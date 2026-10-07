export type ComponentStatus = "GREEN" | "YELLOW" | "RED";
export type OrderStatus = "CUTTING_IN_PROGRESS" | "PENDING_VERIFICATION" | "REJECTED" | "VERIFIED" | "SEWING_IN_PROGRESS" | "COMPLETED";

export type Component = {
  id: string;
  name: string;
  piecesPerGarment: number;
};

export type VerificationItem = {
  componentId: string;
  componentName: string;
  expectedQty: number;
  actualQty: number;
  status: ComponentStatus;
};

export function getComponentStatus(expectedQty: number, actualQty: number): ComponentStatus {
  if (!Number.isInteger(actualQty) || actualQty < 0) throw new Error("Actual quantity must be a non-negative integer.");
  if (actualQty === expectedQty) return "GREEN";
  if (actualQty > expectedQty) return "YELLOW";
  return "RED";
}

export function canApprove(items: VerificationItem[]) {
  return items.length > 0 && items.every((item) => item.status === "GREEN");
}

export function calculateWastage(actualFabric: number, expectedFabric: number) {
  if (expectedFabric <= 0) throw new Error("Expected fabric must be greater than zero.");
  return ((actualFabric - expectedFabric) / expectedFabric) * 100;
}

export function expectedComponentQty(targetQty: number, piecesPerGarment: number) {
  if (!Number.isInteger(targetQty) || targetQty <= 0) throw new Error("Target quantity must be a positive integer.");
  if (!Number.isInteger(piecesPerGarment) || piecesPerGarment <= 0) throw new Error("Pieces per garment must be a positive integer.");
  return targetQty * piecesPerGarment;
}