"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useCompletion } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function CourseViewer() {
  const { courseId } = useParams();
  const [course, setCourse] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<Record<string, any[]>>({});
  const [exam, setExam] = useState<any>(null);
  const [activeItem, setActiveItem] = useState<{ type: string; id?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingChapters, setGeneratingChapters] = useState<Record<string, boolean>>({});
  const [selectedQuizAnswers, setSelectedQuizAnswers] = useState<Record<string, string>>({});
  const [selectedExamAnswers, setSelectedExamAnswers] = useState<Record<number, string>>({});

  const supabase = createClient();

  useEffect(() => {
    fetchCourseDetails();
  }, [courseId]);

  const fetchCourseDetails = async () => {
    if (!courseId) return;
    setLoading(true);

    const { data: courseData } = await supabase
      .from("courses")
      .select("*")
      .eq("id", courseId)
      .single();

    if (courseData) setCourse(courseData);

    const { data: chaptersData } = await supabase
      .from("chapters")
      .select("*")
      .eq("course_id", courseId)
      .order("order_index", { ascending: true });

    if (chaptersData) {
      setChapters(chaptersData);
      if (chaptersData.length > 0 && !activeItem) {
        setActiveItem({ type: "chapter", id: chaptersData[0].id });
      }
    }

    const { data: examData } = await supabase
      .from("exams")
      .select("*")
      .eq("course_id", courseId)
      .single();

    if (examData) setExam(examData);

    setLoading(false);
  };

  const fetchQuizForChapter = async (chapterId: string) => {
    const { data } = await supabase
      .from("quizzes")
      .select("*")
      .eq("chapter_id", chapterId);
    if (data && data.length > 0) {
      setQuizzes((prev) => ({ ...prev, [chapterId]: data }));
    }
  };

  const generateChapterContent = async (chapter: any) => {
    if (!course) return;
    setGeneratingChapters((prev) => ({ ...prev, [chapter.id]: true }));
    try {
      const res = await fetch("/api/generate/chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId: chapter.id, modelName: course.model }),
      });
      if (res.ok) {
        // Read the stream so the connection stays open until the backend finishes generating
        await res.text();
        await fetchCourseDetails();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingChapters((prev) => ({ ...prev, [chapter.id]: false }));
    }
  };

  const generateQuiz = async (chapterId: string) => {
    const res = await fetch("/api/generate/quiz", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ chapterId, modelName: course?.model }),
    });
    if (res.ok) {
       fetchQuizForChapter(chapterId);
    }
  };

  const generateStudyMaterial = async () => {
    const res = await fetch("/api/generate/study-material", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, modelName: course?.model }),
    });
    if (res.ok) fetchCourseDetails();
  };

  const generateExam = async () => {
    const res = await fetch("/api/generate/exam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, modelName: course?.model }),
    });
    if (res.ok) fetchCourseDetails();
  };

  useEffect(() => {
    if (activeItem?.type === "chapter" && activeItem.id) {
       fetchQuizForChapter(activeItem.id);
       
       const chapter = chapters.find((c) => c.id === activeItem.id);
       if (chapter) {
         // Determine if it's a placeholder based on its length (less than 150 words means it hasn't fully generated)
         const isPlaceholder = !chapter.content || chapter.content === "Generating..." || chapter.content.split(" ").length < 150;
         if (isPlaceholder && !generatingChapters[chapter.id]) {
           generateChapterContent(chapter);
         }
       }
    }
  }, [activeItem, chapters]); // Depends on chapters so it can trigger once data loads and activeItem is set

  if (loading) return <div className="p-12"><Skeleton className="w-full h-[500px]" /></div>;
  if (!course) return <div className="p-12">Course not found.</div>;

  const renderContent = () => {
    if (!activeItem) return null;

    if (activeItem.type === "chapter") {
      const chapter = chapters.find((c) => c.id === activeItem.id);
      if (!chapter) return null;

      const isPlaceholder = !chapter.content || chapter.content === "Generating..." || chapter.content.split(" ").length < 150;

      return (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold dark:text-gray-50">{chapter.title}</h2>
          {isPlaceholder ? (
            <div className="p-6 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-lg flex items-center gap-4">
              <Skeleton className="w-6 h-6 rounded-full shrink-0" />
              <p>Generating learning resources for this chapter...</p>
            </div>
          ) : (
            <>
              <div className="prose dark:prose-invert max-w-none">
                <ReactMarkdown>{chapter.content}</ReactMarkdown>
              </div>
              
              <Separator className="my-8" />
              
              <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-xl border">
                <h3 className="text-xl font-bold mb-4">Chapter Quiz</h3>
                {quizzes[chapter.id] ? (
                  <div className="space-y-4">
                    {quizzes[chapter.id].map((q: any, i: number) => (
                      <Card key={q.id}>
                         <CardHeader><CardTitle className="text-lg">{i + 1}. {q.question}</CardTitle></CardHeader>
                         <CardContent>
                           <ul className="space-y-2">
                             {q.options_json.map((opt: string, j: number) => {
                               const isSelected = selectedQuizAnswers[q.id] === opt;
                               const isCorrect = q.correct_answer === opt;
                               const isSubmitted = !!selectedQuizAnswers[q.id];
                               
                               let optionClass = "p-3 border rounded-lg cursor-pointer transition-colors";
                               
                               if (isSubmitted) {
                                 if (isCorrect) {
                                   optionClass += " bg-green-100 dark:bg-green-900/30 border-green-500 text-green-900 dark:text-green-100 font-medium";
                                 } else if (isSelected && !isCorrect) {
                                   optionClass += " bg-red-100 dark:bg-red-900/30 border-red-500 text-red-900 dark:text-red-100 font-medium";
                                 } else {
                                   optionClass += " bg-white dark:bg-black opacity-50";
                                 }
                               } else {
                                 optionClass += " bg-white dark:bg-black hover:bg-gray-100 dark:hover:bg-gray-800";
                               }

                               return (
                                 <li 
                                   key={j} 
                                   className={optionClass}
                                   onClick={() => {
                                     if (!isSubmitted) {
                                       setSelectedQuizAnswers(prev => ({ ...prev, [q.id]: opt }));
                                     }
                                   }}
                                 >
                                    {opt}
                                 </li>
                               );
                             })}
                           </ul>
                         </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                   <Button onClick={() => generateQuiz(chapter.id)} variant="outline">
                     Generate Quiz for this Chapter
                   </Button>
                )}
              </div>
            </>
          )}
        </div>
      );
    }

    if (activeItem.type === "exam") {
      if (!exam) {
        return (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold mb-4">Final Exam</h2>
            <p className="text-gray-500 mb-6">Test your knowledge on the entire course.</p>
            <Button onClick={generateExam} size="lg">Generate Exam</Button>
          </div>
        );
      }
      return (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold">Comprehensive Final Exam</h2>
          {exam.questions_json.map((q: any, i: number) => (
            <Card key={i}>
                <CardHeader><CardTitle className="text-lg">{i + 1}. {q.question}</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {q.options.map((opt: string, j: number) => {
                      const isSelected = selectedExamAnswers[i] === opt;
                      const isCorrect = q.correct_answer === opt;
                      const isSubmitted = !!selectedExamAnswers[i];
                      
                      let optionClass = "p-3 border rounded-lg cursor-pointer transition-colors";
                      
                      if (isSubmitted) {
                        if (isCorrect) {
                          optionClass += " bg-green-100 dark:bg-green-900/30 border-green-500 text-green-900 dark:text-green-100 font-medium";
                        } else if (isSelected && !isCorrect) {
                          optionClass += " bg-red-100 dark:bg-red-900/30 border-red-500 text-red-900 dark:text-red-100 font-medium";
                        } else {
                          optionClass += " bg-gray-50 dark:bg-gray-900 opacity-50";
                        }
                      } else {
                        optionClass += " bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800";
                      }

                      return (
                        <li 
                          key={j} 
                          className={optionClass}
                          onClick={() => {
                            if (!isSubmitted) {
                              setSelectedExamAnswers(prev => ({ ...prev, [i]: opt }));
                            }
                          }}
                        >
                            {opt}
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    return null;
  };

  const podcastChapters = chapters.filter(c => c.type === "podcast");
  const studyMaterial = chapters.find(c => c.type === "study_material");

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-white dark:bg-black font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-80 border-r dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-6 flex flex-col gap-6 overflow-y-auto hidden md:flex">
        <div>
          <h1 className="text-xl font-bold leading-tight">{course.topic}</h1>
          <p className="text-sm text-gray-500 mt-1 uppercase tracking-wider font-semibold">Course Navigation</p>
        </div>
        
        <nav className="space-y-6 flex-1">
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-3 px-2">CHAPTERS</h3>
            <ul className="space-y-1">
              {podcastChapters.map((ch, i) => (
                <li key={ch.id}>
                  <button
                    onClick={() => setActiveItem({ type: "chapter", id: ch.id })}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm ${
                      activeItem?.id === ch.id 
                        ? "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 font-medium" 
                        : "hover:bg-gray-200 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {i + 1}. {ch.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-3 px-2">RESOURCES</h3>
            <ul className="space-y-1">
               <li>
                  <button
                    onClick={() => {
                      if (studyMaterial) {
                        setActiveItem({ type: "chapter", id: studyMaterial.id });
                      } else {
                        generateStudyMaterial();
                      }
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm ${
                      activeItem?.id === studyMaterial?.id && studyMaterial
                        ? "bg-purple-100 text-purple-900 dark:bg-purple-900/30 dark:text-purple-100 font-medium" 
                        : "hover:bg-gray-200 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    Study Material {studyMaterial ? "" : "(Generate)"}
                  </button>
               </li>
               <li>
                  <button
                    onClick={() => setActiveItem({ type: "exam" })}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm ${
                      activeItem?.type === "exam"
                        ? "bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100 font-medium" 
                        : "hover:bg-gray-200 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    Final Exam {exam ? "" : "(Generate)"}
                  </button>
               </li>
            </ul>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 sm:p-12 overflow-y-auto bg-white dark:bg-black h-screen">
        <div className="max-w-4xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
