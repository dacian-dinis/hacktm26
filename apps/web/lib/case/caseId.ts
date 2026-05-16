// Generate a case ID from creation date + a short hash prefix.
// Format: VS-YYYY-MM-DD-XXXX (e.g. VS-2026-05-16-0142)

export function deriveCaseId(createdAt: string, inputHashOrSeed: string): string {
  const d = new Date(createdAt);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  // Use the first 4 hex of whatever seed we have; fall back to time-of-day.
  const seed = (inputHashOrSeed || "").replace(/[^a-f0-9]/gi, "").slice(0, 4);
  const fallback = String(d.getUTCHours()).padStart(2, "0") + String(d.getUTCMinutes()).padStart(2, "0");
  const tail = seed.length === 4 ? seed.toLowerCase() : fallback;
  return `VS-${yyyy}-${mm}-${dd}-${tail}`;
}
