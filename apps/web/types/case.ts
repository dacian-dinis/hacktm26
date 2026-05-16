// Analyst-workbench case model. Lives alongside the wire Report; the case
// adds analyst-supplied context (claims, claimed location/time/source) and
// derived structures (hypotheses, timeline, tensions, collection gaps).

import type { Finding, Report } from "./report";

export type CaseStatus = "intake" | "triage" | "assessment" | "signed";

export type PanelId =
  | "overview"
  | "media"
  | "provenance"
  | "forensics"
  | "osint"
  | "source-network"
  | "timeline"
  | "hypotheses"
  | "tensions"
  | "gaps"
  | "claims"
  | "strength"
  | "notes"
  | "assessment";

export interface CaseIntake {
  mediaFile: File | null;
  mediaUrl: string;
  sourceUrl: string;
  claimText: string;
  claimedLocation: string;
  claimedDateTime: string;
  claimedSource: string;
  operationalRelevance: string;
  analystNotes: string;
}

export interface Preview {
  url: string;
  name?: string;
}

export type ReliabilityLabel =
  | "Deterministic"
  | "Inspectable"
  | "Probabilistic"
  | "External-source dependent"
  | "Experimental"
  | "Missing input";

export type HypothesisId = "H1" | "H2" | "H3" | "H4" | "H5";

export interface FindingRef {
  check: string;
  reason: string;
}

export interface Hypothesis {
  id: HypothesisId;
  label: string;
  supporting: FindingRef[];
  contradicting: FindingRef[];
  gaps: string[];
  confidence: "high" | "moderate" | "low" | "insufficient";
  rationale: string;
}

export type TimelineSource =
  | "intake"
  | "exif"
  | "c2pa"
  | "reverse-image-earliest"
  | "factcheck-review"
  | "source-publication"
  | "analyst";

export interface TimelineEvent {
  at: string; // ISO-8601 or "unknown"
  source: TimelineSource;
  label: string;
  detail?: string;
  conflict?: string; // populated when this event clashes with another
}

export interface Tension {
  id: string;
  severity: "high" | "medium" | "low";
  statement: string;
  related: string[]; // check names
  followUp: string;
}

export type GapId =
  | "no_source_url"
  | "no_c2pa_manifest"
  | "no_claim_text"
  | "no_geolocation"
  | "no_claimed_datetime"
  | "no_source_reputation"
  | "no_factcheck_data"
  | "exif_missing";

export interface CollectionGap {
  id: GapId;
  label: string;
  impact: string;
}

export type AssessmentStatus =
  | "verified"
  | "likely-verified"
  | "contradicted"
  | "unverifiable"
  | "escalate";

export type SubClaimStatus =
  | "supported"
  | "contradicted"
  | "unresolved"
  | "insufficient";

export type SubClaimKind =
  | "subject"
  | "location"
  | "datetime"
  | "source"
  | "not_edited";

export interface SubClaim {
  kind: SubClaimKind;
  text: string;
  supporting: FindingRef[];
  contradicting: FindingRef[];
  status: SubClaimStatus;
  rationale: string;
}

// --- Evidence strength rubric --------------------------------------------
// We score *report quality*, not "fake probability." Each axis answers:
//   "How well-supported is any assessment we'd make from this evidence?"

export type StrengthLevel = "strong" | "partial" | "limited" | "missing";

export type StrengthAxisId =
  | "provenance"
  | "forensic"
  | "source"
  | "temporal"
  | "ai_only"
  | "gaps";

export interface StrengthAxis {
  id: StrengthAxisId;
  label: string;
  score: number; // 0-100
  level: StrengthLevel;
  reasons: string[];
}

export interface StrengthScore {
  axes: StrengthAxis[];
  overallScore: number;
  overall: StrengthLevel;
  summary: string;
}

export interface CaseContext {
  caseId: string;
  handling: string;
  analystName: string | null;
  status: CaseStatus;
  createdAt: string;
  intake: CaseIntake;
  report: Report | null;
  preview: Preview | null;
  demoSlug: string | null;
}

export const PANEL_LABELS: Record<PanelId, string> = {
  overview: "Case Overview",
  media: "Media Evidence",
  provenance: "Provenance",
  forensics: "Forensics",
  osint: "OSINT Corroboration",
  "source-network": "Source Network",
  timeline: "Timeline",
  hypotheses: "Hypotheses",
  tensions: "Analytic Tensions",
  gaps: "Collection Gaps",
  claims: "Claim Ledger",
  strength: "Evidence Strength",
  notes: "Analyst Notes",
  assessment: "Final Assessment",
};

export const PANEL_ORDER: PanelId[] = [
  "overview",
  "media",
  "provenance",
  "forensics",
  "osint",
  "source-network",
  "timeline",
  "hypotheses",
  "tensions",
  "gaps",
  "claims",
  "strength",
  "notes",
  "assessment",
];

// Findings-tier → panel mapping (used to route a tier's findings into its panel)
export function panelForTier(tier: 1 | 2 | 3 | 4): PanelId {
  if (tier === 1) return "provenance";
  if (tier === 2) return "forensics";
  if (tier === 3) return "forensics"; // T3 sits inside forensics under the AI banner
  return "osint";
}

export function reliabilityFor(finding: Finding): ReliabilityLabel {
  const ev = finding.evidence ?? {};
  if (finding.confidence === "deterministic") {
    if ((ev as Record<string, unknown>).error) return "Missing input";
    return "Deterministic";
  }
  if (finding.source === "huggingface.inference") return "Probabilistic";
  if (finding.source.startsWith("google.") || finding.source.startsWith("serpapi"))
    return "External-source dependent";
  if (finding.confidence === "high" || finding.confidence === "medium")
    return "Inspectable";
  return "Experimental";
}
