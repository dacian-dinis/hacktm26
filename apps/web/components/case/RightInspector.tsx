"use client";

import { reliabilityFor } from "@/types/case";
import type { Finding } from "@/types/report";

export function RightInspector({
  finding,
  onClear,
}: {
  finding: Finding | null;
  onClear: () => void;
}) {
  return (
    <aside className="flex h-full w-80 flex-col border-l border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-200">
      <header className="mb-2 flex items-center justify-between border-b border-slate-800 pb-1.5">
        <span className="font-mono uppercase tracking-widest text-slate-400">
          Inspector
        </span>
        {finding && (
          <button
            type="button"
            onClick={onClear}
            className="text-slate-500 hover:text-slate-200"
          >
            clear
          </button>
        )}
      </header>
      {!finding ? (
        <div className="flex flex-1 items-center justify-center px-4 text-center text-slate-500">
          Select a finding to inspect method, evidence, and limitations.
        </div>
      ) : (
        <div className="flex flex-col gap-3 overflow-y-auto">
          <Row label="check" value={finding.check} mono />
          <Row label="tier" value={`T${finding.tier}`} />
          <Row label="result" value={finding.result.toUpperCase()} />
          <Row label="confidence" value={finding.confidence} />
          <Row label="reliability" value={reliabilityFor(finding)} />
          <Row label="source" value={finding.source} mono />
          <Row
            label="timestamp"
            value={finding.timestamp}
            mono
          />
          <div>
            <div className="mb-1 font-mono uppercase tracking-widest text-slate-500">
              evidence
            </div>
            <pre className="overflow-x-auto rounded bg-slate-900/80 p-2 font-mono text-[10.5px] leading-snug text-slate-200">
              {JSON.stringify(evidenceWithoutBlobs(finding), null, 2)}
            </pre>
          </div>
        </div>
      )}
    </aside>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
        {label}
      </span>
      <span className={mono ? "break-all font-mono" : ""}>{value}</span>
    </div>
  );
}

function evidenceWithoutBlobs(f: Finding): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f.evidence)) {
    if (k.endsWith("_base64") && typeof v === "string")
      out[k] = `<${v.length}b base64 omitted>`;
    else out[k] = v;
  }
  return out;
}
