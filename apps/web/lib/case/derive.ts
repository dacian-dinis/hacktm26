// Pure derivation functions over Finding[] + CaseIntake.
// Lives in the frontend deliberately: the backend's contract is the raw
// Finding list; the analyst layer is interpretation on top of that.

import type {
  AssessmentMemo,
  CaseIntake,
  ChainEvent,
  CollectionGap,
  DeceptionIndicator,
  EntityEdge,
  EntityNode,
  FindingRef,
  Hypothesis,
  PlanTask,
  SecurityControl,
  SourceDossier,
  SourceLabel,
  SourceType,
  StrengthAxis,
  StrengthLevel,
  StrengthScore,
  SubClaim,
  Tension,
  TimelineEvent,
} from "@/types/case";
import type { Finding } from "@/types/report";

// --- helpers ---------------------------------------------------------------

function byCheck(findings: Finding[], check: string): Finding | undefined {
  return findings.find((f) => f.check === check);
}

function ev<T = unknown>(f: Finding | undefined, key: string): T | undefined {
  if (!f) return undefined;
  return (f.evidence as Record<string, unknown>)[key] as T | undefined;
}

function safeDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isElaElevated(f: Finding | undefined): boolean {
  if (!f) return false;
  const max = ev<number>(f, "max_channel_error");
  const p95 = ev<number>(f, "p95_channel_error");
  // p95>5 or max>20 is meaningful relative to the cleaner demo assets
  return (typeof p95 === "number" && p95 > 5) || (typeof max === "number" && max > 20);
}

function isNoiseInconsistent(f: Finding | undefined): boolean {
  if (!f) return false;
  const max = ev<number>(f, "max_abs_residual");
  const p95 = ev<number>(f, "p95_abs_residual");
  return (typeof p95 === "number" && p95 > 10) || (typeof max === "number" && max > 100);
}

// --- collection gaps ------------------------------------------------------

export function deriveGaps(
  findings: Finding[],
  intake: CaseIntake,
): CollectionGap[] {
  const gaps: CollectionGap[] = [];
  if (!intake.sourceUrl.trim())
    gaps.push({
      id: "no_source_url",
      label: "No source URL supplied",
      impact:
        "Source reputation and Telegram-handle checks cannot run; reverse-image live lookup falls back to cache.",
    });
  const c2pa = byCheck(findings, "c2pa.signature.verify");
  if (c2pa && ev<boolean>(c2pa, "manifest_present") === false)
    gaps.push({
      id: "no_c2pa_manifest",
      label: "No C2PA manifest embedded",
      impact:
        "No cryptographic provenance to verify. Provenance must be established by reverse-image and OSINT corroboration.",
    });
  if (!intake.claimText.trim())
    gaps.push({
      id: "no_claim_text",
      label: "No claim text provided",
      impact:
        "Fact-check search cannot run against a real sentence; claim ledger has no rows to evaluate.",
    });
  if (!intake.claimedLocation.trim())
    gaps.push({
      id: "no_geolocation",
      label: "No claimed location",
      impact:
        "Chronolocation/shadow-consistency checks unavailable; OSINT source filtering is broader than necessary.",
    });
  if (!intake.claimedDateTime.trim())
    gaps.push({
      id: "no_claimed_datetime",
      label: "No claimed date/time",
      impact:
        "Timeline cannot flag conflicts between visual age and claim age.",
    });
  const exif = byCheck(findings, "exif.metadata.parse");
  if (exif) {
    const raw = ev<Record<string, unknown>>(exif, "raw");
    if (!raw || Object.keys(raw).length === 0)
      gaps.push({
        id: "exif_missing",
        label: "No EXIF metadata",
        impact:
          "No camera-model, capture-time, or GPS tags. Forensics relies on pixel-level checks alone.",
      });
  }
  const factcheck = byCheck(findings, "google.factcheck.search");
  if (factcheck && ev(factcheck, "error"))
    gaps.push({
      id: "no_factcheck_data",
      label: "Fact-check data unavailable",
      impact:
        "External corroboration via Google Fact Check did not return — treat as missing evidence, not absence of claim.",
    });
  return gaps;
}

// --- timeline -------------------------------------------------------------

export function deriveTimeline(
  findings: Finding[],
  intake: CaseIntake,
  caseCreatedAt: string,
  analystSignedAt: string | null,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  events.push({
    at: caseCreatedAt,
    source: "intake",
    label: "Case intake",
    detail: "Analyst submitted media to verification workbench",
  });

  if (intake.claimedDateTime.trim())
    events.push({
      at: intake.claimedDateTime,
      source: "intake",
      label: "Claimed event date/time",
      detail: intake.claimText || undefined,
    });

  const c2pa = byCheck(findings, "c2pa.signature.verify");
  const c2paSig = ev<Record<string, unknown> | null>(c2pa, "signer");
  const c2paTime = c2paSig && (c2paSig as Record<string, unknown>).time;
  if (typeof c2paTime === "string")
    events.push({
      at: c2paTime,
      source: "c2pa",
      label: "C2PA manifest signed",
      detail: `Signer: ${
        (c2paSig as Record<string, unknown>).issuer ?? "(unknown)"
      }`,
    });

  const exif = byCheck(findings, "exif.metadata.parse");
  const exifHeadline = ev<Record<string, unknown>>(exif, "headline");
  const exifTime =
    exifHeadline &&
    (exifHeadline.DateTimeOriginal || exifHeadline.DateTime || exifHeadline.dateTimeOriginal);
  if (typeof exifTime === "string")
    events.push({
      at: exifTime,
      source: "exif",
      label: "EXIF DateTimeOriginal",
    });

  const reverse = byCheck(findings, "reverse_image.lookup");
  const earliest = ev<string>(reverse, "earliest_seen");
  if (earliest)
    events.push({
      at: earliest,
      source: "reverse-image-earliest",
      label: "Earliest reverse-image sighting",
      detail: `Hit count: ${ev<number>(reverse, "hit_count") ?? "?"}`,
    });

  const factcheck = byCheck(findings, "google.factcheck.search");
  const reviewDate = ev<string>(factcheck, "review_date");
  if (reviewDate)
    events.push({
      at: reviewDate,
      source: "factcheck-review",
      label: "Fact-check review published",
      detail: ev<string>(factcheck, "publisher") ?? undefined,
    });

  if (analystSignedAt)
    events.push({
      at: analystSignedAt,
      source: "analyst",
      label: "Analyst signed assessment",
    });

  // Sort chronologically; unknown timestamps sink.
  events.sort((a, b) => {
    const da = safeDate(a.at);
    const db = safeDate(b.at);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da.getTime() - db.getTime();
  });

  // Conflict pass: claimed date vs. earliest reverse-image sighting.
  const claimedDt = safeDate(intake.claimedDateTime);
  const earliestDt = safeDate(earliest ?? null);
  if (claimedDt && earliestDt) {
    const diffYears = (claimedDt.getTime() - earliestDt.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (diffYears > 1) {
      const reverseEvent = events.find((e) => e.source === "reverse-image-earliest");
      if (reverseEvent)
        reverseEvent.conflict = `Visual base predates claimed event by ~${diffYears.toFixed(0)} year${diffYears >= 2 ? "s" : ""}.`;
    }
  }

  return events;
}

// --- analytic tensions ----------------------------------------------------

export function deriveTensions(
  findings: Finding[],
  intake: CaseIntake,
): Tension[] {
  const tensions: Tension[] = [];
  const t3 = byCheck(findings, "ai.deepfake.vit");
  const reverse = byCheck(findings, "reverse_image.lookup");
  const c2pa = byCheck(findings, "c2pa.signature.verify");
  const ela = byCheck(findings, "forensics.ela");
  const noise = byCheck(findings, "forensics.noise_residual");
  const factcheck = byCheck(findings, "google.factcheck.search");

  // 1. AI says Real high, but reverse-image found old hits
  const t3Label = ev<string>(t3, "model_label");
  const t3Score = ev<number>(t3, "model_score");
  const reverseHits = ev<number>(reverse, "hit_count") ?? 0;
  const earliestStr = ev<string>(reverse, "earliest_seen");
  const earliest = safeDate(earliestStr ?? null);
  if (
    t3Label === "Real" &&
    typeof t3Score === "number" &&
    t3Score > 0.8 &&
    reverseHits > 0 &&
    earliest &&
    (Date.now() - earliest.getTime()) / (1000 * 60 * 60 * 24 * 365.25) > 1
  ) {
    tensions.push({
      id: "ai_real_vs_old_visual",
      severity: "high",
      statement: `AI signal reports "${t3Label}" (${(t3Score * 100).toFixed(0)}%) but reverse-image evidence shows the visual base predates the claim by >1 year.`,
      related: ["ai.deepfake.vit", "reverse_image.lookup"],
      followUp:
        "Treat the AI output as non-authoritative for this case. Report the temporal evidence as the primary signal.",
    });
  }

  // 2. Claim date vs. visual age
  const claimedDt = safeDate(intake.claimedDateTime);
  if (claimedDt && earliest) {
    const diffYears = (claimedDt.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (diffYears > 1)
      tensions.push({
        id: "claim_date_vs_visual_age",
        severity: "high",
        statement: `Claim is dated ${claimedDt.toISOString().slice(0, 10)} but the visual base has been online since ${earliest.toISOString().slice(0, 10)}.`,
        related: ["reverse_image.lookup"],
        followUp:
          "If the claim is 'recently captured,' the visual is reused. Confirm via a second reverse-image source.",
      });
  }

  // 3. No C2PA + claimed trusted source
  const manifestPresent = ev<boolean>(c2pa, "manifest_present");
  if (manifestPresent === false && intake.claimedSource.trim())
    tensions.push({
      id: "no_provenance_for_named_source",
      severity: "medium",
      statement: `Claimed source "${intake.claimedSource}" but no C2PA manifest is embedded.`,
      related: ["c2pa.signature.verify"],
      followUp:
        "Ask the claimed source for the original. Verify whether their pipeline signs C2PA; absence ≠ inauthentic but materially weakens the chain.",
    });

  // 4. Isolated forensic signal (ELA hot but T3 clean, no copy-move/JPEG yet)
  if (isElaElevated(ela) && t3Label === "Real" && (t3Score ?? 0) > 0.9 && !isNoiseInconsistent(noise))
    tensions.push({
      id: "isolated_forensic_signal",
      severity: "low",
      statement:
        "ELA shows elevated recompression error in regions, but noise residual is flat and AI signal says Real. Compositing is possible but not yet corroborated.",
      related: ["forensics.ela", "forensics.noise_residual", "ai.deepfake.vit"],
      followUp:
        "Add copy-move and JPEG double-compression checks for corroboration before flagging as composite.",
    });

  // 5. Fact-check MISLEADING but result indeterminate
  const rating = ev<string>(factcheck, "rating");
  if (rating && /mislead|false|fake|incorrect/i.test(rating))
    tensions.push({
      id: "factcheck_disagrees_with_claim",
      severity: "high",
      statement: `External fact-check rated this claim "${rating}".`,
      related: ["google.factcheck.search"],
      followUp:
        "Cite the fact-check URL in the assessment. Note it is an external opinion, not a primary evidence chain.",
    });

  return tensions;
}

// --- hypotheses -----------------------------------------------------------

export function deriveHypotheses(
  findings: Finding[],
  intake: CaseIntake,
  gaps: CollectionGap[],
): Hypothesis[] {
  const out: Hypothesis[] = [];

  const c2pa = byCheck(findings, "c2pa.signature.verify");
  const reverse = byCheck(findings, "reverse_image.lookup");
  const ela = byCheck(findings, "forensics.ela");
  const noise = byCheck(findings, "forensics.noise_residual");
  const t3 = byCheck(findings, "ai.deepfake.vit");
  const factcheck = byCheck(findings, "google.factcheck.search");

  const c2paPass = c2pa?.result === "pass";
  const reverseHits = ev<number>(reverse, "hit_count") ?? 0;
  const earliest = safeDate(ev<string>(reverse, "earliest_seen") ?? null);
  const claimedDt = safeDate(intake.claimedDateTime);
  const claimVsVisualYears =
    claimedDt && earliest
      ? (claimedDt.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
      : null;
  const t3Label = ev<string>(t3, "model_label");
  const t3Score = ev<number>(t3, "model_score") ?? 0;
  const factRating = ev<string>(factcheck, "rating");

  // H1 Authentic current media
  {
    const support: { check: string; reason: string }[] = [];
    const contra: { check: string; reason: string }[] = [];
    if (c2paPass)
      support.push({
        check: "c2pa.signature.verify",
        reason: "Cryptographic provenance verified.",
      });
    if (reverseHits === 0)
      support.push({
        check: "reverse_image.lookup",
        reason: "No prior web matches — image may be novel.",
      });
    if (!isElaElevated(ela))
      support.push({ check: "forensics.ela", reason: "ELA within baseline." });
    if (!isNoiseInconsistent(noise))
      support.push({
        check: "forensics.noise_residual",
        reason: "Noise residual statistically uniform.",
      });
    if (claimVsVisualYears && claimVsVisualYears > 1)
      contra.push({
        check: "reverse_image.lookup",
        reason: `Visual base predates claimed event by ~${claimVsVisualYears.toFixed(0)} year(s).`,
      });
    if (factRating && /mislead|false|fake|incorrect/i.test(factRating))
      contra.push({
        check: "google.factcheck.search",
        reason: `External fact-check rated this "${factRating}".`,
      });
    if (!c2paPass)
      contra.push({
        check: "c2pa.signature.verify",
        reason: "No verifiable provenance manifest.",
      });
    out.push({
      id: "H1",
      label: "Authentic current media",
      supporting: support,
      contradicting: contra,
      gaps: gaps.filter((g) => g.id === "no_c2pa_manifest" || g.id === "exif_missing").map((g) => g.label),
      confidence: scoreConfidence(support.length, contra.length),
      rationale:
        support.length > contra.length
          ? "Provenance and pixel-level evidence are consistent with novel capture."
          : "Provenance is missing or contradicted by reverse-image history.",
    });
  }

  // H2 Old real media reused in false context
  {
    const support: { check: string; reason: string }[] = [];
    const contra: { check: string; reason: string }[] = [];
    if (reverseHits > 0 && claimVsVisualYears && claimVsVisualYears > 1)
      support.push({
        check: "reverse_image.lookup",
        reason: `Earliest sighting ${earliest?.toISOString().slice(0, 10)} predates claimed event by ~${claimVsVisualYears.toFixed(0)} year(s).`,
      });
    if (factRating && /mislead|outdated|false|context/i.test(factRating))
      support.push({
        check: "google.factcheck.search",
        reason: `Fact-check rating "${factRating}" matches reuse pattern.`,
      });
    if (c2paPass)
      contra.push({
        check: "c2pa.signature.verify",
        reason: "Manifest verifies fresh provenance.",
      });
    if (reverseHits === 0)
      contra.push({
        check: "reverse_image.lookup",
        reason: "No prior matches — image may be novel.",
      });
    out.push({
      id: "H2",
      label: "Old real media reused in false context",
      supporting: support,
      contradicting: contra,
      gaps: gaps.filter((g) => g.id === "no_claim_text" || g.id === "no_claimed_datetime").map((g) => g.label),
      confidence: scoreConfidence(support.length, contra.length),
      rationale:
        support.length > 0
          ? "Visual base is older than the claim implies; image likely reused out of context."
          : "Insufficient temporal contradiction to support reuse hypothesis.",
    });
  }

  // H3 Real scene with inserted synthetic element
  {
    const support: { check: string; reason: string }[] = [];
    const contra: { check: string; reason: string }[] = [];
    if (isElaElevated(ela))
      support.push({
        check: "forensics.ela",
        reason: "Localized recompression-error anomaly.",
      });
    if (isNoiseInconsistent(noise))
      support.push({
        check: "forensics.noise_residual",
        reason: "Inconsistent residual texture across regions.",
      });
    if (t3Label === "Fake" && t3Score > 0.7)
      support.push({
        check: "ai.deepfake.vit",
        reason: `Face-level model leans synthetic (${(t3Score * 100).toFixed(0)}%).`,
      });
    if (c2paPass)
      contra.push({
        check: "c2pa.signature.verify",
        reason: "Manifest verifies — composite would invalidate the signature.",
      });
    if (!isElaElevated(ela) && !isNoiseInconsistent(noise))
      contra.push({
        check: "forensics.*",
        reason: "Both pixel-forensic signals are within baseline.",
      });
    out.push({
      id: "H3",
      label: "Real scene with inserted synthetic element",
      supporting: support,
      contradicting: contra,
      gaps: ["Copy-move detection not yet wired", "JPEG quantization analysis not yet wired"],
      confidence: scoreConfidence(support.length, contra.length),
      rationale:
        support.length > 0
          ? "Pixel-level anomalies consistent with local manipulation; needs copy-move / JPEG corroboration."
          : "No pixel-level anomalies indicate localized insertion.",
    });
  }

  // H4 Fully synthetic media
  {
    const support: { check: string; reason: string }[] = [];
    const contra: { check: string; reason: string }[] = [];
    if (t3Label === "Fake" && t3Score > 0.85)
      support.push({
        check: "ai.deepfake.vit",
        reason: `AI signal flags this as synthetic with ${(t3Score * 100).toFixed(0)}% confidence.`,
      });
    if (reverseHits === 0)
      support.push({
        check: "reverse_image.lookup",
        reason: "No prior web matches — image not in known corpus.",
      });
    if (c2paPass)
      contra.push({
        check: "c2pa.signature.verify",
        reason: "Real C2PA manifest with valid signature.",
      });
    if (t3Label === "Real" && t3Score > 0.8)
      contra.push({
        check: "ai.deepfake.vit",
        reason: `AI signal labels Real (${(t3Score * 100).toFixed(0)}%).`,
      });
    if (reverseHits > 0)
      contra.push({
        check: "reverse_image.lookup",
        reason: "Prior web matches — image existed before any synthesis claim.",
      });
    out.push({
      id: "H4",
      label: "Fully synthetic media",
      supporting: support,
      contradicting: contra,
      gaps: ["T3 model is face-focused; weak for scene-level synthesis"],
      confidence: scoreConfidence(support.length, contra.length),
      rationale:
        support.length > contra.length
          ? "AI signal and absence of prior matches consistent with synthesis."
          : "Prior matches and/or AI Real label contradict full synthesis.",
    });
  }

  // H5 Unknown origin — insufficient evidence
  {
    const indet = findings.filter((f) => f.result === "indeterminate").length;
    const ratio = findings.length ? indet / findings.length : 0;
    out.push({
      id: "H5",
      label: "Unknown origin — insufficient evidence",
      supporting:
        ratio > 0.6
          ? [
              {
                check: "(aggregate)",
                reason: `${indet}/${findings.length} findings indeterminate; multiple collection gaps remain.`,
              },
            ]
          : [],
      contradicting:
        out.some((h) => h.confidence === "high")
          ? [
              {
                check: "(aggregate)",
                reason: "At least one hypothesis above is high-confidence.",
              },
            ]
          : [],
      gaps: gaps.map((g) => g.label),
      confidence:
        ratio > 0.6 ? "moderate" : ratio > 0.3 ? "low" : "insufficient",
      rationale:
        ratio > 0.6
          ? "Most checks are inconclusive; collection gaps dominate. Hold judgment until gaps are filled."
          : "Sufficient deterministic and inspectable evidence to evaluate the other hypotheses.",
    });
  }

  return out;
}

function scoreConfidence(supports: number, contras: number) {
  const net = supports - contras;
  if (supports === 0 && contras === 0) return "insufficient" as const;
  if (net >= 2) return "high" as const;
  if (net >= 1) return "moderate" as const;
  if (net === 0) return "low" as const;
  return "insufficient" as const;
}

// --- sub-claim auto-extraction --------------------------------------------
// Decompose the freeform `claimText` plus the structured intake fields into
// a small set of testable sub-claims, then evaluate each against the
// findings. This is the "claim ledger" view: a single claim is rarely a
// single proposition — it bundles subject + location + time + source +
// integrity. Each can be supported or contradicted independently.

export function deriveSubClaims(
  findings: Finding[],
  intake: CaseIntake,
): SubClaim[] {
  const claimText = intake.claimText.trim();
  if (!claimText && !intake.claimedLocation && !intake.claimedDateTime && !intake.claimedSource)
    return [];

  const out: SubClaim[] = [];

  const reverse = byCheck(findings, "reverse_image.lookup");
  const reverseHits = ev<number>(reverse, "hit_count") ?? 0;
  const earliestStr = ev<string>(reverse, "earliest_seen");
  const earliest = safeDate(earliestStr ?? null);
  const factcheck = byCheck(findings, "google.factcheck.search");
  const factRating = ev<string>(factcheck, "rating");
  const factClaim = ev<string>(factcheck, "claim");
  const sourceRep = byCheck(findings, "source.reputation.lookup");
  const telegram = byCheck(findings, "osint.telegram.reputation");
  const ela = byCheck(findings, "forensics.ela");
  const noise = byCheck(findings, "forensics.noise_residual");
  const c2pa = byCheck(findings, "c2pa.signature.verify");
  const c2paPass = c2pa?.result === "pass";

  // 1. Subject — "this image shows X" — extracted from claimText
  if (claimText) {
    const support: FindingRef[] = [];
    const contra: FindingRef[] = [];
    if (factClaim && factRating && /support|true|correct|accurate/i.test(factRating))
      support.push({
        check: "google.factcheck.search",
        reason: `External fact-check supports a similar claim: "${factClaim}".`,
      });
    if (factRating && /mislead|false|fake|incorrect|outdated/i.test(factRating))
      contra.push({
        check: "google.factcheck.search",
        reason: `External fact-check rated this subject "${factRating}".`,
      });
    if (reverseHits > 0 && earliest)
      contra.push({
        check: "reverse_image.lookup",
        reason: `Image was already on the web at ${earliest.toISOString().slice(0, 10)}; subject framing may not be the original one.`,
      });
    out.push({
      kind: "subject",
      text: `This image shows: ${claimText}`,
      supporting: support,
      contradicting: contra,
      status: deriveStatus(support, contra),
      rationale:
        contra.length > 0
          ? "Subject framing is challenged by external corroboration and/or temporal evidence."
          : support.length > 0
            ? "Subject framing matches a corroborated external claim."
            : "No external evidence pro or con the subject framing.",
    });
  }

  // 2. Location — "it happened in Y"
  if (intake.claimedLocation.trim()) {
    const support: FindingRef[] = [];
    const contra: FindingRef[] = [];
    // No backend geolocation check yet — flag as unresolved with the gap
    out.push({
      kind: "location",
      text: `Claimed location: ${intake.claimedLocation}`,
      supporting: support,
      contradicting: contra,
      status: "insufficient",
      rationale:
        "No geolocation evidence in this workbench yet (shadow / EXIF GPS / scene-matching backlog). Treat as an open lead for the analyst.",
    });
  }

  // 3. Date / time — "it happened on Z"
  if (intake.claimedDateTime.trim()) {
    const support: FindingRef[] = [];
    const contra: FindingRef[] = [];
    const claimed = safeDate(intake.claimedDateTime);
    if (claimed && earliest) {
      const diffYears =
        (claimed.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (diffYears > 1)
        contra.push({
          check: "reverse_image.lookup",
          reason: `Visual base online since ${earliest.toISOString().slice(0, 10)} — predates claimed date by ~${diffYears.toFixed(0)} year(s).`,
        });
      else if (Math.abs(diffYears) < 0.1)
        support.push({
          check: "reverse_image.lookup",
          reason: "Earliest sighting and claimed date are within a month of each other.",
        });
    }
    // C2PA signing time
    const c2paSig = ev<Record<string, unknown> | null>(c2pa, "signer");
    const c2paTime = c2paSig && (c2paSig as Record<string, unknown>).time;
    const c2paDt = typeof c2paTime === "string" ? safeDate(c2paTime) : null;
    if (claimed && c2paDt) {
      const diffDays = Math.abs(
        (claimed.getTime() - c2paDt.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays < 30)
        support.push({
          check: "c2pa.signature.verify",
          reason: `C2PA signature time (${c2paDt.toISOString().slice(0, 10)}) is within ${diffDays.toFixed(0)} day(s) of claimed date.`,
        });
      else
        contra.push({
          check: "c2pa.signature.verify",
          reason: `C2PA signature time (${c2paDt.toISOString().slice(0, 10)}) is ${diffDays.toFixed(0)} day(s) off the claimed date.`,
        });
    }
    out.push({
      kind: "datetime",
      text: `Claimed date / time: ${intake.claimedDateTime}`,
      supporting: support,
      contradicting: contra,
      status: deriveStatus(support, contra),
      rationale:
        contra.length > 0
          ? "Temporal evidence contradicts the claimed date."
          : support.length > 0
            ? "Temporal evidence is consistent with the claimed date."
            : "No temporal evidence to evaluate this sub-claim.",
    });
  }

  // 4. Source — "it came from S"
  if (intake.claimedSource.trim() || intake.sourceUrl.trim()) {
    const support: FindingRef[] = [];
    const contra: FindingRef[] = [];
    if (sourceRep && sourceRep.result === "pass")
      support.push({
        check: "source.reputation.lookup",
        reason: "Source domain is in the trusted set.",
      });
    if (sourceRep && sourceRep.result === "fail")
      contra.push({
        check: "source.reputation.lookup",
        reason: "Source domain is in the known-disinformation set.",
      });
    if (telegram && telegram.result === "fail")
      contra.push({
        check: "osint.telegram.reputation",
        reason: "Telegram handle flagged in the curated disinfo list.",
      });
    if (c2paPass)
      support.push({
        check: "c2pa.signature.verify",
        reason: "Cryptographically signed by a named issuer.",
      });
    out.push({
      kind: "source",
      text: `Source: ${intake.claimedSource || intake.sourceUrl}`,
      supporting: support,
      contradicting: contra,
      status: deriveStatus(support, contra),
      rationale:
        contra.length > 0
          ? "Source attribution is contradicted by reputation or provenance signals."
          : support.length > 0
            ? "Source attribution corroborated by reputation or provenance signals."
            : "No source-reputation evidence — analyst must validate the source manually.",
    });
  }

  // 5. Integrity — "the media has not been edited"
  {
    const support: FindingRef[] = [];
    const contra: FindingRef[] = [];
    if (c2paPass)
      support.push({
        check: "c2pa.signature.verify",
        reason: "C2PA signature would be invalidated by any post-signing edit.",
      });
    if (!isElaElevated(ela) && !isNoiseInconsistent(noise))
      support.push({
        check: "forensics.*",
        reason: "ELA and noise residual both within baseline.",
      });
    if (isElaElevated(ela))
      contra.push({
        check: "forensics.ela",
        reason: "Localized recompression anomalies present.",
      });
    if (isNoiseInconsistent(noise))
      contra.push({
        check: "forensics.noise_residual",
        reason: "Inconsistent residual texture across regions.",
      });
    out.push({
      kind: "not_edited",
      text: "The media has not been edited",
      supporting: support,
      contradicting: contra,
      status: deriveStatus(support, contra),
      rationale:
        contra.length > 0
          ? "Pixel-level signals are inconsistent with an unedited image."
          : support.length > 0
            ? "Pixel-level signals are consistent with an unedited image."
            : "Insufficient forensic signal to evaluate integrity.",
    });
  }

  return out;
}

function deriveStatus(
  supporting: FindingRef[],
  contradicting: FindingRef[],
): SubClaim["status"] {
  if (supporting.length === 0 && contradicting.length === 0) return "insufficient";
  if (contradicting.length > supporting.length) return "contradicted";
  if (supporting.length > contradicting.length) return "supported";
  return "unresolved";
}

// --- evidence strength rubric --------------------------------------------
// Six axes. Each rated 0–100. The score answers "how well-supported is any
// assessment built on this evidence", not "how likely is the image to be
// fake." Overall confidence is the weighted average plus a missing-evidence
// penalty for collection gaps.

function levelFor(score: number): StrengthLevel {
  if (score >= 80) return "strong";
  if (score >= 50) return "partial";
  if (score >= 20) return "limited";
  return "missing";
}

export function deriveStrength(
  findings: Finding[],
  intake: CaseIntake,
  gaps: CollectionGap[],
  tensions: Tension[],
): StrengthScore {
  const c2pa = byCheck(findings, "c2pa.signature.verify");
  const exif = byCheck(findings, "exif.metadata.parse");
  const reverse = byCheck(findings, "reverse_image.lookup");
  const ela = byCheck(findings, "forensics.ela");
  const noise = byCheck(findings, "forensics.noise_residual");
  const t3 = byCheck(findings, "ai.deepfake.vit");
  const sourceRep = byCheck(findings, "source.reputation.lookup");
  const telegram = byCheck(findings, "osint.telegram.reputation");
  const factcheck = byCheck(findings, "google.factcheck.search");

  // 1. Provenance ----------------------------------------------------------
  const provReasons: string[] = [];
  let prov = 0;
  if (c2pa?.result === "pass") {
    prov += 70;
    provReasons.push("C2PA signature verified");
  } else if (c2pa && ev<boolean>(c2pa, "manifest_present") === false) {
    prov += 5;
    provReasons.push("No C2PA manifest embedded");
  }
  const exifHeadline = ev<Record<string, unknown>>(exif, "headline") ?? {};
  const exifKeys = Object.keys(exifHeadline);
  if (exifKeys.length > 0) {
    prov += Math.min(30, exifKeys.length * 5);
    provReasons.push(`EXIF: ${exifKeys.length} headline tag(s)`);
  } else if (exif) {
    provReasons.push("EXIF empty");
  }
  prov = Math.min(100, prov);

  // 2. Forensic consistency ------------------------------------------------
  const forReasons: string[] = [];
  let forensic = 0;
  if (ela) {
    if (isElaElevated(ela)) {
      forensic += 25;
      forReasons.push("ELA: localized recompression anomaly present");
    } else {
      forensic += 45;
      forReasons.push("ELA: within baseline");
    }
  }
  if (noise) {
    if (isNoiseInconsistent(noise)) {
      forensic += 20;
      forReasons.push("Noise: inconsistent across regions");
    } else {
      forensic += 45;
      forReasons.push("Noise: uniform residual texture");
    }
  }
  forReasons.push(
    "Copy-move + JPEG quantization checks not yet wired (backlog #5, #4)",
  );
  forensic = Math.min(100, forensic);

  // 3. Source corroboration -----------------------------------------------
  const srcReasons: string[] = [];
  let source = 0;
  const reverseHits = ev<number>(reverse, "hit_count") ?? 0;
  if (reverseHits > 0) {
    source += 40;
    srcReasons.push(`Reverse-image: ${reverseHits} prior web match(es)`);
  } else if (reverse?.result === "indeterminate") {
    source += 5;
    srcReasons.push("Reverse-image: no matches in source");
  }
  if (sourceRep) {
    if (sourceRep.result === "pass") {
      source += 25;
      srcReasons.push("Source domain in trusted set");
    } else if (sourceRep.result === "fail") {
      source -= 30;
      srcReasons.push("Source domain in known-disinformation set");
    }
  }
  if (telegram?.result === "fail") {
    source -= 20;
    srcReasons.push("Telegram handle flagged");
  }
  if (factcheck && ev<string>(factcheck, "rating")) {
    source += 25;
    srcReasons.push(
      `External fact-check hit ("${ev<string>(factcheck, "rating")}")`,
    );
  }
  source = Math.max(0, Math.min(100, source));

  // 4. Temporal consistency ------------------------------------------------
  const tempReasons: string[] = [];
  let temporal = 0;
  const earliestStr = ev<string>(reverse, "earliest_seen");
  const earliest = safeDate(earliestStr ?? null);
  const claimedDt = safeDate(intake.claimedDateTime);
  const c2paSig = ev<Record<string, unknown> | null>(c2pa, "signer");
  const c2paTime = c2paSig && (c2paSig as Record<string, unknown>).time;
  const c2paDt = typeof c2paTime === "string" ? safeDate(c2paTime) : null;
  let temporalSignals = 0;
  if (earliest) {
    temporal += 25;
    tempReasons.push(
      `Reverse-image earliest_seen: ${earliest.toISOString().slice(0, 10)}`,
    );
    temporalSignals++;
  }
  if (c2paDt) {
    temporal += 25;
    tempReasons.push(
      `C2PA signing time: ${c2paDt.toISOString().slice(0, 10)}`,
    );
    temporalSignals++;
  }
  if (claimedDt) {
    temporal += 25;
    tempReasons.push(
      `Analyst-supplied claim date: ${claimedDt.toISOString().slice(0, 10)}`,
    );
    temporalSignals++;
  }
  if (temporalSignals >= 2) {
    temporal += 25;
    tempReasons.push(
      `${temporalSignals} independent timestamps — cross-checkable`,
    );
  }
  if (!earliestStr && !c2paDt && !claimedDt)
    tempReasons.push("No timestamps from any source");
  temporal = Math.min(100, temporal);

  // 5. AI-only reliance (lower is better; we display it inverted) ----------
  const aiReasons: string[] = [];
  // How much non-AI signal do we have?
  const nonAiPasses = [
    c2pa?.result === "pass",
    reverseHits > 0,
    sourceRep?.result === "pass",
    !!ev<string>(factcheck, "rating"),
    !!earliest,
    exifKeys.length > 0,
  ].filter(Boolean).length;
  // 0 non-AI signals + a T3 finding → very high AI-only reliance (axis = 10)
  // 5+ non-AI signals → low AI-only reliance (axis = 95)
  const aiOnlyScore = Math.min(100, 10 + nonAiPasses * 15);
  if (t3 && nonAiPasses <= 1)
    aiReasons.push(
      "Heavy reliance on T3 — non-AI evidence is sparse. Treat T3 as illustrative, not authoritative.",
    );
  else if (nonAiPasses >= 3)
    aiReasons.push(
      `${nonAiPasses} non-AI signals present — T3 is one input among many.`,
    );
  else
    aiReasons.push(`${nonAiPasses} non-AI signal(s) — T3 weight is moderate.`);

  // 6. Missing-evidence penalty -------------------------------------------
  const gapReasons: string[] = gaps.map((g) => g.label);
  // Each gap removes confidence. Start at 100; -15 per gap, floor at 0.
  const gapScore = Math.max(0, 100 - gaps.length * 15);

  const axes: StrengthAxis[] = [
    {
      id: "provenance",
      label: "Provenance strength",
      score: prov,
      level: levelFor(prov),
      reasons: provReasons.length ? provReasons : ["No provenance evidence collected"],
    },
    {
      id: "forensic",
      label: "Forensic consistency",
      score: forensic,
      level: levelFor(forensic),
      reasons: forReasons,
    },
    {
      id: "source",
      label: "Source corroboration",
      score: source,
      level: levelFor(source),
      reasons: srcReasons.length ? srcReasons : ["No external source signals"],
    },
    {
      id: "temporal",
      label: "Temporal consistency",
      score: temporal,
      level: levelFor(temporal),
      reasons: tempReasons,
    },
    {
      id: "ai_only",
      label: "AI-only fallback risk",
      score: aiOnlyScore,
      level: levelFor(aiOnlyScore),
      reasons: aiReasons,
    },
    {
      id: "gaps",
      label: "Collection coverage",
      score: gapScore,
      level: levelFor(gapScore),
      reasons: gapReasons.length ? gapReasons : ["No collection gaps detected"],
    },
  ];

  // Weighted overall. Provenance and source are weighted higher because they
  // anchor an assessment; AI-only reliance is a guardrail, not a verdict.
  const overallScore = Math.round(
    (prov * 0.25 +
      forensic * 0.15 +
      source * 0.25 +
      temporal * 0.15 +
      aiOnlyScore * 0.1 +
      gapScore * 0.1),
  );

  // Penalize for unresolved high-severity tensions.
  const tensionPenalty = tensions.filter((t) => t.severity === "high").length * 8;
  const adjusted = Math.max(0, overallScore - tensionPenalty);

  const overall = levelFor(adjusted);
  const summary = buildSummary(overall, axes, tensions);

  return {
    axes,
    overallScore: adjusted,
    overall,
    summary,
  };
}

function buildSummary(
  level: StrengthLevel,
  axes: StrengthAxis[],
  tensions: Tension[],
): string {
  const weak = axes.filter((a) => a.level === "missing" || a.level === "limited");
  const strong = axes.filter((a) => a.level === "strong");
  const parts: string[] = [];
  if (strong.length > 0)
    parts.push(`strong ${strong.map((a) => a.id).join(", ")}`);
  if (weak.length > 0)
    parts.push(`weak ${weak.map((a) => a.id).join(", ")}`);
  if (tensions.some((t) => t.severity === "high"))
    parts.push("unresolved high-severity tension");
  const reason = parts.length ? parts.join("; ") : "evidence axes are balanced";
  if (level === "limited" || level === "missing") {
    return `Evidence coverage is ${level}; missing axes are collection gaps, not authenticity failures — ${reason}.`;
  }
  return `Evidence coverage is ${level} — ${reason}.`;
}

// --- chain of custody ---------------------------------------------------

const TOOL_ID = "veritas/0.2";

function externalSourceFor(f: Finding): string | null {
  if (f.source.startsWith("google.")) return f.source;
  if (f.source.startsWith("serpapi.")) return f.source;
  if (f.source === "huggingface.inference") return f.source;
  if (f.source.startsWith("bing.")) return f.source;
  return null;
}

export function deriveCustodyChain(
  findings: Finding[],
  intake: CaseIntake,
  createdAt: string,
  inputHash: string | null,
  analystSignedAt: string | null,
  analystName: string | null,
): ChainEvent[] {
  const out: ChainEvent[] = [];
  const actor = analystName || "analyst";

  out.push({
    at: createdAt,
    actor,
    action: "case_created",
    objectId: "case",
    tool: TOOL_ID,
    external: false,
    detail: `Compartment: ${intake.operationalRelevance || "—"}`,
  });

  if (inputHash)
    out.push({
      at: createdAt,
      actor: "system",
      action: "input_hash_computed",
      objectId: "media:original",
      hashAfter: inputHash,
      tool: "python:hashlib.sha256",
      external: false,
    });

  out.push({
    at: createdAt,
    actor: "system",
    action: "working_copy_created",
    objectId: "media:working",
    tool: TOOL_ID,
    external: false,
    detail: "Bytes routed into tier pipelines; original preserved",
  });

  // One event per finding (and an external-lookup record where applicable).
  for (const f of findings) {
    const ext = externalSourceFor(f);
    if (ext)
      out.push({
        at: f.timestamp,
        actor: `external:${ext}`,
        action: "external_lookup",
        objectId: f.check,
        tool: ext,
        external: true,
        detail: "API request issued; provider disclosure logged",
      });
    out.push({
      at: f.timestamp,
      actor: "system",
      action: "finding_generated",
      objectId: f.check,
      tool: ext ?? TOOL_ID,
      external: !!ext,
      detail: `T${f.tier} · ${f.result} · ${f.confidence}`,
    });
  }

  if (intake.analystNotes.trim())
    out.push({
      at: createdAt,
      actor,
      action: "analyst_note_recorded",
      objectId: "note:intake",
      tool: TOOL_ID,
      external: false,
      detail: intake.analystNotes.slice(0, 120),
    });

  if (analystSignedAt)
    out.push({
      at: analystSignedAt,
      actor,
      action: "assessment_signed",
      objectId: "report",
      tool: TOOL_ID,
      external: false,
      detail: `Analyst: ${analystName ?? "—"}`,
    });

  // Stable chronological order.
  out.sort((a, b) => {
    const da = safeDate(a.at)?.getTime() ?? 0;
    const db = safeDate(b.at)?.getTime() ?? 0;
    return da - db;
  });
  return out;
}

// --- deception indicators -----------------------------------------------

export function deriveDeception(
  findings: Finding[],
  intake: CaseIntake,
  tensions: Tension[],
): DeceptionIndicator[] {
  const c2pa = byCheck(findings, "c2pa.signature.verify");
  const reverse = byCheck(findings, "reverse_image.lookup");
  const earliest = safeDate(ev<string>(reverse, "earliest_seen") ?? null);
  const claimed = safeDate(intake.claimedDateTime);
  const sourceRep = byCheck(findings, "source.reputation.lookup");
  const factcheck = byCheck(findings, "google.factcheck.search");
  const ela = byCheck(findings, "forensics.ela");
  const noise = byCheck(findings, "forensics.noise_residual");
  const t3 = byCheck(findings, "ai.deepfake.vit");
  const t3Label = ev<string>(t3, "model_label");
  const t3Score = ev<number>(t3, "model_score") ?? 0;
  const factRating = ev<string>(factcheck, "rating");
  const reverseHits = ev<number>(reverse, "hit_count") ?? 0;

  const out: DeceptionIndicator[] = [];

  out.push({
    id: "provenance_absence",
    label: "Provenance absence",
    status:
      c2pa && ev<boolean>(c2pa, "manifest_present") === false ? "active" : "absent",
    affectedClaims: ["Authentic current media"],
    evidence: ["c2pa.signature.verify"],
    explanation:
      "No cryptographic provenance present. Authenticity rests entirely on inspectable and external evidence.",
    caveat:
      "Absence of C2PA is the common case in 2026. Not by itself a deception signal — weighs against H1.",
  });

  const historicalActive =
    reverseHits > 0 &&
    claimed &&
    earliest &&
    (claimed.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24 * 365.25) > 1;
  out.push({
    id: "historical_reuse",
    label: "Historical media reuse",
    status: historicalActive ? "active" : reverseHits > 0 ? "not_evaluable" : "absent",
    affectedClaims: ["Date / time", "Subject", "Authentic current media"],
    evidence: ["reverse_image.lookup", "intake.claimedDateTime"],
    explanation: historicalActive
      ? `Visual base online since ${earliest?.toISOString().slice(0, 10)} — predates the claimed event by years.`
      : reverseHits > 0
        ? "Prior matches exist but no claim date supplied to evaluate reuse."
        : "No prior matches; reuse cannot be established.",
    caveat: "Reuse is not always intentional deception (memorial posts, retrospective coverage, etc.).",
  });

  out.push({
    id: "context_mismatch",
    label: "Context mismatch",
    status:
      factRating && /mislead|outdated|context|false|fake|incorrect/i.test(factRating)
        ? "active"
        : factRating
          ? "absent"
          : "not_evaluable",
    affectedClaims: ["Subject", "Context"],
    evidence: ["google.factcheck.search"],
    explanation: factRating
      ? `External fact-check rated this "${factRating}".`
      : "No external fact-check available to evaluate context.",
    caveat: "External fact-check is an opinion, not a primary evidence chain.",
  });

  out.push({
    id: "source_laundering",
    label: "Source laundering",
    status:
      !intake.sourceUrl.trim() && !intake.claimedSource.trim()
        ? "not_evaluable"
        : sourceRep?.result === "fail"
          ? "active"
          : "absent",
    affectedClaims: ["Source"],
    evidence: ["source.reputation.lookup", "intake.sourceUrl"],
    explanation:
      "Multiple republications of the same media may launder its origin from an unknown or compromised source.",
    caveat: "Reposting alone is not laundering. Look for chains that obscure first publication.",
  });

  out.push({
    id: "forensic_inconsistency",
    label: "Forensic inconsistency",
    status:
      isElaElevated(ela) || isNoiseInconsistent(noise) ? "active" : ela || noise ? "absent" : "not_evaluable",
    affectedClaims: ["Integrity"],
    evidence: ["forensics.ela", "forensics.noise_residual"],
    explanation:
      isElaElevated(ela) || isNoiseInconsistent(noise)
        ? "Pixel-level anomalies suggest localized editing or compositing."
        : "Pixel-level signals are within baseline.",
    caveat:
      "ELA and noise residual catch many but not all manipulations. Copy-move and JPEG quantization checks are on the backlog.",
  });

  out.push({
    id: "metadata_contradiction",
    label: "Metadata contradiction",
    status: tensions.some((t) => t.id === "claim_date_vs_visual_age") ? "active" : "absent",
    affectedClaims: ["Date / time"],
    evidence: ["intake.claimedDateTime", "reverse_image.lookup"],
    explanation: "Claimed timestamp does not line up with the earliest known sighting of the visual.",
    caveat: "Earliest-seen is a lower bound for true origin date, not an upper bound.",
  });

  out.push({
    id: "ai_source_disagreement",
    label: "AI / source disagreement",
    status: tensions.some((t) => t.id === "ai_real_vs_old_visual")
      ? "active"
      : t3
        ? "absent"
        : "not_evaluable",
    affectedClaims: ["Integrity", "Subject"],
    evidence: ["ai.deepfake.vit", "reverse_image.lookup"],
    explanation:
      t3Label === "Real" && t3Score > 0.8
        ? "Face-level AI signal labels the image Real, but source evidence (reverse-image, fact-check) tells a different story."
        : "AI signal and source evidence are not in conflict.",
    caveat: "T3 is face-focused. Disagreement with source evidence is expected for scene-level manipulation.",
  });

  out.push({
    id: "claim_source_mismatch",
    label: "Claim / source mismatch",
    status:
      intake.claimedSource.trim() && c2pa && ev<boolean>(c2pa, "manifest_present") === false
        ? "active"
        : "absent",
    affectedClaims: ["Source"],
    evidence: ["intake.claimedSource", "c2pa.signature.verify"],
    explanation:
      "Analyst attributes the media to a named source, but no signed provenance ties the media to that source.",
    caveat: "Most outlets do not yet sign C2PA. Absence is informational, not damning.",
  });

  out.push({
    id: "coordinated_amplification",
    label: "Coordinated amplification",
    status: "not_evaluable",
    affectedClaims: ["Source"],
    evidence: ["(not yet wired)"],
    explanation: "Detecting bot-like republication patterns requires multi-source ingestion (backlog).",
    caveat: "Amplification volume alone does not imply coordination; analyst review required.",
  });

  out.push({
    id: "unsupported_urgency",
    label: "Unsupported urgency / emotional framing",
    status: "not_evaluable",
    affectedClaims: ["Subject"],
    evidence: ["(text analysis on claim wording not yet wired)"],
    explanation:
      "Emotional or time-pressure framing is a classic deception lever but requires text analysis we have not implemented.",
    caveat: "Treat emotional framing as a soft signal, not an indicator on its own.",
  });

  return out;
}

// --- entity graph -------------------------------------------------------

function safeUrlHost(u: string): string | null {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function deriveEntities(
  findings: Finding[],
  intake: CaseIntake,
  inputHash: string | null,
): { nodes: EntityNode[]; edges: EntityEdge[] } {
  const nodes: EntityNode[] = [];
  const edges: EntityEdge[] = [];

  const mediaId = "media:" + (inputHash?.slice(0, 8) ?? "current");
  nodes.push({
    id: mediaId,
    type: "media",
    label: `Submitted media (${inputHash?.slice(0, 8) ?? "—"})`,
  });

  // Source domain
  if (intake.sourceUrl.trim()) {
    const host = safeUrlHost(intake.sourceUrl);
    if (host) {
      const isTelegram = /^t\.me$|^telegram\.me$/i.test(host);
      const id = isTelegram ? `tg:${host}` : `domain:${host}`;
      nodes.push({
        id,
        type: isTelegram ? "telegram_channel" : "source_domain",
        label: host,
      });
      edges.push({ from: id, to: mediaId, type: "published" });
    }
  }

  // Claimed source (analyst label) — distinct from sourceUrl
  if (intake.claimedSource.trim()) {
    const id = `claimed:${intake.claimedSource}`;
    nodes.push({
      id,
      type: "claimed_source",
      label: intake.claimedSource,
      caveat: "Analyst-supplied attribution, not yet corroborated.",
    });
    edges.push({ from: id, to: mediaId, type: "claims_same_event" });
  }

  // Claimed location
  if (intake.claimedLocation.trim()) {
    const id = `loc:${intake.claimedLocation}`;
    nodes.push({
      id,
      type: "claimed_location",
      label: intake.claimedLocation,
      caveat: "Geolocation not yet verified.",
    });
    edges.push({ from: mediaId, to: id, type: "located_in" });
  }

  // Reverse-image visual matches
  const reverse = byCheck(findings, "reverse_image.lookup");
  const hits = ev<Array<Record<string, unknown>>>(reverse, "hits") ?? [];
  hits.forEach((h, i) => {
    const url = typeof h.url === "string" ? h.url : null;
    const host = url ? safeUrlHost(url) : null;
    const id = `vmatch:${i}`;
    nodes.push({
      id,
      type: "visual_match",
      label: (typeof h.name === "string" && h.name) || host || `match #${i + 1}`,
      caveat:
        typeof h.datePublished === "string"
          ? `First seen ${h.datePublished}`
          : undefined,
    });
    edges.push({ from: id, to: mediaId, type: "visually_matches" });
    if (host) {
      const dom = `domain:${host}`;
      if (!nodes.some((n) => n.id === dom))
        nodes.push({ id: dom, type: "source_domain", label: host });
      edges.push({ from: dom, to: id, type: "published" });
    }
  });

  // Fact-check publisher
  const factcheck = byCheck(findings, "google.factcheck.search");
  const publisher = ev<string>(factcheck, "publisher");
  const reviewUrl = ev<string>(factcheck, "url");
  if (publisher) {
    const id = `fc:${publisher}`;
    nodes.push({
      id,
      type: "fact_check",
      label: publisher,
      caveat: reviewUrl ? `Review: ${reviewUrl}` : undefined,
    });
    edges.push({ from: id, to: mediaId, type: "reviews" });
  }

  return { nodes, edges };
}

// --- source dossier -----------------------------------------------------

export function deriveSourceDossier(
  findings: Finding[],
  intake: CaseIntake,
): SourceDossier | null {
  if (!intake.sourceUrl.trim() && !intake.claimedSource.trim()) return null;

  const sourceRep = byCheck(findings, "source.reputation.lookup");
  const telegram = byCheck(findings, "osint.telegram.reputation");
  const host = intake.sourceUrl.trim() ? safeUrlHost(intake.sourceUrl) : null;
  const isTelegram = host ? /^t\.me$|^telegram\.me$/i.test(host) : false;

  const identity =
    host || intake.claimedSource || intake.sourceUrl || "(unresolved)";

  let type: SourceType = "unknown";
  if (isTelegram) type = "telegram_channel";
  else if (host && /reuters\.com|apnews\.com|bbc\.|nato\.int|gov\.|wikimedia/i.test(host)) type = "official";
  else if (host && /\.gov$|\.edu$|reuters|ap\.|bbc|cnn|nytimes|guardian|wapo/i.test(host)) type = "media_outlet";
  else if (host && /twitter\.com|x\.com|facebook|instagram|tiktok/i.test(host)) type = "social_account";

  const labels: SourceLabel[] = [];
  if (sourceRep?.result === "pass") labels.push("Trusted publication domain");
  if (sourceRep?.result === "fail") labels.push("Questionable provenance");
  if (telegram?.result === "fail") labels.push("Known amplification node");
  if (!sourceRep && intake.claimedSource) labels.push("Primary source not established");
  if (!sourceRep && !intake.claimedSource) labels.push("Uncorroborated source");
  if (!host && intake.claimedSource) labels.push("Identity unresolved");
  if (type === "official") labels.push("Official channel");

  const reliabilityHistory =
    sourceRep
      ? typeof ev(sourceRep, "rating") === "string"
        ? (ev<string>(sourceRep, "rating") as string)
        : sourceRep.result === "pass"
          ? "Domain in trusted set; no prior issues in local cache."
          : sourceRep.result === "fail"
            ? "Domain present in local disinfo cache."
            : "No reputation record."
      : "No reputation record.";

  const amplificationBehavior =
    telegram?.result === "fail"
      ? "Channel flagged in curated amplifier list."
      : telegram
        ? "Not flagged in local amplifier list."
        : "Not a Telegram URL.";

  const linkedEntities: string[] = [];
  if (intake.claimedSource.trim()) linkedEntities.push(intake.claimedSource);
  if (intake.claimedLocation.trim()) linkedEntities.push(intake.claimedLocation);

  const caveats: string[] = [];
  if (!sourceRep) caveats.push("No reputation lookup performed (no source URL or local cache miss).");
  if (intake.claimedSource && !host) caveats.push("Analyst-named source has not been matched to a domain.");
  if (host && !sourceRep) caveats.push("URL is present but reputation lookup did not return data.");

  return {
    identity,
    type,
    labels,
    reliabilityHistory,
    amplificationBehavior,
    linkedEntities,
    caveats,
  };
}

// --- collection plan ----------------------------------------------------

const GAP_TO_TASK: Record<string, { title: string; priority: PlanTask["priority"]; affected: string }> = {
  no_source_url: {
    title: "Request original source URL from submitter",
    priority: "high",
    affected: "H1, H4",
  },
  no_c2pa_manifest: {
    title: "Locate original C2PA-signed source upload if available",
    priority: "medium",
    affected: "H1",
  },
  no_claim_text: {
    title: "Capture analyst claim statement",
    priority: "high",
    affected: "all hypotheses",
  },
  no_geolocation: {
    title: "Verify claimed location via geo / shadow / landmark",
    priority: "medium",
    affected: "H1, H2",
  },
  no_claimed_datetime: {
    title: "Pin down claimed event datetime",
    priority: "medium",
    affected: "H2",
  },
  no_source_reputation: {
    title: "Run source reputation lookup against curated set",
    priority: "low",
    affected: "H1",
  },
  no_factcheck_data: {
    title: "Re-attempt fact-check lookup or escalate to manual review",
    priority: "low",
    affected: "H2",
  },
  exif_missing: {
    title: "Obtain full-resolution original with EXIF intact",
    priority: "low",
    affected: "H1, H3",
  },
};

export function derivePlan(gaps: CollectionGap[]): PlanTask[] {
  return gaps.map((g, i) => {
    const tmpl = GAP_TO_TASK[g.id] ?? {
      title: g.label,
      priority: "medium" as const,
      affected: "—",
    };
    return {
      id: `task-${i + 1}`,
      title: tmpl.title,
      affectedHypothesis: tmpl.affected,
      owner: "—",
      priority: tmpl.priority,
      status: "open",
      due: "—",
    };
  });
}

// --- security posture ---------------------------------------------------

export function deriveSecurity(
  findings: Finding[],
  intake: CaseIntake,
  inputHash: string | null,
): SecurityControl[] {
  const externalChecks = findings.filter((f) => externalSourceFor(f));
  const out: SecurityControl[] = [];

  out.push({
    id: "external_lookup",
    label: "External lookup",
    state: externalChecks.length > 0 ? "warn" : "ok",
    detail:
      externalChecks.length > 0
        ? `${externalChecks.length} external service(s) consulted: ${[...new Set(externalChecks.map((f) => f.source))].join(", ")}`
        : "All analysis performed locally / from cache.",
  });

  out.push({
    id: "original_preserved",
    label: "Original byte preservation",
    state: inputHash ? "ok" : "off",
    detail: inputHash
      ? `Immutable input hash recorded (${inputHash.slice(0, 12)}…). Tier pipelines operate on working copies.`
      : "No input hash yet.",
  });

  out.push({
    id: "api_disclosure",
    label: "API disclosure",
    state: externalChecks.length > 0 ? "warn" : "ok",
    detail:
      externalChecks.length > 0
        ? "Investigative interest was disclosed to external providers (logged in Chain of Custody)."
        : "No external services contacted; investigative interest not disclosed.",
  });

  out.push({
    id: "key_redaction",
    label: "API key redaction in exports",
    state: "ok",
    detail:
      "All error strings are scrubbed of `?key=` / `apikey=` / `token=` query parameters before being written into evidence.",
  });

  out.push({
    id: "active_content",
    label: "Active content stripped",
    state: "warn",
    detail:
      "We do not yet parse the image bytes for embedded active content (PDFs, SVG scripts). Treat untrusted uploads in an isolated session.",
  });

  out.push({
    id: "url_fetch_cap",
    label: "URL fetch cap",
    state: "ok",
    detail:
      "Remote fetches are capped at 25MB, require image/* content-type, and use a self-identifying User-Agent.",
  });

  out.push({
    id: "report_integrity",
    label: "Report integrity hash",
    state: "ok",
    detail:
      "Exported PDFs embed `report_sha256 = sha256(input_hash || canonical_report_json_without_signature)` so the PDF and the JSON are byte-verifiable against each other.",
  });

  out.push({
    id: "session_risk",
    label: "Session risk profile",
    state: intake.sourceUrl.trim() && /t\.me|telegram\.me/i.test(intake.sourceUrl) ? "warn" : "ok",
    detail:
      intake.sourceUrl.trim() && /t\.me|telegram\.me/i.test(intake.sourceUrl)
        ? "Telegram-sourced material — analyst handle exposure risk present in any direct fetch."
        : "Standard session.",
  });

  return out;
}

// --- final assessment memo ----------------------------------------------

export function buildMemo(
  findings: Finding[],
  hypotheses: Hypothesis[],
  tensions: Tension[],
  gaps: CollectionGap[],
  strength: StrengthScore,
  deception: DeceptionIndicator[],
): AssessmentMemo {
  const top = [...hypotheses].sort((a, b) =>
    (b.confidence === "high" ? 3 : b.confidence === "moderate" ? 2 : b.confidence === "low" ? 1 : 0) -
    (a.confidence === "high" ? 3 : a.confidence === "moderate" ? 2 : a.confidence === "low" ? 1 : 0),
  )[0];

  const executive =
    `We assess with ${strength.overall} confidence that ` +
    (top?.id === "H1" && top.confidence === "high"
      ? `the submitted media supports the attached claim.`
      : top?.id === "H2"
        ? `the submitted media is reused out of context; the visual base does not originate at the claimed event.`
        : top?.id === "H3"
          ? `localized manipulation is present in the submitted media.`
          : top?.id === "H4"
            ? `the submitted media may be fully synthetic, but corroborating evidence is incomplete.`
            : `the available evidence is insufficient to verify the attached claim.`) +
    ` ${strength.summary} ` +
    (tensions.length > 0
      ? `${tensions.length} cross-tier tension(s) remain unresolved.`
      : "No cross-tier tensions surfaced.") +
    ` The Tier 3 AI signal is treated as non-authoritative and does not override deterministic provenance and OSINT findings.`;

  const keySupporting = (top?.supporting ?? []).slice(0, 5).map((r) => `${r.check} — ${r.reason}`);
  const keyContradicting = (top?.contradicting ?? []).slice(0, 5).map((r) => `${r.check} — ${r.reason}`);
  const deceptionLines = deception.filter((d) => d.status === "active").map((d) => `${d.label} — ${d.explanation}`);
  const collectionGaps = gaps.map((g) => g.label);
  const methodLimitations = [
    "C2PA verification is deterministic on signature presence; it does not establish editorial intent.",
    "ELA and noise residual flag local recompression anomalies; they do not localize manipulation type.",
    "Reverse-image lookup is bounded by provider coverage; absence of matches is not novelty.",
    "Tier 3 deepfake classifier is face-focused (FaceForensics++) and weak for scene-level compositing.",
    "Fact-check API returns the strongest single hit; it is one external opinion, not consensus.",
  ];

  return {
    executive,
    keySupporting,
    keyContradicting,
    deception: deceptionLines,
    collectionGaps,
    methodLimitations,
    securityNote:
      "Original bytes preserved; external lookups logged in Chain of Custody; API keys redacted from evidence. Report integrity hash is embedded in the exported PDF.",
  };
}
