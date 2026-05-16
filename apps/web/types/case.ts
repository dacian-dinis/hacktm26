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
  | "entity-graph"
  | "timeline"
  | "geo-chrono"
  | "deception"
  | "hypotheses"
  | "tensions"
  | "gaps"
  | "claims"
  | "strength"
  | "security"
  | "custody"
  | "notes"
  | "assessment";

export type SessionRiskLevel =
  | "Normal"
  | "Degraded"
  | "High-risk source"
  | "Untrusted media";

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

// --- chain of custody ----------------------------------------------------

export interface ChainEvent {
  at: string;
  actor: string; // analyst initials or "system" or "external:google.factcheck"
  action: string; // "case_created", "input_hash_computed", "external_lookup", "finding_generated", "assessment_signed", ...
  objectId: string; // case id or finding check or "report"
  hashBefore?: string;
  hashAfter?: string;
  tool: string; // "veritas/0.1", "huggingface.inference", "serpapi.google_lens", ...
  external: boolean;
  detail?: string;
}

// --- deception indicators (Screen 9) -------------------------------------

export type DeceptionStatus = "active" | "absent" | "not_evaluable";

export type DeceptionIndicatorId =
  | "provenance_absence"
  | "historical_reuse"
  | "context_mismatch"
  | "source_laundering"
  | "coordinated_amplification"
  | "forensic_inconsistency"
  | "metadata_contradiction"
  | "claim_source_mismatch"
  | "ai_source_disagreement"
  | "unsupported_urgency";

export interface DeceptionIndicator {
  id: DeceptionIndicatorId;
  label: string;
  status: DeceptionStatus;
  affectedClaims: string[];
  evidence: string[];
  explanation: string;
  caveat: string;
}

// --- entity graph --------------------------------------------------------

export type EntityNodeType =
  | "media"
  | "visual_match"
  | "source_domain"
  | "telegram_channel"
  | "fact_check"
  | "claimed_source"
  | "claimed_location"
  | "publisher";

export type EntityEdgeType =
  | "published"
  | "visually_matches"
  | "reposted"
  | "reviews"
  | "located_in"
  | "claims_same_event";

export interface EntityNode {
  id: string;
  type: EntityNodeType;
  label: string;
  caveat?: string;
}

export interface EntityEdge {
  from: string;
  to: string;
  type: EntityEdgeType;
}

// --- source dossier ------------------------------------------------------

export type SourceLabel =
  | "Primary source not established"
  | "Uncorroborated source"
  | "Known amplification node"
  | "Official channel"
  | "Trusted publication domain"
  | "Questionable provenance"
  | "Identity unresolved";

export type SourceType =
  | "primary"
  | "aggregator"
  | "official"
  | "media_outlet"
  | "social_account"
  | "telegram_channel"
  | "unknown";

export interface SourceDossier {
  identity: string;
  type: SourceType;
  labels: SourceLabel[];
  reliabilityHistory: string;
  amplificationBehavior: string;
  linkedEntities: string[];
  caveats: string[];
}

// --- collection plan -----------------------------------------------------

export type PlanTaskPriority = "high" | "medium" | "low";

export type PlanTaskStatus = "open" | "in_progress" | "blocked" | "done";

export interface PlanTask {
  id: string;
  title: string;
  affectedHypothesis: string;
  owner: string;
  priority: PlanTaskPriority;
  status: PlanTaskStatus;
  due: string; // ISO or "—"
}

// --- security posture ----------------------------------------------------

export type SecurityControlState = "ok" | "warn" | "violated" | "off";

export interface SecurityControl {
  id: string;
  label: string;
  state: SecurityControlState;
  detail: string;
}

// --- final assessment memo ----------------------------------------------

export interface AssessmentMemo {
  executive: string;
  keySupporting: string[];
  keyContradicting: string[];
  deception: string[];
  collectionGaps: string[];
  methodLimitations: string[];
  securityNote: string;
}

export interface CaseContext {
  caseId: string;
  handling: string;
  compartment: string;
  sessionRisk: SessionRiskLevel;
  analystName: string | null;
  status: CaseStatus;
  createdAt: string;
  intake: CaseIntake;
  report: Report | null;
  preview: Preview | null;
  demoSlug: string | null;
}

export const PANEL_LABELS: Record<PanelId, string> = {
  overview: "Case Board",
  media: "Media Lab",
  provenance: "Provenance",
  forensics: "Forensics",
  osint: "OSINT",
  "source-network": "Source Dossier",
  "entity-graph": "Entity Graph",
  timeline: "Timeline",
  "geo-chrono": "Geo / Chrono",
  deception: "Deception Indicators",
  hypotheses: "Hypotheses",
  tensions: "Analytic Tensions",
  gaps: "Collection Plan",
  claims: "Claim Ledger",
  strength: "Evidence Strength",
  security: "Security Posture",
  custody: "Chain of Custody",
  notes: "Analyst Notes",
  assessment: "Final Assessment",
};

export const PANEL_ORDER: PanelId[] = [
  "overview",
  "media",
  "provenance",
  "forensics",
  "osint",
  "claims",
  "source-network",
  "entity-graph",
  "timeline",
  "geo-chrono",
  "deception",
  "tensions",
  "hypotheses",
  "strength",
  "gaps",
  "security",
  "custody",
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
