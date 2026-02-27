"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AnimatedBackground } from "@/components/ui/animated-background";
import { GlassCard } from "@/components/ui/glass-card";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, BookOpen, CheckCircle2, Circle, FileText, GraduationCap, Layout, PlayCircle, Loader2, Download, X } from "lucide-react";
import Link from "next/link";
// @ts-ignore
import domtoimage from "dom-to-image-more";
import jsPDF from "jspdf";

export default function CourseViewer() {
  const { courseId } = useParams();
  const [course, setCourse] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<Record<string, any[]>>({});
  const [exam, setExam] = useState<any>(null);
  const [activeItem, setActiveItem] = useState<{ type: string; id?: string } | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generatingChapters, setGeneratingChapters] = useState<Record<string, boolean>>({});
  const [loadingExam, setLoadingExam] = useState(false);
  const [generatingExam, setGeneratingExam] = useState(false);
  const [submittingExam, setSubmittingExam] = useState(false);
  const [retakingExam, setRetakingExam] = useState(false);
  const [selectedQuizAnswers, setSelectedQuizAnswers] = useState<Record<string, string>>({});
  const [selectedExamAnswers, setSelectedExamAnswers] = useState<Record<number, string>>({});
  const [validatedAnswers, setValidatedAnswers] = useState<Record<number, { isCorrect: boolean, correctAnswer: string }>>({});
  const [validatingQuestion, setValidatingQuestion] = useState<Record<number, boolean>>({});
  const [chapterErrors, setChapterErrors] = useState<Record<string, string>>({});
  const [isGeneratingCert, setIsGeneratingCert] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [certificateId, setCertificateId] = useState("");
  const certificateRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchCourseDetails();
    fetchUser();
  }, [courseId]);

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

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

    setLoading(false);
  };

  const fetchExamData = async (silent = false) => {
    if (!courseId) return;
    if (!silent) setLoadingExam(true);
    
    try {
      const examRes = await fetch(`/api/exam?courseId=${courseId}`);
      if (examRes.ok) {
        const { exam } = await examRes.json();
        if (exam) {
          setExam(exam);
          const safeUserAnswers = exam.user_answers || {};
          setSelectedExamAnswers(safeUserAnswers);
          
          if (exam.score !== null && safeUserAnswers && Object.keys(safeUserAnswers).length > 0) {
             const rehydratedValidated: Record<number, { isCorrect: boolean, correctAnswer: string }> = {};
             // Use empty array if questions_json is missing to be extra safe
             const questions = exam.questions_json || []; 
             questions.forEach((q: any, i: number) => {
                rehydratedValidated[i] = {
                   isCorrect: safeUserAnswers[i] === q.correct_answer,
                   correctAnswer: q.correct_answer
                };
             });
             setValidatedAnswers(rehydratedValidated);
          } else {
             setValidatedAnswers({});
             setSelectedExamAnswers({});
             setValidatingQuestion({});
          }
        } else {
          setExam(null);
        }
      }
    } catch (e) {
      console.error("Error fetching exam:", e);
    } finally {
      if (!silent) setLoadingExam(false);
    }
  };

  useEffect(() => {
    console.log("EXAM STATE TICK:", {
      exam,
      selectedExamAnswers,
      validatedAnswers,
      validatingQuestion
    });
  }, [exam, selectedExamAnswers, validatedAnswers]);

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
    setChapterErrors((prev) => ({ ...prev, [chapter.id]: "" }));
    try {
      const res = await fetch("/api/generate/chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId: chapter.id, modelName: course.model }),
      });
      if (res.ok) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let aggregatedText = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            aggregatedText += chunk;
            
            setChapters((prev) => prev.map((c) => 
               c.id === chapter.id ? { ...c, content: aggregatedText } : c
            ));
          }
        }
        await fetchCourseDetails();
      } else {
        setChapterErrors((prev) => ({ ...prev, [chapter.id]: "Generation failed. Please try again in a few moments." }));
      }
    } catch (e) {
      console.error(e);
      setChapterErrors((prev) => ({ ...prev, [chapter.id]: "An error occurred. Please check your connection and try again." }));
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
    setGeneratingExam(true);
    try {
      const res = await fetch("/api/generate/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, modelName: course?.model }),
      });
      if (res.ok) await fetchExamData(true);
    } finally {
      setGeneratingExam(false);
    }
  };

  const verifyQuestion = async (questionIndex: number, selectedOption: string) => {
    if (validatingQuestion[questionIndex] || validatedAnswers[questionIndex]) return;
    
    // Optimistic UI update to show it's selected while loading
    setSelectedExamAnswers(prev => ({ ...prev, [questionIndex]: selectedOption }));
    setValidatingQuestion(prev => ({ ...prev, [questionIndex]: true }));

    try {
      const res = await fetch("/api/exam/verify-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId: exam.id, questionIndex, selectedOption })
      });
      
      if (res.ok) {
         const data = await res.json();
         setValidatedAnswers(prev => ({
           ...prev,
           [questionIndex]: { isCorrect: data.isCorrect, correctAnswer: data.correct_answer }
         }));
      }
    } catch (e) {
      console.error(e);
      // Revert selection on error
      setSelectedExamAnswers(prev => {
         const newAnswers = { ...prev };
         delete newAnswers[questionIndex];
         return newAnswers;
      });
    } finally {
      setValidatingQuestion(prev => ({ ...prev, [questionIndex]: false }));
    }
  };

  const submitExam = async () => {
    if (!exam || Object.keys(validatedAnswers).length < exam.questions_json.length) return;
    setSubmittingExam(true);
    try {
      const res = await fetch("/api/exam/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId: exam.id, answers: selectedExamAnswers }),
      });
      if (res.ok) await fetchExamData(true);
    } finally {
      setSubmittingExam(false);
    }
  };

  // Auto-submit when all 10 are answered and validated
  useEffect(() => {
    if (exam && !exam.score && Object.keys(validatedAnswers).length === exam.questions_json.length) {
      if (!submittingExam) submitExam();
    }
  }, [validatedAnswers]);

  const retakeExam = async () => {
    setRetakingExam(true);
    try {
      const res = await fetch(`/api/exam?courseId=${courseId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setExam(null);
        setSelectedExamAnswers({});
        setValidatedAnswers({});
        setValidatingQuestion({});
      }
    } finally {
      setRetakingExam(false);
    }
  };

  const handleClaimClick = () => {
    setStudentName(user?.user_metadata?.full_name || user?.email || "");
    setIsClaimModalOpen(true);
  };

  const generateCertificate = async () => {
    if (!certificateRef.current || !studentName.trim() || !exam?.id) return;
    setIsGeneratingCert(true);
    try {
      // 1. Claim the certificate in the database
      const res = await fetch('/api/certificate/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          examId: exam.id,
          studentName: studentName.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.studentName) {
        setStudentName(data.studentName);
      }
      setCertificateId(data.certificateId);

      // Small timeout to ensure fonts, layout, and new ID are completely settled in the DOM
      await new Promise(r => setTimeout(r, 200));
      
      const scale = 2; // High resolution scale factor
      const imgData = await domtoimage.toPng(certificateRef.current, {
        bgcolor: '#ffffff',
        width: 960 * scale,
        height: 680 * scale,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: '960px',
          height: '680px'
        }
      });
      
      // Certificate dimensions from CSS: w-[960px] h-[680px]
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [960, 680]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, 960, 680);
      pdf.save(`${course?.topic || 'Course'}-Certificate.pdf`);
      
      setIsClaimModalOpen(false);
    } catch (error) {
      console.error('Error generating certificate:', error);
    } finally {
      setIsGeneratingCert(false);
    }
  };

  useEffect(() => {
    if (activeItem?.type === "chapter" && activeItem.id) {
       fetchQuizForChapter(activeItem.id);
       
       const chapter = chapters.find((c) => c.id === activeItem.id);
       if (chapter) {
         const isPlaceholder = !chapter.content || chapter.content === "Generating..." || chapter.content.split(" ").length < 150;
         if (isPlaceholder && !generatingChapters[chapter.id] && !chapterErrors[chapter.id]) {
           generateChapterContent(chapter);
         }
       }
    }
  }, [activeItem, chapters, generatingChapters, chapterErrors]);

  // Automatically fetch exam data when the exam tab is selected
  useEffect(() => {
     if (activeItem?.type === "exam" && !exam && !loadingExam) {
        fetchExamData();
     }
  }, [activeItem, courseId]);

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-6">
        <AnimatedBackground />
        <GlassCard padding="lg" className="w-full max-w-md animate-pulse">
           <div className="flex flex-col items-center gap-6">
              <div className="w-16 h-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="w-3/4 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
              <div className="w-1/2 h-4 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
           </div>
        </GlassCard>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-6">
        <AnimatedBackground />
        <GlassCard padding="lg" className="text-center">
          <h2 className="text-2xl font-bold mb-4">Course Not Found</h2>
          <Button asChild variant="outline">
            <Link href="/">Return Home</Link>
          </Button>
        </GlassCard>
      </div>
    );
  }

  const renderContent = () => {
    if (!activeItem) return null;

    if (activeItem.type === "chapter") {
      const chapter = chapters.find((c) => c.id === activeItem.id);
      if (!chapter) return null;

      const isGenerating = generatingChapters[chapter.id];
      const hasContent = chapter.content && chapter.content !== "Generating..." && chapter.content.split(" ").length > 10;
      const showPlaceholder = !isGenerating && !hasContent && !chapterErrors[chapter.id];

      return (
        <motion.div 
          key={chapter.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          <div className="flex items-center gap-4 mb-2">
            <div className={`p-3 rounded-2xl ${chapter.type === 'podcast' ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400' : 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400'}`}>
               {chapter.type === 'podcast' ? <PlayCircle className="w-8 h-8" /> : <BookOpen className="w-8 h-8" />}
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {chapter.type === 'podcast' ? 'Podcast Lesson' : 'Study Guide'}
              </p>
              <h2 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">{chapter.title}</h2>
            </div>
          </div>

          {chapterErrors[chapter.id] ? (
            <GlassCard variant="highlight" className="flex flex-col items-center justify-center gap-4 p-8 border-dashed border-2 border-red-500/30 dark:border-red-500/20 bg-red-50/50 dark:bg-red-950/10">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-lg font-medium text-red-800 dark:text-red-300 text-center">{chapterErrors[chapter.id]}</p>
              <Button onClick={() => generateChapterContent(chapter)} variant="outline" className="mt-2 border-red-200 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-900/20 text-red-700 dark:text-red-300">
                Try Again
              </Button>
            </GlassCard>
          ) : showPlaceholder ? (
            <GlassCard variant="highlight" className="flex items-center gap-4 p-8 border-dashed border-2">
              <div className="w-8 h-8 rounded-full border-4 border-orange-500 border-t-transparent animate-spin shrink-0" />
              <p className="text-lg font-medium text-zinc-600 dark:text-zinc-400">Synthesizing learning materials...</p>
            </GlassCard>
          ) : (
            <>
              <div className={`relative transition-all duration-300 ${isGenerating ? 'p-[2px] rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(249,115,22,0.3)]' : ''}`}>
                {isGenerating && (
                  <div className="absolute -inset-full animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,transparent_70%,#f97316_95%,#ffffff_100%)] opacity-80" />
                )}
                <GlassCard 
                  padding="lg" 
                  className={`relative z-10 w-full h-full prose prose-zinc dark:prose-invert max-w-none transition-all duration-300 border-white/20 dark:border-white/10 ${
                    isGenerating ? 'bg-white/95 dark:bg-black/95 backdrop-blur-2xl' : ''
                  }`}
                >
                  <ReactMarkdown>
                    {chapter.content && chapter.content !== "Generating..." ? chapter.content : "Generating content..."}
                  </ReactMarkdown>
                </GlassCard>
              </div>
              
              {!isGenerating && chapter.type === 'podcast' && (
                <div className="pt-8">
                  <div className="flex items-center gap-3 mb-6">
                    <CheckCircle2 className="w-6 h-6 text-orange-500" />
                    <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Knowledge Check</h3>
                  </div>
                  
                  {quizzes[chapter.id] ? (
                    <div className="space-y-6">
                      {quizzes[chapter.id].map((q: any, i: number) => (
                        <GlassCard key={q.id} padding="md" variant="highlight" className="border-white/10 dark:border-white/5">
                           <h4 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">{i + 1}. {q.question}</h4>
                           <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                             {q.options_json.map((opt: string, j: number) => {
                               const isSelected = selectedQuizAnswers[q.id] === opt;
                               const isCorrect = q.correct_answer === opt;
                               const isSubmitted = !!selectedQuizAnswers[q.id];
                               
                               let optionClass = "p-4 rounded-xl cursor-pointer transition-all duration-300 border flex items-center justify-between gap-3 text-sm font-medium ";
                               
                               if (isSubmitted) {
                                 if (isCorrect) {
                                   optionClass += "bg-emerald-500/10 border-emerald-500/50 text-emerald-900 dark:text-emerald-300 shadow-sm";
                                 } else if (isSelected && !isCorrect) {
                                   optionClass += "bg-rose-500/10 border-rose-500/50 text-rose-900 dark:text-rose-300 shadow-sm";
                                 } else {
                                   optionClass += "bg-white/40 dark:bg-black/20 border-transparent opacity-50";
                                 }
                               } else {
                                 optionClass += "bg-white/60 dark:bg-black/40 border-zinc-200/50 dark:border-zinc-800/50 hover:border-orange-500/50 hover:shadow-md text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-900";
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
                                    <span>{opt}</span>
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${isSubmitted ? (isCorrect ? 'border-emerald-500 bg-emerald-500 text-white' : isSelected ? 'border-rose-500 bg-rose-500 text-white' : 'border-zinc-300 dark:border-zinc-700') : 'border-zinc-300 dark:border-zinc-600'}`}>
                                      {isSubmitted && (isCorrect || isSelected) && <CheckCircle2 className="w-3 h-3" />}
                                    </div>
                                 </li>
                               );
                             })}
                           </ul>
                        </GlassCard>
                      ))}
                    </div>
                  ) : (
                     <Button 
                       onClick={() => generateQuiz(chapter.id)} 
                       size="lg"
                       className="w-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 shadow-xl rounded-2xl"
                     >
                       <CheckCircle2 className="w-5 h-5 mr-2" />
                       Generate Interactive Quiz
                     </Button>
                  )}
                </div>
              )}
            </>
          )}
        </motion.div>
      );
    }

    if (activeItem.type === "exam") {
      if (loadingExam && !exam) {
         return (
           <motion.div 
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             className="flex flex-col items-center justify-center text-center py-24 px-4 h-full"
           >
             <Loader2 className="w-12 h-12 text-zinc-400 animate-spin mb-4" />
             <p className="text-lg text-zinc-500">Checking for existing certification...</p>
           </motion.div>
         );
      }

      if (!exam) {
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center text-center py-24 px-4"
          >
            <div className="w-20 h-20 bg-linear-to-br from-emerald-400 to-teal-500 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-emerald-500/20 rotate-3">
              <GraduationCap className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white mb-4">Final Certification</h2>
            <p className="text-xl text-zinc-500 dark:text-zinc-400 mb-8 max-w-md mx-auto">
              Ready to test your mastery? Generate a comprehensive final exam covering all the material in this course.
            </p>
            <Button 
              onClick={generateExam} 
              disabled={generatingExam}
              size="lg" 
              className="rounded-full px-8 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-xl"
            >
              {generatingExam ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Generating Exam...
                </>
              ) : (
                "Start Final Exam"
              )}
            </Button>
          </motion.div>
        );
      }
      
      return (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">Final Exam</h2>
            <p className="text-lg text-zinc-500">Test your knowledge on the entire course.</p>
          </div>

          <div className="space-y-6">
            {exam.questions_json.map((q: any, i: number) => (
              <GlassCard key={i} padding="lg">
                  <h3 className="text-xl font-bold mb-6 text-zinc-900 dark:text-zinc-100">{i + 1}. {q.question}</h3>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {q.options.map((opt: string, j: number) => {
                      const isSelected = selectedExamAnswers[i] === opt;
                      const isValidated = validatedAnswers[i] !== undefined;
                      const isCorrectAnswer = isValidated && validatedAnswers[i].correctAnswer === opt;
                      const isLoading = validatingQuestion[i] && isSelected;
                      
                      let optionClass = "p-4 rounded-xl cursor-pointer transition-all duration-300 border flex items-center justify-between gap-3 text-sm font-medium ";
                      
                      if (isValidated) {
                        if (isCorrectAnswer) {
                          optionClass += "bg-emerald-500/10 border-emerald-500/50 text-emerald-900 dark:text-emerald-300 shadow-sm";
                        } else if (isSelected && !isCorrectAnswer) {
                          optionClass += "bg-rose-500/10 border-rose-500/50 text-rose-900 dark:text-rose-300 shadow-sm";
                        } else {
                          optionClass += "bg-white/40 dark:bg-black/20 border-transparent opacity-50";
                        }
                      } else {
                        if (isSelected && isLoading) {
                          optionClass += "bg-orange-500/10 border-orange-500/50 text-orange-900 dark:text-orange-300 shadow-sm opacity-70";
                        } else if (validatingQuestion[i]) {
                          optionClass += "bg-white/40 dark:bg-black/20 border-transparent opacity-50 cursor-not-allowed";
                        } else {
                          optionClass += "bg-white/60 dark:bg-black/40 border-zinc-200/50 dark:border-zinc-800/50 hover:border-orange-500/50 hover:shadow-md text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-900";
                        }
                      }

                      return (
                        <li 
                          key={j} 
                          className={optionClass}
                          onClick={() => {
                            if (!isValidated && !validatingQuestion[i]) {
                              verifyQuestion(i, opt);
                            }
                          }}
                        >
                            <span>{opt}</span>
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                               isValidated 
                                 ? (isCorrectAnswer ? 'border-emerald-500 bg-emerald-500 text-white' : isSelected ? 'border-rose-500 bg-rose-500 text-white' : 'border-zinc-300 dark:border-zinc-700') 
                                 : isSelected ? 'border-orange-500 bg-orange-500 text-white' : 'border-zinc-300 dark:border-zinc-600'
                            }`}>
                              {isLoading ? (
                                <Loader2 className="w-3 h-3 text-orange-500 animate-spin" />
                              ) : (isValidated && (isCorrectAnswer || isSelected)) ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : null}
                            </div>
                        </li>
                      );
                    })}
                  </ul>
              </GlassCard>
            ))}
          </div>

          <div className="mt-12 flex justify-center pb-8">
            {exam.score !== null ? (
              <div className="text-center space-y-6">
                 <div className="inline-flex items-center justify-center p-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 border-4 border-emerald-500 text-emerald-700 dark:text-emerald-400">
                   <div className="text-5xl font-black">{exam.score}%</div>
                 </div>
                 <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Exam Completed</h3>
                 <div className="flex justify-center gap-4 mt-4">
                   {exam.score >= 60 && (
                     <Button 
                       onClick={handleClaimClick} 
                       disabled={isGeneratingCert} 
                       className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl"
                       size="lg"
                     >
                       {isGeneratingCert ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Download className="w-5 h-5 mr-2" />}
                       Claim Certificate
                     </Button>
                   )}
                   <Button onClick={retakeExam} disabled={retakingExam} variant="outline" size="lg" className="rounded-full">
                      {retakingExam ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
                      Retake Exam
                   </Button>
                 </div>
              </div>
            ) : (
               <div className="text-center">
                  {submittingExam ? (
                    <div className="flex items-center gap-2 text-zinc-500">
                       <Loader2 className="w-5 h-5 animate-spin" /> Finalizing score...
                    </div>
                  ) : (
                    <p className="text-zinc-500">
                       Answer all {exam.questions_json.length} questions to finalize your score. <br/>
                       {Object.keys(validatedAnswers).length} / {exam.questions_json.length} completed
                    </p>
                  )}
               </div>
            )}
          </div>
        </motion.div>
      );
    }

    return null;
  };

  const podcastChapters = chapters.filter(c => c.type === "podcast");
  const studyMaterial = chapters.find(c => c.type === "study_material");

  return (
    <div className="flex flex-col md:flex-row min-h-screen relative overflow-hidden font-sans">
      <AnimatedBackground />
      
      {/* Sidebar Overlay for Mobile could go here later */}
      
      {/* Sidebar Container */}
      <aside className="w-full md:w-80 h-screen sticky top-0 shrink-0 z-20 hidden md:block p-4 pl-6 py-6">
        <GlassCard padding="none" variant="dark" className="h-full flex flex-col overflow-hidden border-r-0 shadow-2xl bg-white/40 dark:bg-black/40 shrink-0">
          <div className="p-6 border-b border-zinc-200/20 dark:border-zinc-800/50">
            <Link href="/" className="inline-flex items-center gap-2 mb-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              <div className="w-8 h-8 bg-zinc-900 dark:bg-zinc-100 rounded-lg flex items-center justify-center">
                 <Layout className="w-4 h-4 text-white dark:text-black" />
              </div>
              <span className="font-bold text-lg text-zinc-900 dark:text-zinc-100">LearnIt</span>
            </Link>

            <h1 className="text-xl font-black leading-tight tracking-tight text-zinc-900 dark:text-white line-clamp-3">
              {course.topic}
            </h1>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs font-semibold px-2 py-1 rounded bg-zinc-200/50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400">
                {course.model.includes('flash') ? 'Flash' : 'GPT-4o'}
              </span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <nav className="space-y-8">
              <div>
                <h3 className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-4 px-3">Journey</h3>
                <ul className="space-y-1.5 relative">
                  {/* Timeline connecting line */}
                  <div className="absolute left-[19px] top-4 bottom-4 w-px bg-zinc-200 dark:bg-zinc-800 z-0"></div>

                  {podcastChapters.map((ch, i) => {
                    const isActive = activeItem?.id === ch.id;
                    const isGenerated = ch.content && ch.content !== "Generating..." && ch.content.split(" ").length > 10;
                    
                    return (
                      <li key={ch.id} className="relative z-10">
                        <button
                          onClick={() => setActiveItem({ type: "chapter", id: ch.id })}
                          className={`w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl transition-all ${
                            isActive 
                              ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100" 
                              : "hover:bg-white/50 dark:hover:bg-zinc-900/50 text-zinc-600 dark:text-zinc-400"
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border-2 transition-colors ${
                             isActive ? 'border-orange-500 bg-orange-100 dark:bg-orange-900/50' : 
                             isGenerated ? 'border-zinc-400 bg-zinc-200 dark:bg-zinc-800' : 'border-zinc-300 dark:border-zinc-700 bg-transparent'
                          }`}>
                            {isActive && <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />}
                          </div>
                          <span className={`text-sm flex-1 truncate ${isActive ? 'font-bold' : 'font-medium'}`}>
                            Int. {i + 1}: {ch.title}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-4 px-3">Resources</h3>
                <ul className="space-y-1.5 relative">
                   <div className="absolute left-[19px] top-4 bottom-4 w-px bg-zinc-200 dark:bg-zinc-800 z-0"></div>

                   <li className="relative z-10">
                      <button
                        onClick={() => {
                          if (studyMaterial) {
                            setActiveItem({ type: "chapter", id: studyMaterial.id });
                          } else {
                            generateStudyMaterial();
                          }
                        }}
                        className={`w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl transition-all ${
                          activeItem?.id === studyMaterial?.id && studyMaterial
                            ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100" 
                            : "hover:bg-white/50 dark:hover:bg-zinc-900/50 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border-2 transition-colors ${
                           (activeItem?.id === studyMaterial?.id && studyMaterial) ? 'border-purple-500 bg-purple-100 dark:bg-purple-900/50' : 
                           studyMaterial ? 'border-zinc-400 bg-zinc-200 dark:bg-zinc-800' : 'border-zinc-300 dark:border-zinc-700 bg-transparent'
                        }`}>
                          {(activeItem?.id === studyMaterial?.id && studyMaterial) && <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />}
                        </div>
                        <span className={`text-sm flex-1 truncate ${activeItem?.id === studyMaterial?.id ? 'font-bold' : 'font-medium'}`}>
                          Study Companion {studyMaterial ? "" : "(TBC)"}
                        </span>
                      </button>
                   </li>
                   
                    <li className="relative z-10">
                      <button
                        onClick={() => {
                          setActiveItem({ type: "exam" });
                        }}
                        className={`w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl transition-all ${
                          activeItem?.type === "exam"
                            ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100" 
                            : "hover:bg-white/50 dark:hover:bg-zinc-900/50 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border-2 transition-colors ${
                           activeItem?.type === "exam" ? 'border-emerald-500 bg-emerald-100 dark:bg-emerald-900/50' : 
                           exam ? 'border-zinc-400 bg-zinc-200 dark:bg-zinc-800' : 'border-zinc-300 dark:border-zinc-700 bg-transparent'
                        }`}>
                          {activeItem?.type === "exam" && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
                        </div>
                        <span className={`text-sm flex-1 truncate ${activeItem?.type === "exam" ? 'font-bold' : 'font-medium'}`}>
                          Final Certification {exam ? "" : "(TBC)"}
                        </span>
                      </button>
                   </li>
                </ul>
              </div>
            </nav>
          </div>
        </GlassCard>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 w-full h-screen overflow-y-auto relative z-10 scroll-smooth">
        <div className="max-w-6xl mx-auto px-6 py-12 lg:px-12 lg:py-20">
          <AnimatePresence mode="wait">
             {renderContent()}
          </AnimatePresence>
        </div>
      </main>

      {/* Hidden Certificate Container (Inline hex colors to prevent color sync bugs) */}
      <div 
        className="fixed top-0 left-[-9999px] w-[960px] h-[680px] flex flex-col items-center justify-center p-16 z-[-99] **:border-none"
        style={{ 
           fontFamily: "Inter, sans-serif",
           background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #f1f5f9 100%)",
           border: "8px solid #10b981",
           color: "#0f172a"
        }}
        ref={certificateRef}
      >
        <div className="absolute top-10 left-10 w-32 h-32 rounded-full blur-[100px] opacity-30" style={{ backgroundColor: "#10b981" }}></div>
        <div className="absolute bottom-10 right-10 w-40 h-40 rounded-full blur-[120px] opacity-20" style={{ backgroundColor: "#a855f7" }}></div>
        
        <div className="relative z-10 w-full h-full rounded-xl p-12 flex flex-col items-center justify-center text-center shadow-2xl" 
             style={{ border: "1px solid rgba(0,0,0,0.05)", backgroundColor: "rgba(255,255,255,0.8)", backdropFilter: "blur(12px)" }}>
          <GraduationCap className="w-20 h-20 mb-6" style={{ color: "#059669" }} />
          <h1 className="text-5xl font-black mb-2 uppercase tracking-widest" style={{ color: "#0f172a" }}>Certificate of Completion</h1>
          <div className="w-24 h-1 rounded-full mb-10" style={{ backgroundColor: "#10b981" }}></div>
                    <p className="text-xl" style={{ color: "#64748b" }}>This is to certify that</p>
            <p className="text-5xl font-bold mt-4 mb-6" style={{ color: "#0f172a", borderBottom: "2px solid #e2e8f0", paddingBottom: "8px" }}>
              {studentName || user?.user_metadata?.full_name || user?.email}
            </p>
            <p className="text-xl" style={{ color: "#64748b" }}>has successfully completed the course</p>
            <h3 className="text-3xl font-black mb-10 max-w-2xl leading-tight line-clamp-2" style={{ color: "#059669" }}>
            {course?.topic}
          </h3>
            
            <div className="flex w-full justify-between items-end mt-auto pt-8" style={{ borderTop: "1px solid rgba(0,0,0,0.1)" }}>
              <div className="text-left w-32">
                <p className="text-sm uppercase tracking-widest mb-1" style={{ color: "#94a3b8" }}>Date</p>
                <p className="text-lg font-bold" style={{ color: "#334155" }}>{new Date().toLocaleDateString()}</p>
              </div>
              
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold shadow-[0_0_30px_rgba(16,185,129,0.15)]" style={{ backgroundColor: "rgba(16,185,129,0.05)", border: "4px solid #34d399", color: "#059669" }}>
                  {exam?.score || 0}%
                </div>
                <p className="text-sm font-bold tracking-widest mt-2 uppercase" style={{ color: "#059669" }}>Passed</p>
              </div>

              <div className="text-right w-32">
                <p className="text-sm uppercase tracking-widest mb-1" style={{ color: "#94a3b8" }}>Verify ID</p>
                {certificateId ? (
                  <p className="text-sm font-mono truncate" style={{ color: "#059669", maxWidth: "8rem" }}>{certificateId.substring(0, 8).toUpperCase()}</p>
                ) : (
                  <p className="text-lg font-bold" style={{ color: "#059669" }}>LearnIt</p>
                )}
              </div>
            </div>
        </div>
      </div>
      {/* Name Prompt Modal */}
      <AnimatePresence>
        {isClaimModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-zinc-200 p-8 rounded-2xl shadow-2xl max-w-md w-full relative"
            >
              <button 
                onClick={() => setIsClaimModalOpen(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 transition-colors"
                disabled={isGeneratingCert}
              >
                <X className="w-5 h-5" />
              </button>
              
              <h2 className="text-2xl font-bold text-zinc-900 mb-2">Claim Your Certificate</h2>
              <p className="text-zinc-600 mb-6 text-sm">Please enter the name exactly as you want it to appear on your verified certificate.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Name on Certificate</label>
                  <input 
                    type="text" 
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    disabled={isGeneratingCert}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                  />
                </div>
                                <button
                            onClick={generateCertificate}
                            disabled={!studentName.trim() || isGeneratingCert}
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            {isGeneratingCert ? (
                              <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Saving & Generating...
                              </>
                            ) : (
                              "Confirm & Download"
                            )}
                          </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
