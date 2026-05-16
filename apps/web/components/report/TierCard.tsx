"use client";

import { useId, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FindingRow } from "./FindingRow";
import { TIER_LABELS, type Finding, type Tier } from "@/types/report";

export function TierCard({
  tier,
  findings,
}: {
  tier: Tier;
  findings: Finding[];
}) {
  const [open, setOpen] = useState(true);
  const panelId = useId();
  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          aria-expanded={open}
          aria-controls={panelId}
        >
          {open ? (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="text-sm font-semibold">{TIER_LABELS[tier]}</span>
          <span className="ml-auto text-xs text-mutedForeground">
            {findings.length} finding{findings.length === 1 ? "" : "s"}
          </span>
        </button>
      </CardHeader>
      {open && (
        <CardContent id={panelId}>
          {tier === 3 && <Tier3Banner findings={findings} />}
          {findings.length === 0 ? (
            <p className="text-sm text-mutedForeground">No findings yet.</p>
          ) : (
            findings.map((f, i) => <FindingRow key={i} finding={f} />)
          )}
        </CardContent>
      )}
    </Card>
  );
}

function Tier3Banner({ findings }: { findings: Finding[] }) {
  // Model name lives in the first T3 finding's evidence.
  const ev = (findings[0]?.evidence ?? {}) as Record<string, unknown>;
  const model =
    typeof ev.model === "string" ? ev.model : "(model name unavailable)";
  const trainingData =
    typeof ev.training_data === "string" ? ev.training_data : null;
  return (
    <div
      role="note"
      className="mb-4 rounded-md border border-amber-400 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900"
    >
      <p className="font-semibold uppercase tracking-wide">
        AI signal — one input among many. Not authoritative.
      </p>
      <p className="mt-1">
        Model: <span className="font-mono">{model}</span>
        {trainingData && (
          <>
            {" "}
            · trained on <span className="font-mono">{trainingData}</span>
          </>
        )}
      </p>
      <p className="mt-1">
        Tier 3 always returns <span className="font-mono">indeterminate</span>.
        The verdict lives in the layered evidence above, not in this classifier.
      </p>
    </div>
  );
}
