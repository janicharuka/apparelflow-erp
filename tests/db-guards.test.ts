// Runs the REAL migration in an in-process Postgres (PGlite) and attacks it
// directly — proving the hard stop holds even if the API layer were bypassed.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const S = "11111111-1111-1111-1111-111111111111"; // cutting supervisor
const V = "22222222-2222-2222-2222-222222222222"; // verifier
const W = "33333333-3333-3333-3333-333333333333"; // sewing supervisor
let db: PGlite;
let recipeId: string;
let comps: { id: string; pieces_per_garment: number }[];

const sql = (f: string) => fs.readFileSync(path.join(__dirname, "..", "supabase", f), "utf8");
const rows = async <T = Record<string, unknown>>(q: string, p?: unknown[]) => (await db.query<T>(q, p)).rows;

async function newOrder(qty = 50) {
  const items = comps.map((c) => ({ component_id: c.id, expected_qty: qty * c.pieces_per_garment }));
  const [o] = await rows<{ id: string }>(
    `select * from create_cutting_order($1, $2, 'FAB-ROLL-882', 92.5, $3, $4::jsonb)`,
    [recipeId, qty, S, JSON.stringify(items)],
  );
  return o.id;
}
async function pendingItems(orderId: string) {
  await db.query(`update cutting_orders set status = 'PENDING_VERIFICATION' where id = $1`, [orderId]);
  return rows<{ id: string; expected_qty: number }>(`select id, expected_qty from verification_items where order_id = $1`, [orderId]);
}
const approve = (orderId: string, items: unknown[]) =>
  db.query(`select finalize_verification($1, $2, 'APPROVED', null, 2.78, $3::jsonb)`, [orderId, V, JSON.stringify(items)]);
const status = async (id: string) => (await rows<{ status: string }>(`select status from cutting_orders where id = $1`, [id]))[0].status;

beforeAll(async () => {
  db = new PGlite();
  // Minimal stand-in for Supabase's auth schema + API roles
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
  `);
  await db.exec(sql("migrations/0001_schema.sql"));
  await db.exec(sql("seed.sql"));
  await db.exec(`
    insert into auth.users values ('${S}'), ('${V}'), ('${W}');
    insert into public.users (id, email, full_name, role) values
      ('${S}', 's@x', 'Sup', 'cutting_supervisor'),
      ('${V}', 'v@x', 'Ver', 'cutting_verifier'),
      ('${W}', 'w@x', 'Sew', 'sewing_supervisor');
    grant usage on schema public to authenticated;
    grant select on all tables in schema public to authenticated;
  `);
  recipeId = (await rows<{ id: string }>(`select id from recipes where recipe_code = 'REC-BL01'`))[0].id;
  comps = await rows(`select id, pieces_per_garment from recipe_components where recipe_id = $1 order by sort_order`, [recipeId]);
}, 60_000);

describe("database-level guards (migration 0001)", () => {
  it("seeds both recipes with 5 components each", async () => {
    expect(await rows(`select recipe_code from recipes order by 1`)).toEqual([{ recipe_code: "REC-BL01" }, { recipe_code: "REC-CT02" }]);
    expect(comps.map((c) => c.pieces_per_garment)).toEqual([1, 1, 2, 1, 2]);
  });

  it("rejects a tampered multiplier payload", async () => {
    const bad = comps.map((c, i) => ({ component_id: c.id, expected_qty: i === 0 ? 1 : 50 * c.pieces_per_garment }));
    await expect(
      db.query(`select * from create_cutting_order($1, 50, 'FAB-1', 90, $2, $3::jsonb)`, [recipeId, S, JSON.stringify(bad)]),
    ).rejects.toThrow(/multiplier mismatch/);
  });

  it("HARD STOP: RED component cannot be approved even by calling the RPC directly", async () => {
    const id = await newOrder();
    const items = await pendingItems(id);
    const red = items.map((x, i) => ({ item_id: x.id, actual_qty: x.expected_qty - (i === 0 ? 1 : 0), status: i === 0 ? "RED" : "GREEN" }));
    await expect(approve(id, red)).rejects.toThrow(/HARD STOP/);
    expect(await status(id)).toBe("PENDING_VERIFICATION");
    expect(await rows(`select 1 from verification_logs where order_id = $1`, [id])).toHaveLength(0); // rolled back
  });

  it("HARD STOP: a raw UPDATE to VERIFIED with uncounted items is refused", async () => {
    const id = await newOrder();
    await pendingItems(id);
    await expect(
      db.query(`update cutting_orders set status='VERIFIED', verified_by=$2, verified_at=now(), wastage_pct=0 where id=$1`, [id, V]),
    ).rejects.toThrow(/HARD STOP/);
  });

  it("illegal transitions are refused (skip QC, un-verify)", async () => {
    const id = await newOrder();
    await expect(db.query(`update cutting_orders set status='VERIFIED' where id=$1`, [id])).rejects.toThrow(/Illegal status transition/);
  });

  it("rejection requires a note (CHECK constraint)", async () => {
    const id = await newOrder();
    await pendingItems(id);
    await expect(
      db.query(`select finalize_verification($1, $2, 'REJECTED', '  ', 0, '[]'::jsonb)`, [id, V]),
    ).rejects.toThrow(/rejection_needs_note/);
  });

  it("approved audit data and logs are immutable", async () => {
    const id = await newOrder();
    const items = await pendingItems(id);
    await approve(id, items.map((x) => ({ item_id: x.id, actual_qty: x.expected_qty, status: "GREEN" })));
    const [o] = await rows<{ status: string; verified_by: string }>(`select status, verified_by from cutting_orders where id=$1`, [id]);
    expect(o).toEqual({ status: "VERIFIED", verified_by: V });

    await expect(approve(id, [])).rejects.toThrow(/ORDER_NOT_PENDING/);
    await expect(db.query(`update cutting_orders set wastage_pct = 0 where id=$1`, [id])).rejects.toThrow(/immutable/);
    await expect(db.query(`update cutting_orders set status='REJECTED' where id=$1`, [id])).rejects.toThrow(/Illegal/);
    await expect(db.query(`update verification_logs set decision='REJECTED' where order_id=$1`, [id])).rejects.toThrow(/append-only/);
    await expect(db.query(`delete from verification_logs where order_id=$1`, [id])).rejects.toThrow(/append-only/);
  });

  it("Required test 5 (SQL): sewing query + RLS never return unapproved orders", async () => {
    const queue = await rows<{ status: string }>(`select status from cutting_orders where status = 'VERIFIED'`);
    expect(queue.length).toBeGreaterThan(0);
    expect(queue.every((r) => r.status === "VERIFIED")).toBe(true);

    // as an authenticated sewing supervisor hitting Supabase REST directly
    await db.exec(`set request.jwt.sub = '${W}'; set role authenticated;`);
    try {
      const visible = await rows<{ status: string }>(`select status from cutting_orders`);
      expect(visible.length).toBeGreaterThan(0);
      expect(visible.every((r) => ["VERIFIED", "SEWING_IN_PROGRESS"].includes(r.status))).toBe(true);
      await expect(approve(crypto.randomUUID(), [])).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec(`reset role;`);
    }
  });
});
