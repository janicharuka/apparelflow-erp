import "server-only";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/domain";
import { ROLE_HOME } from "@/lib/domain";
import { unauthorized } from "@/lib/errors";
import { supabaseRepo } from "@/lib/repo/supabase-repo";
import type { AuthContext } from "@/lib/repo/types";
import { publicEnv } from "@/lib/supabase/env";
import { createSessionClient } from "@/lib/supabase/server";

/**
 * Resolve the caller's identity from a VERIFIED Supabase JWT.
 * - Browser: auth cookie (set by @supabase/ssr)
 * - Postman/cURL: `Authorization: Bearer <access_token>`
 * Role is read from public.users on the server — never from the request.
 */
export async function getAuthContext(req?: Request): Promise<AuthContext | null> {
  let userId: string | null = null;

  const header = req?.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    const { url, anonKey } = publicEnv();
    const client = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data } = await client.auth.getUser(header.slice(7).trim());
    userId = data.user?.id ?? null;
  } else {
    const supabase = await createSessionClient();
    const { data } = await supabase.auth.getUser(); // validates with Supabase Auth server
    userId = data.user?.id ?? null;
  }

  if (!userId) return null;
  const profile = await supabaseRepo.getUserProfile(userId);
  if (!profile) return null;
  return { userId, ...profile };
}

export async function requireAuth(req?: Request): Promise<AuthContext> {
  const ctx = await getAuthContext(req);
  if (!ctx) throw unauthorized();
  return ctx;
}

/** For Server Component pages: redirect instead of throwing. */
export async function requirePageRole(role: Role): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.role !== role) redirect(ROLE_HOME[ctx.role]);
  return ctx;
}
