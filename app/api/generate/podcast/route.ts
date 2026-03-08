import { createClient } from "@/utils/supabase/server";
import textToSpeech from '@google-cloud/text-to-speech';
import { NextRequest, NextResponse } from "next/server";
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
          const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
          if (!credentialsJson) {
            console.error("Missing GOOGLE_APPLICATION_CREDENTIALS_JSON");
            controller.close();
            return;
          }
          
          let ttsClient: any;
          try {
             // Removing surrounding quotes if any just in case it was wrapped in Vercel UI
             const cleanJson = credentialsJson.replace(/^'|'$/g, '');
             const credentials = JSON.parse(cleanJson);
             ttsClient = new textToSpeech.TextToSpeechClient({ credentials });
          } catch (e) {
             console.error("Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON. Make sure it is a valid JSON string.");
             controller.close();
             return;
          }

          for (let i = 0; i < transcript.dialogue.length; i++) {
              if (req.signal.aborted) {
                  console.log("Client aborted request, stopping TTS generation.");
                  break;
              }

              const segment = transcript.dialogue[i];
              console.log(`Generating TTS for segment ${i+1}/${transcript.dialogue.length} - ${segment.speaker}`);
              
              // Map speaker to a Google Cloud TTS voice
              // Aoede (female) -> en-US-Journey-F
              // Puck (male) -> en-US-Journey-D
              const voiceName = segment.speaker === "Aoede" ? "en-US-Journey-F" : "en-US-Journey-D";
              
              try {
                  const [response] = await ttsClient.synthesizeSpeech({
                      input: { text: segment.text },
                      voice: { languageCode: 'en-US', name: voiceName },
                      audioConfig: {
                          // We stream RAW PCM at 24000Hz as the stream header is manually written above
                          audioEncoding: 'LINEAR16', 
                          sampleRateHertz: 24000
                      }
                  });

                  if (response.audioContent) {
                      let rawPcmBuffer: Uint8Array;
                      if (typeof response.audioContent === 'string') {
                          rawPcmBuffer = Buffer.from(response.audioContent, 'base64');
                      } else if (response.audioContent instanceof Uint8Array) {
                          rawPcmBuffer = response.audioContent;
                      } else {
                          rawPcmBuffer = Buffer.from(response.audioContent as any);
                      }

                      // Trim startup and trailing transients to eliminate click/tick sounds.
                      // Google TTS LINEAR16 often has a brief encoder artifact at the very
                      // start and end of each segment. At 24kHz 16-bit mono:
                      //   800 bytes ≈ 16ms  (front trim — removes startup pop)
                      //   400 bytes ≈  8ms  (back trim  — removes trailing click)
                      const FRONT_TRIM = 800;
                      const BACK_TRIM  = 400;
                      if (rawPcmBuffer.length > FRONT_TRIM + BACK_TRIM) {
                          rawPcmBuffer = rawPcmBuffer.slice(FRONT_TRIM, rawPcmBuffer.length - BACK_TRIM);
                      }

                      try {
                          // 50ms silence before each segment (smooth transition from previous)
                          // 24000 * 0.05 * 2 = 2400 bytes
                          controller.enqueue(new Uint8Array(2400));
                          controller.enqueue(rawPcmBuffer);
                          // 50ms silence after the segment (tail fade-out before next voice)
                          controller.enqueue(new Uint8Array(2400));
                      } catch (e) {
                          console.log("Failed to enqueue to stream (client likely disconnected):", e);
                          break;
                      }
                  } else {
                      console.error(`No audio content returned from Google TTS API for segment ${i+1}`);
                  }
              } catch (ttsError: any) {
                  console.error(`TTS Request Error for segment ${i+1}:`, ttsError.message || ttsError);
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
