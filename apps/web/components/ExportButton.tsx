"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Check, Loader2 } from "lucide-react";
import type { Report } from "@/types/report";
import { exportReport } from "@/lib/api";

interface ExportButtonProps {
  report: Report;
}

export default function ExportButton({ report }: ExportButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  const handleExport = async () => {
    if (state !== "idle") return;
    setState("loading");
    try {
      const blob = await exportReport(report);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `veritas-report-${report.input_hash.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setState("done");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("idle");
    }
  };

  return (
    <motion.button
      onClick={handleExport}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-all hover:border-accent/40 hover:bg-accent/5"
    >
      <AnimatePresence mode="wait">
        {state === "loading" ? (
          <motion.span
            key="loading"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
          >
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
          </motion.span>
        ) : state === "done" ? (
          <motion.span
            key="done"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
          >
            <Check className="h-4 w-4 text-accent" />
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
          >
            <Download className="h-4 w-4" />
          </motion.span>
        )}
      </AnimatePresence>
      {state === "loading"
        ? "Generating…"
        : state === "done"
        ? "Downloaded"
        : "Export PDF"}
    </motion.button>
  );
}
