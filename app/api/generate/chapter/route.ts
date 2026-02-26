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

    const wordCount = chapter.order_index === 0 ? "1000 to 1500" : "800 to 1200";
    const result = streamText({
      model,
      prompt: `You are an expert educator. Write a comprehensive, highly detailed learning guide (STRICTLY ${wordCount} words) for the chapter titled "${chapter.title}" which is part of a course teaching someone how to start a podcast about "${topic}". 
      
Here is the focus area for this chapter: ${description}.

FORMATTING EXPLICIT INSTRUCTIONS:
- Do not output a spoken script. Write a structured educational guide.
- Use Markdown formatting with headings (H2, H3), bullet points, and bold text.
- Divide the content into logical sections (e.g., Introduction, Deep Dive, Actionable Steps, Recommended Resources, Conclusion).
- Expand significantly on each concept with examples, case histories, and practical advice.
- Ensure the total length is highly substantial (at least 800 words).
- Frame the advice around creating a podcast specifically about "${topic}".
- Do not mention the word count requirements in your response.`,
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
