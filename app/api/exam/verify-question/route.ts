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

    const { examId, questionIndex, selectedOption } = await req.json();

    if (!examId || typeof questionIndex !== 'number' || !selectedOption) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data: exam, error } = await supabase
      .from('exams')
      .select('*')
      .eq('id', examId)
      .single();

    if (error || !exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    if (exam.score !== null) {
       return NextResponse.json({ error: "Exam already finalized" }, { status: 400 });
    }

    const question = exam.questions_json[questionIndex];

    if (!question) {
       return NextResponse.json({ error: "Invalid question index" }, { status: 400 });
    }

    const isCorrect = question.correct_answer === selectedOption;

    return NextResponse.json({
      success: true,
      isCorrect,
      correct_answer: question.correct_answer,
    });
  } catch (error) {
    console.error("Verify Question Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
