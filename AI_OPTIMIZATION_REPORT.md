# AI Optimization Report

## 1. Tools & Prompting
AI assistance was used for project scaffolding, architecture planning, UI ideas, database schema drafting, validation logic, and test planning.

## 2. Flawed / Broken AI Code
During development, generated code must be reviewed for:
- Client-only RBAC that could be bypassed through direct API requests.
- Approval logic that trusts a client-supplied status rather than rechecking database state.
- Numeric input coercion that accepts decimals, negatives, or empty values.
- Low-contrast form controls.

## 3. Human Refactoring
The final implementation should be manually reviewed and hardened so authorization and gatekeeper rules are enforced on the server. UI disabled states are treated only as usability features, not security boundaries.

## 4. Defensive Architecture
Approval must verify the authenticated server-side role and reload all verification items from persistent storage. Any RED, missing, or uncounted component must reject approval. Sewing Queue queries must filter for VERIFIED orders at the database query level.
