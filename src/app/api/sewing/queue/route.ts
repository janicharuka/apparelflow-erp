import { handle } from "@/lib/http";
import { supabaseRepo } from "@/lib/repo/supabase-repo";
import { getSewingQueue } from "@/lib/services";

/** GET /api/sewing/queue — Sewing Supervisor only; DB query is WHERE status = 'VERIFIED'. Query params are ignored. */
export const GET = handle(({ ctx }) => getSewingQueue(ctx, supabaseRepo));
