"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedBackgroundProps {
  className?: string;
}

export function AnimatedBackground({ className }: AnimatedBackgroundProps) {
  return (
    <div className={cn("fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-zinc-50 dark:bg-zinc-950", className)}>
      {/* Base Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      
      {/* Animated Orbs */}
      <motion.div
        animate={{
          x: ["0%", "50%", "0%", "-50%", "0%"],
          y: ["0%", "-30%", "20%", "-20%", "0%"],
          scale: [1, 1.2, 0.8, 1.1, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] bg-orange-400/20 dark:bg-orange-500/20 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen"
      />

      <motion.div
        animate={{
          x: ["0%", "-40%", "20%", "40%", "0%"],
          y: ["0%", "40%", "-20%", "30%", "0%"],
          scale: [1, 0.9, 1.3, 0.9, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute top-1/3 right-1/4 w-[35vw] h-[35vw] bg-blue-400/20 dark:bg-blue-500/20 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen"
      />

      <motion.div
        animate={{
          x: ["0%", "30%", "-30%", "20%", "0%"],
          y: ["0%", "20%", "40%", "-30%", "0%"],
          scale: [1, 1.1, 0.9, 1.2, 1],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute bottom-1/4 left-1/3 w-[30vw] h-[30vw] bg-purple-400/20 dark:bg-purple-500/20 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen"
      />
      
      {/* Noise Overlay applied globally */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] mix-blend-overlay pointer-events-none" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noiseFilter\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.65\" numOctaves=\"3\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23noiseFilter)\"/%3E%3C/svg%3E')" }}></div>
    </div>
  );
}
