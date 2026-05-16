"use client";

import type { Finding } from "@/types/report";

export function Tier3Banner({ findings }: { findings: Finding[] }) {
  const ev = (findings[0]?.evidence ?? {}) as Record<string, unknown>;
  const model =
    typeof ev.model === "string" ? ev.model : "(model name unavailable)";
  const trainingData =
    typeof ev.training_data === "string" ? ev.training_data : null;
  return (
    <div
      role="note"
      className="rounded border border-amber-500/60 bg-amber-950/30 p-3 text-xs leading-relaxed text-amber-100"
    >
      <p className="font-mono uppercase tracking-wide text-amber-300">
        AI signal — one input among many. Not authoritative.
      </p>
      <p className="mt-1">
        Model: <span className="font-mono text-amber-200">{model}</span>
        {trainingData && (
          <>
            {" "}
            · trained on <span className="font-mono text-amber-200">{trainingData}</span>
          </>
        )}
      </p>
      <p className="mt-1">
        Tier 3 always returns <span className="font-mono">indeterminate</span>.
        The verdict lives in the layered evidence, not in this classifier.
      </p>
    </div>
  );
}
