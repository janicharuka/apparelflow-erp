import { handle } from "@/lib/http";
import { supabaseRepo } from "@/lib/repo/supabase-repo";
import { startSewing } from "@/lib/services";

/** VERIFIED → SEWING_IN_PROGRESS (Sewing Supervisor) */
export const POST = handle<{ id: string }>(({ ctx, params }) => startSewing(ctx, supabaseRepo, params.id));
