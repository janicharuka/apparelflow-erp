import { handle } from "@/lib/http";

export const GET = handle(async ({ ctx }) => ({ id: ctx.userId, email: ctx.email, full_name: ctx.fullName, role: ctx.role }));
