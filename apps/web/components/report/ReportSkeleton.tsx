"use client";

import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReportSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-32" />
          </div>
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Tier Card Skeletons */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-border bg-card/80"
          >
            <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
              <Skeleton className="h-7 w-7 rounded-md" />
              <Skeleton className="h-5 w-48" />
            </div>
            <div className="space-y-0">
              {[1, 2].map((j) => (
                <div
                  key={j}
                  className="flex items-center gap-3 border-b border-border/50 px-4 py-3 last:border-0"
                >
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                  <Skeleton className="h-5 w-12 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
