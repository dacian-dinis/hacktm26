import { Loader2, ShieldCheck } from "lucide-react";

export function ReportSkeleton() {
  const tiers = [
    ["T1", "Provenance"],
    ["T2", "Forensics"],
    ["T3", "Deepfake model"],
    ["T4", "OSINT"],
  ];

  return (
    <div
      className="mx-auto flex max-w-5xl flex-col gap-4"
      role="status"
      aria-live="polite"
      aria-label="Verifying - running checks across all four tiers"
    >
      <span className="sr-only">
        Verifying - running checks across all four tiers
      </span>
      <div className="rounded border border-emerald-700/50 bg-slate-950/80 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded border border-emerald-700/60 bg-emerald-950/40">
            <ShieldCheck className="h-6 w-6 text-emerald-300" />
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-emerald-400">
              Creating verification case
            </p>
            <p className="text-sm text-slate-300">
              Running provenance, forensic, AI, and OSINT checks.
            </p>
          </div>
          <Loader2 className="ml-auto h-5 w-5 animate-spin text-emerald-400" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {tiers.map(([id, label]) => (
          <div
            key={id}
            className="rounded border border-slate-800 bg-slate-950/70 p-3"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-widest text-slate-500">
                {id}
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
            </div>
            <p className="text-sm font-medium text-slate-100">{label}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded bg-slate-800">
              <div className="h-full w-2/3 animate-pulse rounded bg-emerald-500" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
