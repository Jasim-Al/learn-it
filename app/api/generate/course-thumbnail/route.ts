import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { generateImage } from "ai";
import { google } from "@ai-sdk/google";

export async function POST(req: Request) {
  console.log("Received request to generate course thumbnail");
  try {
    const supabase = createClient(cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { courseId } = await req.json();

    if (!courseId) {
      return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
    }

    // 1. Fetch course topic
    const { data: course, error: courseError } = await supabase.from("courses").select("topic").eq("id", courseId).single();

    if (courseError || !course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // 2. Generate image using Vercel AI with Google
    console.log("Generating thumbnail for course:", courseId, "topic:", course.topic);

    const imagePrompt = `Create a visually stunning, premium-quality course thumbnail for a course about "${course.topic}". 
Style: Cinematic, professional, and evocative. 
It should be a high-impact, abstract or conceptual visualization that captures the essence of the topic.
Wide 4:3 aspect ratio. No text, no letters, no words. Use a sophisticated color palette.
Focus on visual excellence and premium aesthetics.`;

    let response;
    try {
      response = await generateImage({
        model: google.imageModel("gemini-3.1-flash-image-preview"),
        prompt: imagePrompt,
        aspectRatio: "4:3",
      });
    } catch (err: {
      stack?: string;
    }) {
      console.error("generateImage threw error:", err && err?.stack ? err.stack : err);
      return NextResponse.json({ error: "Image generation failed", details: String(err) }, { status: 500 });
    }

    // Extract image data from response.images[0]
    if (!response || !response.images || !Array.isArray(response.images) || !response.images[0]) {
      console.error("No valid image data in response", response);
      return NextResponse.json({ error: "No valid image data in response" }, { status: 500 });
    }

    let imageBuffer;
    try {
      const image = response.images[0];
      imageBuffer = Buffer.from(image.uint8Array);
    } catch (err: {
      stack?: string;
    }) {
      console.error("Image buffer conversion error:", err && err?.stack ? err.stack : err, response);
      return NextResponse.json({ error: "Image buffer conversion failed", details: String(err) }, { status: 500 });
    }

    // 4. Upload to Supabase Storage
    const filePath = `${courseId}.png`;
    console.log("Uploading thumbnail to Supabase Storage at path:", filePath);

    const { error: uploadError } = await supabase.storage.from("course-thumbnails").upload(filePath, imageBuffer, {
      contentType: "image/png",
      upsert: true,
    });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
    }

    // 5. Get public URL and update the course record
    const {
      data: { publicUrl },
    } = supabase.storage.from("course-thumbnails").getPublicUrl(filePath);

    const { error: updateError } = await supabase.from("courses").update({ thumbnail_url: publicUrl }).eq("id", courseId);

    if (updateError) {
      console.error("Course update error:", updateError);
      return NextResponse.json({ error: "Failed to update course" }, { status: 500 });
    }

    console.log("Successfully generated and saved thumbnail for course:", courseId);
    return NextResponse.json({ imageUrl: publicUrl });
  } catch (error) {
    console.error("Course Thumbnail Generation Error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: String(error) }, { status: 500 });
  }
}
