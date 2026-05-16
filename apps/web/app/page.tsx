"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DemoExamples } from "@/components/DemoExamples";
import { WhyPanel } from "@/components/WhyPanel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReportView } from "@/components/report/ReportView";
import { ReportSkeleton } from "@/components/report/ReportSkeleton";
import type { Report } from "@/types/report";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

interface Preview {
  url: string;
  name?: string;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [demoSlug, setDemoSlug] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [query, setQuery] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Revoke object URLs when the preview changes or the page unmounts.
  useEffect(() => {
    if (!preview?.url || !preview.url.startsWith("blob:")) return;
    const u = preview.url;
    return () => URL.revokeObjectURL(u);
  }, [preview?.url]);

  function setFileWithPreview(next: File | null) {
    setFile(next);
    setPreview(
      next
        ? { url: URL.createObjectURL(next), name: next.name }
        : null,
    );
  }

  async function verify(target: File | null) {
    if (!target && !url) {
      setError("Provide either an uploaded file or a source URL.");
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const form = new FormData();
      if (target) form.append("file", target);
      if (url) form.append("url", url);
      if (query) form.append("query", query);
      const res = await fetch(`${API_BASE}/verify`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      setReport((await res.json()) as Report);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file && !url) return;
    setDemoSlug(null);
    await verify(file);
  }

  async function onPickDemo(slug: string, demoFile: File) {
    setFileWithPreview(demoFile);
    setDemoSlug(slug);
    await verify(demoFile);
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          Veritas Stack &middot; HackTM 2026 &middot; Defense Track
        </p>
        <h1 className="text-3xl font-bold leading-tight md:text-4xl">
          Provenance over prediction.
        </h1>
        <p className="max-w-2xl text-sm text-mutedForeground md:text-base">
          A verification workbench for synthetic and sourced media. Every
          check emits a structured, signed finding &mdash; the output is an
          audit trail, not a confidence score.
        </p>
      </header>

      <WhyPanel />

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-white p-4 shadow-sm">
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="upload-input">
            Upload an image
          </label>
          <input
            id="upload-input"
            type="file"
            accept="image/*"
            onChange={(e) => {
              setFileWithPreview(e.target.files?.[0] ?? null);
              setDemoSlug(null);
            }}
            className="text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="url">Source URL (optional)</Label>
              <Input
                id="url"
                placeholder="https://t.me/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="query">Claim query (optional)</Label>
              <Input
                id="query"
                placeholder="What is being claimed?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <Button type="submit" disabled={(!file && !url) || loading}>
            {loading ? "Verifying…" : "Verify"}
          </Button>
          <p className="text-xs text-mutedForeground">
            Provide an uploaded file <em>or</em> a source URL (or both).
          </p>
          {demoSlug && (
            <p className="text-xs text-mutedForeground">
              Loaded demo asset: <span className="font-mono">{demoSlug}</span>
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-md border border-danger/40 bg-danger/10 p-2 text-sm text-danger"
            >
              {error}
            </p>
          )}
        </form>

        <hr className="border-border" />

        <DemoExamples
          apiBase={API_BASE}
          onPick={onPickDemo}
          disabled={loading}
        />
      </div>

      {loading && <ReportSkeleton />}
      {report && !loading && (
        <ReportView report={report} preview={preview} demoSlug={demoSlug} />
      )}

      <footer className="mt-8 border-t border-border pt-4 text-xs text-mutedForeground">
        Built for HackTM 2026 in collaboration with the NATO HUMINT Centre of
        Excellence. Open source.
      </footer>
    </main>
  );
}
