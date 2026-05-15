"use client";

import { motion } from "framer-motion";
import type { Report } from "@/types/report";
import { Hash, ShieldCheck, ShieldX, Clock } from "lucide-react";

interface ReportHeaderProps {
  report: Report;
}

export default function ReportHeader({ report }: ReportHeaderProps) {
  const passCount = report.findings.filter((f) => f.result === "pass").length;
  const failCount = report.findings.filter((f) => f.result === "fail").length;
  const indCount = report.findings.filter(
    (f) => f.result === "indeterminate"
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-4"
    >
      {/* Hash */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Hash className="h-4 w-4" />
        <span className="font-mono text-xs text-foreground/70">
          {report.input_hash}
        </span>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent">
          <ShieldCheck className="h-4 w-4" />
          {passCount} Pass
        </div>
        {failCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg bg-danger/10 px-3 py-1.5 text-sm font-medium text-danger">
            <ShieldX className="h-4 w-4" />
            {failCount} Fail
          </div>
        )}
        {indCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg bg-warning/10 px-3 py-1.5 text-sm font-medium text-warning">
            <Clock className="h-4 w-4" />
            {indCount} Indeterminate
          </div>
        )}
        <div className="flex items-center gap-1.5 rounded-lg bg-card px-3 py-1.5 text-sm text-muted-foreground">
          {report.findings.length} findings total
        </div>
      </div>

      {/* Signature */}
      {report.analyst_signature && (
        <div className="flex items-center gap-2 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-xs">
          <ShieldCheck className="h-3.5 w-3.5 text-accent" />
          <span className="text-muted-foreground">Signed by</span>
          <span className="font-mono text-foreground">
            {report.analyst_signature}
          </span>
          {report.signed_at && (
            <span className="text-muted-foreground">
              at {new Date(report.signed_at).toLocaleString()}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}
