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
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle2, FileText, GraduationCap, Loader2, Download, X, ChevronLeft, ChevronRight, Pause, Play, SkipBack, SkipForward, Music, BookOpen } from "lucide-react";
import Link from "next/link";
// @ts-ignore
import domtoimage from "dom-to-image-more";
import jsPDF from "jspdf";
import { WikiImage } from "@/components/ui/wiki-image";

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
  
  // Podcast State
  const [generatingPodcastFor, setGeneratingPodcastFor] = useState<string | null>(null);
  const [playingPodcastId, setPlayingPodcastId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Global Player State
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [podcastTitle, setPodcastTitle] = useState("");
  
  const supabase = createClient();

  useEffect(() => {
    fetchCourseDetails();
    fetchUser();
  }, [courseId]);

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const fetchCourseDetails = async (silent = false) => {
    if (!courseId) return;
    if (!silent) setLoading(true);

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

    if (!silent) setLoading(false);
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
        await fetchCourseDetails(true);
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
    if (res.ok) fetchCourseDetails(true);
  };

  const playPodcast = async (chapterId: string) => {
    if (playingPodcastId === chapterId && audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play();
        setIsAudioPlaying(true);
      } else {
        audioRef.current.pause();
        setIsAudioPlaying(false);
      }
      return;
    }

    const targetChapter = chapters.find(c => c.id === chapterId);
    if (targetChapter) setPodcastTitle(targetChapter.title);

    setGeneratingPodcastFor(chapterId);
    setPlayingPodcastId(chapterId); // Instantly trigger the player mounting for the skeleton
    
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }

      const url = `/api/generate/podcast?chapterId=${chapterId}&modelName=${course?.model || 'gemini-2.5-flash'}`;
      
      if (!audioRef.current) {
        audioRef.current = new Audio(url);
      } else {
        audioRef.current.src = url;
        audioRef.current.load();
      }
      
      const updateDurationFromBuffer = () => {
        if (!audioRef.current) return;
        const currentDuration = audioRef.current.duration;
        // The stream WAV size acts inconsistently on clients, if duration is > 10 mins (600s), default to ~2.3 mins (138s)
        if (!isFinite(currentDuration) || currentDuration > 600) {
            if (audioRef.current.buffered.length > 0) {
               const bufferedEnd = audioRef.current.buffered.end(audioRef.current.buffered.length - 1);
               // Default to 138 seconds as requested, unless we buffered more than that
               setAudioDuration(Math.max(bufferedEnd, 138));
            } else {
               setAudioDuration(Math.max(audioRef.current.currentTime, 138));
            }
        } else {
            setAudioDuration(currentDuration);
        }
      };

      // Setup event listeners
      audioRef.current.ontimeupdate = () => {
        if (!audioRef.current) return;
        setAudioProgress(audioRef.current.currentTime || 0);
        updateDurationFromBuffer();
      };
      
      audioRef.current.onprogress = updateDurationFromBuffer;
      audioRef.current.onsuspend = updateDurationFromBuffer;
      
      audioRef.current.onloadedmetadata = () => {
        if (!audioRef.current) return;
        updateDurationFromBuffer();
      };
      audioRef.current.onplay = () => {
        setIsAudioPlaying(true);
      };
      audioRef.current.onplaying = () => {
        setGeneratingPodcastFor(null); // Stop loading indicator when actual audio data arrives and starts playing
      };
      audioRef.current.onwaiting = () => {
        setGeneratingPodcastFor(chapterId); // Show loading indicator when audio needs to buffer
      };
      audioRef.current.onpause = () => setIsAudioPlaying(false);
      audioRef.current.onended = () => {
        setIsAudioPlaying(false);
        setPlayingPodcastId(null);
        setAudioProgress(0);
      };
      audioRef.current.onerror = () => {
        console.error("Audio playback error", audioRef.current?.error);
        alert("Error streaming podcast audio. It might not be ready yet.");
        setGeneratingPodcastFor(null);
        setIsAudioPlaying(false);
        setPlayingPodcastId(null);
      };
      
      await audioRef.current.play();
      setPlayingPodcastId(chapterId);
    } catch (error) {
       console.error(error);
       alert("Error generating podcast audio");
       setGeneratingPodcastFor(null);
    }
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  };

  const skipAudio = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(Math.max(audioRef.current.currentTime + seconds, 0), audioDuration);
    }
  };

  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
       audioRef.current.currentTime = time;
       setAudioProgress(time);
    }
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
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-12"
        >
          <div className="mb-4">
            <p className="text-[13px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
              {chapter.type === 'chapter' ? 'Textbook' : 'Study Guide'}
            </p>
            <h2 className="text-4xl font-black tracking-tight text-zinc-900 font-serif leading-tight">{chapter.title}</h2>
          </div>

          {chapterErrors[chapter.id] ? (
            <div className="flex flex-col items-center justify-center gap-4 p-8 border border-red-200 bg-red-50 rounded-2xl">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <p className="text-[15px] font-medium text-red-800 text-center">{chapterErrors[chapter.id]}</p>
              <Button onClick={() => generateChapterContent(chapter)} variant="outline" className="mt-2 bg-white text-red-700 hover:bg-red-50 hover:text-red-800">
                Try Again
              </Button>
            </div>
          ) : showPlaceholder ? (
            <div className="flex items-center gap-4 p-8 border border-zinc-200 bg-zinc-50/50 rounded-2xl">
              <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
              <p className="text-[15px] font-medium text-zinc-600">Synthesizing learning materials...</p>
            </div>
          ) : (
            <>
              <div className="prose prose-zinc max-w-none text-[1.05rem] leading-relaxed text-zinc-700">
                <ReactMarkdown
                  components={{
                    img: ({ node, ...props }) => {
                      const src = typeof props.src === "string" ? props.src : "";
                      const alt = typeof props.alt === "string" ? props.alt : undefined;
                      
                      if (src.startsWith("wiki:")) {
                        const searchTerm = src.replace("wiki:", "");
                        return <WikiImage title={searchTerm} alt={alt} />;
                      }

                      if (src.includes("wikimedia.org") || src.includes("wikipedia.org")) {
                        let searchTerm = alt && alt.length > 2 && alt !== "Course reference image" ? alt : "";
                        if (!searchTerm) {
                          try {
                             const urlObj = new URL(src);
                             const pathParts = urlObj.pathname.split('/');
                             const lastPart = pathParts[pathParts.length - 1];
                             searchTerm = decodeURIComponent(lastPart).replace(/\.(png|jpe?g|svg|gif|webp)$/i, '').replace(/^\d+px-/, '');
                          } catch (e) {
                             searchTerm = "Image";
                          }
                        }
                        return <WikiImage title={searchTerm} alt={alt || searchTerm} />;
                      }
                      
                      return (
                        <span className="block my-10 rounded-xl overflow-hidden shadow-sm border border-zinc-200 bg-zinc-50">
                          <img className="w-full h-auto max-h-[500px] object-cover" {...props} src={src} alt={alt || "Course reference image"} loading="lazy" />
                        </span>
                      );
                    },
                    h1: ({node, ...props}) => <h1 className="font-serif font-black text-3xl text-zinc-900 mt-12 mb-6" {...props} />,
                    h2: ({node, ...props}) => <h2 className="font-serif font-bold text-2xl text-zinc-900 mt-10 mb-4" {...props} />,
                    h3: ({node, ...props}) => <h3 className="font-serif font-bold text-xl text-zinc-900 mt-8 mb-4 border-b border-zinc-100 pb-2" {...props} />,
                    p: ({node, ...props}) => <p className="mb-6" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-6 space-y-2 marker:text-zinc-400" {...props} />,
                    li: ({node, ...props}) => <li {...props} />,
                    a: ({ node, ...props }) => <a className="text-zinc-900 hover:text-zinc-600 underline underline-offset-4 decoration-zinc-300 font-medium transition-colors" target="_blank" rel="noopener noreferrer" {...props} />
                  }}
                >
                  {chapter.content && chapter.content !== "Generating..." ? chapter.content : "Generating content..."}
                </ReactMarkdown>
              </div>
              
              {!isGenerating && chapter.type === 'chapter' && (
                <div className="pt-12 mt-12 border-t border-zinc-100">
                  <div className="mb-8">
                    <h3 className="text-2xl font-black font-serif tracking-tight text-zinc-900 mb-2">Knowledge Check</h3>
                    <p className="text-zinc-500 text-[15px]">Test your understanding of this chapter before moving on.</p>
                  </div>
                  
                  {quizzes[chapter.id] ? (
                    <div className="space-y-8">
                      {quizzes[chapter.id].map((q: any, i: number) => (
                        <div key={q.id} className="p-8 rounded-2xl border border-zinc-200 bg-white shadow-sm">
                           <h4 className="text-[1.1rem] font-bold mb-6 text-zinc-900 leading-snug">
                              <span className="text-zinc-400 mr-2">{i + 1}.</span> 
                              {q.question}
                           </h4>
                           <ul className="space-y-3">
                             {q.options_json.map((opt: string, j: number) => {
                               const isSelected = selectedQuizAnswers[q.id] === opt;
                               const isCorrect = q.correct_answer === opt;
                               const isSubmitted = !!selectedQuizAnswers[q.id];
                               const optionLabel = String.fromCharCode(65 + j); // A, B, C, D
                               
                               let optionClass = "flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer text-[15px] ";
                               
                               if (isSubmitted) {
                                 if (isCorrect) {
                                   optionClass += "bg-emerald-50 border-emerald-200 text-emerald-900";
                                 } else if (isSelected && !isCorrect) {
                                   optionClass += "bg-rose-50 border-rose-200 text-rose-900";
                                 } else {
                                   optionClass += "bg-white border-zinc-100 text-zinc-400 opacity-60";
                                 }
                               } else {
                                 optionClass += isSelected 
                                  ? "bg-zinc-50 border-zinc-300 text-zinc-900" 
                                  : "bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50";
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
                                    <div className={`w-7 h-7 rounded-sm flex items-center justify-center shrink-0 font-semibold text-[13px] transition-colors ${
                                       isSubmitted 
                                        ? (isCorrect ? 'bg-emerald-100 text-emerald-700' : isSelected ? 'bg-rose-100 text-rose-700' : 'bg-zinc-100 text-zinc-400') 
                                        : isSelected ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500'
                                    }`}>
                                      {optionLabel}
                                    </div>
                                    <span className="flex-1 leading-snug font-medium">{opt}</span>
                                    {isSubmitted && (isCorrect || isSelected) && (
                                       <div className="shrink-0 ml-2">
                                         {isCorrect ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <X className="w-5 h-5 text-rose-500" />}
                                       </div>
                                    )}
                                 </li>
                               );
                             })}
                           </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                     <Button 
                       onClick={() => generateQuiz(chapter.id)} 
                       size="lg"
                       className="bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm rounded-lg h-12 px-6 font-semibold"
                     >
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
           <div className="flex flex-col items-center justify-center py-24 text-center">
             <Loader2 className="w-8 h-8 text-zinc-400 animate-spin mb-4" />
             <p className="text-[15px] font-medium text-zinc-500">Retrieving examination data...</p>
           </div>
         );
      }

      if (!exam) {
        return (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center text-center py-32 px-4 max-w-lg mx-auto"
          >
            <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mb-6">
              <GraduationCap className="w-8 h-8 text-zinc-900" />
            </div>
            <h2 className="text-3xl font-black font-serif tracking-tight text-zinc-900 mb-4">Final Certification</h2>
            <p className="text-[15px] text-zinc-600 mb-8 leading-relaxed">
              Test your mastery of the entire course. Pass the exam to claim your verified certificate of completion.
            </p>
            <Button 
              onClick={generateExam} 
              disabled={generatingExam}
              size="lg" 
              className="rounded-lg h-12 px-8 bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm font-semibold w-full sm:w-auto"
            >
              {generatingExam ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-10"
        >
          <div className="mb-4">
            <h2 className="text-4xl font-black font-serif tracking-tight text-zinc-900 mb-2">Final Certification</h2>
            <p className="text-[15px] text-zinc-500">Select the best answer for each question below.</p>
          </div>

          <div className="space-y-8">
            {exam.questions_json.map((q: any, i: number) => (
              <div key={i} className="p-8 rounded-2xl border border-zinc-200 bg-white shadow-sm">
                  <h3 className="text-[1.1rem] font-bold mb-6 text-zinc-900 leading-snug">
                    <span className="text-zinc-400 mr-2">{i + 1}.</span> 
                    {q.question}
                  </h3>
                  <ul className="space-y-3">
                    {q.options.map((opt: string, j: number) => {
                      const isSelected = selectedExamAnswers[i] === opt;
                      const isValidated = validatedAnswers[i] !== undefined;
                      const isCorrectAnswer = isValidated && validatedAnswers[i].correctAnswer === opt;
                      const isLoading = validatingQuestion[i] && isSelected;
                      const optionLabel = String.fromCharCode(65 + j);
                      
                      let optionClass = "flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer text-[15px] ";
                      
                      if (isValidated) {
                        if (isCorrectAnswer) {
                          optionClass += "bg-emerald-50 border-emerald-200 text-emerald-900";
                        } else if (isSelected && !isCorrectAnswer) {
                          optionClass += "bg-rose-50 border-rose-200 text-rose-900";
                        } else {
                          optionClass += "bg-white border-zinc-100 text-zinc-400 opacity-60";
                        }
                      } else {
                        if (isSelected && isLoading) {
                          optionClass += "bg-zinc-100 border-zinc-300 text-zinc-900 opacity-80 cursor-wait";
                        } else if (validatingQuestion[i]) {
                          optionClass += "bg-white border-zinc-100 text-zinc-400 opacity-60 cursor-not-allowed";
                        } else {
                          optionClass += isSelected 
                           ? "bg-zinc-50 border-zinc-300 text-zinc-900" 
                           : "bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50";
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
                           <div className={`w-7 h-7 rounded-sm flex items-center justify-center shrink-0 font-semibold text-[13px] transition-colors ${
                              isValidated 
                               ? (isCorrectAnswer ? 'bg-emerald-100 text-emerald-700' : isSelected ? 'bg-rose-100 text-rose-700' : 'bg-zinc-100 text-zinc-400') 
                               : isSelected ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500'
                           }`}>
                             {isLoading ? <Loader2 className="w-3 h-3 animate-spin text-white" /> : optionLabel}
                           </div>
                           <span className="flex-1 leading-snug font-medium">{opt}</span>
                           {isValidated && (isCorrectAnswer || isSelected) && (
                              <div className="shrink-0 ml-2">
                                {isCorrectAnswer ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <X className="w-5 h-5 text-rose-500" />}
                              </div>
                           )}
                        </li>
                      );
                    })}
                  </ul>
              </div>
            ))}
          </div>

          <div className="pt-12 mt-12 border-t border-zinc-100 flex justify-center pb-8">
            {exam.score !== null ? (
              <div className="text-center space-y-6 max-w-sm">
                 <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-zinc-50 border border-zinc-200 text-zinc-900 shadow-sm">
                   <div className="text-5xl font-black font-serif tracking-tighter">{exam.score}%</div>
                 </div>
                 <div>
                   <h3 className="text-2xl font-bold text-zinc-900 font-serif mb-2">Exam Completed</h3>
                   <p className="text-sm text-zinc-500">You have finished the final certification exam.</p>
                 </div>
                 <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6">
                   {exam.score >= 60 && (
                     <Button 
                       onClick={handleClaimClick} 
                       disabled={isGeneratingCert} 
                       className="rounded-lg h-11 px-6 bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm font-semibold"
                     >
                       {isGeneratingCert ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                       Claim Certificate
                     </Button>
                   )}
                   <Button onClick={retakeExam} disabled={retakingExam} variant="outline" className="h-11 px-6 rounded-lg font-semibold bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                      {retakingExam ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Retake Exam
                   </Button>
                 </div>
              </div>
            ) : (
               <div className="text-center bg-zinc-50 border border-zinc-200 rounded-2xl p-8 max-w-md w-full">
                  {submittingExam ? (
                    <div className="flex flex-col items-center gap-3">
                       <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                       <span className="text-[15px] font-medium text-zinc-600">Finalizing score...</span>
                    </div>
                  ) : (
                    <div>
                      <h4 className="font-semibold text-zinc-900 mb-2 text-[15px]">In Progress</h4>
                      <p className="text-[13px] text-zinc-500 mb-4">
                         Answer all questions to finalize your score.
                      </p>
                      <div className="w-full bg-zinc-200 rounded-full h-1.5 mb-3 overflow-hidden">
                        <div 
                          className="bg-zinc-900 h-1.5 rounded-full transition-all" 
                          style={{ width: `${(Object.keys(validatedAnswers).length / exam.questions_json.length) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                         {Object.keys(validatedAnswers).length} / {exam.questions_json.length} completed
                      </p>
                    </div>
                  )}
               </div>
            )}
          </div>
        </motion.div>
      );
    }

    if (activeItem.type === "podcast") {
      return (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-10"
        >
          <div className="mb-4">
            <h2 className="text-2xl sm:text-4xl font-black font-serif tracking-tight text-zinc-900 mb-2">Podcast Conversations</h2>
            <p className="text-[15px] text-zinc-500 max-w-2xl">
              Listen to a lively discussion about each chapter. Perfect for reinforcing what you've learned on the go.
            </p>
          </div>


          <div className="space-y-3">
            {courseChapters.map((ch, i) => {
               const isGeneratingThis = generatingPodcastFor === ch.id;
               const isPlayingThis = playingPodcastId === ch.id;

               return (
                 <div key={ch.id} className="flex items-center gap-3 p-3 rounded-xl border border-zinc-100 bg-zinc-50/50 hover:bg-zinc-50 hover:border-zinc-200 transition-all group overflow-hidden">
                   <div className="w-10 h-10 rounded-lg bg-white border border-zinc-200 text-zinc-400 font-serif font-bold flex items-center justify-center shrink-0 shadow-sm text-sm">
                     {i + 1}
                   </div>
                   <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                     <h3 className="text-[15px] font-semibold text-zinc-900 truncate leading-snug">{ch.title}</h3>
                     <span className="text-[12px] font-medium text-zinc-500 uppercase tracking-wider">Discussion</span>
                   </div>
                   <button 
                     onClick={() => playPodcast(ch.id)}
                     disabled={!!generatingPodcastFor && !isGeneratingThis}
                     className={`w-10 h-10 rounded-full flex items-center justify-center transition-all bg-white border border-zinc-200 shadow-sm group-hover:shadow-md shrink-0 ${
                       isPlayingThis ? 'border-zinc-900 bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                     }`}
                     title="Play Discussion"
                   >
                      {isGeneratingThis ? (
                         <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                      ) : isPlayingThis ? (
                         <div className="w-3.5 h-3.5 flex justify-between items-end gap-[2px]">
                            <span className="w-[3px] bg-white rounded-sm animate-[bounce_1s_infinite] h-full"></span>
                            <span className="w-[3px] bg-white rounded-sm animate-[bounce_1s_infinite_0.2s] h-full"></span>
                            <span className="w-[3px] bg-white rounded-sm animate-[bounce_1s_infinite_0.4s] h-full"></span>
                         </div>
                      ) : (
                         <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                   </button>
                 </div>
               );
            })}
          </div>
        </motion.div>
      );
    }

    return null;
  };

  const courseChapters = chapters.filter(c => c.type === "chapter");
  const studyMaterial = chapters.find(c => c.type === "study_material");

  // Generate an ordered list of navigable items for proper Previous / Next logic
  const navigableItems = [
    ...courseChapters.map((ch, index) => ({ type: "chapter", id: ch.id, title: `Ch. ${index + 1}: ${ch.title}` })),
    { type: "podcast", id: "podcast-section", title: "Podcast Conversations" },
    ...(studyMaterial ? [{ type: "chapter", id: studyMaterial.id, title: "Study Companion" }] : [{ type: "chapter", id: "study-companion-placeholder", title: "Study Companion (TBC)" }]),
    { type: "exam", id: "exam-placeholder", title: `Final Certification ${exam ? "" : "(TBC)"}` }
  ];

  let activeIndex = -1;
  if (activeItem?.type === "chapter" && activeItem.id) {
    activeIndex = navigableItems.findIndex(item => item.id === activeItem.id);
  } else if (activeItem?.type === "podcast") {
    activeIndex = navigableItems.findIndex(item => item.type === "podcast");
  } else if (activeItem?.type === "exam") {
    activeIndex = navigableItems.findIndex(item => item.type === "exam");
  }

  const prevItem = activeIndex > 0 ? navigableItems[activeIndex - 1] : null;
  const nextItem = activeIndex < navigableItems.length - 1 ? navigableItems[activeIndex + 1] : null;

  const handleNavigate = (navItem: { type: string, id: string }) => {
    if (navItem.type === "chapter") {
      if (navItem.id === "study-companion-placeholder") {
        generateStudyMaterial();
      } else {
        setActiveItem({ type: "chapter", id: navItem.id });
      }
    } else if (navItem.type === "podcast") {
      setActiveItem({ type: "podcast" });
    } else if (navItem.type === "exam") {
      setActiveItem({ type: "exam" });
    }
  };

  return (
    <div className="flex bg-white min-h-screen relative font-sans overflow-x-hidden">
      {/* Sidebar Container */}
      <aside className="w-full md:w-[280px] h-screen sticky top-0 shrink-0 z-20 hidden md:flex flex-col border-r border-zinc-100 bg-white/50 backdrop-blur-3xl pt-8 pb-4">
        <div className="px-6 mb-8 flex flex-col gap-3">
          {/* Mock Course Thumbnail */}
          <div className="w-full aspect-[4/3] bg-zinc-100 rounded-lg overflow-hidden border border-zinc-200/60 shadow-sm relative mb-2">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1516321497487-e288fb19713f?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center opacity-80 mix-blend-overlay"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3">
               <span className="text-white text-xs font-semibold px-2 py-0.5 rounded-sm bg-black/40 backdrop-blur-sm border border-white/20">
                 {course.model.includes('flash') ? 'Flash' : 'GPT-4o'}
               </span>
            </div>
          </div>
          <h1 className="text-[1.1rem] font-bold leading-tight tracking-tight text-zinc-900 line-clamp-2 pr-2">
            {course.topic}
          </h1>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 custom-scrollbar">
          <nav className="space-y-6">
            <div>
              <h3 className="text-xs font-semibold flex items-center gap-2 text-zinc-500 mb-2 px-3">
                <FileText className="w-3.5 h-3.5" />
                Textbook
              </h3>
              <ul className="space-y-0.5">
                {courseChapters.map((ch, i) => {
                  const isActive = activeItem?.id === ch.id;
                  
                  return (
                    <li key={ch.id}>
                      <button
                        onClick={() => setActiveItem({ type: "chapter", id: ch.id })}
                        className={`w-full flex items-center gap-2 text-left px-3 py-1.5 rounded-md transition-all ${
                          isActive 
                            ? "bg-zinc-100/80 text-zinc-900 font-semibold" 
                            : "hover:bg-zinc-50 text-zinc-600 font-medium"
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full flex items-center justify-center border shrink-0 border-transparent">
                          {isActive ? (
                            <div className="w-1.5 h-1.5 bg-zinc-900 rounded-full" />
                          ) : (
                            <div className="w-[3px] h-[3px] bg-zinc-300 rounded-full" />
                          )}
                        </div>
                        <span className="text-[13px] flex-1 truncate">
                          {ch.title}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

             <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => setActiveItem({ type: "podcast" })}
                  className={`w-full flex items-center gap-3 text-left px-3 py-2 rounded-md transition-all ${
                    activeItem?.type === "podcast"
                      ? "bg-zinc-100/80 text-zinc-900 font-semibold text-[13px]" 
                      : "hover:bg-zinc-50 text-zinc-600 font-medium text-[13px]"
                  }`}
                >
                  <Music className="w-4 h-4 shrink-0" />
                  <span className="flex-1 truncate">Podcast</span>
                </button>

                <button
                  onClick={() => {
                    if (studyMaterial) {
                      setActiveItem({ type: "chapter", id: studyMaterial.id });
                    } else {
                      generateStudyMaterial();
                    }
                  }}
                  className={`w-full flex items-center gap-3 text-left px-3 py-2 rounded-md transition-all ${
                    activeItem?.id === studyMaterial?.id && studyMaterial
                      ? "bg-zinc-100/80 text-zinc-900 font-semibold text-[13px]" 
                      : "hover:bg-zinc-50 text-zinc-600 font-medium text-[13px]"
                  }`}
                >
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span className="flex-1 truncate">
                    Study Guide {studyMaterial ? "" : "(TBC)"}
                  </span>
                </button>
                
                <button
                  onClick={() => setActiveItem({ type: "exam" })}
                  className={`w-full flex items-center gap-3 text-left px-3 py-2 rounded-md transition-all ${
                    activeItem?.type === "exam"
                      ? "bg-zinc-100/80 text-zinc-900 font-semibold text-[13px]" 
                      : "hover:bg-zinc-50 text-zinc-600 font-medium text-[13px]"
                  }`}
                >
                  <GraduationCap className="w-4 h-4 shrink-0" />
                  <span className="flex-1 truncate">
                    Exam {exam ? "" : "(TBC)"}
                  </span>
                </button>
             </div>
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`flex-1 min-w-0 w-full h-screen overflow-y-auto overflow-x-hidden relative z-10 scroll-smooth bg-white flex flex-col items-center ${playingPodcastId ? 'pb-36 md:pb-[76px]' : 'pb-14 md:pb-0'}`}>


        <div className="w-full max-w-[800px] px-4 py-10 sm:px-6 lg:px-12 lg:py-16">
          <AnimatePresence mode="wait">
             {renderContent()}
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <div className={`md:hidden fixed left-0 right-0 z-40 bg-white border-t border-zinc-100 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] transition-all duration-300 ${playingPodcastId ? 'bottom-[63px]' : 'bottom-0'}`}>
        <div className="flex items-center h-11 px-1">
          <button
            className="flex items-center justify-center w-10 h-full text-zinc-400 disabled:opacity-30 active:text-zinc-900"
            disabled={!prevItem}
            onClick={() => prevItem && handleNavigate(prevItem)}
            aria-label="Previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex-1 flex items-center justify-center overflow-hidden px-1">
            <span className="text-[12px] font-semibold text-zinc-600 truncate text-center leading-tight">
              {activeIndex >= 0 ? navigableItems[activeIndex].title : 'Select section'}
            </span>
          </div>

          <button
            className="flex items-center justify-center w-10 h-full text-zinc-400 disabled:opacity-30 active:text-zinc-900"
            disabled={!nextItem}
            onClick={() => nextItem && handleNavigate(nextItem)}
            aria-label="Next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Hidden Certificate Container */}
      <div 
        className="fixed top-0 left-[-9999px] w-[960px] h-[680px] flex flex-col items-center justify-center p-16 z-[-99]"
        style={{ 
           fontFamily: "Inter, sans-serif",
           background: "#ffffff",
           border: "8px solid #f9fafb",
           color: "#111827"
        }}
        ref={certificateRef}
      >
        <div className="relative z-10 w-full h-full rounded-xl p-12 flex flex-col items-center justify-center text-center shadow-sm" 
             style={{ border: "1px solid #e5e7eb", backgroundColor: "#ffffff" }}>
          <GraduationCap className="w-20 h-20 mb-6" style={{ color: "#111827" }} />
          <h1 className="text-5xl font-black mb-2 uppercase tracking-widest font-serif" style={{ color: "#111827" }}>Certificate of Completion</h1>
          <div className="w-24 h-px mb-10" style={{ backgroundColor: "#e5e7eb" }}></div>
          <p className="text-xl font-medium" style={{ color: "#6b7280" }}>This is to certify that</p>
          <p className="text-5xl font-serif mt-4 mb-6" style={{ color: "#111827", borderBottom: "1px solid #e5e7eb", paddingBottom: "12px" }}>
            {studentName || user?.user_metadata?.full_name || user?.email}
          </p>
          <p className="text-xl font-medium" style={{ color: "#6b7280" }}>has successfully completed the course</p>
          <h3 className="text-3xl font-serif font-black mb-10 max-w-2xl leading-tight line-clamp-2" style={{ color: "#111827" }}>
            {course?.topic}
          </h3>
            
          <div className="flex w-full justify-between items-end mt-auto pt-8">
            <div className="text-left w-32">
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#9ca3af" }}>Date</p>
              <p className="text-lg font-semibold" style={{ color: "#4b5563" }}>{new Date().toLocaleDateString()}</p>
            </div>
              
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold bg-zinc-50 border border-zinc-200 text-zinc-900">
                {exam?.score || 0}%
              </div>
              <p className="text-xs font-bold tracking-widest mt-3 uppercase text-zinc-500">Passed</p>
            </div>

            <div className="text-right w-32">
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#9ca3af" }}>Verify ID</p>
              {certificateId ? (
                <p className="text-sm font-mono truncate" style={{ color: "#4b5563", maxWidth: "8rem" }}>{certificateId.substring(0, 8).toUpperCase()}</p>
              ) : (
                <p className="text-lg font-bold" style={{ color: "#111827" }}>LearnIt</p>
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/20 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-zinc-200 p-8 rounded-2xl shadow-xl max-w-md w-full relative"
            >
              <button 
                onClick={() => setIsClaimModalOpen(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 transition-colors"
                disabled={isGeneratingCert}
              >
                <X className="w-5 h-5" />
              </button>
              
              <h2 className="text-2xl font-bold text-zinc-900 mb-2 font-serif">Claim Certificate</h2>
              <p className="text-zinc-600 mb-6 text-[15px]">Please enter the name exactly as you want it to appear on your verified certificate.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[13px] font-semibold text-zinc-600 mb-1.5">Name on Certificate</label>
                  <input 
                    type="text" 
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    disabled={isGeneratingCert}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 transition-all font-medium text-[15px]"
                  />
                </div>
                <button
                  onClick={generateCertificate}
                  disabled={!studentName.trim() || isGeneratingCert}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-3 px-4 rounded-lg shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-[15px]"
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

      {/* Global Audio Player - Full-width bottom bar */}
      <AnimatePresence>
        {playingPodcastId && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-zinc-200 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] md:bottom-0"
          >
            {/* Progress bar - sits right on top edge */}
            <div className="w-full h-[3px] bg-zinc-100 relative cursor-pointer group">
              <div
                className="absolute top-0 left-0 bottom-0 bg-zinc-900 transition-all z-10"
                style={{ width: `${(audioProgress / (audioDuration || 1)) * 100}%` }}
              />
              <input
                type="range"
                min="0"
                max={audioDuration || 100}
                value={audioProgress}
                onChange={handleTimelineChange}
                className="absolute inset-0 opacity-0 z-20 cursor-pointer w-full h-full"
              />
            </div>

            <div className="flex items-center h-[60px] px-4 gap-4">
              {/* Track info - left */}
              <div className="flex items-center gap-3 w-[260px] shrink-0 min-w-0">
                <div className="w-9 h-9 bg-zinc-100 rounded-lg overflow-hidden relative shrink-0 border border-zinc-200/60">
                  <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1516321497487-e288fb19713f?q=80&w=400&auto=format&fit=crop')] bg-cover bg-center" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[13px] font-semibold text-zinc-900 truncate leading-tight">{podcastTitle || "Podcast Playing"}</span>
                  <span className="text-[11px] text-zinc-500 truncate leading-tight">{course.topic}</span>
                </div>
                <button
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.pause();
                      audioRef.current.src = "";
                    }
                    setIsAudioPlaying(false);
                    setPlayingPodcastId(null);
                    setAudioProgress(0);
                  }}
                  className="text-zinc-400 hover:text-zinc-700 shrink-0 ml-1 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Playback controls - center */}
              <div className="flex-1 flex items-center justify-center gap-5">
                {generatingPodcastFor === playingPodcastId ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
                    <span className="text-[12px] text-zinc-500 font-medium">Generating...</span>
                  </div>
                ) : (
                  <>
                    <button onClick={() => skipAudio(-10)} className="text-zinc-500 hover:text-zinc-900 transition-colors">
                      <SkipBack className="w-4 h-4" />
                    </button>
                    <button
                      onClick={togglePlayPause}
                      className="w-9 h-9 flex items-center justify-center bg-zinc-900 hover:bg-zinc-800 text-white rounded-full shadow-sm transition-transform active:scale-95"
                    >
                      {isAudioPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                    </button>
                    <button onClick={() => skipAudio(10)} className="text-zinc-500 hover:text-zinc-900 transition-colors">
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>

              {/* Time - right */}
              <div className="w-[260px] shrink-0 flex justify-end">
                <span className="text-[12px] font-medium text-zinc-500 tabular-nums">
                  {new Date(audioProgress * 1000).toISOString().substring(14, 19)}
                  {" / "}
                  {new Date(audioDuration * 1000).toISOString().substring(14, 19)}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
