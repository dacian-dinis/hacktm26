"use client";

import { motion } from "framer-motion";
import type { Finding, Tier } from "@/types/report";
import { TIER_LABELS } from "@/types/report";
import FindingRow from "./FindingRow";

interface TierCardProps {
  tier: Tier;
  findings: Finding[];
  index: number;
}

const tierAccents: Record<Tier, string> = {
  1: "border-l-accent",
  2: "border-l-info",
  3: "border-l-warning",
  4: "border-l-purple-400",
};

const tierBadgeBg: Record<Tier, string> = {
  1: "bg-accent/10 text-accent",
  2: "bg-info/10 text-info",
  3: "bg-warning/10 text-warning",
  4: "bg-purple-400/10 text-purple-400",
};

export default function TierCard({ tier, findings, index }: TierCardProps) {
  const passCount = findings.filter((f) => f.result === "pass").length;
  const failCount = findings.filter((f) => f.result === "fail").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`overflow-hidden rounded-xl border border-border bg-card/80 border-l-4 ${tierAccents[tier]}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold ${tierBadgeBg[tier]}`}
        >
          T{tier}
        </span>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-foreground">
            {TIER_LABELS[tier]}
          </h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {passCount > 0 && (
            <span className="text-accent">{passCount} pass</span>
          )}
          {failCount > 0 && (
            <span className="text-danger">{failCount} fail</span>
          )}
          <span className="text-muted-foreground">
            {findings.length} check{findings.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Findings */}
      <div>
        {findings.map((finding, i) => (
          <FindingRow
            key={`${finding.check}-${finding.timestamp}`}
            finding={finding}
            index={i}
          />
        ))}
      </div>
    </motion.div>
  );
}
