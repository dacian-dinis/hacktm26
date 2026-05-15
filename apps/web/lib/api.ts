import type { Report } from "@/types/report";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

/** POST /verify — upload an image for multi-tier verification */
export async function verifyImage(
  file?: File,
  url?: string,
  query?: string
): Promise<Report> {
  const form = new FormData();
  if (file) form.append("file", file);
  if (url) form.append("url", url);
  if (query) form.append("query", query);

  return request<Report>("/verify", {
    method: "POST",
    body: form,
  });
}

/** POST /export — generate a signed PDF from a report */
export async function exportReport(
  report: Report,
  analystName?: string
): Promise<Blob> {
  const res = await fetch(`${API_BASE}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      report,
      analyst_name: analystName ?? "Anonymous Analyst",
    }),
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  return res.blob();
}

/** GET /demo — list available demo assets */
export interface DemoItem {
  slug: string;
  title: string;
  description?: string;
}

export async function getDemoIndex(): Promise<DemoItem[]> {
  return request<DemoItem[]>("/demo");
}

/** GET /demo/:slug — load a demo asset and verify it */
export async function runDemo(slug: string): Promise<Report> {
  return request<Report>(`/demo/${slug}`, { method: "POST" });
}

/** GET /health */
export async function healthCheck(): Promise<{ status: string }> {
  return request<{ status: string }>("/health");
}
