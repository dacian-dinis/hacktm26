"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Play } from "lucide-react";
import { getDemoIndex, type DemoItem } from "@/lib/api";

interface DemoExamplesProps {
  onSelect: (slug: string) => void;
  isLoading?: boolean;
}

export default function DemoExamples({ onSelect, isLoading }: DemoExamplesProps) {
  const [items, setItems] = useState<DemoItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDemoIndex()
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading demo assets…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
        Failed to load demo index: {error}
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">
        Or try a curated example:
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <motion.button
            key={item.slug}
            onClick={() => onSelect(item.slug)}
            disabled={isLoading}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.3 }}
            whileHover={!isLoading ? { scale: 1.02, y: -2 } : {}}
            whileTap={!isLoading ? { scale: 0.98 } : {}}
            className="group flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-accent/40 hover:bg-card/80 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:y-0"
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-medium text-foreground group-hover:text-accent transition-colors">
                {item.title}
              </span>
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 opacity-0 transition-opacity group-hover:opacity-100">
                <Play className="h-3 w-3 text-accent translate-x-[1px]" />
              </div>
            </div>
            {item.description && (
              <span className="text-xs text-muted-foreground line-clamp-2">
                {item.description}
              </span>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
