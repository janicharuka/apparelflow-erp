import type { ItemStatus, OrderStatus } from "@/lib/domain";

// All colour pairs below are ≥ 4.5:1 (WCAG AA) — dark text on tinted light backgrounds.
const STATUS_STYLE: Record<OrderStatus, string> = {
  CUTTING_IN_PROGRESS: "bg-slate-200 text-slate-900 border-slate-500",
  PENDING_VERIFICATION: "bg-amber-100 text-amber-900 border-amber-600",
  VERIFIED: "bg-emerald-100 text-emerald-900 border-emerald-700",
  REJECTED: "bg-red-100 text-red-900 border-red-700",
  SEWING_IN_PROGRESS: "bg-blue-100 text-blue-900 border-blue-700",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  CUTTING_IN_PROGRESS: "Cutting in progress",
  PENDING_VERIFICATION: "Pending verification",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  SEWING_IN_PROGRESS: "Sewing in progress",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

const LIGHT: Record<ItemStatus | "NONE", { cls: string; label: string; dot: string }> = {
  GREEN: { cls: "bg-emerald-100 text-emerald-900 border-emerald-700", dot: "bg-emerald-600", label: "MATCH" },
  YELLOW: { cls: "bg-amber-100 text-amber-900 border-amber-600", dot: "bg-amber-500", label: "EXCESS" },
  RED: { cls: "bg-red-100 text-red-900 border-red-700", dot: "bg-red-600", label: "SHORTAGE" },
  NONE: { cls: "bg-slate-100 text-slate-800 border-slate-500", dot: "bg-slate-400", label: "NOT COUNTED" },
};

/** Traffic light uses colour + text label (never colour alone). */
export function TrafficLight({ status }: { status: ItemStatus | null }) {
  const s = LIGHT[status ?? "NONE"];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-xs font-bold ${s.cls}`}
      aria-label={`Status: ${status ?? "not counted"} ${s.label}`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} aria-hidden />
      {status ?? "—"} · {s.label}
    </span>
  );
}

export const btn = {
  primary:
    "inline-flex items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700",
  success:
    "inline-flex items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700",
  danger:
    "inline-flex items-center justify-center rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700",
  secondary:
    "inline-flex items-center justify-center rounded-lg border border-slate-500 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-500",
};

export function Card({ title, children, actions }: { title?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm sm:p-6">
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-lg font-bold text-slate-900">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Alert({ kind, children }: { kind: "error" | "success" | "info" | "warning"; children: React.ReactNode }) {
  const cls = {
    error: "border-red-700 bg-red-50 text-red-900",
    success: "border-emerald-700 bg-emerald-50 text-emerald-900",
    info: "border-blue-700 bg-blue-50 text-blue-900",
    warning: "border-amber-600 bg-amber-50 text-amber-900",
  }[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`rounded-lg border-l-4 px-4 py-3 text-sm ${cls}`}>
      {children}
    </div>
  );
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export function Wastage({ pct, cap }: { pct: number | null; cap?: number }) {
  if (pct === null) return <span className="text-slate-700">—</span>;
  const over = cap !== undefined && pct > cap;
  return (
    <span className={over ? "font-semibold text-red-800" : "text-slate-900"}>
      {pct > 0 ? "+" : ""}
      {pct.toFixed(2)}%{over && ` (over ${cap}% cap)`}
    </span>
  );
}
