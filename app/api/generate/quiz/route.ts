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

    const { chapterId, modelName } = await req.json();

    if (!chapterId || !modelName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Fetch the chapter content
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('title, content')
      .eq('id', chapterId)
      .single();

    if (chapterError || !chapter || !chapter.content) {
      return NextResponse.json({ error: "Chapter not found or content is empty" }, { status: 404 });
    }

    const model = getModel(modelName);

    // Generate a 5-question quiz based on the chapter content
    const { object: quizData } = await generateObject({
      model,
      schema: z.object({
        questions: z.array(
          z.object({
            question: z.string(),
            options: z.array(z.string()).length(4).describe("4 possible answers. One must be correct."),
            correct_answer: z.string().describe("The exact text of the correct option."),
          })
        ).length(5).describe("Exactly 5 multiple-choice questions based on the chapter text."),
      }),
      prompt: `Based on the following chapter text titled "${chapter.title}", generate a 5-question multiple-choice quiz testing the listener's understanding of the key concepts.\n\nCHAPTER TEXT:\n${chapter.content}`,
    });

    // Save questions to the database
    const questionsToInsert = quizData.questions.map((q) => ({
      chapter_id: chapterId,
      question: q.question,
      options_json: q.options,
      correct_answer: q.correct_answer,
    }));

    const { data: savedQuizzes, error: saveError } = await supabase
      .from('quizzes')
      .insert(questionsToInsert)
      .select();

    if (saveError || !savedQuizzes) {
      console.error(saveError);
      return NextResponse.json({ error: "Failed to save quizzes" }, { status: 500 });
    }

    return NextResponse.json({ success: true, quizzes: savedQuizzes });

  } catch (error) {
    console.error("Quiz Generation Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
