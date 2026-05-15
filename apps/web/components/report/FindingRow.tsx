import Image from "next/image";
import type { Finding } from "@/types/report";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

const RESULT_STYLES: Record<Finding["result"], string> = {
  pass: "bg-success/10 text-success border-success/30",
  fail: "bg-danger/10 text-danger border-danger/30",
  indeterminate: "bg-warning/10 text-warning border-warning/30",
};

const IMAGE_EVIDENCE_KEYS = ["overlay_png_base64", "residual_png_base64"];

const TIER4_SPECIFIC_CHECKS = [
  "source.reputation.lookup",
  "osint.telegram.reputation",
  "google.factcheck.search",
];

export function FindingRow({ finding }: { finding: Finding }) {
  const imageEvidence = IMAGE_EVIDENCE_KEYS.flatMap((key) => {
    const value = finding.evidence[key];
    return typeof value === "string" ? [{ key, value }] : [];
  });
  const textEvidence = Object.fromEntries(
    Object.entries(finding.evidence).filter(
      ([key]) => !IMAGE_EVIDENCE_KEYS.includes(key),
    ),
  );
  const hasSpecificRenderer = TIER4_SPECIFIC_CHECKS.includes(finding.check);

  return (
    <div className="flex flex-col gap-3 border-t border-border py-4 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-medium">{finding.check}</span>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-xs font-medium uppercase",
            RESULT_STYLES[finding.result],
          )}
        >
          {finding.result}
        </span>
        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-mutedForeground">
          {finding.confidence} confidence
        </span>
        <span className="ml-auto text-xs text-mutedForeground">
          via {finding.source}
        </span>
      </div>

      {imageEvidence.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {imageEvidence.map(({ key, value }) => (
            <figure
              key={key}
              className="overflow-hidden rounded-md border border-border bg-muted"
            >
              <Image
                src={`data:image/png;base64,${value}`}
                alt={key.replaceAll("_", " ")}
                width={720}
                height={405}
                unoptimized
                className="aspect-video w-full object-contain"
              />
              <figcaption className="border-t border-border px-2 py-1 font-mono text-xs text-mutedForeground">
                {key}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {finding.check === "source.reputation.lookup" && (
        <div className="flex flex-col gap-1 rounded-md bg-muted/50 p-3">
          <div className="text-sm font-semibold text-foreground">
            Domain: {finding.evidence.domain as string}
          </div>
          <div className="text-sm text-mutedForeground">
            {(finding.evidence.description as string) ||
              (finding.evidence.note as string)}
          </div>
        </div>
      )}

      {finding.check === "osint.telegram.reputation" && (
        <div className="flex flex-col gap-1 rounded-md bg-muted/50 p-3">
          <div className="text-sm font-semibold text-foreground">
            Telegram Handle: {(finding.evidence.handle as string) || "N/A"}
          </div>
          <div className="text-sm text-mutedForeground">
            {(finding.evidence.description as string) ||
              (finding.evidence.note as string)}
          </div>
        </div>
      )}

      {finding.check === "google.factcheck.search" && (
        <div className="flex flex-col gap-2 rounded-md bg-muted/50 p-3">
          {Boolean(finding.evidence.claim) && (
            <div className="text-sm italic text-foreground">
              &ldquo;{finding.evidence.claim as string}&rdquo;
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Rating:</span>
            <span
              className={cn(
                "font-bold",
                finding.result === "fail"
                  ? "text-danger"
                  : finding.result === "pass"
                    ? "text-success"
                    : "",
              )}
            >
              {(finding.evidence.rating as string) || "N/A"}
            </span>
          </div>
          {Boolean(finding.evidence.publisher) && (
            <div className="text-xs text-mutedForeground">
              Verified by: {finding.evidence.publisher as string} (
              {finding.evidence.review_date as string})
            </div>
          )}
          {Boolean(finding.evidence.url) && (
            <a
              href={finding.evidence.url as string}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-accent hover:underline"
            >
              Read full fact-check <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {Boolean(finding.evidence.message) && (
            <div className="text-sm italic text-mutedForeground">
              {finding.evidence.message as string}
            </div>
          )}
          {Boolean(finding.evidence.error) && (
            <div className="font-mono text-sm text-danger">
              Error: {finding.evidence.error as string}
            </div>
          )}
        </div>
      )}

      {!hasSpecificRenderer && Object.keys(textEvidence).length > 0 && (
        <pre className="overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs text-foreground">
          {JSON.stringify(textEvidence, null, 2)}
        </pre>
      )}

      <div className="text-xs text-mutedForeground">
        {new Date(finding.timestamp).toISOString()}
      </div>
    </div>
  );
}
