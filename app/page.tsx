"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { CreateCourseModal } from "@/components/CreateCourseModal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function Home() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
    // AuthProvider will catch the state change and redirect automatically
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchCourses();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
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
             <CreateCourseModal onCourseCreated={fetchCourses} />
             <Button variant="outline" onClick={handleSignOut}>Sign Out</Button>
          </div>
        </header>

        <section>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40 w-full rounded-xl" />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <h3 className="text-xl font-medium text-zinc-900 dark:text-zinc-100">No courses yet</h3>
              <p className="text-zinc-500 mt-2">Create your first course to get started.</p>
            </div>
          ) : (
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
          )}
        </section>
      </div>
    </div>
  );
}
