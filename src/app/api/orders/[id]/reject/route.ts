import { handle, readJson } from "@/lib/http";
import { supabaseRepo } from "@/lib/repo/supabase-repo";
import { rejectOrder } from "@/lib/services";

/** POST /api/orders/:id/reject   body: { note: string (>=5 chars), counts?: [...] } */
export const POST = handle<{ id: string }>(async ({ req, ctx, params }) =>
  rejectOrder(ctx, supabaseRepo, params.id, await readJson(req)),
);
