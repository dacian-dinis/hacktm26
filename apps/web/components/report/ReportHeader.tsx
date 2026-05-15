"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Report } from "@/types/report";

export function ReportHeader({
  report,
  preview,
}: {
  report: Report;
  preview?: { url: string; name?: string } | null;
}) {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    setNow(new Date().toISOString());
  }, [report.input_hash]);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted p-4 md:flex-row md:items-center">
      {preview?.url ? (
        <img
          src={preview.url}
          alt={preview.name ?? "verified input thumbnail"}
          className="h-20 w-20 rounded-md border border-border object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-20 w-20 items-center justify-center rounded-md border border-border bg-white text-mutedForeground"
        >
          <span className="font-mono text-xs">no preview</span>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1">
        <div className="text-xs uppercase tracking-wide text-mutedForeground">
          Input SHA-256
        </div>
        <div className="break-all font-mono text-xs text-foreground">
          {report.input_hash}
        </div>
        {now && (
          <div className="text-xs text-mutedForeground">
            Verified locally at {now}
          </div>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        disabled
        title="PDF/JSON export + analyst signature land in feat/report"
        className="md:self-center"
      >
        Sign &amp; Export
      </Button>
    </div>
  );
}
