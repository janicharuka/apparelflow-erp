import { describe, expect, it } from "vitest";
import { canApprove, calculateWastage, getComponentStatus } from "./domain";

describe("ApparelFlow gatekeeper rules", () => {
  it("marks exact counts GREEN", () => expect(getComponentStatus(100, 100)).toBe("GREEN"));
  it("marks excess counts YELLOW", () => expect(getComponentStatus(100, 101)).toBe("YELLOW"));
  it("marks shortage counts RED", () => expect(getComponentStatus(100, 99)).toBe("RED"));
  it("only approves all-GREEN items", () => {
    expect(canApprove([{componentId:"1",componentName:"Cuff",expectedQty:100,actualQty:100,status:"GREEN"}])).toBe(true);
    expect(canApprove([{componentId:"1",componentName:"Cuff",expectedQty:100,actualQty:99,status:"RED"}])).toBe(false);
  });
  it("calculates fabric wastage", () => expect(calculateWastage(189, 180)).toBe(5));
});