"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Alert, btn, Card, TrafficLight } from "@/components/ui";
import { api } from "@/lib/api-client";
import { checkApprovable, itemStatus } from "@/lib/domain";
import type { OrderDetail } from "@/lib/repo/types";
import { validateCount } from "@/lib/validation";

export function VerificationTerminal({ order }: { order: OrderDetail }) {
  const router = useRouter();
  const [raw, setRaw] = useState<Record<string, string>>(() =>
    Object.fromEntries(order.items.map((i) => [i.id, i.actual_qty === null ? "" : String(i.actual_qty)])),
  );
  const [note, setNote] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Live preview only — the server recomputes everything on submit.
  const rows = useMemo(
    () =>
      order.items.map((i) => {
        const err = validateCount(raw[i.id] ?? "");
        const actual = err ? null : Number(raw[i.id]);
        return { ...i, err, actual, light: itemStatus(i.expected_qty, actual) };
      }),
    [order.items, raw],
  );
  const gate = checkApprovable(rows.map((r) => ({ expected_qty: r.expected_qty, actual_qty: r.actual })));
  const invalidInputs = rows.some((r) => r.err && (raw[r.id] ?? "") !== "");

  const counts = () =>
    rows.filter((r) => r.actual !== null).map((r) => ({ item_id: r.id, actual_qty: r.actual as number }));

  async function approve() {
    setBusy(true);
    setServerError(null);
    const res = await api(`/api/orders/${order.id}/approve`, "POST", { counts: counts() });
    setBusy(false);
    if (!res.ok) {
      const extra = res.shortages?.length ? ` — short: ${res.shortages.map((s) => `${s.component} (${s.actual}/${s.expected})`).join(", ")}` : "";
      setServerError(`${res.status} · ${res.error}${extra}`);
      return;
    }
    router.push("/verifier");
    router.refresh();
  }

  async function reject() {
    if (note.trim().length < 5) {
      setNoteError("A rejection reason of at least 5 characters is required");
      return;
    }
    setBusy(true);
    setServerError(null);
    const res = await api(`/api/orders/${order.id}/reject`, "POST", { note, counts: counts() });
    setBusy(false);
    if (!res.ok) {
      setServerError(`${res.status} · ${res.fields?.note ?? res.error}`);
      return;
    }
    router.push("/verifier");
    router.refresh();
  }

  return (
    <Card title="Component count — traffic-light matrix">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm text-slate-900">
          <thead className="border-b-2 border-slate-400">
            <tr>
              <th className="py-2 pr-3">Component</th>
              <th className="py-2 pr-3">Expected</th>
              <th className="py-2 pr-3">Physical count</th>
              <th className="py-2 pr-3">Variance</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((r) => {
              const showErr = r.err && (raw[r.id] ?? "") !== "";
              return (
                <tr key={r.id} className="align-top">
                  <td className="py-3 pr-3 font-semibold">
                    {r.component_name}
                    <div className="text-xs font-normal text-slate-700">{r.pieces_per_garment} pcs × {order.target_qty}</div>
                  </td>
                  <td className="py-3 pr-3 font-mono text-base">{r.expected_qty}</td>
                  <td className="w-40 py-3 pr-3">
                    <label className="sr-only" htmlFor={`count-${r.id}`}>Count for {r.component_name}</label>
                    <input
                      id={`count-${r.id}`}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Count"
                      value={raw[r.id] ?? ""}
                      aria-invalid={!!showErr}
                      onChange={(e) => setRaw((s) => ({ ...s, [r.id]: e.target.value }))}
                    />
                    {showErr && <p role="alert" className="mt-1 text-xs font-semibold text-red-800">{r.err}</p>}
                  </td>
                  <td className="py-3 pr-3 font-mono">
                    {r.actual === null ? "—" : `${r.actual - r.expected_qty > 0 ? "+" : ""}${r.actual - r.expected_qty}`}
                  </td>
                  <td className="py-3"><TrafficLight status={r.light} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-3">
        {gate.shortages > 0 && (
          <Alert kind="error">
            <strong>HARD STOP:</strong> {gate.shortages} component(s) are short. This batch cannot be approved and cannot enter the
            Sewing Queue. Reject it with a reason so the supervisor can re-cut.
          </Alert>
        )}
        {gate.shortages === 0 && gate.uncounted > 0 && (
          <Alert kind="info">{gate.uncounted} component(s) still need a physical count before approval.</Alert>
        )}
        {gate.ok && !invalidInputs && <Alert kind="success">All components meet or exceed the recipe. Ready for sign-off.</Alert>}
        {serverError && <Alert kind="error">Server rejected the request: {serverError}</Alert>}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={btn.success}
            disabled={!gate.ok || invalidInputs || busy}
            aria-disabled={!gate.ok || invalidInputs || busy}
            title={!gate.ok ? "Disabled: shortage or uncounted components" : "Approve and release to the Sewing Queue"}
            onClick={approve}
          >
            Approve Batch
          </button>
          <button type="button" className={btn.danger} disabled={busy} onClick={() => setShowReject((v) => !v)}>
            Reject Batch
          </button>
        </div>

        {showReject && (
          <div className="rounded-lg border-2 border-red-700 bg-red-50 p-4">
            <label htmlFor="reject-note" className="mb-1 block text-sm font-bold text-red-900">
              Rejection reason (mandatory)
            </label>
            <textarea
              id="reject-note"
              rows={3}
              value={note}
              aria-invalid={!!noteError}
              placeholder="e.g. Sleeve Cuffs short by 4 pcs; shade variation on Front Body Panel"
              onChange={(e) => {
                setNote(e.target.value);
                setNoteError(null);
              }}
            />
            {noteError && <p role="alert" className="mt-1 text-sm font-semibold text-red-800">{noteError}</p>}
            <button type="button" className={btn.danger + " mt-3"} disabled={busy} onClick={reject}>
              Confirm rejection
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
