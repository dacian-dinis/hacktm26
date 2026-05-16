"use client";

import { useMemo, useState } from "react";
import type { CaseContext, ReliabilityLabel } from "@/types/case";
import type { Finding } from "@/types/report";

interface OverlayTile {
  id: string;
  label: string;
  reliability: ReliabilityLabel;
  src: string | null;
  detail: string;
  finding?: Finding;
}

export function MediaStrip({
  ctx,
  findings,
  onSelect,
}: {
  ctx: CaseContext;
  findings: Finding[];
  onSelect: (f: Finding) => void;
}) {
  const tiles = useTiles(ctx, findings);
  const [active, setActive] = useState<string>("original");
  const current = tiles.find((t) => t.id === active) ?? tiles[0];

  return (
    <section
      aria-label="Media viewer"
      className="border-b border-slate-800 bg-slate-950/80"
    >
      <div className="flex">
        <div className="flex h-56 w-56 shrink-0 items-center justify-center border-r border-slate-800 bg-black/40">
          {current?.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.src}
              alt={current.label}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="px-2 text-center text-[11px] italic text-slate-500">
              {current?.detail ?? "No media loaded"}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1.5 text-[11px] uppercase tracking-widest text-slate-400">
            <span className="font-mono">
              {current?.label} ·{" "}
              <span className="text-slate-500">{current?.reliability}</span>
            </span>
            <span className="font-mono text-slate-500">
              {ctx.preview?.name ?? ctx.intake.mediaUrl ?? "—"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-px overflow-hidden bg-slate-800 md:grid-cols-6">
            {tiles.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActive(t.id);
                  if (t.finding) onSelect(t.finding);
                }}
                className={
                  "flex h-[178px] flex-col items-stretch bg-slate-950 text-left transition " +
                  (active === t.id
                    ? "ring-2 ring-emerald-500"
                    : "hover:bg-slate-900")
                }
              >
                <div className="flex flex-1 items-center justify-center overflow-hidden bg-black/40">
                  {t.src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.src}
                      alt={t.label}
                      className="max-h-full max-w-full object-cover"
                    />
                  ) : (
                    <span className="px-2 text-center text-[10px] italic text-slate-600">
                      {t.detail}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-slate-800 px-1.5 py-1 text-[10px] uppercase tracking-widest">
                  <span className="font-mono text-slate-300">{t.label}</span>
                  <ReliabilityDot reliability={t.reliability} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function useTiles(ctx: CaseContext, findings: Finding[]): OverlayTile[] {
  return useMemo(() => {
    const ela = findings.find((f) => f.check === "forensics.ela");
    const noise = findings.find((f) => f.check === "forensics.noise_residual");
    const elaPng = (ela?.evidence as Record<string, unknown> | undefined)
      ?.overlay_png_base64 as string | undefined;
    const noisePng = (noise?.evidence as Record<string, unknown> | undefined)
      ?.residual_png_base64 as string | undefined;

    const tiles: OverlayTile[] = [
      {
        id: "original",
        label: "Original",
        reliability: "Deterministic",
        src: ctx.preview?.url ?? null,
        detail: "No media preview",
      },
      {
        id: "ela",
        label: "ELA",
        reliability: "Inspectable",
        src: elaPng ? `data:image/png;base64,${elaPng}` : null,
        detail: "ELA overlay unavailable",
        finding: ela,
      },
      {
        id: "noise",
        label: "Noise",
        reliability: "Inspectable",
        src: noisePng ? `data:image/png;base64,${noisePng}` : null,
        detail: "Noise residual unavailable",
        finding: noise,
      },
      {
        id: "copy-move",
        label: "Copy-move",
        reliability: "Experimental",
        src: null,
        detail: "Backlog #5 — ORB+RANSAC clone detector",
      },
      {
        id: "jpeg",
        label: "JPEG",
        reliability: "Experimental",
        src: null,
        detail: "Backlog #4 — quantization + double-compression",
      },
      {
        id: "attention",
        label: "AI attention",
        reliability: "Probabilistic",
        src: null,
        detail: "Not exposed by the HF Inference API for this model",
      },
    ];
    return tiles;
  }, [ctx.preview?.url, findings]);
}

function ReliabilityDot({ reliability }: { reliability: ReliabilityLabel }) {
  const cls =
    reliability === "Deterministic"
      ? "bg-emerald-500"
      : reliability === "Inspectable"
        ? "bg-sky-500"
        : reliability === "Probabilistic"
          ? "bg-amber-500"
          : reliability === "External-source dependent"
            ? "bg-violet-500"
            : reliability === "Missing input"
              ? "bg-red-500"
              : "bg-slate-500";
  return (
    <span
      title={reliability}
      className={"inline-block h-1.5 w-1.5 rounded-full " + cls}
    />
  );
}
