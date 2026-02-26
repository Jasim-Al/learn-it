"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export function HomeClient() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState("");
  const [modelName, setModelName] = useState("gemini-2.5-flash");
  const [isGenerating, setIsGenerating] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const fetchCourses = async () => {
    setLoading(true);
    if (!user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("courses")
      .select("*")
      .order("created_at", { ascending: false });
      
    if (data) setCourses(data);
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleCreate = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);

    try {
      const res = await fetch("/api/generate/course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, modelName }),
      });

      if (!res.ok) {
        throw new Error("Failed to create course");
      }

      const data = await res.json();
      setTopic("");
      await fetchCourses();
      router.push(`/course/${data.course.id}`);

    } catch (error) {
      console.error(error);
      alert("An error occurred while creating the course.");
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (!authLoading && user) {
        await fetchCourses();
      } else if (!authLoading && !user) {
        setLoading(false);
      }
    };
    
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 sm:p-12 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Podcast Courses</h1>
            <p className="text-zinc-500 mt-2 text-lg">Generate AI-powered podcast courses on any topic.</p>
          </div>
          <div className="flex items-center gap-3">
             <Button variant="outline" onClick={handleSignOut}>Sign Out</Button>
          </div>
        </header>

        <section className="mb-12">
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold">Create a New Course</CardTitle>
              <CardDescription className="text-base">What topic do you want to learn about?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Textarea 
                placeholder="e.g. The history of quantum mechanics, or beginner's guide to investing..."
                className="min-h-[120px] text-lg p-4 resize-y bg-zinc-50 dark:bg-zinc-950/50"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex flex-col gap-3">
                  <Label className="text-sm font-medium text-zinc-500">AI Model</Label>
                  <RadioGroup 
                    value={modelName} 
                    onValueChange={setModelName} 
                    className="flex flex-col sm:flex-row gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="gemini-2.5-flash" id="home-m-flash" />
                      <Label htmlFor="home-m-flash" className="cursor-pointer">Gemini 2.5 Flash</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="gpt-4o-mini" id="home-m-openai" />
                      <Label htmlFor="home-m-openai" className="cursor-pointer">GPT-4o Mini</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto font-semibold px-8"
                  onClick={handleCreate}
                  disabled={isGenerating || !topic.trim()}
                >
                  {isGenerating ? "Generating..." : "Generate Course"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40 w-full rounded-xl" />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm mt-8">
              <h3 className="text-xl font-medium text-zinc-900 dark:text-zinc-100">No courses yet</h3>
              <p className="text-zinc-500 mt-2">Create your first course to get started.</p>
            </div>
          ) : (
            <div>
              <h2 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-zinc-50">Your Existing Courses</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {courses.map((course) => (
                  <Link href={`/course/${course.id}`} key={course.id} className="block group">
                    <Card className="h-full transition-all hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                      <CardHeader>
                        <CardTitle className="line-clamp-2 text-xl group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {course.topic}
                        </CardTitle>
                        <CardDescription>
                          Using {course.model}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-zinc-500 mt-4">
                          Created {new Date(course.created_at).toLocaleDateString()}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
