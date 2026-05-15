import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function ReportSkeleton() {
  return (
    <div
      className="flex flex-col gap-4"
      role="status"
      aria-live="polite"
      aria-label="Verifying — running checks across all four tiers"
    >
      <span className="sr-only">Verifying — running checks across all four tiers</span>
      <div className="flex items-center gap-4 rounded-lg border border-border bg-muted p-4">
        <Skeleton className="h-20 w-20 rounded-md" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
      {[1, 2, 3, 4].map((tier) => (
        <Card key={tier}>
          <CardHeader>
            <Skeleton className="h-4 w-2/3" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
