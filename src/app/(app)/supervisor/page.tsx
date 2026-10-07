import Link from "next/link";
import { Card, StatusBadge, Wastage, fmtDate } from "@/components/ui";
import { requirePageRole } from "@/lib/auth";
import { supabaseRepo } from "@/lib/repo/supabase-repo";
import { listOrders, listRecipes } from "@/lib/services";
import { CreateOrderForm } from "./CreateOrderForm";
import { OrderActions } from "./OrderActions";

export const dynamic = "force-dynamic";

export default async function SupervisorPage() {
  const ctx = await requirePageRole("cutting_supervisor");
  const [recipes, orders] = await Promise.all([listRecipes(ctx, supabaseRepo), listOrders(ctx, supabaseRepo)]);

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Cutting Supervisor — Order Engine</h1>
      <CreateOrderForm recipes={recipes} />

      <Card title={`Cutting orders (${orders.length})`}>
        {orders.length === 0 ? (
          <p className="text-slate-700">No cutting orders yet. Create one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b-2 border-slate-400 text-slate-900">
                <tr>
                  <th className="py-2 pr-3">Order</th>
                  <th className="py-2 pr-3">Recipe</th>
                  <th className="py-2 pr-3">Qty</th>
                  <th className="py-2 pr-3">Roll / Yards</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Updated</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-900">
                {orders.map((o) => (
                  <tr key={o.id} className="align-top">
                    <td className="py-3 pr-3 font-mono font-semibold">
                      <Link className="text-blue-800 underline" href={`/orders/${o.id}`}>{o.order_no}</Link>
                    </td>
                    <td className="py-3 pr-3">{o.recipe_name}<div className="text-xs text-slate-700">{o.recipe_code}</div></td>
                    <td className="py-3 pr-3">{o.target_qty}</td>
                    <td className="py-3 pr-3">{o.fabric_roll_id}<div className="text-xs text-slate-700">{o.actual_fabric_yds} yds</div></td>
                    <td className="py-3 pr-3">
                      <StatusBadge status={o.status} />
                      {o.status === "REJECTED" && o.last_rejection_note && (
                        <p className="mt-1 max-w-xs text-xs text-red-900">Reason: {o.last_rejection_note}</p>
                      )}
                      {o.wastage_pct !== null && o.status !== "REJECTED" && (
                        <div className="mt-1 text-xs">Wastage: <Wastage pct={o.wastage_pct} /></div>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-xs text-slate-800">{fmtDate(o.updated_at)}</td>
                    <td className="py-3"><OrderActions order={o} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
