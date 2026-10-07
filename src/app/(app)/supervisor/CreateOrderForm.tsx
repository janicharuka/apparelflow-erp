"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Alert, btn, Card } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { Recipe } from "@/lib/repo/types";
import { createOrderSchema, fieldErrors } from "@/lib/validation";

const EMPTY = { recipe_id: "", target_qty: "", fabric_roll_id: "", actual_fabric_yds: "" };

export function CreateOrderForm({ recipes }: { recipes: Recipe[] }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Same zod schema the server uses → identical inline errors (server stays authoritative).
  const parsed = useMemo(() => createOrderSchema.safeParse(form), [form]);
  const clientErrors = parsed.success ? {} : fieldErrors(parsed.error);
  const errors = { ...clientErrors, ...serverErrors };
  const recipe = recipes.find((r) => r.id === form.recipe_id);
  const qty = /^\d+$/.test(form.target_qty.trim()) ? Number(form.target_qty) : null;

  const expectedFabric = recipe && qty ? qty * recipe.std_fabric_yards : null;
  const yards = /^\d+(\.\d{1,2})?$/.test(form.actual_fabric_yds.trim()) ? Number(form.actual_fabric_yds) : null;
  const previewWastage = expectedFabric && yards ? ((yards - expectedFabric) / expectedFabric) * 100 : null;

  function set<K extends keyof typeof EMPTY>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setServerErrors((e) => ({ ...e, [k]: "" }));
    setTouched((t) => ({ ...t, [k]: true }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ recipe_id: true, target_qty: true, fabric_roll_id: true, actual_fabric_yds: true });
    setMessage(null);
    if (!parsed.success) return;
    setBusy(true);
    const res = await api<{ order_no: string }>("/api/orders", "POST", form);
    setBusy(false);
    if (!res.ok) {
      setServerErrors(res.fields ?? {});
      setMessage({ kind: "error", text: res.error ?? "Could not create order" });
      return;
    }
    setMessage({ kind: "success", text: `Order ${res.data?.order_no} created. Submit it to QC when cutting is complete.` });
    setForm(EMPTY);
    setTouched({});
    router.refresh();
  }

  const fieldErr = (k: string) => (touched[k] && errors[k] ? errors[k] : null);

  return (
    <Card title="Create cutting order">
      <form noValidate onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Production recipe" id="recipe_id" error={fieldErr("recipe_id")}>
            <select id="recipe_id" value={form.recipe_id} aria-invalid={!!fieldErr("recipe_id")}
              onChange={(e) => set("recipe_id", e.target.value)}>
              <option value="">Select recipe…</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>{r.recipe_code} — {r.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Target batch quantity (garments)" id="target_qty" error={fieldErr("target_qty")}>
            <input id="target_qty" inputMode="numeric" placeholder="e.g. 50" value={form.target_qty}
              aria-invalid={!!fieldErr("target_qty")} onChange={(e) => set("target_qty", e.target.value)} />
          </Field>
          <Field label="Fabric roll ID" id="fabric_roll_id" error={fieldErr("fabric_roll_id")}>
            <input id="fabric_roll_id" placeholder="FAB-ROLL-882" value={form.fabric_roll_id}
              aria-invalid={!!fieldErr("fabric_roll_id")} onChange={(e) => set("fabric_roll_id", e.target.value)} />
          </Field>
          <Field label="Actual fabric used (yards)" id="actual_fabric_yds" error={fieldErr("actual_fabric_yds")}>
            <input id="actual_fabric_yds" inputMode="decimal" placeholder="e.g. 92.5" value={form.actual_fabric_yds}
              aria-invalid={!!fieldErr("actual_fabric_yds")} onChange={(e) => set("actual_fabric_yds", e.target.value)} />
          </Field>
        </div>

        {recipe && (
          <div className="rounded-lg border border-slate-300 bg-slate-50 p-4">
            <h3 className="mb-2 font-semibold text-slate-900">
              Multiplier engine — {recipe.name} ({recipe.std_fabric_yards} yds/pc, wastage cap {recipe.wastage_cap}%)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm text-slate-900">
                <thead><tr className="border-b border-slate-400 text-left">
                  <th className="py-1 pr-3">Component</th><th className="py-1 pr-3">Pcs / garment</th><th className="py-1">Expected cut pieces</th>
                </tr></thead>
                <tbody>
                  {recipe.components.map((c) => (
                    <tr key={c.id} className="border-b border-slate-200">
                      <td className="py-1 pr-3">{c.component_name}</td>
                      <td className="py-1 pr-3">{c.pieces_per_garment}</td>
                      <td className="py-1 font-semibold">{qty ? `${qty} × ${c.pieces_per_garment} = ${qty * c.pieces_per_garment}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {expectedFabric !== null && (
              <p className="mt-2 text-sm text-slate-900">
                Expected fabric: <strong>{expectedFabric.toFixed(2)} yds</strong>
                {previewWastage !== null && (
                  <> · Projected wastage: <strong className={previewWastage > recipe.wastage_cap ? "text-red-800" : ""}>
                    {previewWastage.toFixed(2)}%</strong></>
                )}
              </p>
            )}
          </div>
        )}

        {message && <Alert kind={message.kind}>{message.text}</Alert>}
        <button type="submit" disabled={busy} className={btn.primary}>{busy ? "Creating…" : "Create cutting order"}</button>
      </form>
    </Card>
  );
}

function Field({ label, id, error, children }: { label: string; id: string; error: string | null; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-slate-900">{label}</label>
      {children}
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-sm font-semibold text-red-800">{error}</p>}
    </div>
  );
}
