import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/ui";
import { requirePageRole } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { supabaseRepo } from "@/lib/repo/supabase-repo";
import { getOrder } from "@/lib/services";
import { VerificationTerminal } from "./VerificationTerminal";

export const dynamic = "force-dynamic";

export default async function TerminalPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePageRole("cutting_verifier");
  const { id } = await params;
  const order = await getOrder(ctx, supabaseRepo, id).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });

  return (
    <>
      <Link href="/verifier" className="text-sm font-semibold text-blue-800 underline">← Back to QC queue</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Verification Terminal — {order.order_no}</h1>
        <StatusBadge status={order.status} />
      </div>
      <p className="text-slate-800">
        {order.recipe.name} ({order.recipe.recipe_code}) · {order.target_qty} garments · Roll {order.fabric_roll_id} ·{" "}
        {order.actual_fabric_yds} yds used (expected {(order.target_qty * order.recipe.std_fabric_yards).toFixed(2)})
      </p>
      {order.status === "PENDING_VERIFICATION" ? (
        <VerificationTerminal order={order} />
      ) : (
        <p className="rounded-lg border border-slate-400 bg-white p-4 text-slate-900">
          This batch is no longer pending verification. <Link className="text-blue-800 underline" href={`/orders/${order.id}`}>View audit record</Link>
        </p>
      )}
    </>
  );
}
