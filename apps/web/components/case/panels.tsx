"use client";

// All analysis-console panels live here. Each receives `data` (the case +
// derived structures) and `setSelectedFinding` so clicks route to the
// right inspector.

import { useState } from "react";
import type {
  CaseContext,
  CollectionGap,
  Hypothesis,
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
  const elaPng = (ela?.evidence as Record<string, unknown> | undefined)
    ?.overlay_png_base64 as string | undefined;
  const noisePng = (noise?.evidence as Record<string, unknown> | undefined)
    ?.residual_png_base64 as string | undefined;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card title="Original">
        {ctx.preview?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ctx.preview.url}
            alt={ctx.preview.name ?? "submitted media"}
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
        <Placeholder>
          Copy-move detection not yet wired (PLAN.md backlog #5).
        </Placeholder>
      </Card>
      <Card title="JPEG compression map · Experimental">
        <Placeholder>
          JPEG quantization analysis not yet wired (PLAN.md backlog #4).
        </Placeholder>
      </Card>
      <Card title="AI attention map · Experimental">
        <Placeholder>
          T3 attention-map output not exposed by the HF inference API for this
          model.
        </Placeholder>
      </Card>
    </div>
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

// --- Source Network ------------------------------------------------------

export function SourceNetworkPanel({ findings, ctx }: PanelProps) {
  const reverse = findings.find((f) => f.check === "reverse_image.lookup");
  const hits =
    (reverse?.evidence as Record<string, unknown> | undefined)?.hits as
      | { url?: string; name?: string; host?: string; datePublished?: string }[]
      | undefined;
  const sourceRep = findings.find((f) => f.check === "source.reputation");
  const telegram = findings.find((f) => f.check === "telegram.reputation");
  return (
    <div className="flex flex-col gap-4">
      <Card title="Submitted media">
        <KV k="sha256" v={ctx.report?.input_hash ?? "—"} mono />
        <KV k="Claimed source" v={ctx.intake.claimedSource || "—"} />
        <KV k="Source URL" v={ctx.intake.sourceUrl || "—"} />
      </Card>
      <Card title="Same-image visual matches">
        {hits && hits.length > 0 ? (
          <table className="w-full text-xs">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-1">Host</th>
                <th className="py-1">Name</th>
                <th className="py-1">Published</th>
              </tr>
            </thead>
            <tbody>
              {hits.map((h, i) => (
                <tr key={i} className="border-t border-slate-800">
                  <td className="py-1 font-mono text-slate-300">{h.host ?? "—"}</td>
                  <td className="py-1">
                    {h.url ? (
                      <a
                        href={h.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 underline"
                      >
                        {h.name ?? h.url}
                      </a>
                    ) : (
                      h.name ?? "—"
                    )}
                  </td>
                  <td className="py-1 font-mono text-slate-400">
                    {h.datePublished ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Placeholder>No visual matches.</Placeholder>
        )}
      </Card>
      <Card title="Domain reputation">
        {sourceRep ? <FindingRow finding={sourceRep} /> : <Placeholder>No URL supplied — no domain reputation lookup.</Placeholder>}
      </Card>
      <Card title="Telegram reputation">
        {telegram ? <FindingRow finding={telegram} /> : <Placeholder>Not a Telegram URL.</Placeholder>}
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

// --- Gaps ----------------------------------------------------------------

export function GapsPanel({ gaps }: PanelProps) {
  if (gaps.length === 0)
    return <Placeholder>No collection gaps detected.</Placeholder>;
  return (
    <ul className="flex flex-col gap-2">
      {gaps.map((g) => (
        <li
          key={g.id}
          className="rounded border border-slate-700 bg-slate-900/40 p-3"
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
      <Card title="Suggested assessment">
        <p className="text-sm text-slate-100">
          Status: <span className="font-mono">{status}</span>
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
  return (
    <section className={"border-l-4 " + cls + " bg-slate-950/60 px-3 py-2"}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm text-slate-100">
          <span className="font-mono uppercase tracking-widest text-slate-400">
            Verification confidence:
          </span>{" "}
          <span className="font-semibold">{strength.overall}</span>
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
