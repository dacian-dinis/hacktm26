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
