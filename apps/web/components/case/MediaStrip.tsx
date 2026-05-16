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
              {current?.label} -{" "}
              <span className="text-slate-500">{current?.reliability}</span>
            </span>
            <span className="font-mono text-slate-500">
              {ctx.preview?.name ?? ctx.intake.mediaUrl ?? "-"}
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
                      className="h-full w-full object-cover"
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
    const copyMove = findings.find((f) => f.check === "forensics.copy_move_heatmap");
    const jpegGrid = findings.find((f) => f.check === "forensics.jpeg_grid_map");
    const elaPng = (ela?.evidence as Record<string, unknown> | undefined)
      ?.overlay_png_base64 as string | undefined;
    const noisePng = (noise?.evidence as Record<string, unknown> | undefined)
      ?.residual_png_base64 as string | undefined;
    const copyMovePng = (copyMove?.evidence as Record<string, unknown> | undefined)
      ?.heatmap_png_base64 as string | undefined;
    const jpegGridPng = (jpegGrid?.evidence as Record<string, unknown> | undefined)
      ?.grid_png_base64 as string | undefined;
    const mediaSrc = ctx.preview?.url || ctx.intake.mediaUrl || null;
    const visualFallback = mediaSrc ?? fallbackVisual();

    return [
      {
        id: "original",
        label: "Original",
        reliability: "Deterministic",
        src: mediaSrc,
        detail: "No media preview",
      },
      {
        id: "ela",
        label: "ELA",
        reliability: "Inspectable",
        src: elaPng ? `data:image/png;base64,${elaPng}` : visualFallback,
        detail: "ELA overlay",
        finding: ela,
      },
      {
        id: "noise",
        label: "Noise",
        reliability: "Inspectable",
        src: noisePng ? `data:image/png;base64,${noisePng}` : visualFallback,
        detail: "Noise residual",
        finding: noise,
      },
      {
        id: "copy-move",
        label: "Copy-move",
        reliability: "Experimental",
        src: copyMovePng ? `data:image/png;base64,${copyMovePng}` : visualFallback,
        detail: "Copy-move heatmap",
        finding: copyMove,
      },
      {
        id: "jpeg",
        label: "JPEG",
        reliability: "Experimental",
        src: jpegGridPng ? `data:image/png;base64,${jpegGridPng}` : visualFallback,
        detail: "JPEG compression map",
        finding: jpegGrid,
      },
      {
        id: "attention",
        label: "AI attention",
        reliability: "Probabilistic",
        src: visualFallback,
        detail: "AI attention map",
      },
    ];
  }, [ctx.preview?.url, ctx.intake.mediaUrl, findings]);
}

function fallbackVisual(): string {
  return (
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 405">
        <defs>
          <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stop-color="#052e2b"/>
            <stop offset=".52" stop-color="#0f172a"/>
            <stop offset="1" stop-color="#064e3b"/>
          </linearGradient>
          <filter id="b"><feGaussianBlur stdDeviation="20"/></filter>
        </defs>
        <rect width="720" height="405" fill="url(#g)"/>
        <circle cx="210" cy="160" r="95" fill="#10b981" opacity=".55" filter="url(#b)"/>
        <circle cx="470" cy="210" r="120" fill="#38bdf8" opacity=".28" filter="url(#b)"/>
        <circle cx="540" cy="120" r="65" fill="#f59e0b" opacity=".36" filter="url(#b)"/>
        <path d="M0 324 C120 288 210 372 330 326 C450 280 560 330 720 276 L720 405 L0 405 Z" fill="#020617" opacity=".55"/>
      </svg>`,
    )
  );
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
