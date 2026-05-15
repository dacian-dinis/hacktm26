import { ReportHeader } from "./ReportHeader";
import { TierCard } from "./TierCard";
import type { Report, Tier } from "@/types/report";

const TIERS: Tier[] = [1, 2, 3, 4];

export function ReportView({
  report,
  preview,
}: {
  report: Report;
  preview?: { url: string; name?: string } | null;
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
      {TIERS.map((tier) => (
        <TierCard key={tier} tier={tier} findings={grouped[tier]} />
      ))}
    </section>
  );
}
