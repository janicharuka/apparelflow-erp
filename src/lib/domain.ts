// Pure domain rules — no I/O. Shared by server (authoritative) and client (live preview only).

export const ROLES = ["cutting_supervisor", "cutting_verifier", "sewing_supervisor"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  cutting_supervisor: "Cutting Supervisor",
  cutting_verifier: "Cutting Verifier",
  sewing_supervisor: "Sewing Supervisor",
};

export const ROLE_HOME: Record<Role, string> = {
  cutting_supervisor: "/supervisor",
  cutting_verifier: "/verifier",
  sewing_supervisor: "/sewing",
};

export type OrderStatus =
  | "CUTTING_IN_PROGRESS"
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "REJECTED"
  | "SEWING_IN_PROGRESS";

export type ItemStatus = "GREEN" | "YELLOW" | "RED";

/** Statuses the sewing floor may ever see. Single source of truth for query isolation. */
export const SEWING_VISIBLE_STATUSES: readonly OrderStatus[] = ["VERIFIED", "SEWING_IN_PROGRESS"];
export const SEWING_QUEUE_STATUS: OrderStatus = "VERIFIED";
export const VERIFIER_VISIBLE_STATUSES: readonly OrderStatus[] = [
  "PENDING_VERIFICATION",
  "VERIFIED",
  "REJECTED",
];

/** Deterministic state machine. Anything not listed here is illegal. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CUTTING_IN_PROGRESS: ["PENDING_VERIFICATION"],
  PENDING_VERIFICATION: ["VERIFIED", "REJECTED"],
  REJECTED: ["CUTTING_IN_PROGRESS"],
  VERIFIED: ["SEWING_IN_PROGRESS"],
  SEWING_IN_PROGRESS: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Multiplier engine: garments × pieces per garment. */
export function expectedQty(targetQty: number, piecesPerGarment: number): number {
  if (!Number.isSafeInteger(targetQty) || !Number.isSafeInteger(piecesPerGarment)) {
    throw new Error("Quantities must be integers");
  }
  return targetQty * piecesPerGarment;
}

/** Traffic-light status. `null` actual = not yet counted. */
export function itemStatus(expected: number, actual: number | null | undefined): ItemStatus | null {
  if (actual === null || actual === undefined || !Number.isInteger(actual)) return null;
  if (actual === expected) return "GREEN";
  if (actual > expected) return "YELLOW";
  return "RED";
}

export interface CountedItem {
  expected_qty: number;
  actual_qty: number | null;
}

export interface ApprovalCheck {
  ok: boolean;
  shortages: number;
  uncounted: number;
}

/** Hard-stop gatekeeper: every component counted AND no shortage. */
export function checkApprovable(items: CountedItem[]): ApprovalCheck {
  let shortages = 0;
  let uncounted = 0;
  for (const it of items) {
    const s = itemStatus(it.expected_qty, it.actual_qty);
    if (s === null) uncounted++;
    else if (s === "RED") shortages++;
  }
  return { ok: items.length > 0 && shortages === 0 && uncounted === 0, shortages, uncounted };
}

/** Fabric Wastage % = (actual − expected) / expected × 100, rounded to 2 dp. */
export function wastagePct(actualFabricYds: number, targetQty: number, stdFabricYards: number): number {
  const expected = targetQty * stdFabricYards;
  if (!(expected > 0)) throw new Error("Expected fabric must be positive");
  return Math.round(((actualFabricYds - expected) / expected) * 100 * 100) / 100;
}
