import { handle } from "@/lib/http";
import { supabaseRepo } from "@/lib/repo/supabase-repo";
import { getOrder } from "@/lib/services";

export const GET = handle<{ id: string }>(({ ctx, params }) => getOrder(ctx, supabaseRepo, params.id));
