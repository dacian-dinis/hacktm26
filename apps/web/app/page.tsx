"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Report } from "@/types/report";
import { verifyImage, runDemo } from "@/lib/api";

import Navbar from "@/components/Navbar";
import AnimatedBackground from "@/components/AnimatedBackground";
import LoadingScreen from "@/components/LoadingScreen";
import UploadZone from "@/components/UploadZone";
import DemoExamples from "@/components/DemoExamples";
import WhyPanel from "@/components/WhyPanel";
import ReportView from "@/components/report/ReportView";

export default function Home() {
  const [report, setReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (file?: File, url?: string, query?: string) => {
    setIsLoading(true);
    setError(null);
    setReport(null);
    try {
      // Simulate slight network delay for dramatic effect if it's too fast
      const [res] = await Promise.all([
        verifyImage(file, url, query),
        new Promise((resolve) => setTimeout(resolve, 800)),
      ]);
      setReport(res);
    } catch (err: any) {
      setError(err.message || "Verification failed");
      setIsLoading(false);
    }
  };

  const handleDemoSelect = async (slug: string) => {
    setIsLoading(true);
    setError(null);
    setReport(null);
    try {
      const [res] = await Promise.all([
        runDemo(slug),
        new Promise((resolve) => setTimeout(resolve, 800)),
      ]);
      setReport(res);
    } catch (err: any) {
      setError(err.message || "Demo verification failed");
      setIsLoading(false);
    }
  };

  const handleLoadingComplete = () => {
    setIsLoading(false);
    // Smooth scroll to report
    setTimeout(() => {
      document.getElementById("report-section")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  };

  return (
    <>
      <Navbar />
      <AnimatedBackground />
      {isLoading && <LoadingScreen onComplete={handleLoadingComplete} />}

      <main className="relative z-10 mx-auto min-h-screen max-w-5xl px-6 pt-32 pb-24">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium tracking-wide text-muted-foreground">
            <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse-glow" />
            HackTM 2026 · Defense Track
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
            Verify media with{" "}
            <span className="text-gradient">provenance</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground md:text-xl">
            A verification workbench for synthetic and sourced media. Every check emits a structured, signed finding — the output is an audit trail, not a confidence score.
          </p>
        </motion.div>

        {/* Upload Interface */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16"
          id="verify"
        >
          <div className="glass-strong rounded-2xl p-6 md:p-8 shadow-2xl">
            <UploadZone onSubmit={handleVerify} isLoading={isLoading} />
            
            <div className="mt-8 border-t border-border/50 pt-6">
              <DemoExamples onSelect={handleDemoSelect} isLoading={isLoading} />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-6 overflow-hidden rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Report Section */}
        <AnimatePresence mode="wait">
          {report && !isLoading && (
            <motion.div
              key={report.input_hash}
              id="report-section"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mt-16 scroll-m-24"
            >
              <h2 className="mb-6 text-2xl font-bold tracking-tight text-foreground">
                Verification Report
              </h2>
              <ReportView report={report} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Methodology */}
        <WhyPanel />
      </main>
    </>
  );
}
