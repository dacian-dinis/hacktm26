"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Database, Loader2 } from "lucide-react";

const SHORT_LABELS: Record<string, string> = {
  "01-c2pa-authentic": "C2PA-signed",
  "02-wire-match": "Wire match",
  "03-old-misrep": "Old context",
  "04-ela-composite": "Composite",
  "05-deepfake-caught": "AI catches",
  "06-deepfake-missed-but-evidence-wins": "Evidence wins",
};

export interface DemoItem {
  slug: string;
  title: string;
  filename: string;
  demo_narration?: string;
}

export function DemoExamples({
  apiBase,
  onPick,
  disabled,
}: {
  apiBase: string;
  onPick: (slug: string, file: File) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [items, setItems] = useState<DemoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/demo`);
        if (!res.ok) throw new Error(`GET /demo -> ${res.status}`);
        const data = (await res.json()) as { items: DemoItem[] };
        if (!cancelled) setItems(data.items);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  async function handleClick(slug: string) {
    setBusy(slug);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/demo/${slug}`);
      if (!res.ok) throw new Error(`GET /demo/${slug} -> ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], `${slug}.jpg`, {
        type: blob.type || "image/jpeg",
      });
      await onPick(slug, file);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
        <span className="font-mono uppercase tracking-widest text-slate-500">
          Loading demo cases
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded border border-red-800/70 bg-red-950/30 p-2 text-xs text-red-200">
        Demo index unavailable: {error}
      </p>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-emerald-400" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-slate-400">
            Demo cases
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-slate-600">
          curated evidence
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {items.map((item) => {
          const isBusy = busy === item.slug;
          return (
            <button
              key={item.slug}
              type="button"
              disabled={disabled || busy !== null}
              onClick={() => handleClick(item.slug)}
              title={item.demo_narration ?? item.title}
              className="group flex min-h-20 flex-col items-start justify-between rounded border border-slate-800 bg-slate-950/80 p-2.5 text-left text-xs transition hover:border-emerald-600/70 hover:bg-slate-900/80 disabled:opacity-50"
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="font-medium text-slate-100">
                  {SHORT_LABELS[item.slug] ?? item.slug}
                </span>
                {isBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-600 transition group-hover:text-emerald-400" />
                )}
              </span>
              <span className="line-clamp-2 text-[11px] leading-snug text-slate-500">
                {isBusy ? "Preparing evidence pipeline" : item.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
