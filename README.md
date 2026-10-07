# ApparelFlow ERP — Cutting Operations & Gatekeeper Verification Terminal

A full-stack Next.js + Supabase (PostgreSQL) implementation of the ApparelFlow cutting-room checkpoint: **no unverified, mismatched or short batch can ever enter the Sewing Queue.**

- **Live URL:** `https://<your-app>.vercel.app`  ← replace after deploying
- **Stack:** Next.js 16 (App Router, Route Handlers), TypeScript, Tailwind CSS 4, Supabase (Postgres + Auth), Zod, Vitest, PGlite

## Demo credentials

All accounts use the password **`Demo@12345`**. The login page has a one-click **Demo Credential Panel**, and the header has a **Role Switcher** that performs a real sign-out / sign-in (not a client-side flag).

| Role | Email | Can | Cannot |
|---|---|---|---|
| `cutting_supervisor` | supervisor@apparelflow.demo | Create orders, submit to QC, re-cut rejected batches | Verify batches, see the Sewing Queue |
| `cutting_verifier` | verifier@apparelflow.demo | Count components, approve / reject | Create orders, see the Sewing Queue |
| `sewing_supervisor` | sewing@apparelflow.demo | See VERIFIED batches, start sewing | See pending / rejected / in-progress orders |

## Architecture

```
Browser (React client components)
   │  fetch() with Supabase auth cookie   (or  Authorization: Bearer <JWT> from Postman)
   ▼
Next.js Route Handlers  /api/*            src/app/api/**/route.ts
   │  handle(): verify JWT with Supabase Auth → load role from public.users
   ▼
Service layer (authoritative rules)       src/lib/services.ts
   │  requireRole() → 403 · zod validation → 422 · state machine → 409 · hard stop → 422
   ▼
Repository (Supabase adapter)             src/lib/repo/supabase-repo.ts
   │  service-role client, server only
   ▼
PostgreSQL (Supabase)                     supabase/migrations/0001_schema.sql
      triggers: legal transitions, HARD STOP on VERIFIED, immutable audit, append-only logs
      RPCs: create_cutting_order, finalize_verification (atomic, row-locked)
      RLS: role-scoped SELECT, no write policies (anon key cannot write anything)
```

**Defence in depth.** The UI disables "Approve" when a component is RED, but that is only a convenience. The same rule is enforced again in the service layer (HTTP 422) and a third time by a Postgres trigger, so even a direct SQL `UPDATE` cannot move a short batch to `VERIFIED`.

### State machine

```
CUTTING_IN_PROGRESS ──submit──▶ PENDING_VERIFICATION ──approve (all GREEN/YELLOW)──▶ VERIFIED ──start──▶ SEWING_IN_PROGRESS
        ▲                               │
        └──────re-cut────── REJECTED ◀──┘ reject (mandatory note)
```

Every transition is a compare-and-set (`UPDATE … WHERE status = <expected>`), so two people acting on the same order cannot both succeed.

### Traffic light

| Status | Rule | Effect |
|---|---|---|
| GREEN | actual = expected | OK |
| YELLOW | actual > expected | OK (surplus recorded) |
| RED | actual < expected | Approval blocked (UI disabled + API 422 + DB trigger) |

Expected count = target qty × pieces per garment (computed on the server, re-checked in SQL).
Wastage % = (actual fabric − target qty × std yards) ÷ expected × 100, stored on approval.

## Database schema

| Table | Key columns | Notes |
|---|---|---|
| `users` | id (FK auth.users), email, full_name, role, created_at | Password hash is stored by Supabase Auth in `auth.users.encrypted_password` (bcrypt) |
| `recipes` | id, recipe_code, name, category, std_fabric_yards, wastage_cap | Seeded: REC-BL01, REC-CT02 |
| `recipe_components` | id, recipe_id, component_name, pieces_per_garment, image_url | 5 per recipe |
| `cutting_orders` | id, order_no, recipe_id, target_qty, fabric_roll_id, actual_fabric_yds, status, created_by, verified_by, verified_at, wastage_pct, timestamps | Audit columns frozen once VERIFIED |
| `verification_items` | id, order_id, component_id, expected_qty, actual_qty, status, variance (generated) | One row per component |
| `verification_logs` | id, order_id, verifier_id, decision, rejection_note, wastage_pct, variances (jsonb), created_at | Append-only (UPDATE/DELETE blocked by trigger); CHECK requires a note on rejection |

## API

All endpoints need a session cookie or `Authorization: Bearer <access_token>`.

| Method | Path | Role | Errors |
|---|---|---|---|
| GET | `/api/me` | any | 401 |
| GET | `/api/recipes` | cutting_supervisor | 403 |
| GET | `/api/orders` | any (filtered by role) | 401 |
| POST | `/api/orders` | cutting_supervisor | 403, 422 |
| GET | `/api/orders/:id` | any (404 if not visible to role) | 404 |
| POST | `/api/orders/:id/submit` | cutting_supervisor | 403, 409 |
| POST | `/api/orders/:id/recut` | cutting_supervisor | 403, 409, 422 |
| POST | `/api/orders/:id/approve` | cutting_verifier | 403, 409, **422 hard stop** |
| POST | `/api/orders/:id/reject` | cutting_verifier | 403, 409, 422 (no note) |
| GET | `/api/sewing/queue` | sewing_supervisor | 403 |
| POST | `/api/sewing/:id/start` | sewing_supervisor | 403, 404, 409 |

### Testing with cURL

```bash
# get a token
curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"supervisor@apparelflow.demo","password":"Demo@12345"}' | jq -r .access_token

# supervisor tries to approve → 403
curl -i -X POST https://<app>/api/orders/<ORDER_ID>/approve \
  -H "Authorization: Bearer $SUP_TOKEN" -H "Content-Type: application/json" -d '{"counts":[]}'

# verifier approves with a shortage → 422
curl -i -X POST https://<app>/api/orders/<ORDER_ID>/approve \
  -H "Authorization: Bearer $VER_TOKEN" -H "Content-Type: application/json" \
  -d '{"counts":[{"item_id":"<ITEM_ID>","actual_qty":99}, ...]}'
```

## Running locally

```bash
npm install
cp .env.example .env.local          # fill in Supabase URL + keys
# Supabase SQL editor: run supabase/migrations/0001_schema.sql then supabase/seed.sql
npm run seed:users                  # creates the 3 demo accounts
npm run dev                         # http://localhost:3000
npm test                            # 39 tests
```

## Tests (`npm test`)

| File | What it proves |
|---|---|
| `tests/gatekeeper.test.ts` | The 5 required rules, plus spoofed IDs, invalid input, double approval, re-cut flow |
| `tests/db-guards.test.ts` | Runs the **real migration** in PGlite (in-process Postgres) and attacks it with raw SQL: hard stop, illegal transitions, immutable audit, RLS |
| `tests/sewing-query.test.ts` | The Supabase adapter sends `status = 'VERIFIED'` in the DB query itself |
| `tests/domain.test.ts` | Traffic light, multiplier, wastage formula, state machine |

Required tests map: **1** all-GREEN approval · **2** RED → 422 · **3** reject without note → 422 · **4** non-verifier → 403 · **5** sewing queue isolation.

## UI contrast

The app sets `color-scheme: light` and gives every `input`, `select`, `option`, `textarea` explicit dark text (#0f172a) on white, including focus, disabled, autofill and placeholder states (see `src/app/globals.css`). Status colours are always paired with a text label.
