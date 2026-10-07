import { handle } from "@/lib/http";
import { supabaseRepo } from "@/lib/repo/supabase-repo";
import { listRecipes } from "@/lib/services";

export const GET = handle(({ ctx }) => listRecipes(ctx, supabaseRepo));
