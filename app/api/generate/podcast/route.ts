import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { generateObject } from "ai";
import { z } from "zod";
import { cookies } from "next/headers";
import { getModel } from "@/utils/ai-models";

// Helper function to wrap raw PCM audio in a valid WAV header
function pcmToWav(pcmData: Buffer, sampleRate: number = 24000, numChannels: number = 1): Buffer {
    const header = Buffer.alloc(44);
    
    // RIFF chunk descriptor
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcmData.length, 4);
    header.write('WAVE', 8);
    
    // "fmt " subchunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
    header.writeUInt16LE(numChannels, 22); // NumChannels
    header.writeUInt32LE(sampleRate, 24); // SampleRate
    header.writeUInt32LE(sampleRate * numChannels * 2, 28); // ByteRate
    header.writeUInt16LE(numChannels * 2, 32); // BlockAlign
    header.writeUInt16LE(16, 34); // BitsPerSample
    
    // "data" subchunk
    header.write('data', 36);
    header.writeUInt32LE(pcmData.length, 40);
    
    return Buffer.concat([header, pcmData]);
}

export async function POST(req: NextRequest) {
  try {
    const { chapterId, modelName } = await req.json();

    if (!chapterId) {
      return NextResponse.json({ error: "Missing chapterId" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore as any);

    // 1. Fetch chapter content
    const { data: chapter, error: chapterError } = await supabase
      .from("chapters")
      .select("*, course:courses(topic)")
      .eq("id", chapterId)
      .single();

    if (chapterError || !chapter) {
      console.error("Error fetching chapter:", chapterError);
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    if (!chapter.content || chapter.content.trim() === "" || chapter.content === "Generating...") {
       return NextResponse.json({ error: "Chapter content is not yet generated." }, { status: 400 });
    }

    const modelToUse = modelName || "gemini-2.5-flash"; // Default to flash if not provided
    const model = getModel(modelToUse);

    // 2. Generate Podcast Transcript using the chosen LLM
    const isFirstChapter = chapter.order_index === 0 || chapter.order_index === 1;

    const systemPrompt = `You are a podcast producer creating a 2-person educational conversation about the following chapter titled "${chapter.title}" from a course about "${chapter.course?.topic}".

Host 1 is Aoede (female). She is the expert host who explains the core concepts clearly and energetically.
Host 2 is Puck (male). He is the curious co-host who asks relatable questions, asks for clarifications, and reacts to the explanations.

${isFirstChapter 
  ? "CRITICAL: This is the VERY FIRST chapter of the new course. Do NOT use phrases like 'Welcome back', 'As we discussed previously', or 'Another episode'. Start by warmly welcoming the listener to the new course, briefly introducing the overarching topic, and then diving right into the chapter." 
  : "You can naturally welcome the listener back as they continue their journey through the course."}

Make the conversation natural, engaging, and educational. Speak as if you are directly addressing the listener. Do not use excessive filler words. Break down complex points simply and summarize the key takeaways at the end. Keep your entire dialogue suitable for a 3-5 minute audio segment. Do NOT include stage directions, markdown, or any text that should not ideally be read aloud. 

Here is the chapter content to discuss:
${chapter.content.substring(0, 3000)}`;

    const { object: transcript } = await generateObject({
      model: model,
      system: "You are an expert podcast scriptwriter.",
      prompt: systemPrompt,
      temperature: 0.7,
      schema: z.object({
        dialogue: z.array(z.object({
          speaker: z.enum(["Aoede", "Puck"]),
          text: z.string().describe("The exact text to be spoken by this host, without any acting directions or markdown.")
        }))
      })
    });

    console.log(`Generated Transcript with ${transcript.dialogue.length} segments.`);

    // Initialize the official Google Gen AI Client for TTS
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
    const audioPcmBuffers: Buffer[] = [];

    // 3. Generate Audio String using the Gemini TTS model for each dialogue segment
    for (let i = 0; i < transcript.dialogue.length; i++) {
        const segment = transcript.dialogue[i];
        console.log(`Generating TTS for segment ${i+1}/${transcript.dialogue.length} - ${segment.speaker}`);
        
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-tts',
                contents: segment.text, // Pass ONLY the generated transcript to be spoken
                config: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: segment.speaker, // "Aoede" or "Puck"
                            }
                        }
                    }
                }
            });

            // Extract Audio
            const part = response.candidates?.[0]?.content?.parts?.[0];
            
            if (part && part.inlineData && part.inlineData.data) {
                // The inlineData.data is a base64 encoded string of the raw PCM audio
                const rawPcmBuffer = Buffer.from(part.inlineData.data, 'base64');
                audioPcmBuffers.push(rawPcmBuffer);
            } else {
                throw new Error("No audio inlineData returned from Gemini API");
            }
        } catch (err: any) {
            console.error(`TTS generation failed for segment ${i+1}: ${err.message}`);
            // If one segment fails, we can either throw or ignore. Let's throw for now.
            throw err;
        }
    }

    if (audioPcmBuffers.length === 0) {
        throw new Error("No audio was generated.");
    }

    // 4. Combine all PCM buffers and wrap with a WAV header
    const combinedPcmBuffer = Buffer.concat(audioPcmBuffers);
    const finalWavBuffer = pcmToWav(combinedPcmBuffer, 24000, 1);

    // 5. Return Audio as a response
    return new NextResponse(finalWavBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Disposition': `attachment; filename="podcast-${chapterId}.wav"`
      }
    });

  } catch (error: any) {
    console.error("Error generating podcast:", error);
    return NextResponse.json(
      { error: "Failed to generate podcast", details: error.message },
      { status: 500 }
    );
  }
}
