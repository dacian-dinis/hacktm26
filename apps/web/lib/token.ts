import type { Report } from "@/types/report";

export interface TokenPayload {
  report: Report;
  source_url?: string;
}

// Mirrors the encoder in packages/extension/background.js:
// base64url(JSON.stringify(payload)).
export function decodeReportToken(token: string): TokenPayload {
  if (!token) throw new Error("missing token");
  const padded = token.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const b64 = padded + pad;
  let bin: string;
  try {
    bin = atob(b64);
  } catch {
    throw new Error("token is not valid base64");
  }
  let json: string;
  try {
    json = decodeURIComponent(escape(bin));
  } catch {
    json = bin;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("token payload is not valid JSON");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("report" in parsed) ||
    typeof (parsed as { report: unknown }).report !== "object"
  ) {
    throw new Error("token payload missing 'report'");
  }
  return parsed as TokenPayload;
}
