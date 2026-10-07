import "server-only";
import { NextResponse } from "next/server";
import { HttpError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import type { AuthContext } from "@/lib/repo/types";

export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

/** Wrap a route handler: authenticate, run, and map errors to clean JSON + status codes. */
export function handle<P = Record<string, string>>(
  fn: (args: { req: Request; ctx: AuthContext; params: P }) => Promise<unknown>,
  successStatus = 200,
) {
  return async (req: Request, routeCtx: { params: Promise<P> }) => {
    try {
      const ctx = await requireAuth(req);
      const params = (await routeCtx?.params) ?? ({} as P);
      const data = await fn({ req, ctx, params });
      return NextResponse.json({ ok: true, data: data ?? null }, { status: successStatus });
    } catch (e) {
      if (e instanceof HttpError) {
        return NextResponse.json({ ok: false, error: e.message, ...e.details }, { status: e.status });
      }
      console.error(e);
      return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
    }
  };
}
