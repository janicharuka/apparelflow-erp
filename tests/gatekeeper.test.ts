import { beforeEach, describe, expect, it } from "vitest";
import { HttpError } from "@/lib/errors";
import {
  approveOrder,
  createOrder,
  getOrder,
  getSewingQueue,
  listOrders,
  recutOrder,
  rejectOrder,
  startSewing,
  submitForVerification,
} from "@/lib/services";
import { FakeRepo, users } from "./fake-repo";

let repo: FakeRepo;

/** Creates a 50-unit Casual Blouse order and submits it to QC. */
async function pendingOrder() {
  const { id } = await createOrder(users.supervisor, repo, {
    recipe_id: repo.recipes[0].id,
    target_qty: "50",
    fabric_roll_id: "FAB-ROLL-882",
    actual_fabric_yds: "92.5",
  });
  await submitForVerification(users.supervisor, repo, id);
  return (await repo.getOrder(id))!;
}

const exactCounts = (o: Awaited<ReturnType<typeof pendingOrder>>) =>
  o.items.map((i) => ({ item_id: i.id, actual_qty: i.expected_qty }));

async function expectHttp(p: Promise<unknown>, status: number) {
  const err = await p.then(() => null, (e) => e);
  expect(err, `expected HttpError ${status}`).toBeInstanceOf(HttpError);
  expect((err as HttpError).status).toBe(status);
  return err as HttpError;
}

beforeEach(() => {
  repo = new FakeRepo();
});

describe("Required test 1 — all GREEN can be approved by an authenticated Verifier", () => {
  it("approves, moves to VERIFIED and writes verifier attribution + wastage", async () => {
    const o = await pendingOrder();
    const res = await approveOrder(users.verifier, repo, o.id, { counts: exactCounts(o) });

    expect(res.status).toBe("VERIFIED");
    const after = (await repo.getOrder(o.id))!;
    expect(after.status).toBe("VERIFIED");
    expect(after.items.every((i) => i.status === "GREEN")).toBe(true);
    expect(after.verified_at).not.toBeNull();
    // 50 × 1.8 = 90 expected yds; 92.5 used → +2.78 %
    expect(after.wastage_pct).toBe(2.78);
    expect(after.logs).toHaveLength(1);
    expect(after.logs[0].decision).toBe("APPROVED");
    // verifier id comes from the session context, not the body
    expect((repo.orders.get(o.id) as unknown as { verifier_id: string }).verifier_id).toBe(users.verifier.userId);
  });

  it("YELLOW (excess) components may still proceed", async () => {
    const o = await pendingOrder();
    const counts = exactCounts(o).map((c, i) => (i === 0 ? { ...c, actual_qty: c.actual_qty + 3 } : c));
    await approveOrder(users.verifier, repo, o.id, { counts });
    const after = (await repo.getOrder(o.id))!;
    expect(after.status).toBe("VERIFIED");
    expect(after.items[0].status).toBe("YELLOW");
  });

  it("ignores a spoofed verifier_id in the request body", async () => {
    const o = await pendingOrder();
    await approveOrder(users.verifier, repo, o.id, { counts: exactCounts(o), verifier_id: users.supervisor.userId });
    expect((repo.orders.get(o.id) as unknown as { verifier_id: string }).verifier_id).toBe(users.verifier.userId);
  });
});

describe("Required test 2 — one RED (shortage) component blocks approval", () => {
  it("returns 422 and the order stays PENDING_VERIFICATION", async () => {
    const o = await pendingOrder();
    const counts = exactCounts(o).map((c) =>
      c.item_id === o.items[4].id ? { ...c, actual_qty: c.actual_qty - 1 } : c, // 99 of 100 cuffs
    );
    const err = await expectHttp(approveOrder(users.verifier, repo, o.id, { counts }), 422);
    expect(err.message).toMatch(/HARD STOP/);
    expect(err.details?.shortages).toEqual([{ component: "Sleeve Cuffs", expected: 100, actual: 99 }]);

    const after = (await repo.getOrder(o.id))!;
    expect(after.status).toBe("PENDING_VERIFICATION");
    expect(after.logs).toHaveLength(0);
    expect(await getSewingQueue(users.sewing, repo)).toHaveLength(0);
  });

  it("returns 422 when any component is missing / uncounted", async () => {
    const o = await pendingOrder();
    await expectHttp(approveOrder(users.verifier, repo, o.id, { counts: exactCounts(o).slice(1) }), 422);
  });

  it("returns 422 for negative, decimal, non-numeric and empty counts", async () => {
    const o = await pendingOrder();
    for (const bad of [-1, 2.5, "abc", "", "1e3", null]) {
      const counts = exactCounts(o).map((c, i) => (i === 0 ? { ...c, actual_qty: bad } : c));
      await expectHttp(approveOrder(users.verifier, repo, o.id, { counts }), 422);
    }
    await expectHttp(approveOrder(users.verifier, repo, o.id, {}), 422);
  });

  it("rejects counts for components that do not belong to the order", async () => {
    const o = await pendingOrder();
    const counts = [...exactCounts(o), { item_id: crypto.randomUUID(), actual_qty: 1 }];
    await expectHttp(approveOrder(users.verifier, repo, o.id, { counts }), 422);
  });
});

describe("Required test 3 — rejecting without a reason note fails validation", () => {
  it.each([undefined, "", "   ", "bad"])("note = %j → 422", async (note) => {
    const o = await pendingOrder();
    await expectHttp(rejectOrder(users.verifier, repo, o.id, { note }), 422);
    expect((await repo.getOrder(o.id))!.status).toBe("PENDING_VERIFICATION");
  });

  it("rejection with a valid note moves the order to REJECTED and supervisor can re-cut", async () => {
    const o = await pendingOrder();
    await rejectOrder(users.verifier, repo, o.id, { note: "Sleeve cuffs short by 4 pcs" });
    expect((await repo.getOrder(o.id))!.status).toBe("REJECTED");

    await recutOrder(users.supervisor, repo, o.id, { actual_fabric_yds: "91" });
    const after = (await repo.getOrder(o.id))!;
    expect(after.status).toBe("CUTTING_IN_PROGRESS");
    expect(after.items.every((i) => i.actual_qty === null)).toBe(true);
  });
});

describe("Required test 4 — non-verifier roles get 403 on approval", () => {
  it.each(["supervisor", "sewing"] as const)("%s → 403", async (who) => {
    const o = await pendingOrder();
    await expectHttp(approveOrder(users[who], repo, o.id, { counts: exactCounts(o) }), 403);
    await expectHttp(rejectOrder(users[who], repo, o.id, { note: "trying to bypass" }), 403);
    expect((await repo.getOrder(o.id))!.status).toBe("PENDING_VERIFICATION");
  });

  it("separation of duties: verifier cannot create orders; supervisor & verifier cannot see sewing queue", async () => {
    await expectHttp(
      createOrder(users.verifier, repo, { recipe_id: repo.recipes[0].id, target_qty: 5, fabric_roll_id: "FAB-1", actual_fabric_yds: 9 }),
      403,
    );
    await expectHttp(getSewingQueue(users.supervisor, repo), 403);
    await expectHttp(getSewingQueue(users.verifier, repo), 403);
  });
});

describe("Required test 5 — unapproved orders never appear in the Sewing Queue", () => {
  it("only VERIFIED orders are returned, across every other state", async () => {
    // one order in every state
    const inProgress = await createOrder(users.supervisor, repo, {
      recipe_id: repo.recipes[0].id, target_qty: 10, fabric_roll_id: "FAB-A", actual_fabric_yds: 18,
    });
    const pending = await pendingOrder();
    const rejected = await pendingOrder();
    await rejectOrder(users.verifier, repo, rejected.id, { note: "Fabric defect on back panel" });
    const verified = await pendingOrder();
    await approveOrder(users.verifier, repo, verified.id, { counts: exactCounts(verified) });

    const queue = await getSewingQueue(users.sewing, repo);
    expect(queue.map((o) => o.id)).toEqual([verified.id]);
    expect(queue.every((o) => o.status === "VERIFIED")).toBe(true);

    // detail endpoint must not leak unapproved orders to sewing either (404, not 403)
    for (const id of [inProgress.id, pending.id, rejected.id]) {
      await expectHttp(getOrder(users.sewing, repo, id), 404);
    }
    const sewingList = await listOrders(users.sewing, repo);
    expect(sewingList.map((o) => o.id)).toEqual([verified.id]);
  });

  it("start sewing moves VERIFIED → SEWING_IN_PROGRESS and only from VERIFIED", async () => {
    const o = await pendingOrder();
    await expectHttp(startSewing(users.sewing, repo, o.id), 404); // not visible yet
    await approveOrder(users.verifier, repo, o.id, { counts: exactCounts(o) });
    await startSewing(users.sewing, repo, o.id);
    expect((await repo.getOrder(o.id))!.status).toBe("SEWING_IN_PROGRESS");
    expect(await getSewingQueue(users.sewing, repo)).toHaveLength(0);
  });
});

describe("State machine & tamper protection", () => {
  it("cannot approve an order that is not PENDING_VERIFICATION (409)", async () => {
    const { id } = await createOrder(users.supervisor, repo, {
      recipe_id: repo.recipes[0].id, target_qty: 10, fabric_roll_id: "FAB-A", actual_fabric_yds: 18,
    });
    const o = (await repo.getOrder(id))!;
    await expectHttp(approveOrder(users.verifier, repo, id, { counts: exactCounts(o) }), 404); // verifier can't even see it
    await submitForVerification(users.supervisor, repo, id);
    await approveOrder(users.verifier, repo, id, { counts: exactCounts(o) });
    await expectHttp(approveOrder(users.verifier, repo, id, { counts: exactCounts(o) }), 409); // double approval
  });

  it("order creation validates inputs strictly", async () => {
    const base = { recipe_id: repo.recipes[0].id, target_qty: 50, fabric_roll_id: "FAB-ROLL-882", actual_fabric_yds: 90 };
    for (const patch of [{ target_qty: -5 }, { target_qty: 2.5 }, { target_qty: "ten" }, { target_qty: "" }, { actual_fabric_yds: 0 },
      { actual_fabric_yds: -3 }, { fabric_roll_id: "" }, { recipe_id: "not-a-uuid" }]) {
      await expectHttp(createOrder(users.supervisor, repo, { ...base, ...patch }), 422);
    }
    await expectHttp(createOrder(users.supervisor, repo, null), 422);
  });

  it("multiplier engine derives expected counts from the recipe (client cannot supply them)", async () => {
    const { id } = await createOrder(users.supervisor, repo, {
      recipe_id: repo.recipes[0].id, target_qty: 50, fabric_roll_id: "FAB-ROLL-882", actual_fabric_yds: 90,
      items: [{ expected_qty: 1 }], // ignored
    });
    const o = (await repo.getOrder(id))!;
    expect(o.items.map((i) => [i.component_name, i.expected_qty])).toEqual([
      ["Front Body Panel", 50], ["Back Body Panel", 50], ["Sleeves (Left & Right)", 100], ["Collar & Stand", 50], ["Sleeve Cuffs", 100],
    ]);
  });
});
