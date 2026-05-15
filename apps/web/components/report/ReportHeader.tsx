"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Report } from "@/types/report";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export function ReportHeader({
  report,
  preview,
}: {
  report: Report;
  preview?: { url: string; name?: string } | null;
}) {
  const [now, setNow] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    setNow(new Date().toISOString());
  }, [report.input_hash]);

  function downloadJson() {
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `veritas_${report.input_hash.slice(0, 8) || "report"}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    setExportError(null);
    const analyst = window.prompt(
      "Analyst name (leave blank for unsigned export):",
      "",
    );
    if (analyst === null) return;
    setExporting(true);
    try {
      const res = await fetch(`${API_BASE}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report,
          analyst_name: analyst.trim() || null,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`/export ${res.status} ${text}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `veritas_${report.input_hash.slice(0, 8) || "report"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

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
        {report.analyst_signature && (
          <div className="text-xs text-success">
            Signed by{" "}
            <span className="font-medium">{report.analyst_signature}</span>
            {report.signed_at ? ` at ${report.signed_at}` : ""}
          </div>
        )}
        {exportError && (
          <div role="alert" className="text-xs text-danger">
            {exportError}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 md:self-center">
        <Button
          type="button"
          variant="outline"
          onClick={downloadJson}
          disabled={exporting}
        >
          Download JSON
        </Button>
        <Button type="button" onClick={exportPdf} disabled={exporting}>
          {exporting ? "Exporting…" : "Sign & Export PDF"}
        </Button>
      </div>
    </div>
  );
}
