// In-memory Repository with the same semantics as the Supabase adapter
// (incl. the DB trigger's hard stop + compare-and-set transitions).
import { randomUUID } from "node:crypto";
import { canTransition, type OrderStatus } from "@/lib/domain";
import { conflict, unprocessable } from "@/lib/errors";
import type { AuthContext, OrderDetail, Recipe, Repository } from "@/lib/repo/types";

export const users: Record<string, AuthContext> = {
  supervisor: { userId: randomUUID(), email: "s@x", fullName: "Sup", role: "cutting_supervisor" },
  verifier: { userId: randomUUID(), email: "v@x", fullName: "Ver", role: "cutting_verifier" },
  sewing: { userId: randomUUID(), email: "w@x", fullName: "Sew", role: "sewing_supervisor" },
};

export function makeBlouse(): Recipe {
  const c = (name: string, pcs: number, i: number) => ({ id: randomUUID(), component_name: name, pieces_per_garment: pcs, image_url: null, sort_order: i });
  return {
    id: randomUUID(), recipe_code: "REC-BL01", name: "Casual Blouse", category: "Blouse", std_fabric_yards: 1.8, wastage_cap: 5,
    components: [c("Front Body Panel", 1, 1), c("Back Body Panel", 1, 2), c("Sleeves (Left & Right)", 2, 3), c("Collar & Stand", 1, 4), c("Sleeve Cuffs", 2, 5)],
  };
}

export class FakeRepo implements Repository {
  recipes: Recipe[] = [makeBlouse()];
  orders = new Map<string, OrderDetail>();
  seq = 1000;
  calls: string[] = [];

  async getUserProfile(id: string) {
    const u = Object.values(users).find((x) => x.userId === id);
    return u ? { email: u.email, fullName: u.fullName, role: u.role } : null;
  }
  async listRecipes() { return this.recipes; }
  async getRecipe(id: string) { return this.recipes.find((r) => r.id === id) ?? null; }

  async createOrder(input: Parameters<Repository["createOrder"]>[0]) {
    const recipe = this.recipes.find((r) => r.id === input.recipe_id)!;
    const id = randomUUID();
    const order_no = `CO-${++this.seq}`;
    const now = new Date().toISOString();
    const { components, ...recipeHeader } = recipe;
    this.orders.set(id, {
      id, order_no, status: "CUTTING_IN_PROGRESS", target_qty: input.target_qty, fabric_roll_id: input.fabric_roll_id,
      actual_fabric_yds: input.actual_fabric_yds, wastage_pct: null, recipe_code: recipe.recipe_code, recipe_name: recipe.name,
      created_at: now, updated_at: now, verified_at: null, verifier_name: null, last_rejection_note: null,
      recipe: recipeHeader, created_by_name: "Sup", sewing_started_at: null, logs: [],
      items: input.items.map((it) => {
        const comp = components.find((c) => c.id === it.component_id)!;
        return { id: randomUUID(), component_id: it.component_id, component_name: comp.component_name, pieces_per_garment: comp.pieces_per_garment,
          sort_order: comp.sort_order, expected_qty: it.expected_qty, actual_qty: null, status: null };
      }),
    });
    return { id, order_no };
  }

  async listOrdersByStatus(statuses: readonly OrderStatus[]) {
    return [...this.orders.values()].filter((o) => statuses.includes(o.status));
  }
  async listSewingQueue() {
    this.calls.push("listSewingQueue");
    return [...this.orders.values()].filter((o) => o.status === "VERIFIED");
  }
  async getOrder(id: string) { return structuredClone(this.orders.get(id) ?? null); }

  async transitionOrder(id: string, from: OrderStatus, to: OrderStatus, patch: Record<string, unknown> = {}) {
    const o = this.orders.get(id);
    if (!o || o.status !== from) return false;
    if (!canTransition(from, to)) throw conflict(`Illegal status transition ${from} -> ${to}`);
    Object.assign(o, patch, { status: to });
    return true;
  }
  async resetItemCounts(orderId: string) {
    this.orders.get(orderId)!.items.forEach((i) => { i.actual_qty = null; i.status = null; });
  }

  async finalizeVerification(p: Parameters<Repository["finalizeVerification"]>[0]) {
    const o = this.orders.get(p.orderId)!;
    if (o.status !== "PENDING_VERIFICATION") throw conflict("Order is no longer pending verification");
    for (const it of p.items) {
      const row = o.items.find((i) => i.id === it.item_id)!;
      row.actual_qty = it.actual_qty;
      row.status = it.status;
    }
    if (p.decision === "APPROVED") {
      // mirrors trg_order_state_machine hard stop
      if (o.items.some((i) => i.actual_qty === null || i.actual_qty < i.expected_qty)) throw unprocessable("HARD STOP (db)");
      Object.assign(o, { status: "VERIFIED", verified_at: new Date().toISOString(), wastage_pct: p.wastagePct, verifier_name: "Ver" });
    } else {
      if (!p.note || p.note.trim().length < 5) throw unprocessable("rejection_needs_note (db)");
      Object.assign(o, { status: "REJECTED", last_rejection_note: p.note });
    }
    o.logs.push({ id: randomUUID(), decision: p.decision, rejection_note: p.note, wastage_pct: p.wastagePct, verifier_name: "Ver", created_at: new Date().toISOString() });
    (o as OrderDetail & { verifier_id?: string }).verifier_id = p.verifierId;
  }
}
