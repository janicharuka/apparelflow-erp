import Link from "next/link";
import { Card, StatusBadge, fmtDate } from "@/components/ui";
import { requirePageRole } from "@/lib/auth";
import { supabaseRepo } from "@/lib/repo/supabase-repo";
import { listOrders } from "@/lib/services";

export const dynamic = "force-dynamic";

export default async function VerifierPage() {
  const ctx = await requirePageRole("cutting_verifier");
  const orders = await listOrders(ctx, supabaseRepo);
  const pending = orders.filter((o) => o.status === "PENDING_VERIFICATION");
  const history = orders.filter((o) => o.status !== "PENDING_VERIFICATION");

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Cutting Verifier — QC Gate</h1>
      <Card title={`Awaiting verification (${pending.length})`}>
        {pending.length === 0 ? (
          <p className="text-slate-700">No batches waiting at the QC station.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((o) => (
              <li key={o.id} className="rounded-lg border border-slate-300 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-slate-900">{o.order_no}</span>
                  <StatusBadge status={o.status} />
                </div>
                <p className="mt-1 text-sm text-slate-900">{o.recipe_name} · {o.target_qty} garments</p>
                <p className="text-xs text-slate-700">Roll {o.fabric_roll_id} · submitted {fmtDate(o.updated_at)}</p>
                <Link href={`/verifier/${o.id}`} className="mt-3 inline-block rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
                  Open verification terminal
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Recent decisions">
        {history.length === 0 ? <p className="text-slate-700">No decisions yet.</p> : (
          <ul className="divide-y divide-slate-200">
            {history.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm text-slate-900">
                <Link className="font-mono font-semibold text-blue-800 underline" href={`/orders/${o.id}`}>{o.order_no}</Link>
                <span>{o.recipe_name}</span>
                <StatusBadge status={o.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
