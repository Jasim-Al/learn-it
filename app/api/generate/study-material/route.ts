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

    const { courseId, modelName } = await req.json();

    if (!courseId || !modelName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Fetch Course and its Chapters
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('topic, chapters(title, content)')
      .eq('id', courseId)
      .single();

    if (courseError || !course || !course.chapters) {
      return NextResponse.json({ error: "Course or chapters not found" }, { status: 404 });
    }

    // Prepare chapters context
    const chaptersText = course.chapters
      .map((ch: any) => `Chapter: ${ch.title}\nContent Summary: ${ch.content?.substring(0, 500)}...`)
      .join('\n\n');

    // 2. Create the Study Material Chapter in the DB first so we can stream into it
    // Wait, since we are streaming it back, let's create a placeholder chapter if it doesn't exist.
    
    // Check if study material already exists
    let { data: studyChapter } = await supabase
      .from('chapters')
      .select('id')
      .eq('course_id', courseId)
      .eq('type', 'study_material')
      .single();

    if (!studyChapter) {
      // Create it
      const { data: newCh, error: newChErr } = await supabase
        .from('chapters')
        .insert({
          course_id: courseId,
          title: "Comprehensive Study Material",
          content: "Generating...",
          type: "study_material",
          order_index: 999, // put it at the end
        })
        .select()
        .single();
        
      if (newChErr || !newCh) {
         return NextResponse.json({ error: "Failed to create study chapter" }, { status: 500 });
      }
      studyChapter = newCh;
    }

    // 3. Generate the streaming content
    const model = getModel(modelName);
    if (!studyChapter) {
      return NextResponse.json({ error: "Failed to resolve study chapter" }, { status: 500 });
    }
    const chapterId = studyChapter.id;

    const result = streamText({
      model,
      prompt: `You are an expert educator. Create comprehensive Study Material for a course on "${course.topic}".
      Here are the chapters covered in this course:\n${chaptersText}\n
      Synthesize this into a cohesive, easy-to-read study guide formatted in Markdown. Include key takeaways, definitions of important terms, and a brief summary of each core concept.`,
      onFinish: async ({ text }) => {
        // Save the generated text back to the database as content
        await supabase
          .from('chapters')
          .update({ content: text })
          .eq('id', chapterId);
      }
    });

    return result.toTextStreamResponse();

  } catch (error) {
    console.error("Study Material Generation Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
