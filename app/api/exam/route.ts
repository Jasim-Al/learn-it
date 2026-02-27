import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const supabase = createClient(cookies());
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId');

    if (!courseId) {
      return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
    }

    const { data: exam, error } = await supabase
      .from('exams')
      .select('*')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !exam) {
      return NextResponse.json({ exam: null }); // Normal case if exam isn't generated yet
    }

    // If score is null, the user hasn't submitted yet. Do not send correct answers.
    if (exam.score === null) {
      exam.questions_json = exam.questions_json.map((q: any) => ({
        question: q.question,
        options: q.options
      }));
    }

    return NextResponse.json({ success: true, exam });
  } catch (error) {
    console.error("Exam Fetch Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = createClient(cookies());
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId');

    if (!courseId) {
      return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
    }

    const { error } = await supabase
      .from('exams')
      .delete()
      .eq('course_id', courseId);

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Failed to delete exam" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Exam Delete Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
