import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "./env";

let cached: SupabaseClient | null = null;

/**
 * Service-role client. SERVER ONLY. Bypasses RLS, so it must only be used
 * AFTER the caller has been authenticated and authorised in lib/services.ts.
 */
export function adminClient(): SupabaseClient {
  if (cached) return cached;
  const { url } = publicEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}
