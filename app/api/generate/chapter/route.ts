import { streamText } from 'ai';
import { getModel } from '@/utils/ai-models';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const supabase = createClient(cookies());
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { chapterId, modelName } = await req.json();

    if (!chapterId || !modelName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Fetch Chapter and Course contexts
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('title, content, order_index, courses(topic)')
      .eq('id', chapterId)
      .single();

    if (chapterError || !chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    const topic = Array.isArray(chapter.courses) 
      ? chapter.courses[0]?.topic 
      : (chapter.courses as any)?.topic || 'Unknown Topic';
    const description = chapter.content; // Temporarily holds the description

    // 2. Generate the streaming content
    const model = getModel(modelName);

    const wordCount = chapter.order_index === 0 ? "1500-2000" : "500-800";
    const result = streamText({
      model,
      prompt: `Write a detailed podcast script (around ${wordCount} words) for the chapter titled "${chapter.title}" which is part of a course on "${topic}". 
      Here is a brief description of what this chapter should cover: ${description}.
      Format the content in Markdown. Make the tone engaging, educational, and suitable for listening. Include a brief intro and outro.`,
      onFinish: async ({ text }) => {
        // 3. Save the generated text back to the database as content
        await supabase
          .from('chapters')
          .update({ content: text })
          .eq('id', chapterId);
      }
    });

    return result.toTextStreamResponse();

  } catch (error) {
    console.error("Chapter Generation Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
