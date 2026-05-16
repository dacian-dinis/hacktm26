"use client";

// All analysis-console panels live here. Each receives `data` (the case +
// derived structures) and `setSelectedFinding` so clicks route to the
// right inspector.

import { useState } from "react";
import type {
  AssessmentMemo,
  CaseContext,
  ChainEvent,
  CollectionGap,
  DeceptionIndicator,
  EntityEdge,
  EntityNode,
  Hypothesis,
  PlanTask,
  SecurityControl,
  SourceDossier,
  StrengthAxis,
  StrengthLevel,
  StrengthScore,
  SubClaim,
  Tension,
  TimelineEvent,
} from "@/types/case";
import type { Finding } from "@/types/report";
import { reliabilityFor } from "@/types/case";
import { FindingRow } from "@/components/report/FindingRow";
import { Tier3Banner } from "./Tier3Banner";

export interface PanelProps {
  ctx: CaseContext;
  findings: Finding[];
  hypotheses: Hypothesis[];
  timeline: TimelineEvent[];
  tensions: Tension[];
  gaps: CollectionGap[];
  subClaims: SubClaim[];
  strength: StrengthScore;
  deception: DeceptionIndicator[];
  custody: ChainEvent[];
  entities: { nodes: EntityNode[]; edges: EntityEdge[] };
  dossier: SourceDossier | null;
  plan: PlanTask[];
  security: SecurityControl[];
  memo: AssessmentMemo;
  onSelect: (f: Finding) => void;
  onExportPdf: () => void;
  onDownloadJson: () => void;
  busy: boolean;
}

// --- Case Overview -------------------------------------------------------

export function CaseOverviewPanel({
  ctx,
  findings,
  hypotheses,
  gaps,
  tensions,
  strength,
}: PanelProps) {
  const topH = [...hypotheses].sort((a, b) =>
    confidenceRank(b.confidence) - confidenceRank(a.confidence),
  )[0];
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <StrengthBanner strength={strength} />
      </div>
      <Card title="Submission">
        <KV k="Media" v={ctx.preview?.name ?? ctx.intake.mediaUrl ?? "(none)"} />
        <KV k="Source URL" v={ctx.intake.sourceUrl || "—"} />
        <KV k="Claim" v={ctx.intake.claimText || "—"} />
        <KV k="Claimed location" v={ctx.intake.claimedLocation || "—"} />
        <KV k="Claimed date" v={ctx.intake.claimedDateTime || "—"} />
        <KV k="Claimed source" v={ctx.intake.claimedSource || "—"} />
        {ctx.report && (
          <KV k="input_sha256" v={ctx.report.input_hash} mono />
        )}
      </Card>
      <Card title="Top hypothesis">
        {topH ? (
          <>
            <p className="text-sm text-slate-100">
              <span className="font-mono text-emerald-400">{topH.id}</span>{" "}
              · {topH.label}
            </p>
            <ConfidenceBadge confidence={topH.confidence} />
            <p className="mt-2 text-xs text-slate-400">{topH.rationale}</p>
          </>
        ) : (
          <p className="text-sm text-slate-500">No hypotheses derived yet.</p>
        )}
      </Card>
      <Card title="Findings">
        <p className="text-2xl font-semibold text-slate-100">
          {findings.length}
        </p>
        <p className="text-xs text-slate-500">
          deterministic · inspectable · probabilistic · external
        </p>
      </Card>
      <Card title="Open tensions">
        <p className="text-2xl font-semibold text-amber-400">{tensions.length}</p>
        <p className="text-xs text-slate-500">cross-tier contradictions</p>
      </Card>
      <Card title="Collection gaps">
        <p className="text-2xl font-semibold text-slate-100">{gaps.length}</p>
        <p className="text-xs text-slate-500">
          missing inputs that limit confidence
        </p>
      </Card>
      <Card title="Reminder">
        <p className="text-xs italic text-slate-400">
          The verdict lives in the layered evidence, not in any single
          classifier. T3 is one input among many — never authoritative.
        </p>
      </Card>
    </div>
  );
}

// --- Media Evidence ------------------------------------------------------

export function MediaEvidencePanel({ ctx, findings }: PanelProps) {
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
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card title="Original">
        {mediaSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaSrc}
            alt={ctx.preview?.name ?? "submitted media"}
            className="w-full rounded border border-slate-800"
          />
        ) : (
          <Placeholder>No preview available</Placeholder>
        )}
      </Card>
      <Card title="ELA · Inspectable">
        {elaPng ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/png;base64,${elaPng}`}
            alt="ELA overlay"
            className="w-full rounded border border-slate-800"
          />
        ) : (
          <Placeholder>ELA overlay unavailable</Placeholder>
        )}
      </Card>
      <Card title="Noise residual · Inspectable">
        {noisePng ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/png;base64,${noisePng}`}
            alt="Noise residual"
            className="w-full rounded border border-slate-800"
          />
        ) : (
          <Placeholder>Noise residual unavailable</Placeholder>
        )}
      </Card>
      <Card title="Copy-move heatmap · Experimental">
        {copyMovePng ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/png;base64,${copyMovePng}`}
            alt="Copy-move heatmap"
            className="w-full rounded border border-slate-800"
          />
        ) : (
          <ImageFallback src={mediaSrc} alt="Copy-move heatmap unavailable" />
        )}
      </Card>
      <Card title="JPEG compression map · Experimental">
        {jpegGridPng ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/png;base64,${jpegGridPng}`}
            alt="JPEG compression map"
            className="w-full rounded border border-slate-800"
          />
        ) : (
          <ImageFallback src={mediaSrc} alt="JPEG compression map unavailable" />
        )}
      </Card>
      <Card title="AI attention map · Tier 3">
        <ImageFallback src={mediaSrc} alt="AI attention map" />
      </Card>
    </div>
  );
}

function ImageFallback({ src, alt }: { src: string | null; alt: string }) {
  const fallbackSvg =
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 405">
        <defs>
          <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stop-color="#052e2b"/>
            <stop offset="0.48" stop-color="#0f172a"/>
            <stop offset="1" stop-color="#064e3b"/>
          </linearGradient>
          <filter id="blur"><feGaussianBlur stdDeviation="18"/></filter>
        </defs>
        <rect width="720" height="405" fill="url(#g)"/>
        <circle cx="210" cy="160" r="95" fill="#10b981" opacity=".55" filter="url(#blur)"/>
        <circle cx="470" cy="210" r="120" fill="#38bdf8" opacity=".28" filter="url(#blur)"/>
        <circle cx="540" cy="120" r="65" fill="#f59e0b" opacity=".38" filter="url(#blur)"/>
        <path d="M0 324 C120 288 210 372 330 326 C450 280 560 330 720 276 L720 405 L0 405 Z" fill="#020617" opacity=".5"/>
      </svg>`,
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src ?? fallbackSvg}
      alt={alt}
      className="aspect-video w-full rounded border border-slate-800 object-cover opacity-90 saturate-125"
    />
  );
}

// --- Provenance / Forensics / OSINT --------------------------------------

export function TierPanel({
  tier,
  findings,
  onSelect,
}: {
  tier: 1 | 2 | 3 | 4;
  findings: Finding[];
  onSelect: (f: Finding) => void;
}) {
  if (findings.length === 0)
    return <Placeholder>No findings in this tier.</Placeholder>;
  return (
    <div className="flex flex-col gap-3">
      {tier === 3 && <Tier3Banner findings={findings} />}
      {findings.map((f, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(f)}
          className="rounded border border-slate-800 bg-slate-950/60 p-2 text-left transition hover:border-emerald-600/60"
        >
          <div className="mb-1 flex items-center gap-2 text-xs">
            <span className="font-mono text-slate-200">{f.check}</span>
            <ResultChip r={f.result} />
            <ReliabilityChip label={reliabilityFor(f)} />
            <span className="ml-auto font-mono text-[10px] text-slate-500">
              {f.confidence}
            </span>
          </div>
          <FindingRow finding={f} />
        </button>
      ))}
    </div>
  );
}

// --- Source Dossier -----------------------------------------------------

export function SourceNetworkPanel({ findings, ctx, dossier }: PanelProps) {
  if (!dossier)
    return (
      <Placeholder>
        No source supplied. Add a source URL or claimed source on intake to
        populate the dossier.
      </Placeholder>
    );
  const sourceRep = findings.find((f) => f.check === "source.reputation.lookup");
  const telegram = findings.find((f) => f.check === "osint.telegram.reputation");
  return (
    <div className="flex flex-col gap-3">
      <Card title={`Identity · ${dossier.identity}`}>
        <KV k="Type" v={dossier.type.replace(/_/g, " ")} mono />
        <div className="mt-2 flex flex-wrap gap-1">
          {dossier.labels.map((l) => (
            <span
              key={l}
              className="rounded border border-slate-700 bg-slate-900/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-slate-300"
            >
              {l}
            </span>
          ))}
        </div>
      </Card>
      <Card title="Reliability history">
        <p className="text-xs text-slate-200">{dossier.reliabilityHistory}</p>
      </Card>
      <Card title="Amplification behavior">
        <p className="text-xs text-slate-200">{dossier.amplificationBehavior}</p>
      </Card>
      <Card title="Linked entities">
        {dossier.linkedEntities.length === 0 ? (
          <Placeholder>None recorded yet.</Placeholder>
        ) : (
          <ul className="space-y-0.5 text-xs">
            {dossier.linkedEntities.map((e, i) => (
              <li key={i} className="text-slate-200">
                · {e}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Caveats">
        {dossier.caveats.length === 0 ? (
          <Placeholder>No caveats recorded.</Placeholder>
        ) : (
          <ul className="space-y-0.5 text-xs">
            {dossier.caveats.map((c, i) => (
              <li key={i} className="text-amber-200">
                ⚠ {c}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Backing tier-4 findings">
        {sourceRep ? <FindingRow finding={sourceRep} /> : <Placeholder>No source-reputation finding for this case.</Placeholder>}
        {telegram && (
          <div className="mt-2">
            <FindingRow finding={telegram} />
          </div>
        )}
      </Card>
    </div>
  );
}

// --- Timeline ------------------------------------------------------------

export function TimelinePanel({ timeline }: PanelProps) {
  if (timeline.length === 0)
    return <Placeholder>No timeline events yet.</Placeholder>;
  return (
    <ol className="relative flex flex-col gap-3 border-l border-slate-700 pl-6">
      {timeline.map((e, i) => (
        <li key={i} className="relative">
          <span
            className={
              "absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-slate-950 " +
              (e.conflict ? "bg-red-500" : "bg-emerald-500")
            }
          />
          <div className="flex flex-wrap items-baseline gap-2">
            <time className="font-mono text-xs text-slate-300">{e.at}</time>
            <span className="rounded bg-slate-800 px-1.5 font-mono text-[10px] uppercase text-slate-400">
              {e.source}
            </span>
            <span className="text-sm text-slate-100">{e.label}</span>
          </div>
          {e.detail && (
            <p className="mt-0.5 text-xs text-slate-400">{e.detail}</p>
          )}
          {e.conflict && (
            <p className="mt-1 rounded border border-red-600/40 bg-red-900/20 p-1.5 text-xs text-red-200">
              ⚠ {e.conflict}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

// --- Hypotheses ----------------------------------------------------------

export function HypothesesPanel({ hypotheses }: PanelProps) {
  if (hypotheses.length === 0)
    return <Placeholder>No hypotheses derived yet.</Placeholder>;
  return (
    <div className="overflow-x-auto rounded border border-slate-800">
      <table className="w-full text-xs">
        <thead className="bg-slate-900/80 text-left text-slate-400">
          <tr>
            <th className="px-3 py-2">Hypothesis</th>
            <th className="px-3 py-2">Supporting</th>
            <th className="px-3 py-2">Contradicting</th>
            <th className="px-3 py-2">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {hypotheses.map((h) => (
            <tr key={h.id} className="border-t border-slate-800 align-top">
              <td className="px-3 py-2">
                <div className="font-mono text-emerald-400">{h.id}</div>
                <div className="text-sm text-slate-100">{h.label}</div>
                <p className="mt-1 text-[11px] text-slate-400">{h.rationale}</p>
              </td>
              <td className="px-3 py-2">
                {h.supporting.length === 0 ? (
                  <span className="text-slate-600">—</span>
                ) : (
                  <ul className="space-y-0.5 text-slate-200">
                    {h.supporting.map((r, i) => (
                      <li key={i}>
                        <span className="font-mono text-[10.5px] text-slate-400">
                          {r.check}
                        </span>{" "}
                        — {r.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="px-3 py-2">
                {h.contradicting.length === 0 ? (
                  <span className="text-slate-600">—</span>
                ) : (
                  <ul className="space-y-0.5 text-slate-200">
                    {h.contradicting.map((r, i) => (
                      <li key={i}>
                        <span className="font-mono text-[10.5px] text-slate-400">
                          {r.check}
                        </span>{" "}
                        — {r.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="px-3 py-2">
                <ConfidenceBadge confidence={h.confidence} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Tensions ------------------------------------------------------------

export function TensionsPanel({ tensions }: PanelProps) {
  if (tensions.length === 0)
    return (
      <Placeholder>
        No tensions detected. Evidence sources are consistent so far.
      </Placeholder>
    );
  return (
    <ul className="flex flex-col gap-3">
      {tensions.map((t) => (
        <li
          key={t.id}
          className={
            "rounded border p-3 " +
            (t.severity === "high"
              ? "border-red-600/60 bg-red-950/30"
              : t.severity === "medium"
                ? "border-amber-600/60 bg-amber-950/30"
                : "border-slate-700 bg-slate-900/60")
          }
        >
          <div className="mb-1 flex items-center gap-2 text-xs">
            <span className="font-mono uppercase tracking-widest text-slate-400">
              {t.severity}
            </span>
            <span className="font-mono text-slate-500">{t.id}</span>
          </div>
          <p className="text-sm text-slate-100">{t.statement}</p>
          <p className="mt-2 text-xs text-slate-400">
            <span className="font-mono uppercase tracking-widest text-slate-500">
              follow-up
            </span>
            {" — "}
            {t.followUp}
          </p>
          <p className="mt-1 font-mono text-[10.5px] text-slate-500">
            Related: {t.related.join(" · ")}
          </p>
        </li>
      ))}
    </ul>
  );
}

// --- Collection Plan ----------------------------------------------------

export function GapsPanel({ gaps, plan }: PanelProps) {
  if (gaps.length === 0 && plan.length === 0)
    return <Placeholder>No collection gaps detected.</Placeholder>;
  return (
    <div className="flex flex-col gap-3">
      <Card title={`Open tasks (${plan.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-900/80 text-left font-mono uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-2 py-1.5">ID</th>
                <th className="px-2 py-1.5">Task</th>
                <th className="px-2 py-1.5">Hypothesis</th>
                <th className="px-2 py-1.5">Priority</th>
                <th className="px-2 py-1.5">Owner</th>
                <th className="px-2 py-1.5">Status</th>
                <th className="px-2 py-1.5">Due</th>
              </tr>
            </thead>
            <tbody>
              {plan.map((t, i) => (
                <tr
                  key={t.id}
                  className={
                    "border-t border-slate-800 align-top " +
                    (i % 2 === 0 ? "bg-slate-950/30" : "bg-slate-950/10")
                  }
                >
                  <td className="px-2 py-1.5 font-mono text-slate-400">{t.id}</td>
                  <td className="px-2 py-1.5 text-slate-100">{t.title}</td>
                  <td className="px-2 py-1.5 font-mono text-[10.5px] text-slate-400">
                    {t.affectedHypothesis}
                  </td>
                  <td className="px-2 py-1.5">
                    <PriorityChip p={t.priority} />
                  </td>
                  <td className="px-2 py-1.5 text-slate-300">{t.owner}</td>
                  <td className="px-2 py-1.5">
                    <StatusChip s={t.status} />
                  </td>
                  <td className="px-2 py-1.5 font-mono text-slate-400">{t.due}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Underlying gaps">
        <ul className="flex flex-col gap-2">
          {gaps.map((g) => (
            <li
              key={g.id}
              className="border-l-2 border-amber-500/60 bg-slate-950/40 pl-3"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[10.5px] uppercase tracking-widest text-amber-400">
                  missing
                </span>
                <span className="text-sm text-slate-100">{g.label}</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{g.impact}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function PriorityChip({ p }: { p: PlanTask["priority"] }) {
  const cls =
    p === "high"
      ? "bg-red-700/30 text-red-200 border-red-600/60"
      : p === "medium"
        ? "bg-amber-700/30 text-amber-200 border-amber-600/60"
        : "bg-slate-700/40 text-slate-300 border-slate-600/60";
  return (
    <span
      className={
        "rounded border px-1.5 font-mono text-[10px] uppercase tracking-widest " +
        cls
      }
    >
      {p}
    </span>
  );
}

function StatusChip({ s }: { s: PlanTask["status"] }) {
  const cls =
    s === "done"
      ? "bg-emerald-700/30 text-emerald-200 border-emerald-600/60"
      : s === "in_progress"
        ? "bg-sky-700/30 text-sky-200 border-sky-600/60"
        : s === "blocked"
          ? "bg-red-700/30 text-red-200 border-red-600/60"
          : "bg-slate-800/40 text-slate-300 border-slate-700";
  return (
    <span
      className={
        "rounded border px-1.5 font-mono text-[10px] uppercase tracking-widest " +
        cls
      }
    >
      {s.replace("_", " ")}
    </span>
  );
}

// --- Claims --------------------------------------------------------------

const SUBCLAIM_KIND_LABEL: Record<SubClaim["kind"], string> = {
  subject: "Subject",
  location: "Location",
  datetime: "Date / time",
  source: "Source",
  not_edited: "Integrity",
};

export function ClaimsPanel({ subClaims }: PanelProps) {
  if (subClaims.length === 0)
    return (
      <Placeholder>
        No claim text or claim metadata supplied. Add at least a claim, claimed
        location, claimed date/time, or claimed source on intake to populate the
        ledger.
      </Placeholder>
    );
  return (
    <div className="overflow-x-auto rounded border border-slate-800">
      <table className="w-full text-xs">
        <thead className="bg-slate-900/80 text-left font-mono uppercase tracking-widest text-slate-500">
          <tr>
            <th className="px-3 py-2">Kind</th>
            <th className="px-3 py-2">Sub-claim</th>
            <th className="px-3 py-2">Supporting</th>
            <th className="px-3 py-2">Contradicting</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {subClaims.map((c, i) => (
            <tr
              key={i}
              className={
                "border-t border-slate-800 align-top " +
                (i % 2 === 0 ? "bg-slate-950/30" : "bg-slate-950/10")
              }
            >
              <td className="px-3 py-2 font-mono text-[10.5px] uppercase tracking-widest text-slate-400">
                {SUBCLAIM_KIND_LABEL[c.kind]}
              </td>
              <td className="px-3 py-2">
                <div className="text-slate-100">{c.text}</div>
                <p className="mt-1 text-[11px] text-slate-500">{c.rationale}</p>
              </td>
              <td className="px-3 py-2">
                {c.supporting.length === 0 ? (
                  <span className="text-slate-600">—</span>
                ) : (
                  <ul className="space-y-0.5">
                    {c.supporting.map((r, j) => (
                      <li key={j} className="text-slate-200">
                        <span className="font-mono text-[10.5px] text-slate-400">
                          {r.check}
                        </span>{" "}
                        — {r.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="px-3 py-2">
                {c.contradicting.length === 0 ? (
                  <span className="text-slate-600">—</span>
                ) : (
                  <ul className="space-y-0.5">
                    {c.contradicting.map((r, j) => (
                      <li key={j} className="text-slate-200">
                        <span className="font-mono text-[10.5px] text-slate-400">
                          {r.check}
                        </span>{" "}
                        — {r.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="px-3 py-2">
                <SubClaimStatusBadge status={c.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-slate-800 bg-slate-950/40 px-3 py-2 text-[11px] italic text-slate-500">
        Sub-claims are auto-extracted from intake. Each is evaluated
        independently against the tier findings — a single &ldquo;true / false&rdquo; label is
        rarely the right shape for media claims.
      </p>
    </div>
  );
}

function SubClaimStatusBadge({ status }: { status: SubClaim["status"] }) {
  const cls =
    status === "supported"
      ? "bg-emerald-600/30 text-emerald-200 border-emerald-600/60"
      : status === "contradicted"
        ? "bg-red-700/30 text-red-200 border-red-600/60"
        : status === "unresolved"
          ? "bg-amber-700/30 text-amber-200 border-amber-600/60"
          : "bg-slate-800/40 text-slate-400 border-slate-700";
  return (
    <span
      className={
        "inline-block rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest " +
        cls
      }
    >
      {status}
    </span>
  );
}

// --- Notes ---------------------------------------------------------------

export function NotesPanel({ ctx }: PanelProps) {
  return (
    <Card title="Analyst notes (from intake)">
      {ctx.intake.analystNotes.trim() ? (
        <p className="whitespace-pre-wrap text-sm text-slate-200">
          {ctx.intake.analystNotes}
        </p>
      ) : (
        <Placeholder>
          No analyst notes yet. Free-form note capture during triage is on the
          backlog.
        </Placeholder>
      )}
    </Card>
  );
}

// --- Final Assessment ----------------------------------------------------

export function AssessmentPanel({
  ctx,
  hypotheses,
  tensions,
  gaps,
  strength,
  memo,
  onExportPdf,
  onDownloadJson,
  busy,
}: PanelProps) {
  const [analyst, setAnalyst] = useState(ctx.analystName ?? "");
  const [status, setStatus] = useState<"likely-verified" | "contradicted" | "unverifiable" | "escalate">(
    suggestStatus(hypotheses, tensions, strength),
  );
  const top = [...hypotheses].sort((a, b) =>
    confidenceRank(b.confidence) - confidenceRank(a.confidence),
  )[0];

  return (
    <div className="flex flex-col gap-3">
      <StrengthBanner strength={strength} />
      <Card title="Executive assessment">
        <p className="text-sm leading-relaxed text-slate-100">{memo.executive}</p>
      </Card>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card title="Key supporting evidence">
          {memo.keySupporting.length === 0 ? (
            <Placeholder>None recorded.</Placeholder>
          ) : (
            <ul className="space-y-1 text-xs text-slate-200">
              {memo.keySupporting.map((s, i) => (
                <li key={i}>· {s}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Key contradicting evidence">
          {memo.keyContradicting.length === 0 ? (
            <Placeholder>None recorded.</Placeholder>
          ) : (
            <ul className="space-y-1 text-xs text-slate-200">
              {memo.keyContradicting.map((s, i) => (
                <li key={i}>· {s}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Active deception indicators">
          {memo.deception.length === 0 ? (
            <Placeholder>None active.</Placeholder>
          ) : (
            <ul className="space-y-1 text-xs text-amber-200">
              {memo.deception.map((s, i) => (
                <li key={i}>⚑ {s}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Collection gaps">
          {memo.collectionGaps.length === 0 ? (
            <Placeholder>No gaps.</Placeholder>
          ) : (
            <ul className="space-y-1 text-xs text-slate-200">
              {memo.collectionGaps.map((s, i) => (
                <li key={i}>· {s}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Method limitations">
          <ul className="space-y-1 text-xs text-slate-400">
            {memo.methodLimitations.map((s, i) => (
              <li key={i}>· {s}</li>
            ))}
          </ul>
        </Card>
        <Card title="Security / custody note">
          <p className="text-xs text-slate-300">{memo.securityNote}</p>
        </Card>
      </div>
      <Card title="Suggested status">
        <p className="text-sm text-slate-100">
          <span className="font-mono">{status}</span>
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Strongest hypothesis: <span className="font-mono">{top?.id ?? "—"}</span>{" "}
          ({top?.label ?? "—"}) at confidence{" "}
          <span className="font-mono">{top?.confidence ?? "insufficient"}</span>.
          {tensions.length > 0 && ` ${tensions.length} unresolved tension(s).`}
          {gaps.length > 0 && ` ${gaps.length} collection gap(s) limit confidence.`}
        </p>
      </Card>
      <Card title="Sign and export">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-mono uppercase tracking-widest text-slate-400">
              Analyst name
            </span>
            <input
              value={analyst}
              onChange={(e) => setAnalyst(e.target.value)}
              placeholder="Initials or full name"
              className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-sm text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-mono uppercase tracking-widest text-slate-400">
              Assessment status
            </span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-sm text-slate-100"
            >
              <option value="likely-verified">Likely verified</option>
              <option value="contradicted">Contradicted</option>
              <option value="unverifiable">Unverifiable</option>
              <option value="escalate">Escalate for manual review</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              ctx.analystName = analyst || null;
              onExportPdf();
            }}
            disabled={busy}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-emerald-500 disabled:opacity-40"
          >
            Sign & export brief PDF
          </button>
          <button
            type="button"
            onClick={onDownloadJson}
            disabled={busy}
            className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:border-emerald-500 hover:text-emerald-300 disabled:opacity-40"
          >
            Download evidence JSON
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          The PDF embeds a <span className="font-mono">report_sha256</span>{" "}
          so the printed brief is byte-verifiable against the served JSON.
        </p>
      </Card>
    </div>
  );
}

function suggestStatus(
  hypotheses: Hypothesis[],
  tensions: Tension[],
  strength: StrengthScore,
) {
  const top = [...hypotheses].sort((a, b) =>
    confidenceRank(b.confidence) - confidenceRank(a.confidence),
  )[0];
  if (strength.overall === "missing") return "unverifiable";
  if (tensions.some((t) => t.severity === "high")) return "contradicted";
  if (!top) return "unverifiable";
  if (top.id === "H1" && top.confidence === "high" && strength.overall !== "limited")
    return "likely-verified";
  if ((top.id === "H2" || top.id === "H3" || top.id === "H4") && top.confidence !== "insufficient")
    return "contradicted";
  if (strength.overall === "limited") return "escalate";
  return "unverifiable";
}

// --- shared bits --------------------------------------------------------

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-slate-800 bg-slate-950/60">
      <header className="flex items-center gap-2 border-b border-slate-800 bg-slate-900/40 px-2.5 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
        <h3 className="font-mono text-[10.5px] uppercase tracking-widest text-slate-400">
          {title}
        </h3>
      </header>
      <div className="p-2.5">{children}</div>
    </section>
  );
}

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="mb-1 flex gap-2 text-xs">
      <span className="w-28 shrink-0 font-mono uppercase tracking-widest text-slate-500">
        {k}
      </span>
      <span className={mono ? "break-all font-mono text-slate-200" : "text-slate-200"}>
        {v}
      </span>
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-dashed border-slate-700 bg-slate-950/40 p-3 text-xs italic text-slate-500">
      {children}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: Hypothesis["confidence"] }) {
  const cls =
    confidence === "high"
      ? "bg-emerald-600/30 text-emerald-300 border-emerald-600/60"
      : confidence === "moderate"
        ? "bg-amber-700/30 text-amber-200 border-amber-600/60"
        : confidence === "low"
          ? "bg-slate-700/40 text-slate-300 border-slate-600/60"
          : "bg-slate-900/60 text-slate-500 border-slate-700";
  return (
    <span
      className={
        "inline-block rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest " +
        cls
      }
    >
      {confidence}
    </span>
  );
}

function confidenceRank(c: Hypothesis["confidence"]): number {
  return c === "high" ? 3 : c === "moderate" ? 2 : c === "low" ? 1 : 0;
}

function ResultChip({ r }: { r: "pass" | "fail" | "indeterminate" }) {
  const cls =
    r === "pass"
      ? "bg-emerald-600/20 text-emerald-300"
      : r === "fail"
        ? "bg-red-700/30 text-red-200"
        : "bg-slate-700/40 text-slate-300";
  return (
    <span className={"rounded px-1.5 font-mono text-[10px] uppercase " + cls}>
      {r}
    </span>
  );
}

function ReliabilityChip({ label }: { label: string }) {
  const tone =
    label === "Deterministic"
      ? "border-emerald-600/60 bg-emerald-700/20 text-emerald-200"
      : label === "Inspectable"
        ? "border-sky-600/60 bg-sky-700/20 text-sky-200"
        : label === "Probabilistic"
          ? "border-amber-600/60 bg-amber-700/20 text-amber-200"
          : label === "External-source dependent"
            ? "border-violet-600/60 bg-violet-700/20 text-violet-200"
            : label === "Missing input"
              ? "border-red-600/60 bg-red-700/20 text-red-200"
              : "border-slate-700 text-slate-400";
  return (
    <span
      className={
        "rounded border px-1.5 font-mono text-[10px] uppercase tracking-widest " +
        tone
      }
    >
      {label}
    </span>
  );
}

// --- Strength rubric -----------------------------------------------------

export function StrengthPanel({ strength }: PanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <StrengthBanner strength={strength} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {strength.axes.map((a) => (
          <Card key={a.id} title={a.label}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-2xl text-slate-100">
                {a.score}
                <span className="text-xs text-slate-500">/100</span>
              </span>
              <StrengthLevelBadge level={a.level} />
            </div>
            <StrengthBar score={a.score} level={a.level} />
            <ul className="mt-2 space-y-0.5 text-[11px] text-slate-400">
              {a.reasons.map((r, i) => (
                <li key={i}>· {r}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StrengthBanner({ strength }: { strength: StrengthScore }) {
  const cls = strengthBorder(strength.overall);
  const label =
    strength.overall === "strong"
      ? "strong"
      : strength.overall === "partial"
        ? "supported"
        : strength.overall === "limited"
          ? "baseline"
          : "insufficient";
  return (
    <section className={"border-l-4 " + cls + " bg-slate-950/60 px-3 py-2"}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm text-slate-100">
          <span className="font-mono uppercase tracking-widest text-slate-400">
            Evidence coverage:
          </span>{" "}
          <span className="font-semibold">{label}</span>
        </p>
        <span className="font-mono text-[11px] text-slate-500">
          aggregate {strength.overallScore}/100
        </span>
      </div>
      <p className="mt-0.5 text-xs text-slate-400">{strength.summary}</p>
      <div className="mt-2 grid grid-cols-3 gap-1 md:grid-cols-6">
        {strength.axes.map((a) => (
          <div
            key={a.id}
            className="flex flex-col gap-0.5"
            title={`${a.label}: ${a.score}/100`}
          >
            <span className="truncate font-mono text-[9.5px] uppercase tracking-widest text-slate-500">
              {a.id}
            </span>
            <StrengthBar score={a.score} level={a.level} compact />
          </div>
        ))}
      </div>
    </section>
  );
}

function StrengthBar({
  score,
  level,
  compact,
}: {
  score: number;
  level: StrengthAxis["level"];
  compact?: boolean;
}) {
  const fill =
    level === "strong"
      ? "bg-emerald-500"
      : level === "partial"
        ? "bg-sky-500"
        : level === "limited"
          ? "bg-amber-500"
          : "bg-red-500";
  return (
    <div
      className={
        "w-full overflow-hidden rounded bg-slate-800 " +
        (compact ? "h-1" : "mt-2 h-1.5")
      }
    >
      <div
        className={"h-full " + fill}
        style={{ width: `${Math.max(2, score)}%` }}
      />
    </div>
  );
}

function StrengthLevelBadge({ level }: { level: StrengthAxis["level"] }) {
  const cls =
    level === "strong"
      ? "bg-emerald-600/30 text-emerald-200 border-emerald-600/60"
      : level === "partial"
        ? "bg-sky-700/30 text-sky-200 border-sky-600/60"
        : level === "limited"
          ? "bg-amber-700/30 text-amber-200 border-amber-600/60"
          : "bg-red-700/30 text-red-200 border-red-600/60";
  return (
    <span
      className={
        "rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest " +
        cls
      }
    >
      {level}
    </span>
  );
}

function strengthBorder(level: StrengthLevel): string {
  if (level === "strong") return "border-emerald-500";
  if (level === "partial") return "border-sky-500";
  if (level === "limited") return "border-amber-500";
  return "border-red-500";
}

// --- Entity Graph (Screen 5) --------------------------------------------

const ENTITY_TYPE_LABEL: Record<EntityNode["type"], string> = {
  media: "MEDIA",
  visual_match: "VISUAL MATCH",
  source_domain: "DOMAIN",
  telegram_channel: "TELEGRAM",
  fact_check: "FACT-CHECK",
  claimed_source: "CLAIMED SRC",
  claimed_location: "LOCATION",
  publisher: "PUBLISHER",
};

const EDGE_LABEL: Record<EntityEdge["type"], string> = {
  published: "published",
  visually_matches: "visually matches",
  reposted: "reposted",
  reviews: "reviews",
  located_in: "located in",
  claims_same_event: "claims same event",
};

export function EntityGraphPanel({ entities }: PanelProps) {
  const { nodes, edges } = entities;
  if (nodes.length <= 1)
    return (
      <Placeholder>
        Only the submitted media is in the graph. Add a source URL, claimed
        location, or run reverse-image to extract more entities.
      </Placeholder>
    );
  return (
    <div className="flex flex-col gap-3">
      <Card title={`Nodes (${nodes.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left font-mono uppercase tracking-widest text-slate-500">
              <tr>
                <th className="py-1 pr-3">Type</th>
                <th className="py-1 pr-3">Label</th>
                <th className="py-1 pr-3">Caveat</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((n) => (
                <tr key={n.id} className="border-t border-slate-800">
                  <td className="py-1 pr-3 font-mono text-[10.5px] text-slate-400">
                    {ENTITY_TYPE_LABEL[n.type]}
                  </td>
                  <td className="py-1 pr-3 text-slate-100">{n.label}</td>
                  <td className="py-1 pr-3 text-amber-200">{n.caveat ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title={`Edges (${edges.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left font-mono uppercase tracking-widest text-slate-500">
              <tr>
                <th className="py-1 pr-3">From</th>
                <th className="py-1 pr-3">Relation</th>
                <th className="py-1 pr-3">To</th>
              </tr>
            </thead>
            <tbody>
              {edges.map((e, i) => {
                const fromNode = nodes.find((n) => n.id === e.from);
                const toNode = nodes.find((n) => n.id === e.to);
                return (
                  <tr key={i} className="border-t border-slate-800">
                    <td className="py-1 pr-3 font-mono text-slate-300">
                      {fromNode?.label ?? e.from}
                    </td>
                    <td className="py-1 pr-3 font-mono text-emerald-300">
                      {EDGE_LABEL[e.type]}
                    </td>
                    <td className="py-1 pr-3 font-mono text-slate-300">
                      {toNode?.label ?? e.to}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-[11px] italic text-slate-500">
        Initial implementation is a table. Visual graph layout (D3 / cytoscape)
        is on the backlog; the conceptual model is the value.
      </p>
    </div>
  );
}

// --- Geo / Chrono Workbench (Screen 8) ----------------------------------

export function GeoChronoPanel({ ctx }: PanelProps) {
  const claimed = ctx.intake.claimedLocation.trim();
  const dt = ctx.intake.claimedDateTime.trim();
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Card title="Analyst inputs">
        <KV k="Claimed location" v={claimed || "—"} />
        <KV k="Claimed date / time" v={dt || "—"} />
        <KV k="Shadow direction" v="(analyst entry)" />
        <KV k="Landmarks" v="(analyst entry)" />
        <KV k="Weather clue" v="(analyst entry)" />
        <KV k="Language / signage" v="(analyst entry)" />
        <KV k="Vehicle / plate clue" v="(analyst entry)" />
        <KV k="Terrain / architecture" v="(analyst entry)" />
      </Card>
      <Card title="Geolocation candidates">
        <ul className="flex flex-col gap-2 text-xs text-slate-200">
          <li className="rounded border border-slate-800 bg-slate-900/40 p-2">
            <span className="font-mono text-emerald-300">Primary claim</span>
            <div className="mt-1">{claimed || "No claimed location supplied"}</div>
          </li>
          <li className="rounded border border-slate-800 bg-slate-900/40 p-2">
            <span className="font-mono text-slate-400">Source context</span>
            <div className="mt-1 break-all">
              {ctx.intake.sourceUrl || ctx.intake.mediaUrl || "No source URL supplied"}
            </div>
          </li>
          <li className="rounded border border-slate-800 bg-slate-900/40 p-2">
            <span className="font-mono text-slate-400">Visual review queue</span>
            <div className="mt-1">
              Landmarks, signage, plates, terrain, and shadows ready for analyst notes.
            </div>
          </li>
        </ul>
      </Card>
      <Card title="Chronolocation constraints">
        <ul className="flex flex-col gap-2 text-xs text-slate-200">
          <li>
            <Status label="Claimed time" status={dt || "Not supplied"} />
          </li>
          <li>
            <Status label="Capture metadata" status={ctx.report ? "Checked in T1" : "Pending"} />
          </li>
          <li>
            <Status label="Reverse-image history" status="Checked in T1" />
          </li>
          <li>
            <Status label="Claim consistency" status={dt ? "Ready to compare" : "Needs claim time"} />
          </li>
        </ul>
      </Card>
      <Card title="Verdict">
        <ul className="flex flex-col gap-1 text-xs">
          <li>
            <Status label="Sun-position" status="Unresolved" />
          </li>
          <li>
            <Status label="Weather" status="Unresolved" />
          </li>
          <li>
            <Status label="Landmark refs" status="Unresolved" />
          </li>
          <li>
            <Status label="Overall" status="Needs analyst review" />
          </li>
        </ul>
      </Card>
    </div>
  );
}

function Status({ label, status }: { label: string; status: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="font-mono uppercase tracking-widest text-slate-500">
        {label}
      </span>
      <span className="rounded border border-slate-700 bg-slate-900/60 px-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-300">
        {status}
      </span>
    </span>
  );
}

// --- Deception Indicators (Screen 9) ------------------------------------

export function DeceptionPanel({ deception }: PanelProps) {
  if (deception.length === 0)
    return <Placeholder>No indicators evaluated yet.</Placeholder>;
  return (
    <ul className="flex flex-col gap-2">
      {deception.map((d) => (
        <li
          key={d.id}
          className={
            "border-l-4 bg-slate-950/40 p-3 " +
            (d.status === "active"
              ? "border-red-500"
              : d.status === "absent"
                ? "border-emerald-600/60"
                : "border-slate-700")
          }
        >
          <div className="flex flex-wrap items-baseline gap-2">
            <span
              className={
                "rounded border px-1.5 font-mono text-[10px] uppercase tracking-widest " +
                (d.status === "active"
                  ? "border-red-600/60 bg-red-700/20 text-red-200"
                  : d.status === "absent"
                    ? "border-emerald-600/60 bg-emerald-700/20 text-emerald-200"
                    : "border-slate-700 text-slate-400")
              }
            >
              {d.status === "active" ? "active" : d.status === "absent" ? "clear" : "n/a"}
            </span>
            <span className="text-sm text-slate-100">{d.label}</span>
            <span className="ml-auto font-mono text-[10.5px] text-slate-500">
              {d.id}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-300">{d.explanation}</p>
          <p className="mt-1 font-mono text-[10.5px] text-slate-500">
            Evidence: {d.evidence.join(" · ")} · affects {d.affectedClaims.join(", ")}
          </p>
          <p className="mt-1 text-[11px] italic text-amber-200/80">{d.caveat}</p>
        </li>
      ))}
    </ul>
  );
}

// --- Chain of Custody (Screen 13) ---------------------------------------

export function CustodyPanel({ custody }: PanelProps) {
  if (custody.length === 0)
    return <Placeholder>No custody events recorded yet.</Placeholder>;
  return (
    <div className="overflow-x-auto rounded border border-slate-800">
      <table className="w-full text-xs">
        <thead className="bg-slate-900/80 text-left font-mono uppercase tracking-widest text-slate-500">
          <tr>
            <th className="px-2 py-1.5">Timestamp</th>
            <th className="px-2 py-1.5">Actor</th>
            <th className="px-2 py-1.5">Action</th>
            <th className="px-2 py-1.5">Object</th>
            <th className="px-2 py-1.5">Tool</th>
            <th className="px-2 py-1.5">External</th>
            <th className="px-2 py-1.5">Detail</th>
          </tr>
        </thead>
        <tbody>
          {custody.map((e, i) => (
            <tr
              key={i}
              className={
                "border-t border-slate-800 align-top " +
                (i % 2 === 0 ? "bg-slate-950/30" : "bg-slate-950/10")
              }
            >
              <td className="whitespace-nowrap px-2 py-1.5 font-mono text-slate-300">
                {e.at}
              </td>
              <td className="px-2 py-1.5 font-mono text-slate-200">{e.actor}</td>
              <td className="px-2 py-1.5 font-mono text-emerald-300">{e.action}</td>
              <td className="px-2 py-1.5 font-mono text-slate-300">{e.objectId}</td>
              <td className="px-2 py-1.5 font-mono text-[10.5px] text-slate-400">
                {e.tool}
              </td>
              <td className="px-2 py-1.5">
                {e.external ? (
                  <span className="rounded border border-amber-600/60 bg-amber-700/20 px-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-200">
                    external
                  </span>
                ) : (
                  <span className="font-mono text-[10px] text-slate-500">local</span>
                )}
              </td>
              <td className="px-2 py-1.5 text-slate-300">{e.detail ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-slate-800 bg-slate-950/40 px-3 py-2 text-[11px] italic text-slate-500">
        Every external lookup is recorded so investigative interest disclosed to
        third parties is visible to the analyst before export.
      </p>
    </div>
  );
}

// --- Security Posture (Screen 14) ---------------------------------------

export function SecurityPanel({ security, ctx }: PanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <Card title="Mission risk">
        <KV k="Handling" v={ctx.handling} />
        <KV k="Compartment" v={ctx.compartment} />
        <KV k="Session risk level" v={ctx.sessionRisk} />
      </Card>
      <Card title={`Controls (${security.length})`}>
        <ul className="flex flex-col">
          {security.map((c, i) => (
            <li
              key={c.id}
              className={
                "flex flex-col gap-1 py-2 " +
                (i > 0 ? "border-t border-slate-800" : "")
              }
            >
              <div className="flex items-baseline gap-2">
                <SecurityStateBadge state={c.state} />
                <span className="text-sm text-slate-100">{c.label}</span>
                <span className="ml-auto font-mono text-[10.5px] text-slate-500">
                  {c.id}
                </span>
              </div>
              <p className="text-xs text-slate-400">{c.detail}</p>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Threat assumptions">
        <ul className="space-y-1 text-xs text-slate-300">
          <li>· Submitted media may be malicious; parsers may be exploited.</li>
          <li>· Links may track analyst identity.</li>
          <li>· Third-party APIs disclose investigative interest.</li>
          <li>· External sources may change after analysis (link rot).</li>
          <li>· Adversaries may attempt poisoning, prompt injection, or deception.</li>
          <li>· Over-trust in AI output is itself a threat to assessment quality.</li>
        </ul>
      </Card>
    </div>
  );
}

function SecurityStateBadge({ state }: { state: SecurityControl["state"] }) {
  const cls =
    state === "ok"
      ? "bg-emerald-600/30 text-emerald-200 border-emerald-600/60"
      : state === "warn"
        ? "bg-amber-700/30 text-amber-200 border-amber-600/60"
        : state === "violated"
          ? "bg-red-700/30 text-red-200 border-red-600/60"
          : "bg-slate-800/40 text-slate-400 border-slate-700";
  return (
    <span
      className={
        "rounded border px-1.5 font-mono text-[10px] uppercase tracking-widest " +
        cls
      }
    >
      {state}
    </span>
  );
}
