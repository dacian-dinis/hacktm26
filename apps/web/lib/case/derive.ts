// Pure derivation functions over Finding[] + CaseIntake.
// Lives in the frontend deliberately: the backend's contract is the raw
// Finding list; the analyst layer is interpretation on top of that.

import type {
  CaseIntake,
  CollectionGap,
  FindingRef,
  Hypothesis,
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
  const sourceRep = byCheck(findings, "source.reputation");
  const telegram = byCheck(findings, "telegram.reputation");
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
        check: "source.reputation",
        reason: "Source domain is in the trusted set.",
      });
    if (sourceRep && sourceRep.result === "fail")
      contra.push({
        check: "source.reputation",
        reason: "Source domain is in the known-disinformation set.",
      });
    if (telegram && telegram.result === "fail")
      contra.push({
        check: "telegram.reputation",
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
