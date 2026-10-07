import { handle, readJson } from "@/lib/http";
import { supabaseRepo } from "@/lib/repo/supabase-repo";
import { approveOrder } from "@/lib/services";

/**
 * POST /api/orders/:id/approve   body: { counts: [{ item_id, actual_qty }] }
 * 401 no session · 403 not a verifier · 409 wrong state · 422 RED/uncounted/invalid
 */
export const POST = handle<{ id: string }>(async ({ req, ctx, params }) =>
  approveOrder(ctx, supabaseRepo, params.id, await readJson(req)),
);
