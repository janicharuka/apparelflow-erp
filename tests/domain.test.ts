import { describe, expect, it } from "vitest";
import { canTransition, checkApprovable, expectedQty, itemStatus, wastagePct } from "@/lib/domain";
import { validateCount } from "@/lib/validation";

describe("traffic light", () => {
  it("GREEN / YELLOW / RED / uncounted", () => {
    expect(itemStatus(100, 100)).toBe("GREEN");
    expect(itemStatus(100, 101)).toBe("YELLOW");
    expect(itemStatus(100, 99)).toBe("RED");
    expect(itemStatus(100, 0)).toBe("RED");
    expect(itemStatus(100, null)).toBeNull();
    expect(itemStatus(100, 99.5)).toBeNull();
  });

  it("gatekeeper requires every item counted and none short", () => {
    expect(checkApprovable([{ expected_qty: 5, actual_qty: 5 }, { expected_qty: 5, actual_qty: 6 }]).ok).toBe(true);
    expect(checkApprovable([{ expected_qty: 5, actual_qty: 4 }]).ok).toBe(false);
    expect(checkApprovable([{ expected_qty: 5, actual_qty: null }]).ok).toBe(false);
    expect(checkApprovable([]).ok).toBe(false);
  });
});

describe("multiplier & wastage", () => {
  it("50 garments × 2 cuffs = 100", () => expect(expectedQty(50, 2)).toBe(100));
  it("wastage formula", () => {
    expect(wastagePct(92.5, 50, 1.8)).toBe(2.78);
    expect(wastagePct(90, 50, 1.8)).toBe(0);
    expect(wastagePct(88, 50, 1.8)).toBe(-2.22);
  });
});

describe("state machine", () => {
  it("allows only the documented pipeline", () => {
    expect(canTransition("CUTTING_IN_PROGRESS", "PENDING_VERIFICATION")).toBe(true);
    expect(canTransition("PENDING_VERIFICATION", "VERIFIED")).toBe(true);
    expect(canTransition("PENDING_VERIFICATION", "REJECTED")).toBe(true);
    expect(canTransition("REJECTED", "CUTTING_IN_PROGRESS")).toBe(true);
    expect(canTransition("VERIFIED", "SEWING_IN_PROGRESS")).toBe(true);
    expect(canTransition("CUTTING_IN_PROGRESS", "VERIFIED")).toBe(false);
    expect(canTransition("REJECTED", "VERIFIED")).toBe(false);
    expect(canTransition("REJECTED", "SEWING_IN_PROGRESS")).toBe(false);
    expect(canTransition("VERIFIED", "REJECTED")).toBe(false);
  });
});

describe("client count guard", () => {
  it.each([["", "Required"], ["-1", "Whole numbers only"], ["2.5", "Whole numbers only"], ["abc", "Whole numbers only"], ["12", null]])(
    "%j → %j",
    (raw, expected) => expect(validateCount(raw)).toBe(expected),
  );
});
