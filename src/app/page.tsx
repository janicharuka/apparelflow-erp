import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function Home() {
  const ctx = await getAuthContext();
  redirect(ctx ? ROLE_HOME[ctx.role] : "/login");
}
