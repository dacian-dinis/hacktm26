// Mirror of apps/api/models.py — keep in sync.
// The Finding shape is the contract every tier (T1-T4) emits.

export type Tier = 1 | 2 | 3 | 4;
export type Result = "pass" | "fail" | "indeterminate";
export type Confidence = "deterministic" | "high" | "medium" | "low";

export interface Finding {
  tier: Tier;
  check: string;
  result: Result;
  confidence: Confidence;
  evidence: Record<string, unknown>;
  source: string;
  timestamp: string; // ISO-8601 UTC
}

export interface Report {
  input_hash: string;
  findings: Finding[];
  analyst_signature?: string | null;
  signed_at?: string | null;
}

export const TIER_LABELS: Record<Tier, string> = {
  1: "Tier 1 — Provenance (deterministic)",
  2: "Tier 2 — Forensic (inspectable)",
  3: "Tier 3 — AI signal (probabilistic, one input among many)",
  4: "Tier 4 — OSINT corroboration",
};
