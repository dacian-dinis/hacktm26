import { ReportHeader } from "./ReportHeader";
import { TierCard } from "./TierCard";
import type { Finding, Report, Tier } from "@/types/report";

const TIERS: Tier[] = [1, 2, 3, 4];

export function ReportView({
  report,
  preview,
  demoSlug,
}: {
  report: Report;
  preview?: { url: string; name?: string } | null;
  demoSlug?: string | null;
}) {
  const grouped: Record<Tier, typeof report.findings> = {
    1: [],
    2: [],
    3: [],
    4: [],
  };
  for (const f of report.findings) grouped[f.tier].push(f);

  return (
    <section
      aria-label="Verification report"
      className="flex flex-col gap-4"
    >
      <ReportHeader report={report} preview={preview} />
      <RebuttalCallout
        demoSlug={demoSlug ?? null}
        tier1={grouped[1]}
        tier3={grouped[3]}
      />
      {TIERS.map((tier) => (
        <TierCard key={tier} tier={tier} findings={grouped[tier]} />
      ))}
    </section>
  );
}

/**
 * Renders the "AI fails, evidence wins" banner specifically when the demo
 * asset is 06 (deepfake-missed) AND the runtime signals match the story:
 *   - Tier 3 returns the model's "Real" label
 *   - Tier 1 reverse_image found prior hits (the evidence-wins moment)
 */
function RebuttalCallout({
  demoSlug,
  tier1,
  tier3,
}: {
  demoSlug: string | null;
  tier1: Finding[];
  tier3: Finding[];
}) {
  if (demoSlug !== "06-deepfake-missed-but-evidence-wins") return null;
  const t3 = tier3.find((f) => f.check === "ai.deepfake.vit");
  const t1Reverse = tier1.find((f) => f.check === "reverse_image.lookup");
  if (!t3 || !t1Reverse) return null;
  const t3Label =
    typeof (t3.evidence as Record<string, unknown>)?.model_label === "string"
      ? ((t3.evidence as Record<string, unknown>).model_label as string)
      : null;
  const t1Hits =
    typeof (t1Reverse.evidence as Record<string, unknown>)?.hit_count ===
    "number"
      ? ((t1Reverse.evidence as Record<string, unknown>).hit_count as number)
      : 0;
  const t1Earliest =
    typeof (t1Reverse.evidence as Record<string, unknown>)?.earliest_seen ===
    "string"
      ? ((t1Reverse.evidence as Record<string, unknown>).earliest_seen as string)
      : null;
  const aiFooled = t3Label === "Real";
  const evidenceWins = t1Hits > 0;
  if (!aiFooled || !evidenceWins) return null;
  return (
    <div
      role="note"
      className="rounded-lg border-2 border-accent bg-accent/10 p-4 text-sm"
    >
      <p className="text-base font-semibold text-accent">
        AI signal said <span className="font-mono">{t3Label}</span> — and was
        wrong.
      </p>
      <p className="mt-1 text-mutedForeground">
        The classifier missed the manipulation. The audit trail did not:
        Tier&nbsp;1 reverse-image search returned{" "}
        <span className="font-semibold text-foreground">{t1Hits}</span> prior
        web match{t1Hits === 1 ? "" : "es"}
        {t1Earliest && (
          <>
            , earliest seen{" "}
            <span className="font-mono text-foreground">{t1Earliest}</span>
          </>
        )}
        . Evidence wins, not the classifier.
      </p>
    </div>
  );
}
