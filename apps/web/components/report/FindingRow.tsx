"use client";

import { motion } from "framer-motion";
import type { Finding, Result, Confidence } from "@/types/report";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface FindingRowProps {
  finding: Finding;
  index: number;
}

const resultConfig: Record<Result, { label: string; color: string; bg: string }> = {
  pass: {
    label: "PASS",
    color: "text-accent",
    bg: "bg-accent/10 border-accent/20",
  },
  fail: {
    label: "FAIL",
    color: "text-danger",
    bg: "bg-danger/10 border-danger/20",
  },
  indeterminate: {
    label: "INDETERMINATE",
    color: "text-warning",
    bg: "bg-warning/10 border-warning/20",
  },
};

const confidenceColors: Record<Confidence, string> = {
  deterministic: "text-accent bg-accent/10",
  high: "text-emerald-400 bg-emerald-400/10",
  medium: "text-warning bg-warning/10",
  low: "text-muted-foreground bg-card",
};

export default function FindingRow({ finding, index }: FindingRowProps) {
  const [expanded, setExpanded] = useState(false);
  const rc = resultConfig[finding.result];

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="group border-b border-border/50 last:border-0"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-card/80"
      >
        {/* Expand icon */}
        <span className="text-muted-foreground">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>

        {/* Check name */}
        <span className="flex-1 truncate text-sm text-foreground">
          {finding.check}
        </span>

        {/* Confidence pill */}
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
            confidenceColors[finding.confidence]
          }`}
        >
          {finding.confidence}
        </span>

        {/* Result badge */}
        <span
          className={`rounded-md border px-2.5 py-0.5 text-xs font-bold tracking-wider ${rc.bg} ${rc.color}`}
        >
          {rc.label}
        </span>
      </button>

      {/* Expanded evidence */}
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="space-y-2 px-4 pb-4 pl-11">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                Source:{" "}
                <span className="font-mono text-foreground/70">
                  {finding.source}
                </span>
              </span>
              <span>
                {new Date(finding.timestamp).toLocaleString()}
              </span>
            </div>
            {Object.keys(finding.evidence).length > 0 && (
              <pre className="overflow-x-auto rounded-lg bg-background p-3 text-xs text-muted-foreground">
                <code>{JSON.stringify(finding.evidence, null, 2)}</code>
              </pre>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
