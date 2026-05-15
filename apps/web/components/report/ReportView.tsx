"use client";

import type { Report, Tier } from "@/types/report";
import ReportHeader from "./ReportHeader";
import TierCard from "./TierCard";
import ExportButton from "@/components/ExportButton";
import { motion } from "framer-motion";

interface ReportViewProps {
  report: Report;
}

export default function ReportView({ report }: ReportViewProps) {
  // Group findings by tier
  const tiers: Tier[] = [1, 2, 3, 4];
  const grouped = tiers
    .map((t) => ({
      tier: t,
      findings: report.findings.filter((f) => f.tier === t),
    }))
    .filter((g) => g.findings.length > 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Top bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <ReportHeader report={report} />
        <ExportButton report={report} />
      </div>

      {/* Tier cards */}
      <div className="space-y-4">
        {grouped.map((g, i) => (
          <TierCard
            key={g.tier}
            tier={g.tier}
            findings={g.findings}
            index={i}
          />
        ))}
      </div>

      {/* Empty state */}
      {report.findings.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No findings were produced for this input.
          </p>
        </div>
      )}
    </motion.div>
  );
}
