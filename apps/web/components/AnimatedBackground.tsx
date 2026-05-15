"use client";

import { motion } from "framer-motion";

export default function AnimatedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Dot grid */}
      <div className="dot-grid absolute inset-0 opacity-40" />

      {/* Gradient orbs */}
      <motion.div
        className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full opacity-[0.07]"
        style={{
          background:
            "radial-gradient(circle, hsl(160 84% 50%) 0%, transparent 70%)",
        }}
        animate={{
          x: [0, 80, -40, 0],
          y: [0, -60, 40, 0],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/3 -right-32 h-[500px] w-[500px] rounded-full opacity-[0.05]"
        style={{
          background:
            "radial-gradient(circle, hsl(221 83% 53%) 0%, transparent 70%)",
        }}
        animate={{
          x: [0, -60, 30, 0],
          y: [0, 50, -30, 0],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-32 left-1/3 h-[400px] w-[400px] rounded-full opacity-[0.04]"
        style={{
          background:
            "radial-gradient(circle, hsl(280 70% 50%) 0%, transparent 70%)",
        }}
        animate={{
          x: [0, 40, -60, 0],
          y: [0, -40, 20, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Scan line */}
      <div
        className="absolute left-0 right-0 h-px opacity-[0.03]"
        style={{
          background:
            "linear-gradient(90deg, transparent, hsl(var(--accent)), transparent)",
          animation: "scan-line 8s linear infinite",
        }}
      />
    </div>
  );
}
