"use client";

import { PANEL_LABELS, PANEL_ORDER, type PanelId } from "@/types/case";

interface NavBadgeCounts {
  provenance?: number;
  forensics?: number;
  osint?: number;
  hypotheses?: number;
  tensions?: number;
  gaps?: number;
  claims?: number;
}

export function LeftNav({
  active,
  onSelect,
  badges = {},
}: {
  active: PanelId;
  onSelect: (id: PanelId) => void;
  badges?: NavBadgeCounts;
}) {
  return (
    <nav
      aria-label="Case sections"
      className="flex h-full w-56 flex-col gap-1 border-r border-slate-800 bg-slate-950/80 p-2 text-sm text-slate-300"
    >
      {PANEL_ORDER.map((id) => {
        const isActive = id === active;
        const count = (badges as Record<string, number | undefined>)[id];
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={
              "flex items-center justify-between rounded px-2 py-1.5 text-left transition-colors " +
              (isActive
                ? "bg-emerald-600/20 text-emerald-200 ring-1 ring-emerald-600/40"
                : "hover:bg-slate-800/60 hover:text-slate-100")
            }
          >
            <span className="truncate">{PANEL_LABELS[id]}</span>
            {typeof count === "number" && count > 0 && (
              <span className="rounded bg-slate-800 px-1.5 font-mono text-[10px] text-slate-300">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
