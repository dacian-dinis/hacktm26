"use client";

import { useEffect, useMemo, useState } from "react";
import ReportView from "@/components/report/ReportView";
import { decodeReportToken, type TokenPayload } from "@/lib/token";

export default function ReportPage() {
  const [payload, setPayload] = useState<TokenPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("token");
  }, []);

  useEffect(() => {
    if (!token) {
      setError(
        "No token in URL. Open this page from the Veritas Stack browser extension.",
      );
      return;
    }
    try {
      setPayload(decodeReportToken(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [token]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Veritas Stack</h1>
        <p className="text-sm text-muted-foreground">
          Verification report — delivered from the browser extension.
        </p>
      </header>

      {payload?.source_url && (
        <div className="rounded-lg border border-border bg-muted p-3 text-xs">
          <span className="font-medium">Source URL: </span>
          <a
            href={payload.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-mono text-accent underline"
          >
            {payload.source_url}
          </a>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          {error}
        </div>
      )}

      {payload && <ReportView report={payload.report} />}
    </main>
  );
}
