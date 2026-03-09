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
      .select('title, content, order_index, course_id, courses(topic)')
      .eq('id', chapterId)
      .single();

    if (chapterError || !chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    const topic = Array.isArray(chapter.courses) 
      ? chapter.courses[0]?.topic 
      : (chapter.courses as any)?.topic || 'Unknown Topic';
    const description = chapter.content; // Temporarily holds the description

    // Fetch previous chapters to provide context on what has already been taught
    const { data: previousChaptersData } = await supabase
      .from('chapters')
      .select('title')
      .eq('course_id', chapter.course_id)
      .lt('order_index', chapter.order_index)
      .order('order_index', { ascending: true });

    const previousChapters = previousChaptersData ? previousChaptersData.map(c => c.title) : [];
    const previousContext = previousChapters.length > 0
      ? `\nPREVIOUSLY TAUGHT CHAPTERS (The student ONLY knows these concepts):\n${previousChapters.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nCRITICAL RESTRICTION: You MUST NOT use, introduce, or assume knowledge of any advanced concepts, syntax, or tools that have not been explicitly covered in the previous chapters listed above. If you are creating a project or exercise, restrict the solution strictly to the foundational knowledge implied by the previous chapters.`
      : `\nThis is the first chapter. Assume foundational or zero prior knowledge of "${topic}".`;

    // 2. Generate the streaming content
    const model = getModel(modelName);

    const wordCount = chapter.order_index === 0 ? "1200 to 1500" : "1000 to 1400";
    const result = streamText({
      model,
      prompt: `You are an expert educator. Write a comprehensive, highly detailed learning guide (STRICTLY ${wordCount} words) for the chapter titled "${chapter.title}" which is part of a course teaching someone about "${topic}". 
      
Here is the focus area for this chapter: ${description}.
${previousContext}

FORMATTING EXPLICIT INSTRUCTIONS:
- Do not output a spoken script. Write a structured educational guide.
- Use Markdown formatting with headings (H2, H3), bullet points, and bold text.
- Divide the content into logical sections (e.g., Introduction, Deep Dive, Actionable Steps, Conclusion).
- ONLY include a "References" or "Recommended Resources" section if there are highly specific, unique, and new resources relevant strictly to this chapter's exact focus area. Do NOT repeat generic resources that apply to the whole course.
- Expand significantly on each concept with examples, case histories, and practical advice.
- Ensure the total length is highly substantial (at least 800 words).
- Frame the advice around "${topic}".
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
