import { handle } from "@/lib/http";
import { supabaseRepo } from "@/lib/repo/supabase-repo";
import { submitForVerification } from "@/lib/services";

/** CUTTING_IN_PROGRESS → PENDING_VERIFICATION (Cutting Supervisor) */
export const POST = handle<{ id: string }>(({ ctx, params }) => submitForVerification(ctx, supabaseRepo, params.id));
