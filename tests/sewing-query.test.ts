// Required test 5 (database layer): prove the Supabase adapter puts
// `status = 'VERIFIED'` into the actual query sent to Postgres.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const calls: [string, unknown[]][] = [];
function builder(): unknown {
  const b: Record<string, unknown> = {};
  for (const m of ["from", "select", "eq", "in", "order"]) {
    b[m] = (...args: unknown[]) => {
      calls.push([m, args]);
      return b;
    };
  }
  b.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
  return b;
}
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => builder() }));

describe("supabaseRepo.listSewingQueue", () => {
  it("filters WHERE status = 'VERIFIED' in the DB query (not in JS)", async () => {
    const { supabaseRepo } = await import("@/lib/repo/supabase-repo");
    await supabaseRepo.listSewingQueue();
    expect(calls).toContainEqual(["from", ["cutting_orders"]]);
    expect(calls).toContainEqual(["eq", ["status", "VERIFIED"]]);
    expect(calls.filter(([m]) => m === "in")).toHaveLength(0);
  });
});
