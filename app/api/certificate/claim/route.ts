import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { examId, studentName } = body;

    if (!examId || !studentName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Fetch the exam without user_id since exams table only has course_id
    const { data: exam, error: examError } = await supabase
      .from("exams")
      .select("id, course_id, score")
      .eq("id", examId)
      .single();

    if (examError || !exam) {
      if (examError && examError.code !== 'PGRST116') {
        return NextResponse.json({ error: "Database error fetching exam" }, { status: 500 });
      }
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    // Verify ownership via the associated course
    const { data: course } = await supabase
      .from("courses")
      .select("user_id")
      .eq("id", exam.course_id)
      .single();

    if (!course || course.user_id !== user.id) {
       return NextResponse.json({ error: "Unauthorized access to exam" }, { status: 403 });
    }

    let examData = exam;

    if (examData.score === null || examData.score < 60) {
      return NextResponse.json({ error: "Exam score is insufficient for certificate" }, { status: 400 });
    }

    // 2. Check if a certificate already exists for this exam
    const { data: existingCert } = await supabase
      .from("certificates")
      .select("id, student_name")
      .eq("exam_id", examId)
      .single();

    if (existingCert) {
      // If a cert exists, check if the name matches the requested name. If not, maybe update it?
      // Since certificates are usually immutable once issued, we'll just return the existing ID and name.
      return NextResponse.json({ 
        certificateId: existingCert.id,
        studentName: existingCert.student_name 
      });
    }

    // 3. Insert the new certificate
    const { data: newCert, error: insertError } = await supabase
      .from("certificates")
      .insert({
        user_id: user.id,
        course_id: examData.course_id,
        exam_id: examId,
        student_name: studentName,
        score: examData.score
      })
      .select("id")
      .single();

    if (insertError) {
      console.error(insertError);
      return NextResponse.json({ error: "Failed to generate certificate record" }, { status: 500 });
    }

    return NextResponse.json({ certificateId: newCert.id });

  } catch (error: any) {
    console.error("Error creating certificate:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
