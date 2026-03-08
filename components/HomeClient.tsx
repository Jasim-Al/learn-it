"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Settings2, Plus, ArrowRight, Loader2, Check } from "lucide-react";

export function HomeClient() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState("");
  const [modelName, setModelName] = useState("gpt-4o-mini");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const configRef = useRef<HTMLDivElement>(null);

  const MODELS = [
    { id: "gpt-4o-mini", label: "GPT-4o mini", provider: "OpenAI", badge: "Fast" },
    { id: "gpt-4o", label: "GPT-4o", provider: "OpenAI", badge: "Smart" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "Google", badge: "" },
  ];
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
      .select(`*, chapters ( id, content, type ), exams ( id )`)
      .order("created_at", { ascending: false });
      
    if (data) setCourses(data);
    setLoading(false);
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

  // Close config popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (configRef.current && !configRef.current.contains(e.target as Node)) {
        setShowConfig(false);
      }
    };
    if (showConfig) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showConfig]);

  // Handle enter key submit
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreate();
    }
  };

  return (
    <div className="relative min-h-screen bg-white">


      <div className="flex flex-col items-center justify-center min-h-screen px-4 pb-24">
        <div className="w-full max-w-[640px] flex flex-col items-start gap-3 mt-12 mb-8">

          <h1 className="text-[2.5rem] leading-[1.1] font-serif tracking-tight text-zinc-900 font-medium">
            Learn <span className="italic text-zinc-900">gardening</span> to grow your ow
          </h1>
          <p className="text-zinc-600 text-[15px] font-medium mt-1">
            Enriched, personalized, and interactive courses.<br />
            Get started for free.
          </p>
        </div>

        <div className="w-full max-w-[640px]">
          {/* Main Input Box */}
          <div className="relative flex flex-col bg-white border border-zinc-200 rounded-3xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] focus-within:ring-2 focus-within:ring-zinc-900 transition-all p-3">
            <div className="flex items-center w-full min-h-[48px] px-2 mb-1">
              <Plus className="w-5 h-5 text-zinc-400 shrink-0 mr-3" />
              <input 
                type="text"
                placeholder="I want to learn about..."
                className="flex-1 bg-transparent border-none outline-none text-zinc-900 placeholder:text-zinc-400 font-medium text-[15px]"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            
            <div className="flex items-center justify-between w-full px-2 mt-auto">
              <div className="flex-1"></div>
              <div className="flex items-center gap-3">
                {/* Configure Button + Popover */}
                <div className="relative" ref={configRef}>
                  <button
                    onClick={() => setShowConfig(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    Configure
                  </button>
                  <AnimatePresence>
                    {showConfig && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full right-0 mt-2 w-56 bg-white border border-zinc-200 rounded-2xl shadow-lg overflow-hidden z-50"
                      >
                        <div className="px-3 pt-3 pb-1">
                          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">AI Model</p>
                        </div>
                        {MODELS.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => { setModelName(m.id); setShowConfig(false); }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-50 transition-colors text-left ${
                              modelName === m.id ? "bg-zinc-50" : ""
                            }`}
                          >
                            <div className="flex-1">
                              <p className="text-sm font-medium text-zinc-900 leading-snug">{m.label}</p>
                              <p className="text-[11px] text-zinc-400">{m.provider}{m.badge ? ` · ${m.badge}` : ""}</p>
                            </div>
                            {modelName === m.id && <Check className="w-3.5 h-3.5 text-zinc-900 shrink-0" />}
                          </button>
                        ))}
                        <div className="px-3 pb-3 pt-1">
                          <p className="text-[10px] text-zinc-400">Using: <span className="font-semibold text-zinc-600">{MODELS.find(m => m.id === modelName)?.label}</span></p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="w-8 h-8 bg-zinc-900 rounded-full flex items-center justify-center text-white cursor-pointer hover:bg-zinc-800 transition-colors" onClick={handleCreate}>
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="relative mt-8 min-h-[300px]">
             {/* Fake Gradient BG effect behind list */}
             <div className="absolute inset-x-0 -top-10 bottom-0 bg-gradient-to-br from-orange-50/50 via-teal-50/30 to-blue-50/20 rounded-3xl -z-10 blur-xl"></div>
             
             {loading ? (
                <div className="space-y-4 px-4 py-2 animate-pulse">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-3 h-[1px] bg-zinc-300"></div>
                      <div className="h-4 bg-zinc-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
             ) : (
               <ul className="flex flex-col gap-1 px-4">
                 {courses.length > 0 ? (
                   courses.slice(0, 5).map(course => (
                     <li key={course.id}>
                       <Link 
                         href={`/course/${course.id}`}
                         className="flex items-center gap-4 group py-3 px-2 rounded-xl hover:bg-white/60 transition-colors"
                       >
                         <div className="w-3 h-[1px] bg-zinc-400 group-hover:bg-zinc-900 transition-colors shrink-0"></div>
                         <span className="text-zinc-600 font-medium text-[15px] group-hover:text-zinc-900 transition-colors truncate">
                           {course.topic}
                         </span>
                       </Link>
                     </li>
                   ))
                 ) : (
                   <>
                     <li>
                        <div className="flex items-center gap-4 group py-3 px-2 rounded-xl hover:bg-white/60 cursor-pointer transition-colors" onClick={() => setTopic("The Apollo 11 mission")}>
                          <div className="w-3 h-[1px] bg-zinc-400 group-hover:bg-zinc-900 transition-colors shrink-0"></div>
                          <span className="text-zinc-600 font-medium text-[15px] group-hover:text-zinc-900 transition-colors truncate">The Apollo 11 mission</span>
                        </div>
                     </li>
                     <li>
                        <div className="flex items-center gap-4 group py-3 px-2 rounded-xl hover:bg-white/60 cursor-pointer transition-colors" onClick={() => setTopic("The life of Leonardo da Vinci")}>
                          <div className="w-3 h-[1px] bg-zinc-400 group-hover:bg-zinc-900 transition-colors shrink-0"></div>
                          <span className="text-zinc-600 font-medium text-[15px] group-hover:text-zinc-900 transition-colors truncate">The life of Leonardo da Vinci</span>
                        </div>
                     </li>
                     <li>
                        <div className="flex items-center gap-4 group py-3 px-2 rounded-xl hover:bg-white/60 cursor-pointer transition-colors" onClick={() => setTopic("The physics of sailing")}>
                          <div className="w-3 h-[1px] bg-zinc-400 group-hover:bg-zinc-900 transition-colors shrink-0"></div>
                          <span className="text-zinc-600 font-medium text-[15px] group-hover:text-zinc-900 transition-colors truncate">The physics of sailing</span>
                        </div>
                     </li>
                     <li>
                        <div className="flex items-center gap-4 group py-3 px-2 rounded-xl hover:bg-white/60 cursor-pointer transition-colors" onClick={() => setTopic("Basics of Neuroscience")}>
                          <div className="w-3 h-[1px] bg-zinc-400 group-hover:bg-zinc-900 transition-colors shrink-0"></div>
                          <span className="text-zinc-600 font-medium text-[15px] group-hover:text-zinc-900 transition-colors truncate">Basics of Neuroscience</span>
                        </div>
                     </li>
                     <li>
                        <div className="flex items-center gap-4 group py-3 px-2 rounded-xl hover:bg-white/60 cursor-pointer transition-colors" onClick={() => setTopic("How black holes work")}>
                          <div className="w-3 h-[1px] bg-zinc-400 group-hover:bg-zinc-900 transition-colors shrink-0"></div>
                          <span className="text-zinc-600 font-medium text-[15px] group-hover:text-zinc-900 transition-colors truncate">How black holes work</span>
                        </div>
                     </li>
                   </>
                 )}
               </ul>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
