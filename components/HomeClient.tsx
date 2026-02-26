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
import { AnimatedBackground } from "@/components/ui/animated-background";
import { GlassCard } from "@/components/ui/glass-card";
import { motion } from "framer-motion";
import { Play, CheckCircle2, Star, Sparkles, ArrowRight } from "lucide-react";

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
    <div className="relative min-h-screen font-sans overflow-hidden">
      <AnimatedBackground />

      {/* Main Content Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-12 py-8 flex flex-col min-h-screen">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-zinc-900 dark:bg-zinc-100 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white dark:text-black" />
            </div>
            <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">LearnIt</span>
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-400">
             {user ? (
               <Button variant="ghost" className="font-semibold" onClick={handleSignOut}>Sign Out</Button>
             ) : (
               <Button variant="default" className="rounded-full px-6 font-semibold shadow-lg shadow-primary/20">Log In</Button>
             )}
          </div>
        </header>

        {/* Hero Section */}
        <div className="grid lg:grid-cols-2 gap-16 items-center flex-grow mb-24">
          
          {/* Left Column: Typography & Input */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col gap-8 max-w-xl"
          >
            <h1 className="text-6xl sm:text-7xl font-bold tracking-tighter text-zinc-900 dark:text-zinc-50 leading-[1.1]">
              Learn <span className="text-transparent bg-clip-text bg-linear-to-r from-orange-500 to-rose-500">Podcasts.</span><br/>
              Faster.
            </h1>
            
            <p className="text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-md">
              Harness AI to create deeply personalized, interactive podcast courses tailored to your exact learning goals.
            </p>

            <GlassCard padding="lg" variant="highlight" className="mt-4 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/10 dark:from-white/10 dark:to-transparent pointer-events-none" />
              <div className="relative z-10 flex flex-col gap-4">
                <Textarea 
                  placeholder="What do you want to master today? e.g. Basics of Quantum Physics..."
                  className="min-h-[100px] text-lg p-4 resize-none bg-white/50 dark:bg-black/30 backdrop-blur-sm border-zinc-200/50 dark:border-zinc-800/50 focus-visible:ring-orange-500/50 placeholder:text-zinc-400"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4 bg-white/40 dark:bg-black/20 px-3 py-2 rounded-lg backdrop-blur-md border border-zinc-200/30 dark:border-zinc-800/30">
                     <RadioGroup 
                      value={modelName} 
                      onValueChange={setModelName} 
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="gemini-2.5-flash" id="home-m-flash" className="w-4 h-4" />
                        <Label htmlFor="home-m-flash" className="cursor-pointer text-xs font-medium">Flash</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="gpt-4o-mini" id="home-m-openai" className="w-4 h-4" />
                        <Label htmlFor="home-m-openai" className="cursor-pointer text-xs font-medium">GPT-4o</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  
                  <Button 
                    size="lg" 
                    className="w-full sm:w-auto font-semibold px-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 shadow-xl transition-all hover:scale-105 active:scale-95 flex gap-2 items-center"
                    onClick={handleCreate}
                    disabled={isGenerating || !topic.trim()}
                  >
                    {isGenerating ? "Generating..." : "Generate Course"}
                    {!isGenerating && <Sparkles className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </GlassCard>
            
            <div className="flex gap-4 items-center mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
               <div className="flex gap-1 items-center bg-white/40 dark:bg-black/20 px-3 py-1.5 rounded-full backdrop-blur-sm">
                 <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                 <span>Free to try</span>
               </div>
               <div className="flex gap-1 items-center bg-white/40 dark:bg-black/20 px-3 py-1.5 rounded-full backdrop-blur-sm">
                 <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                 <span>No CC required</span>
               </div>
            </div>
          </motion.div>

          {/* Right Column: Floating Decoratives */}
          <div className="relative h-[600px] hidden lg:block perspective-1000">
             {/* Center Large Card */}
             <motion.div
               initial={{ opacity: 0, scale: 0.9, y: 30 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
               className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[480px] rounded-[32px] overflow-hidden shadow-2xl bg-linear-to-br from-orange-400 to-rose-500 flex flex-col justify-end p-6 border border-white/20"
             >
                <div className="absolute top-6 left-6 w-12 h-12 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center">
                  <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                </div>
                
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
                
                {/* Mock image placeholder using gradient */}
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1516321497487-e288fb19713f?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-overlay"></div>

                <GlassCard padding="lg" className="w-full relative z-10 bottom-0 bg-white/20 dark:bg-black/40 border-white/30 backdrop-blur-2xl rounded-2xl">
                   <div className="flex justify-between items-start mb-2">
                     <h3 className="font-bold text-white text-xl">Advanced Marketing</h3>
                     <span className="bg-white/20 text-white text-xs px-2 py-1 rounded-full font-medium backdrop-blur-md">Audio</span>
                   </div>
                   <p className="text-white/80 text-sm mb-4">Master modern acquisition channels in 4 chapters.</p>
                   <div className="flex items-center justify-between mt-auto">
                     <span className="text-white font-bold">$0.00</span>
                     <div className="flex items-center gap-1 text-yellow-400">
                       <Star className="w-4 h-4 fill-current" />
                       <span className="text-sm font-bold text-white">4.9</span>
                     </div>
                   </div>
                </GlassCard>
             </motion.div>

             {/* Floating chat bubbles */}
             <motion.div
               initial={{ opacity: 0, x: -50 }}
               animate={{ opacity: 1, x: 0 }}
               transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
               className="absolute top-1/4 -left-12 z-20"
             >
               <GlassCard padding="sm" className="flex items-center gap-3 rounded-full pr-6 shadow-xl animate-float-slow bg-white/80 dark:bg-black/60">
                 <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                 </div>
                 <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">How is the pacing?</span>
               </GlassCard>
             </motion.div>

             <motion.div
               initial={{ opacity: 0, x: -50 }}
               animate={{ opacity: 1, x: 0 }}
               transition={{ duration: 0.8, delay: 0.8, ease: "easeOut" }}
               className="absolute top-1/3 -left-20 z-20 mt-8"
             >
               <GlassCard padding="sm" className="flex items-center gap-3 rounded-full pr-6 shadow-xl animate-float bg-white/80 dark:bg-black/60">
                 <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                 </div>
                 <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Do you like the content?</span>
               </GlassCard>
             </motion.div>

             {/* Top Right Stats Card */}
             <motion.div
               initial={{ opacity: 0, x: 50, y: -20 }}
               animate={{ opacity: 1, x: 0, y: 0 }}
               transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
               className="absolute top-8 -right-8 z-20"
             >
               <GlassCard padding="md" variant="dark" className="w-[180px] rounded-[24px] animate-float-slow">
                 <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2 font-bold">— Up to</p>
                 <h4 className="text-5xl font-black text-zinc-900 dark:text-white tracking-tighter mb-2">10x</h4>
                 <p className="text-sm text-zinc-600 dark:text-zinc-300 font-medium leading-tight">Faster learning curve</p>
               </GlassCard>
             </motion.div>
          </div>
        </div>

        {/* Existing Courses Section */}
        <section className="mt-12 pb-24 border-t border-zinc-200/50 dark:border-zinc-800/50 pt-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-3">
              Your Journey <ArrowRight className="w-6 h-6 text-orange-500" />
            </h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 w-full rounded-2xl bg-zinc-200/50 dark:bg-zinc-800/50" />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <GlassCard variant="highlight" className="text-center py-24 rounded-[32px] border-dashed">
              <div className="w-16 h-16 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
                <Sparkles className="w-8 h-8 text-orange-400" />
              </div>
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">Your path is empty</h3>
              <p className="text-zinc-500 text-lg max-w-md mx-auto">Start your learning journey by generating your first personalized course above.</p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {courses.map((course) => (
                <Link href={`/course/${course.id}`} key={course.id} className="block group">
                  <GlassCard 
                    className="h-full transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-orange-500/10 border border-zinc-200/50 dark:border-white/5 bg-white/60 dark:bg-zinc-900/50"
                  >
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-100 to-rose-100 dark:from-orange-900/30 dark:to-rose-900/30 flex items-center justify-center">
                          <Play className="w-4 h-4 text-orange-600 dark:text-orange-400 fill-current" />
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                          {course.model.includes('flash') ? 'Flash' : 'GPT-4o'}
                        </span>
                      </div>
                      <CardTitle className="line-clamp-2 text-xl tracking-tight leading-snug group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-linear-to-r group-hover:from-orange-500 group-hover:to-rose-500 transition-all duration-300">
                        {course.topic}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="h-1.5 grow bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-linear-to-r from-orange-400 to-rose-400 w-1/4 rounded-full"></div>
                        </div>
                        <span className="text-xs font-bold text-zinc-500">25%</span>
                      </div>
                      <p className="text-xs font-medium text-zinc-400 mt-6 flex justify-between items-center">
                        <span>Started</span>
                        <span>{new Date(course.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}</span>
                      </p>
                    </CardContent>
                  </GlassCard>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
