import type { Role } from "./domain";

/** Public demo credentials (shown on the login page for evaluators). Keep in sync with scripts/seed-users.mjs. */
export const DEMO_PASSWORD = "Demo@12345";

export const DEMO_ACCOUNTS: { role: Role; email: string; name: string }[] = [
  { role: "cutting_supervisor", email: "supervisor@apparelflow.demo", name: "Nimal Perera" },
  { role: "cutting_verifier", email: "verifier@apparelflow.demo", name: "Kumari Silva" },
  { role: "sewing_supervisor", email: "sewing@apparelflow.demo", name: "Ruwan Fernando" },
];
