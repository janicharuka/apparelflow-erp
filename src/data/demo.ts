import type { Component, VerificationItem } from "@/lib/domain";

export const recipes = [
  {
    id: "REC-BL01",
    name: "Casual Blouse",
    category: "Blouse",
    stdFabricYards: 1.8,
    wastageCap: 5,
    components: [
      { id: "BL-FRONT", name: "Front Body Panel", piecesPerGarment: 1 },
      { id: "BL-BACK", name: "Back Body Panel", piecesPerGarment: 1 },
      { id: "BL-SLEEVE", name: "Sleeves (Left & Right)", piecesPerGarment: 2 },
      { id: "BL-COLLAR", name: "Collar & Stand", piecesPerGarment: 1 },
      { id: "BL-CUFF", name: "Sleeve Cuffs", piecesPerGarment: 2 }
    ] satisfies Component[]
  },
  {
    id: "REC-CT02",
    name: "Crop Top",
    category: "Crop Top",
    stdFabricYards: 1.1,
    wastageCap: 8,
    components: [
      { id: "CT-FRONT", name: "Front Chest Panel", piecesPerGarment: 1 },
      { id: "CT-BACK", name: "Back Support Panel", piecesPerGarment: 1 },
      { id: "CT-NECK", name: "Neck Binding Strip", piecesPerGarment: 1 },
      { id: "CT-HEM", name: "Hem Elastic Casing", piecesPerGarment: 1 },
      { id: "CT-STRAP", name: "Side Strap Accents", piecesPerGarment: 2 }
    ] satisfies Component[]
  }
];

export const demoOrders = [
  {
    id: "ORD-1001",
    orderNo: "CUT-2026-001",
    recipe: recipes[0],
    targetQty: 50,
    fabricRollId: "FAB-ROLL-882",
    actualFabricYds: 92,
    status: "PENDING_VERIFICATION",
    verifier: null
  },
  {
    id: "ORD-1002",
    orderNo: "CUT-2026-002",
    recipe: recipes[1],
    targetQty: 40,
    fabricRollId: "FAB-ROLL-901",
    actualFabricYds: 44,
    status: "VERIFIED",
    verifier: "Ayesha Perera"
  }
];

export function makeItems(order: typeof demoOrders[number]): VerificationItem[] {
  return order.recipe.components.map((c) => {
    const expectedQty = order.targetQty * c.piecesPerGarment;
    return {
      componentId: c.id,
      componentName: c.name,
      expectedQty,
      actualQty: expectedQty,
      status: "GREEN"
    };
  });
}