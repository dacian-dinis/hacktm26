"use client";

import type { CaseStatus } from "@/types/case";

const STATUS_ORDER: CaseStatus[] = ["intake", "triage", "assessment", "signed"];

const STATUS_LABELS: Record<CaseStatus, string> = {
  intake: "Intake",
  triage: "Triage",
  assessment: "Assessment",
  signed: "Signed",
};

export function TopBar({
  caseId,
  handling,
  analystName,
  status,
  onDownloadJson,
  onExportPdf,
  busy,
}: {
  caseId: string;
  handling: string;
  analystName: string | null;
  status: CaseStatus;
  onDownloadJson?: () => void;
  onExportPdf?: () => void;
  busy?: boolean;
}) {
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-800 bg-slate-950 px-4 py-2 text-xs text-slate-200">
      <div className="flex items-center gap-2">
        <span className="font-semibold tracking-widest text-emerald-400">VERITAS</span>
        <span className="text-slate-500">workbench</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-slate-500">CASE</span>
        <span className="font-mono text-slate-100">{caseId}</span>
      </div>
      <div className="rounded border border-amber-600/60 bg-amber-950/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-amber-300">
        {handling}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-slate-500">ANALYST</span>
        <span className="text-slate-100">{analystName ?? "—"}</span>
      </div>
      <StatusStrip status={status} />
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onDownloadJson}
          disabled={busy || !onDownloadJson}
          className="rounded border border-slate-700 px-2 py-1 font-mono text-[11px] text-slate-200 hover:border-emerald-500 hover:text-emerald-300 disabled:opacity-40"
        >
          Evidence JSON
        </button>
        <button
          type="button"
          onClick={onExportPdf}
          disabled={busy || !onExportPdf}
          className="rounded border border-emerald-600 bg-emerald-700/30 px-2 py-1 font-mono text-[11px] text-emerald-200 hover:bg-emerald-700/50 disabled:opacity-40"
        >
          Brief PDF
        </button>
      </div>
    </header>
  );
}

function StatusStrip({ status }: { status: CaseStatus }) {
  return (
    <div className="flex items-center gap-1">
      {STATUS_ORDER.map((s) => {
        const active = s === status;
        const past = STATUS_ORDER.indexOf(s) < STATUS_ORDER.indexOf(status);
        return (
          <span
            key={s}
            className={
              "rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest " +
              (active
                ? "bg-emerald-600 text-slate-950"
                : past
                  ? "bg-slate-700 text-slate-300"
                  : "border border-slate-700 text-slate-500")
            }
          >
            {STATUS_LABELS[s]}
          </span>
        );
      })}
    </div>
  );
}
