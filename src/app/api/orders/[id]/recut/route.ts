import { handle, readJson } from "@/lib/http";
import { supabaseRepo } from "@/lib/repo/supabase-repo";
import { recutOrder } from "@/lib/services";

/** REJECTED → CUTTING_IN_PROGRESS (Cutting Supervisor re-cuts the batch) */
export const POST = handle<{ id: string }>(async ({ req, ctx, params }) =>
  recutOrder(ctx, supabaseRepo, params.id, await readJson(req)),
);
