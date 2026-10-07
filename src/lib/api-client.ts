"use client";

export interface ApiResult<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  fields?: Record<string, string>;
  shortages?: { component: string; expected: number; actual: number }[];
  uncounted?: string[];
}

export async function api<T = unknown>(path: string, method = "GET", body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, ...json, ok: res.ok && json.ok !== false };
  } catch {
    return { ok: false, status: 0, error: "Network error — check your connection and try again" };
  }
}
