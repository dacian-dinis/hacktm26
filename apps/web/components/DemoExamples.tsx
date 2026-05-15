"use client";

import { useEffect, useState } from "react";

const SHORT_LABELS: Record<string, string> = {
  "01-c2pa-authentic": "C2PA-signed",
  "02-wire-match": "Wire match",
  "03-old-misrep": "Old, misrepresented",
  "04-ela-composite": "ELA composite",
  "05-deepfake-caught": "AI catches",
  "06-deepfake-missed-but-evidence-wins": "AI misses, evidence wins",
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
        if (!res.ok) throw new Error(`GET /demo → ${res.status}`);
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
      if (!res.ok) throw new Error(`GET /demo/${slug} → ${res.status}`);
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
      <p className="text-xs text-mutedForeground">Loading demo examples…</p>
    );
  }
  if (error) {
    return <p className="text-xs text-danger">Demo index unavailable: {error}</p>;
  }
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">Try a demo example →</span>
        <span className="text-xs text-mutedForeground">
          one-click curated assets
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
              className="flex flex-col items-start gap-1 rounded-md border border-border bg-white p-2 text-left text-xs hover:bg-muted disabled:opacity-50"
            >
              <span className="font-medium">
                {SHORT_LABELS[item.slug] ?? item.slug}
              </span>
              <span className="line-clamp-2 text-mutedForeground">
                {isBusy ? "Loading…" : item.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
