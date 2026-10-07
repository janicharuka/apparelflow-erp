import { notFound } from "next/navigation";
import { Card, StatusBadge, TrafficLight, Wastage, fmtDate } from "@/components/ui";
import { getAuthContext } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { supabaseRepo } from "@/lib/repo/supabase-repo";
import { getOrder } from "@/lib/services";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Read-only audit view. Visibility is filtered by role in getOrder() (sewing sees VERIFIED+ only). */
export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  const { id } = await params;
  const order = await getOrder(ctx, supabaseRepo, id).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-bold text-slate-900">{order.order_no}</h1>
        <StatusBadge status={order.status} />
      </div>
      <Card title="Batch">
        <dl className="grid gap-3 text-sm text-slate-900 sm:grid-cols-3">
          <div><dt className="font-semibold">Recipe</dt><dd>{order.recipe.name} ({order.recipe.recipe_code})</dd></div>
          <div><dt className="font-semibold">Target quantity</dt><dd>{order.target_qty} garments</dd></div>
          <div><dt className="font-semibold">Fabric roll</dt><dd>{order.fabric_roll_id}</dd></div>
          <div><dt className="font-semibold">Fabric used / expected</dt><dd>{order.actual_fabric_yds} / {(order.target_qty * order.recipe.std_fabric_yards).toFixed(2)} yds</dd></div>
          <div><dt className="font-semibold">Wastage</dt><dd><Wastage pct={order.wastage_pct} cap={order.recipe.wastage_cap} /></dd></div>
          <div><dt className="font-semibold">Created by</dt><dd>{order.created_by_name} · {fmtDate(order.created_at)}</dd></div>
          <div><dt className="font-semibold">Verified by</dt><dd>{order.verifier_name ?? "—"} · {fmtDate(order.verified_at)}</dd></div>
          <div><dt className="font-semibold">Sewing started</dt><dd>{fmtDate(order.sewing_started_at)}</dd></div>
        </dl>
      </Card>
      <Card title="Components">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm text-slate-900">
            <thead><tr className="border-b-2 border-slate-400 text-left">
              <th className="py-1 pr-3">Component</th><th className="py-1 pr-3">Expected</th><th className="py-1 pr-3">Counted</th><th className="py-1">Status</th>
            </tr></thead>
            <tbody>
              {order.items.map((i) => (
                <tr key={i.id} className="border-b border-slate-200">
                  <td className="py-2 pr-3">{i.component_name}</td>
                  <td className="py-2 pr-3">{i.expected_qty}</td>
                  <td className="py-2 pr-3">{i.actual_qty ?? "—"}</td>
                  <td className="py-2"><TrafficLight status={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Immutable verification audit log">
        {order.logs.length === 0 ? <p className="text-slate-700">No verification decisions yet.</p> : (
          <ul className="space-y-2">
            {order.logs.map((l) => (
              <li key={l.id} className="rounded-lg border border-slate-300 p-3 text-sm text-slate-900">
                <strong className={l.decision === "APPROVED" ? "text-emerald-800" : "text-red-800"}>{l.decision}</strong>{" "}
                by {l.verifier_name} · {fmtDate(l.created_at)} · wastage <Wastage pct={l.wastage_pct} />
                {l.rejection_note && <p className="mt-1">Reason: {l.rejection_note}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
