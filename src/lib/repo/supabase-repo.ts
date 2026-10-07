import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { SEWING_QUEUE_STATUS, type ItemStatus, type OrderStatus, type Role } from "@/lib/domain";
import { conflict, HttpError, notFound, unprocessable } from "@/lib/errors";
import { adminClient } from "@/lib/supabase/admin";
import type {
  OrderDetail,
  OrderSummary,
  Recipe,
  Repository,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

function fail(error: PostgrestError): never {
  // P0001 = raised by our triggers / RPCs (state machine, hard stop)
  if (error.code === "P0001") {
    if (/HARD STOP/i.test(error.message)) throw unprocessable(error.message);
    throw conflict(error.message.replace("ORDER_NOT_PENDING", "Order is no longer pending verification"));
  }
  if (error.code === "P0002") throw notFound("Order not found");
  if (error.code === "23514") throw unprocessable(`Database constraint violated: ${error.message}`);
  if (error.code === "22P02") throw notFound("Not found"); // invalid uuid
  throw new HttpError(500, "Database error");
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

const SUMMARY_COLUMNS = `
  id, order_no, status, target_qty, fabric_roll_id, actual_fabric_yds, wastage_pct,
  created_at, updated_at, verified_at, last_rejection_note,
  recipe:recipes(recipe_code, name),
  verifier:users!cutting_orders_verified_by_fkey(full_name)
`;

function toSummary(r: any): OrderSummary {
  const recipe = one(r.recipe) as any;
  const verifier = one(r.verifier) as any;
  return {
    id: r.id,
    order_no: r.order_no,
    status: r.status as OrderStatus,
    target_qty: r.target_qty,
    fabric_roll_id: r.fabric_roll_id,
    actual_fabric_yds: Number(r.actual_fabric_yds),
    wastage_pct: r.wastage_pct === null ? null : Number(r.wastage_pct),
    recipe_code: recipe?.recipe_code ?? "",
    recipe_name: recipe?.name ?? "",
    created_at: r.created_at,
    updated_at: r.updated_at,
    verified_at: r.verified_at,
    verifier_name: verifier?.full_name ?? null,
    last_rejection_note: r.last_rejection_note,
  };
}

function toRecipe(r: any): Recipe {
  return {
    id: r.id,
    recipe_code: r.recipe_code,
    name: r.name,
    category: r.category,
    std_fabric_yards: Number(r.std_fabric_yards),
    wastage_cap: Number(r.wastage_cap),
    components: (r.components ?? [])
      .map((c: any) => ({
        id: c.id,
        component_name: c.component_name,
        pieces_per_garment: c.pieces_per_garment,
        image_url: c.image_url,
        sort_order: c.sort_order,
      }))
      .sort((a: any, b: any) => a.sort_order - b.sort_order),
  };
}

const RECIPE_COLUMNS = `id, recipe_code, name, category, std_fabric_yards, wastage_cap,
  components:recipe_components(id, component_name, pieces_per_garment, image_url, sort_order)`;

export const supabaseRepo: Repository = {
  async getUserProfile(userId) {
    const { data, error } = await adminClient()
      .from("users")
      .select("email, full_name, role")
      .eq("id", userId)
      .maybeSingle();
    if (error) fail(error);
    return data ? { email: data.email, fullName: data.full_name, role: data.role as Role } : null;
  },

  async listRecipes() {
    const { data, error } = await adminClient().from("recipes").select(RECIPE_COLUMNS).order("recipe_code");
    if (error) fail(error);
    return (data ?? []).map(toRecipe);
  },

  async getRecipe(id) {
    const { data, error } = await adminClient().from("recipes").select(RECIPE_COLUMNS).eq("id", id).maybeSingle();
    if (error) fail(error);
    return data ? toRecipe(data) : null;
  },

  async createOrder(input) {
    const { data, error } = await adminClient()
      .rpc("create_cutting_order", {
        p_recipe_id: input.recipe_id,
        p_target_qty: input.target_qty,
        p_fabric_roll_id: input.fabric_roll_id,
        p_actual_fabric_yds: input.actual_fabric_yds,
        p_created_by: input.created_by,
        p_items: input.items,
      })
      .single();
    if (error) fail(error);
    return data as { id: string; order_no: string };
  },

  async listOrdersByStatus(statuses) {
    const { data, error } = await adminClient()
      .from("cutting_orders")
      .select(SUMMARY_COLUMNS)
      .in("status", statuses as string[])
      .order("created_at", { ascending: false });
    if (error) fail(error);
    return (data ?? []).map(toSummary);
  },

  async listSewingQueue() {
    // Query isolation: the WHERE status = 'VERIFIED' is part of the SQL sent to Postgres.
    const { data, error } = await adminClient()
      .from("cutting_orders")
      .select(SUMMARY_COLUMNS)
      .eq("status", SEWING_QUEUE_STATUS)
      .order("verified_at", { ascending: true });
    if (error) fail(error);
    return (data ?? []).map(toSummary);
  },

  async getOrder(id) {
    const { data, error } = await adminClient()
      .from("cutting_orders")
      .select(
        `${SUMMARY_COLUMNS},
        sewing_started_at,
        full_recipe:recipes(id, recipe_code, name, category, std_fabric_yards, wastage_cap),
        creator:users!cutting_orders_created_by_fkey(full_name),
        items:verification_items(id, component_id, expected_qty, actual_qty, status,
          component:recipe_components(component_name, pieces_per_garment, sort_order)),
        logs:verification_logs(id, decision, rejection_note, wastage_pct, created_at,
          verifier:users(full_name))`,
      )
      .eq("id", id)
      .maybeSingle();
    if (error) fail(error);
    if (!data) return null;
    const r: any = data;
    const recipe: any = one(r.full_recipe);
    const detail: OrderDetail = {
      ...toSummary(r),
      sewing_started_at: r.sewing_started_at,
      created_by_name: (one(r.creator) as any)?.full_name ?? null,
      recipe: {
        id: recipe.id,
        recipe_code: recipe.recipe_code,
        name: recipe.name,
        category: recipe.category,
        std_fabric_yards: Number(recipe.std_fabric_yards),
        wastage_cap: Number(recipe.wastage_cap),
      },
      items: (r.items ?? [])
        .map((i: any) => {
          const c: any = one(i.component);
          return {
            id: i.id,
            component_id: i.component_id,
            component_name: c?.component_name ?? "",
            pieces_per_garment: c?.pieces_per_garment ?? 0,
            sort_order: c?.sort_order ?? 0,
            expected_qty: i.expected_qty,
            actual_qty: i.actual_qty,
            status: i.status as ItemStatus | null,
          };
        })
        .sort((a: any, b: any) => a.sort_order - b.sort_order),
      logs: (r.logs ?? [])
        .map((l: any) => ({
          id: l.id,
          decision: l.decision,
          rejection_note: l.rejection_note,
          wastage_pct: l.wastage_pct === null ? null : Number(l.wastage_pct),
          verifier_name: (one(l.verifier) as any)?.full_name ?? null,
          created_at: l.created_at,
        }))
        .sort((a: any, b: any) => b.created_at.localeCompare(a.created_at)),
    };
    return detail;
  },

  async transitionOrder(id, from, to, patch = {}) {
    const { data, error } = await adminClient()
      .from("cutting_orders")
      .update({ status: to, ...patch })
      .eq("id", id)
      .eq("status", from) // compare-and-set
      .select("id");
    if (error) fail(error);
    return (data ?? []).length === 1;
  },

  async resetItemCounts(orderId) {
    const { error } = await adminClient()
      .from("verification_items")
      .update({ actual_qty: null, status: null })
      .eq("order_id", orderId);
    if (error) fail(error);
  },

  async finalizeVerification(p) {
    const { error } = await adminClient().rpc("finalize_verification", {
      p_order_id: p.orderId,
      p_verifier_id: p.verifierId,
      p_decision: p.decision,
      p_note: p.note,
      p_wastage_pct: p.wastagePct,
      p_items: p.items,
    });
    if (error) fail(error);
  },
};
