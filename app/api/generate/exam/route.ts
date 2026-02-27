import { generateObject } from 'ai';
import { z } from 'zod';
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

    // Fetch the course and all chapters
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('topic, chapters(title, content)')
      .eq('id', courseId)
      .single();

    if (courseError || !course || !course.chapters) {
      return NextResponse.json({ error: "Course or chapters not found" }, { status: 404 });
    }

    const chaptersText = course.chapters
      .filter((ch: any) => ch.content && ch.content !== "Generating...")
      .map((ch: any) => `Chapter: ${ch.title}\nContent: ${ch.content.substring(0, 400)}...`) // truncate for token limits
      .join('\n\n');

    const model = getModel(modelName);

    // Generate a 10-question exam based on the entire course
    const { object: examData } = await generateObject({
      model,
      schema: z.object({
        questions: z.array(
          z.object({
            question: z.string(),
            options: z.array(z.string()).length(4).describe("4 possible answers. One must be correct."),
            correct_answer: z.string().describe("The exact text of the correct option."),
          })
        ).length(10).describe("Exactly 10 multiple-choice questions forming a comprehensive exam.")
      }),
      prompt: `Based on the following course summary on "${course.topic}", generate a 10-question comprehensive final exam.\n\nCOURSE CONTENT:\n${chaptersText}`,
    });

    // Cleanup any existing exams first to avoid overlaps
    await supabase.from('exams').delete().eq('course_id', courseId);

    // Save the exam to the database
    const { data: savedExam, error: saveError } = await supabase
      .from('exams')
      .insert({
        course_id: courseId,
        questions_json: examData.questions,
      })
      .select()
      .single();

    if (saveError || !savedExam) {
      console.error(saveError);
      return NextResponse.json({ error: "Failed to save exam" }, { status: 500 });
    }

    // Strip correct_answers from the response sent to the client
    const safeExam = {
      ...savedExam,
      questions_json: savedExam.questions_json.map((q: any) => ({
        question: q.question,
        options: q.options
      }))
    };

    return NextResponse.json({ success: true, exam: safeExam });

  } catch (error) {
    console.error("Exam Generation Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
