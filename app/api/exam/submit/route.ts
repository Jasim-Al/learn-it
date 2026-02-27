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

    const { examId, answers } = await req.json();

    if (!examId || !answers) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Fetch the exam
    const { data: exam, error } = await supabase
      .from('exams')
      .select('*')
      .eq('id', examId)
      .single();

    if (error || !exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    // Check if already submitted
    if (exam.score !== null) {
      return NextResponse.json({ error: "Exam already submitted", exam }, { status: 400 });
    }

    let correctCount = 0;
    const questions = exam.questions_json;
    const totalQuestions = questions.length;

    questions.forEach((q: any, i: number) => {
      if (answers[i] === q.correct_answer) {
        correctCount++;
      }
    });

    const score = Math.round((correctCount / totalQuestions) * 100);

    // Update the exam
    const { data: updatedExam, error: updateError } = await supabase
      .from('exams')
      .update({ score, user_answers: answers })
      .eq('id', examId)
      .select()
      .single();

    if (updateError || !updatedExam) {
      console.error(updateError);
      return NextResponse.json({ error: "Failed to update exam" }, { status: 500 });
    }

    return NextResponse.json({ success: true, exam: updatedExam });
  } catch (error) {
    console.error("Exam Submit Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
