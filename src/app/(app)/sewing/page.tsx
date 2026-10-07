import Link from "next/link";
import { Card, StatusBadge, TrafficLight, Wastage, fmtDate } from "@/components/ui";
import { requirePageRole } from "@/lib/auth";
import { supabaseRepo } from "@/lib/repo/supabase-repo";
import { getOrder, getSewingQueue, listOrders } from "@/lib/services";
import { StartSewingButton } from "./StartSewingButton";

export const dynamic = "force-dynamic";

export default async function SewingPage() {
  const ctx = await requirePageRole("sewing_supervisor");
  const queue = await getSewingQueue(ctx, supabaseRepo); // WHERE status = 'VERIFIED'
  const details = await Promise.all(queue.map((o) => getOrder(ctx, supabaseRepo, o.id)));
  const inAssembly = (await listOrders(ctx, supabaseRepo)).filter((o) => o.status === "SEWING_IN_PROGRESS");

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Sewing Supervisor — Sewing Queue</h1>
      <p className="text-slate-800">Only batches that passed component-by-component QC sign-off appear here.</p>

      <Card title={`Verified batches ready for assembly (${details.length})`}>
        {details.length === 0 ? (
          <p className="text-slate-700">No verified batches in the queue.</p>
        ) : (
          <div className="space-y-4">
            {details.map((o) => (
              <article key={o.id} className="rounded-lg border border-slate-300 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-lg font-bold text-slate-900">{o.order_no}</span>{" "}
                    <StatusBadge status={o.status} />
                    <p className="text-sm text-slate-900">{o.recipe.name} · {o.target_qty} garments · Roll {o.fabric_roll_id}</p>
                  </div>
                  <StartSewingButton orderId={o.id} />
                </div>
                <dl className="mt-3 grid gap-2 text-sm text-slate-900 sm:grid-cols-3">
                  <div><dt className="font-semibold">Verified by</dt><dd>{o.verifier_name}</dd></div>
                  <div><dt className="font-semibold">Verified at</dt><dd>{fmtDate(o.verified_at)}</dd></div>
                  <div><dt className="font-semibold">Fabric wastage</dt><dd><Wastage pct={o.wastage_pct} cap={o.recipe.wastage_cap} /></dd></div>
                </dl>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm text-slate-900">
                    <thead><tr className="border-b border-slate-400 text-left">
                      <th className="py-1 pr-3">Component</th><th className="py-1 pr-3">Expected</th><th className="py-1 pr-3">Counted</th><th className="py-1">QC</th>
                    </tr></thead>
                    <tbody>
                      {o.items.map((i) => (
                        <tr key={i.id} className="border-b border-slate-200">
                          <td className="py-1 pr-3">{i.component_name}</td>
                          <td className="py-1 pr-3">{i.expected_qty}</td>
                          <td className="py-1 pr-3">{i.actual_qty}</td>
                          <td className="py-1"><TrafficLight status={i.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>

      <Card title={`On the assembly line (${inAssembly.length})`}>
        {inAssembly.length === 0 ? <p className="text-slate-700">Nothing in assembly yet.</p> : (
          <ul className="divide-y divide-slate-200">
            {inAssembly.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm text-slate-900">
                <Link className="font-mono font-semibold text-blue-800 underline" href={`/orders/${o.id}`}>{o.order_no}</Link>
                <span>{o.recipe_name} · {o.target_qty} pcs</span>
                <StatusBadge status={o.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
