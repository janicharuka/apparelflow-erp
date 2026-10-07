// Authoritative server-side business rules. Every function takes an AuthContext
// that was derived from the verified session — NEVER from the request body.
import {
  canTransition,
  checkApprovable,
  expectedQty,
  itemStatus,
  SEWING_VISIBLE_STATUSES,
  VERIFIER_VISIBLE_STATUSES,
  wastagePct,
  type OrderStatus,
  type Role,
} from "@/lib/domain";
import { conflict, forbidden, HttpError, notFound, unprocessable } from "@/lib/errors";
import type { AuthContext, OrderDetail, Repository } from "@/lib/repo/types";
import {
  countsSchema,
  createOrderSchema,
  fieldErrors,
  recutSchema,
  rejectSchema,
} from "@/lib/validation";
import type { z } from "zod";

export function requireRole(ctx: AuthContext, ...allowed: Role[]) {
  if (!allowed.includes(ctx.role)) {
    throw forbidden(`Role '${ctx.role}' is not allowed to perform this action`);
  }
}

function parse<T extends z.ZodType>(schema: T, raw: unknown): z.infer<T> {
  const r = schema.safeParse(raw ?? {});
  if (!r.success) {
    throw unprocessable("Validation failed", { fields: fieldErrors(r.error) });
  }
  return r.data;
}

function visibleStatusesFor(role: Role): readonly OrderStatus[] | "ALL" {
  switch (role) {
    case "cutting_supervisor":
      return "ALL";
    case "cutting_verifier":
      return VERIFIER_VISIBLE_STATUSES;
    case "sewing_supervisor":
      return SEWING_VISIBLE_STATUSES;
  }
}

async function transitionOrThrow(
  repo: Repository,
  order: OrderDetail,
  to: OrderStatus,
  patch?: Parameters<Repository["transitionOrder"]>[3],
) {
  if (!canTransition(order.status, to)) {
    throw conflict(`Order ${order.order_no} is ${order.status}; cannot move to ${to}`);
  }
  const ok = await repo.transitionOrder(order.id, order.status, to, patch);
  if (!ok) throw conflict("Order was modified by someone else. Refresh and try again.");
}

// ---------------------------------------------------------------- recipes
export async function listRecipes(ctx: AuthContext, repo: Repository) {
  requireRole(ctx, "cutting_supervisor");
  return repo.listRecipes();
}

// ---------------------------------------------------------------- orders
export async function listOrders(ctx: AuthContext, repo: Repository) {
  const vis = visibleStatusesFor(ctx.role);
  return repo.listOrdersByStatus(
    vis === "ALL"
      ? ["CUTTING_IN_PROGRESS", "PENDING_VERIFICATION", "VERIFIED", "REJECTED", "SEWING_IN_PROGRESS"]
      : vis,
  );
}

export async function getOrder(ctx: AuthContext, repo: Repository, id: string) {
  const order = await repo.getOrder(id);
  const vis = visibleStatusesFor(ctx.role);
  // Same 404 whether it doesn't exist or isn't visible — never leak existence.
  if (!order || (vis !== "ALL" && !vis.includes(order.status))) throw notFound("Order not found");
  return order;
}

export async function createOrder(ctx: AuthContext, repo: Repository, raw: unknown) {
  requireRole(ctx, "cutting_supervisor");
  const input = parse(createOrderSchema, raw);
  const recipe = await repo.getRecipe(input.recipe_id);
  if (!recipe) throw unprocessable("Validation failed", { fields: { recipe_id: "Unknown recipe" } });
  if (recipe.components.length === 0) throw unprocessable("Recipe has no components");

  return repo.createOrder({
    recipe_id: recipe.id,
    target_qty: input.target_qty,
    fabric_roll_id: input.fabric_roll_id.toUpperCase(),
    actual_fabric_yds: input.actual_fabric_yds,
    created_by: ctx.userId, // from session, never from body
    items: recipe.components.map((c) => ({
      component_id: c.id,
      expected_qty: expectedQty(input.target_qty, c.pieces_per_garment),
    })),
  });
}

export async function submitForVerification(ctx: AuthContext, repo: Repository, id: string) {
  requireRole(ctx, "cutting_supervisor");
  const order = await getOrder(ctx, repo, id);
  await transitionOrThrow(repo, order, "PENDING_VERIFICATION");
}

export async function recutOrder(ctx: AuthContext, repo: Repository, id: string, raw: unknown) {
  requireRole(ctx, "cutting_supervisor");
  const input = parse(recutSchema, raw);
  const order = await getOrder(ctx, repo, id);
  await transitionOrThrow(repo, order, "CUTTING_IN_PROGRESS", {
    ...(input.actual_fabric_yds !== undefined && { actual_fabric_yds: input.actual_fabric_yds }),
    ...(input.fabric_roll_id !== undefined && { fabric_roll_id: input.fabric_roll_id.toUpperCase() }),
  });
  await repo.resetItemCounts(order.id);
}

// ---------------------------------------------------------------- verification gate
function evaluateCounts(order: OrderDetail, counts: { item_id: string; actual_qty: number }[], requireAll: boolean) {
  const byId = new Map(order.items.map((i) => [i.id, i]));
  const seen = new Set<string>();
  for (const c of counts) {
    if (!byId.has(c.item_id)) throw unprocessable("Count submitted for a component that is not part of this order");
    if (seen.has(c.item_id)) throw unprocessable("Duplicate component count submitted");
    seen.add(c.item_id);
  }
  if (requireAll && seen.size !== order.items.length) {
    throw unprocessable("HARD STOP: every component must be counted before approval", {
      uncounted: order.items.filter((i) => !seen.has(i.id)).map((i) => i.component_name),
    });
  }
  return counts.map((c) => {
    const item = byId.get(c.item_id)!;
    return {
      item_id: c.item_id,
      component_name: item.component_name,
      expected_qty: item.expected_qty,
      actual_qty: c.actual_qty,
      status: itemStatus(item.expected_qty, c.actual_qty)!,
    };
  });
}

export async function approveOrder(ctx: AuthContext, repo: Repository, id: string, raw: unknown) {
  requireRole(ctx, "cutting_verifier");
  const { counts } = parse(countsSchema, raw);
  const order = await getOrder(ctx, repo, id);
  if (order.status !== "PENDING_VERIFICATION") {
    throw conflict(`Order ${order.order_no} is ${order.status}, not PENDING_VERIFICATION`);
  }

  const evaluated = evaluateCounts(order, counts, true);
  const gate = checkApprovable(evaluated);
  if (!gate.ok) {
    throw new HttpError(422, "HARD STOP: batch has shortage (RED) components and cannot enter the Sewing Queue", {
      shortages: evaluated.filter((e) => e.status === "RED").map((e) => ({
        component: e.component_name,
        expected: e.expected_qty,
        actual: e.actual_qty,
      })),
    });
  }

  const wastage = wastagePct(order.actual_fabric_yds, order.target_qty, order.recipe.std_fabric_yards);
  await repo.finalizeVerification({
    orderId: order.id,
    verifierId: ctx.userId, // from session
    decision: "APPROVED",
    note: null,
    wastagePct: wastage,
    items: evaluated.map(({ item_id, actual_qty, status }) => ({ item_id, actual_qty, status })),
  });
  return { status: "VERIFIED" as const, wastage_pct: wastage, exceeds_cap: wastage > order.recipe.wastage_cap };
}

export async function rejectOrder(ctx: AuthContext, repo: Repository, id: string, raw: unknown) {
  requireRole(ctx, "cutting_verifier");
  const input = parse(rejectSchema, raw);
  const order = await getOrder(ctx, repo, id);
  if (order.status !== "PENDING_VERIFICATION") {
    throw conflict(`Order ${order.order_no} is ${order.status}, not PENDING_VERIFICATION`);
  }
  const evaluated = evaluateCounts(order, input.counts ?? [], false);
  await repo.finalizeVerification({
    orderId: order.id,
    verifierId: ctx.userId,
    decision: "REJECTED",
    note: input.note,
    wastagePct: wastagePct(order.actual_fabric_yds, order.target_qty, order.recipe.std_fabric_yards),
    items: evaluated.map(({ item_id, actual_qty, status }) => ({ item_id, actual_qty, status })),
  });
  return { status: "REJECTED" as const };
}

// ---------------------------------------------------------------- sewing
export async function getSewingQueue(ctx: AuthContext, repo: Repository) {
  requireRole(ctx, "sewing_supervisor");
  return repo.listSewingQueue();
}

export async function startSewing(ctx: AuthContext, repo: Repository, id: string) {
  requireRole(ctx, "sewing_supervisor");
  const order = await getOrder(ctx, repo, id);
  await transitionOrThrow(repo, order, "SEWING_IN_PROGRESS", {
    sewing_started_by: ctx.userId,
    sewing_started_at: new Date().toISOString(),
  });
}
