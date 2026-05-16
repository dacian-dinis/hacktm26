"use client";

import type { Finding } from "@/types/report";

export function Tier3Banner({ findings }: { findings: Finding[] }) {
  const ev = (findings[0]?.evidence ?? {}) as Record<string, unknown>;
  const model =
    typeof ev.model === "string" ? ev.model : "(model name unavailable)";
  const trainingData =
    typeof ev.training_data === "string" ? ev.training_data : null;
  const label = typeof ev.model_label === "string" ? ev.model_label : null;
  const score =
    typeof ev.model_score === "number" ? Math.round(ev.model_score * 100) : null;

  return (
    <div
      role="note"
      className="rounded border border-emerald-500/60 bg-emerald-950/30 p-3 text-xs leading-relaxed text-emerald-100"
    >
      <p className="font-mono uppercase tracking-wide text-emerald-300">
        Deepfake model result
      </p>
      {label && score !== null ? (
        <p className="mt-1 text-base font-semibold text-emerald-50">
          {label}: <span className="font-mono">{score}%</span>
        </p>
      ) : (
        <p className="mt-1 text-base font-semibold text-emerald-50">
          Model running
        </p>
      )}
      <p className="mt-1 text-emerald-200">
        <span className="font-mono">{model}</span>
        {trainingData && (
          <>
            {" "}
            - trained on <span className="font-mono">{trainingData}</span>
          </>
        )}
      </p>
    </div>
  );
}
