import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "@/utils/ai-models";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const supabase = createClient(cookies());
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { topic, modelName } = await req.json();

    if (!topic || !modelName) {
      return NextResponse.json({ error: "Missing topic or modelName" }, { status: 400 });
    }

    // 1. Generate the Course Outline
    const model = getModel(modelName);
    
    const { object: outline } = await generateObject({
      model,
      schema: z.object({
        chapters: z.array(
          z.object({
            title: z.string(),
            description: z.string(),
          })
        ).length(6).describe("List of exactly 6 chapters for this podcast course. One chapter must be about podcast hardware and setup."),
      }),
      prompt: `Create a 6-chapter podcast course outline about "${topic}". The titles should be engaging and the descriptions brief but clear about what will be covered in each chapter. Ensure that one chapter is specifically dedicated to the hardware and setup that is useful for recording podcasts.`,
    });

    // 2. Save the course to the database via Supabase Service Role or User Role
    // Assuming RLS allows insert if user_id matches
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .insert({
        user_id: user.id,
        topic,
        model: modelName,
      })
      .select()
      .single();

    if (courseError || !course) {
      console.error(courseError);
      return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
    }

    // 3. Save the chapters to the database
    const chaptersToInsert = outline.chapters.map((chapter, index) => ({
      course_id: course.id,
      title: chapter.title,
      content: chapter.description, // Temporary placeholder until generated
      type: "podcast",
      order_index: index,
    }));

    const { data: savedChapters, error: chaptersError } = await supabase
      .from("chapters")
      .insert(chaptersToInsert)
      .select();

    if (chaptersError || !savedChapters) {
      console.error(chaptersError);
      return NextResponse.json({ error: "Failed to save chapters" }, { status: 500 });
    }

    return NextResponse.json({ course, chapters: savedChapters });

  } catch (error) {
    console.error("Course Generation Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
