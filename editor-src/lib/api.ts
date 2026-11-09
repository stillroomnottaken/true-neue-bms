// Thin client for the PHP API (/api/index.php). Same-origin only. Every state-changing call sends the CSRF token
// that PHP injected into the page as <meta name="csrf-token">.
import type { EditorData, MediaItem } from "./model";

export const API = "/api/index.php";
export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) { super(message); }
}
const token = () => document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? "";

async function call<T>(action: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", "X-CSRF-Token": token() };
  let body = init.body;
  if (init.json !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(init.json); }
  const res = await fetch(`${API}?a=${action}`, { ...init, body, headers, credentials: "same-origin", cache: "no-store" });
  let data: unknown = null;
  try { data = await res.json(); } catch { /* non-JSON error page */ }
  if (res.status === 401) { window.location.href = "/admin/"; throw new ApiError(401, "Session expired"); }
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string } | null)?.error ?? `Request failed (${res.status})`, data);
  return data as T;
}

export interface Revision { id: string; at: number; by: string; note: string; bytes: number }
export interface Inquiry { id: string; at: number; role: string; material: string; quantity: string; unit: string; location: string; notes: string; name: string; company: string; phone: string; lang: string }
export interface ContentResponse { data: EditorData; rev: number; savedAt: number | null; user: string }

export const api = {
  content: () => call<ContentResponse>("content"),
  save: (data: EditorData, baseRev: number, force = false) => call<{ rev: number; savedAt: number }>("save", { method: "POST", json: { data, base_rev: baseRev, force } }),
  revisions: () => call<{ items: Revision[] }>("revisions"),
  restore: (id: string) => call<{ rev: number }>("restore", { method: "POST", json: { id } }),
  media: () => call<{ items: MediaItem[] }>("media"),
  upload: (file: File) => { const f = new FormData(); f.append("file", file); return call<{ item: MediaItem }>("upload", { method: "POST", body: f }); },
  deleteMedia: (id: string) => call<{ ok: true }>("media_delete", { method: "POST", json: { id } }),
  inquiries: () => call<{ items: Inquiry[] }>("inquiries"),
  deleteInquiry: (id: string) => call<{ ok: true }>("inquiry_delete", { method: "POST", json: { id } }),
  password: (current: string, next: string) => call<{ ok: true }>("password", { method: "POST", json: { current, next } }),
  logout: () => call<{ ok: true }>("logout", { method: "POST", json: {} }),
};
