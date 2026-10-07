import { handle, readJson } from "@/lib/http";
import { supabaseRepo } from "@/lib/repo/supabase-repo";
import { createOrder, listOrders } from "@/lib/services";

/** GET /api/orders — list filtered by the caller's role (server-side). */
export const GET = handle(({ ctx }) => listOrders(ctx, supabaseRepo));

/** POST /api/orders — Cutting Supervisor only. */
export const POST = handle(async ({ req, ctx }) => createOrder(ctx, supabaseRepo, await readJson(req)), 201);
