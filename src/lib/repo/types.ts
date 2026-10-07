import type { ItemStatus, OrderStatus, Role } from "@/lib/domain";

export interface AuthContext {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
}

export interface RecipeComponent {
  id: string;
  component_name: string;
  pieces_per_garment: number;
  image_url: string | null;
  sort_order: number;
}

export interface Recipe {
  id: string;
  recipe_code: string;
  name: string;
  category: string;
  std_fabric_yards: number;
  wastage_cap: number;
  components: RecipeComponent[];
}

export interface OrderSummary {
  id: string;
  order_no: string;
  status: OrderStatus;
  target_qty: number;
  fabric_roll_id: string;
  actual_fabric_yds: number;
  wastage_pct: number | null;
  recipe_code: string;
  recipe_name: string;
  created_at: string;
  updated_at: string;
  verified_at: string | null;
  verifier_name: string | null;
  last_rejection_note: string | null;
}

export interface OrderItem {
  id: string;
  component_id: string;
  component_name: string;
  pieces_per_garment: number;
  sort_order: number;
  expected_qty: number;
  actual_qty: number | null;
  status: ItemStatus | null;
}

export interface VerificationLog {
  id: string;
  decision: "APPROVED" | "REJECTED";
  rejection_note: string | null;
  wastage_pct: number | null;
  verifier_name: string | null;
  created_at: string;
}

export interface OrderDetail extends OrderSummary {
  recipe: Omit<Recipe, "components">;
  created_by_name: string | null;
  sewing_started_at: string | null;
  items: OrderItem[];
  logs: VerificationLog[];
}

export interface NewOrder {
  recipe_id: string;
  target_qty: number;
  fabric_roll_id: string;
  actual_fabric_yds: number;
  created_by: string;
  items: { component_id: string; expected_qty: number }[];
}

export interface FinalizeParams {
  orderId: string;
  verifierId: string;
  decision: "APPROVED" | "REJECTED";
  note: string | null;
  wastagePct: number | null;
  items: { item_id: string; actual_qty: number; status: ItemStatus }[];
}

/**
 * Persistence port. The Supabase adapter is used in production;
 * an in-memory adapter with identical semantics is used by the test suite.
 */
export interface Repository {
  getUserProfile(userId: string): Promise<Omit<AuthContext, "userId"> | null>;
  listRecipes(): Promise<Recipe[]>;
  getRecipe(id: string): Promise<Recipe | null>;
  createOrder(input: NewOrder): Promise<{ id: string; order_no: string }>;
  listOrdersByStatus(statuses: readonly OrderStatus[]): Promise<OrderSummary[]>;
  /** MUST filter `status = 'VERIFIED'` in the database query itself. */
  listSewingQueue(): Promise<OrderSummary[]>;
  getOrder(id: string): Promise<OrderDetail | null>;
  /** Compare-and-set: only updates when current status === from. Returns false if it lost the race. */
  transitionOrder(
    id: string,
    from: OrderStatus,
    to: OrderStatus,
    patch?: Partial<{ actual_fabric_yds: number; fabric_roll_id: string; sewing_started_by: string; sewing_started_at: string }>,
  ): Promise<boolean>;
  resetItemCounts(orderId: string): Promise<void>;
  /** Atomic: write counts, append audit log, move order to VERIFIED/REJECTED. */
  finalizeVerification(p: FinalizeParams): Promise<void>;
}
