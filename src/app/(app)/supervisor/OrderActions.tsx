"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btn } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { OrderSummary } from "@/lib/repo/types";

export function OrderActions({ order }: { order: OrderSummary }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yards, setYards] = useState(String(order.actual_fabric_yds));

  async function run(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    const res = await api(path, "POST", body);
    setBusy(false);
    if (!res.ok) setError(res.fields ? Object.values(res.fields).join("; ") : res.error ?? "Failed");
    else router.refresh();
  }

  if (order.status === "CUTTING_IN_PROGRESS") {
    return (
      <div className="space-y-1">
        <button disabled={busy} className={btn.primary} onClick={() => run(`/api/orders/${order.id}/submit`)}>
          Submit to QC
        </button>
        {error && <p role="alert" className="text-xs font-semibold text-red-800">{error}</p>}
      </div>
    );
  }
  if (order.status === "REJECTED") {
    return (
      <div className="w-48 space-y-1">
        <label className="block text-xs font-semibold text-slate-900" htmlFor={`yds-${order.id}`}>Re-cut fabric (yds)</label>
        <input id={`yds-${order.id}`} inputMode="decimal" value={yards} onChange={(e) => setYards(e.target.value)} />
        <button disabled={busy} className={btn.secondary} onClick={() => run(`/api/orders/${order.id}/recut`, { actual_fabric_yds: yards })}>
          Re-cut batch
        </button>
        {error && <p role="alert" className="text-xs font-semibold text-red-800">{error}</p>}
      </div>
    );
  }
  return <span className="text-xs text-slate-700">—</span>;
}
