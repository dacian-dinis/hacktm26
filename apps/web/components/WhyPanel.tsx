export function WhyPanel() {
  return (
    <details className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <summary className="cursor-pointer text-sm font-medium select-none">
        Why provenance &gt; prediction?
      </summary>
      <div className="mt-3 flex flex-col gap-2 text-sm text-mutedForeground">
        <p>
          A confidence score from a classifier is not evidence an analyst can
          put into a report. We produce a structured, signed chain of evidence
          a commander can read &mdash; built on three principles:
        </p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <span className="font-medium text-foreground">Cryptography, not statistics.</span>{" "}
            Tier 1 signature verification is mathematically deterministic. The
            only &quot;100% accurate&quot; path that exists.
          </li>
          <li>
            <span className="font-medium text-foreground">Inspectable forensics.</span>{" "}
            Tier 2 ELA and noise residuals are visible artefacts &mdash; not a
            black box.
          </li>
          <li>
            <span className="font-medium text-foreground">AI as one input, never a verdict.</span>{" "}
            Tier 3 is shown with model name, training data, and confidence &mdash;
            the analyst signs the report, not the model.
          </li>
        </ul>
        <p className="text-xs">
          Aligned with EU AI Act Article 50 (live 2 Aug 2026) and the
          Commission&apos;s Code of Practice on AI-generated content.
        </p>
      </div>
    </details>
  );
}
