import { z } from "zod";

/**
 * Strict whole-number parser. Rejects: decimals ("2.5"), negatives ("-1"),
 * exponent/hex tricks ("1e3", "0x10"), blanks (""), booleans, null.
 * Accepts a JS integer or a string of digits only.
 */
const strictInt = (label: string, min: number, max: number) =>
  z
    .union([z.number(), z.string()], { error: `${label} is required` })
    .transform((v, ctx) => {
      if (typeof v === "string") {
        const t = v.trim();
        if (!/^\d+$/.test(t)) {
          ctx.addIssue({ code: "custom", message: `${label} must be a whole number (no decimals, signs or letters)` });
          return z.NEVER;
        }
        v = Number(t);
      }
      if (!Number.isInteger(v)) {
        ctx.addIssue({ code: "custom", message: `${label} must be a whole number` });
        return z.NEVER;
      }
      if (v < min || v > max) {
        ctx.addIssue({ code: "custom", message: `${label} must be between ${min} and ${max}` });
        return z.NEVER;
      }
      return v;
    });

/** Positive decimal with up to 2 dp (fabric yards are physically fractional). */
const positiveYards = z
  .union([z.number(), z.string()], { error: "Actual fabric used is required" })
  .transform((v, ctx) => {
    const s = typeof v === "number" ? String(v) : v.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(s)) {
      ctx.addIssue({ code: "custom", message: "Fabric yards must be a positive number (max 2 decimals)" });
      return z.NEVER;
    }
    const n = Number(s);
    if (!(n > 0) || n > 1_000_000) {
      ctx.addIssue({ code: "custom", message: "Fabric yards must be greater than 0" });
      return z.NEVER;
    }
    return n;
  });

export const createOrderSchema = z.object({
  recipe_id: z.uuid({ error: "Select a recipe" }),
  target_qty: strictInt("Target batch quantity", 1, 100_000),
  fabric_roll_id: z
    .string({ error: "Fabric roll ID is required" })
    .trim()
    .regex(/^[A-Z0-9][A-Z0-9-]{2,39}$/i, "Fabric roll ID must look like FAB-ROLL-882"),
  actual_fabric_yds: positiveYards,
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const countsSchema = z.object({
  counts: z
    .array(
      z.object({
        item_id: z.uuid(),
        actual_qty: strictInt("Counted quantity", 0, 10_000_000),
      }),
    )
    .min(1, "Counts are required"),
});
export type CountsInput = z.infer<typeof countsSchema>;

export const rejectSchema = countsSchema.partial({ counts: true }).extend({
  note: z
    .string({ error: "A rejection reason is required" })
    .trim()
    .min(5, "Rejection reason must be at least 5 characters")
    .max(1000),
});
export type RejectInput = z.infer<typeof rejectSchema>;

export const recutSchema = z.object({
  actual_fabric_yds: positiveYards.optional(),
  fabric_roll_id: createOrderSchema.shape.fabric_roll_id.optional(),
});

/** Flatten zod issues into { field: message } for inline UI errors. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Reusable client-side helper for a single integer field (same rules as server). */
export function validateCount(raw: string): string | null {
  const t = raw.trim();
  if (t === "") return "Required";
  if (!/^\d+$/.test(t)) return "Whole numbers only";
  return null;
}
