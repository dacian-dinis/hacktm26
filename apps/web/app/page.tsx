"use client";

import { useEffect, useMemo, useState } from "react";
import { CaseIntake } from "@/components/case/CaseIntake";
import { TopBar } from "@/components/case/TopBar";
import { LeftNav } from "@/components/case/LeftNav";
import { MediaStrip } from "@/components/case/MediaStrip";
import { RightInspector } from "@/components/case/RightInspector";
import {
  AssessmentPanel,
  CaseOverviewPanel,
  ClaimsPanel,
  GapsPanel,
  HypothesesPanel,
  MediaEvidencePanel,
  NotesPanel,
  SourceNetworkPanel,
  TensionsPanel,
  TierPanel,
  TimelinePanel,
} from "@/components/case/panels";
import { ReportSkeleton } from "@/components/report/ReportSkeleton";
import { deriveCaseId } from "@/lib/case/caseId";
import {
  deriveGaps,
  deriveHypotheses,
  deriveSubClaims,
  deriveTensions,
  deriveTimeline,
} from "@/lib/case/derive";
import type {
  CaseContext,
  CaseIntake as CaseIntakeData,
  PanelId,
  Preview,
} from "@/types/case";
import type { Finding, Report } from "@/types/report";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

const EMPTY_INTAKE: CaseIntakeData = {
  mediaFile: null,
  mediaUrl: "",
  sourceUrl: "",
  claimText: "",
  claimedLocation: "",
  claimedDateTime: "",
  claimedSource: "",
  operationalRelevance: "",
  analystNotes: "",
};

export default function Home() {
  const [intake, setIntake] = useState<CaseIntakeData>(EMPTY_INTAKE);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [demoSlug, setDemoSlug] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<PanelId>("overview");
  const [selected, setSelected] = useState<Finding | null>(null);
  const [analystName, setAnalystName] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string>("");

  // Refresh preview when the file changes.
  useEffect(() => {
    if (!intake.mediaFile) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(intake.mediaFile);
    setPreview({ url, name: intake.mediaFile.name });
    return () => URL.revokeObjectURL(url);
  }, [intake.mediaFile]);

  async function verify(targetFile: File | null) {
    if (!targetFile && !intake.mediaUrl.trim()) {
      setError("Provide a media file or a media URL.");
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);
    setSelected(null);
    setCreatedAt(new Date().toISOString());
    try {
      const form = new FormData();
      if (targetFile) form.append("file", targetFile);
      if (intake.mediaUrl) form.append("url", intake.mediaUrl);
      if (intake.claimText) form.append("query", intake.claimText);
      // Source URL (article/post) — backend Tier 4 also accepts a `url`,
      // but we already use `url` for the media URL. Source URL is analyst
      // context for now; backend source-rep tier only fires when the media
      // URL itself is the source link. (Backlog: separate fields.)
      const res = await fetch(`${API_BASE}/verify`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const r = (await res.json()) as Report;
      setReport(r);
      setActivePanel("overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function onPickDemo(slug: string, demoFile: File) {
    setIntake({ ...intake, mediaFile: demoFile });
    setDemoSlug(slug);
    // Defer verify to after the file is in state.
    setTimeout(() => verify(demoFile), 0);
  }

  function resetCase() {
    setReport(null);
    setSelected(null);
    setDemoSlug(null);
    setIntake(EMPTY_INTAKE);
    setActivePanel("overview");
    setError(null);
  }

  // --- derive everything from the live report + intake -------------------
  const findings = useMemo(() => report?.findings ?? [], [report]);
  const ctx: CaseContext = useMemo(
    () => ({
      caseId: deriveCaseId(createdAt || new Date().toISOString(), report?.input_hash ?? ""),
      handling: "UNCLASSIFIED // DEMO",
      analystName,
      status: report ? (report.analyst_signature ? "signed" : "assessment") : "intake",
      createdAt: createdAt || new Date().toISOString(),
      intake,
      report,
      preview,
      demoSlug,
    }),
    [analystName, createdAt, demoSlug, intake, preview, report],
  );

  const gaps = useMemo(() => deriveGaps(findings, intake), [findings, intake]);
  const hypotheses = useMemo(
    () => deriveHypotheses(findings, intake, gaps),
    [findings, intake, gaps],
  );
  const timeline = useMemo(
    () => deriveTimeline(findings, intake, ctx.createdAt, report?.signed_at ?? null),
    [findings, intake, ctx.createdAt, report?.signed_at],
  );
  const tensions = useMemo(() => deriveTensions(findings, intake), [findings, intake]);
  const subClaims = useMemo(() => deriveSubClaims(findings, intake), [findings, intake]);

  const byTier = (t: 1 | 2 | 3 | 4) => findings.filter((f) => f.tier === t);

  // --- actions -----------------------------------------------------------
  function downloadJson() {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `veritas_${report.input_hash.slice(0, 8) || "report"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    if (!report) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report, analyst_name: analystName ?? "" }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `veritas_${report.input_hash.slice(0, 8) || "report"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  // --- render ------------------------------------------------------------
  if (!report && !loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <TopBar
          caseId={deriveCaseId(new Date().toISOString(), "")}
          handling="UNCLASSIFIED // DEMO"
          analystName={analystName}
          status="intake"
        />
        <CaseIntake
          intake={intake}
          setIntake={setIntake}
          onSubmit={() => verify(intake.mediaFile)}
          onPickDemo={onPickDemo}
          loading={loading}
          error={error}
          apiBase={API_BASE}
        />
      </main>
    );
  }

  if (loading && !report) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <TopBar
          caseId={ctx.caseId}
          handling={ctx.handling}
          analystName={analystName}
          status="triage"
        />
        <div className="p-6">
          <ReportSkeleton />
        </div>
      </main>
    );
  }

  const panelProps = {
    ctx,
    findings,
    hypotheses,
    timeline,
    tensions,
    gaps,
    subClaims,
    onSelect: setSelected,
    onExportPdf: exportPdf,
    onDownloadJson: downloadJson,
    busy: loading,
  };

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <TopBar
        caseId={ctx.caseId}
        handling={ctx.handling}
        analystName={analystName}
        status={ctx.status}
        onDownloadJson={downloadJson}
        onExportPdf={exportPdf}
        busy={loading}
      />
      <MediaStrip ctx={ctx} findings={findings} onSelect={setSelected} />
      <div className="flex flex-1 overflow-hidden">
        <LeftNav
          active={activePanel}
          onSelect={setActivePanel}
          badges={{
            provenance: byTier(1).length,
            forensics: byTier(2).length + byTier(3).length,
            osint: byTier(4).length,
            hypotheses: hypotheses.length,
            tensions: tensions.length,
            gaps: gaps.length,
            claims: subClaims.length,
          }}
        />
        <section className="flex-1 overflow-y-auto p-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-slate-400">
              {panelTitle(activePanel)}
            </h2>
            <div className="flex items-center gap-2">
              <input
                value={analystName ?? ""}
                onChange={(e) => setAnalystName(e.target.value || null)}
                placeholder="Analyst name"
                className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-600"
              />
              <button
                type="button"
                onClick={resetCase}
                className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-emerald-500 hover:text-emerald-300"
              >
                New case
              </button>
            </div>
          </div>
          {error && (
            <p
              role="alert"
              className="mb-3 rounded border border-red-700/60 bg-red-900/30 p-2 text-sm text-red-200"
            >
              {error}
            </p>
          )}
          {activePanel === "overview" && <CaseOverviewPanel {...panelProps} />}
          {activePanel === "media" && <MediaEvidencePanel {...panelProps} />}
          {activePanel === "provenance" && (
            <TierPanel tier={1} findings={byTier(1)} onSelect={setSelected} />
          )}
          {activePanel === "forensics" && (
            <div className="flex flex-col gap-4">
              <TierPanel tier={2} findings={byTier(2)} onSelect={setSelected} />
              <TierPanel tier={3} findings={byTier(3)} onSelect={setSelected} />
            </div>
          )}
          {activePanel === "osint" && (
            <TierPanel tier={4} findings={byTier(4)} onSelect={setSelected} />
          )}
          {activePanel === "source-network" && (
            <SourceNetworkPanel {...panelProps} />
          )}
          {activePanel === "timeline" && <TimelinePanel {...panelProps} />}
          {activePanel === "hypotheses" && <HypothesesPanel {...panelProps} />}
          {activePanel === "tensions" && <TensionsPanel {...panelProps} />}
          {activePanel === "gaps" && <GapsPanel {...panelProps} />}
          {activePanel === "claims" && <ClaimsPanel {...panelProps} />}
          {activePanel === "notes" && <NotesPanel {...panelProps} />}
          {activePanel === "assessment" && <AssessmentPanel {...panelProps} />}
        </section>
        <RightInspector finding={selected} onClear={() => setSelected(null)} />
      </div>
    </main>
  );
}

function panelTitle(id: PanelId): string {
  return {
    overview: "Case Overview",
    media: "Media Evidence",
    provenance: "Provenance · Tier 1",
    forensics: "Forensics · Tier 2 + Tier 3",
    osint: "OSINT Corroboration · Tier 4",
    "source-network": "Source Network",
    timeline: "Timeline Reconstruction",
    hypotheses: "Hypothesis Matrix",
    tensions: "Analytic Tensions",
    gaps: "Collection Gaps",
    claims: "Claim Ledger",
    notes: "Analyst Notes",
    assessment: "Final Assessment Builder",
  }[id];
}
