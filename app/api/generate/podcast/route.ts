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

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const chapterId = url.searchParams.get("chapterId");
    const modelName = url.searchParams.get("modelName");

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

    const isFirstChapter = chapter.order_index === 0 || chapter.order_index === 1;

    // 2. Stream Audio chunks
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Immediately send WAV header to keep connection alive and prepare Audio element
          const sampleRate = 24000;
          const numChannels = 1;
          const header = Buffer.alloc(44);
          
          header.write('RIFF', 0);
          header.writeUInt32LE(0xFFFFFFFF, 4); // Unknown overall size
          header.write('WAVE', 8);
          header.write('fmt ', 12);
          header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
          header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
          header.writeUInt16LE(numChannels, 22); // NumChannels
          header.writeUInt32LE(sampleRate, 24); // SampleRate
          header.writeUInt32LE(sampleRate * numChannels * 2, 28); // ByteRate
          header.writeUInt16LE(numChannels * 2, 32); // BlockAlign
          header.writeUInt16LE(16, 34); // BitsPerSample
          header.write('data', 36);
          header.writeUInt32LE(0xFFFFFFFF, 40); // Unknown data size
          
          controller.enqueue(new Uint8Array(header));

          // 3. Generate Transcript
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

          // 4. Generate TTS for each piece and stream the raw PCM chunk
          const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
          
          for (let i = 0; i < transcript.dialogue.length; i++) {
              if (req.signal.aborted) {
                  console.log("Client aborted request, stopping TTS generation.");
                  break;
              }

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

                  // Extract Audio PCM Data
                  const part = response.candidates?.[0]?.content?.parts?.[0];
                  if (part && part.inlineData && part.inlineData.data) {
                      const rawPcmBuffer = Buffer.from(part.inlineData.data, 'base64');
                      
                      try {
                          controller.enqueue(new Uint8Array(rawPcmBuffer));
                      } catch (e) {
                          console.log("Failed to enqueue to stream (client likely disconnected):", e);
                          break;
                      }
                  } else {
                      console.error(`No audio inlineData returned from Gemini API for segment ${i+1}`);
                  }
              } catch (ttsError: any) {
                  console.error(`TTS API Error for segment ${i+1}:`, ttsError.message || ttsError);
                  // Break on Quota errors or other API errors so we still return what was generated
                  break; 
              }
          }
          
          try {
             controller.close();
          } catch (e) {
             // Ignore if already closed
          }
        } catch (error: any) {
          console.error("Stream generation failed:", error);
          try {
             controller.error(error);
          } catch (e) {
             // Ignore if already closed
          }
        }
      }
    });

    return new NextResponse(stream as any, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error: any) {
    console.error("Error preparing podcast stream:", error);
    return NextResponse.json(
      { error: "Failed to prepare podcast", details: error.message },
      { status: 500 }
    );
  }
}
