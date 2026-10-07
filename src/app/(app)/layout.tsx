import Link from "next/link";
import { redirect } from "next/navigation";
import { RoleSwitcher, SignOutButton } from "@/components/RoleSwitcher";
import { getAuthContext } from "@/lib/auth";
import { ROLE_HOME, ROLE_LABELS } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 py-4">
          <div>
            <Link href={ROLE_HOME[ctx.role]} className="text-xl font-bold text-white">
              ApparelFlow ERP
            </Link>
            <p className="text-sm text-slate-200">Cutting Operations &amp; Gatekeeper Verification Terminal</p>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="text-right text-sm">
              <div className="font-semibold text-white">{ctx.fullName}</div>
              <div className="text-slate-200">{ROLE_LABELS[ctx.role]}</div>
            </div>
            <RoleSwitcher current={ctx.role} />
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">{children}</main>
    </div>
  );
}
