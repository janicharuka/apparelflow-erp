# Step-by-Step Guide: ApparelFlow ERP Assessment (Next.js + Supabase)

This project is already built and tested (39 passing tests, clean production build). Your job is to **understand it, run it, deploy it, and submit it with an honest commit history and AI report**. Read the code as you go. Evaluators will ask about it.

> This file is for you. Delete it (or move it out of the repo) before you submit.

---

## 0. Prerequisites (≈15 min)

| Need | How |
|---|---|
| Node.js **22 LTS** (20.6+ minimum) | https://nodejs.org → check with `node -v` |
| Git | https://git-scm.com → `git --version` |
| VS Code | Recommended editor |
| GitHub account | https://github.com |
| Supabase account | https://supabase.com (free tier is enough) |
| Vercel account | https://vercel.com (sign in with GitHub) |

---

## DAY 1: Architecture, Database & Repo

### Step 1: Unzip the project and install

```bash
cd apparelflow-erp
npm install
npm test          # should print: Tests 39 passed
```

`npm test` needs no database: it uses an in-memory repository and an in-process Postgres (PGlite).

### Step 2: Create the Supabase project

1. Go to https://supabase.com/dashboard → **New project**.
2. Name: `apparelflow-erp`. Generate a strong DB password and save it. Region: **Singapore** (closest to Sri Lanka).
3. Wait about 2 minutes for it to provision.

### Step 3: Run the schema and seed

1. Supabase Dashboard → **SQL Editor** → **New query**.
2. Open `supabase/migrations/0001_schema.sql`, copy **all** of it, paste it in, and click **Run**. You should see "Success. No rows returned".
3. New query → paste all of `supabase/seed.sql` → **Run**.
4. Check: **Table Editor** → `recipes` should have 2 rows, and `recipe_components` should have 10.

### Step 4: Environment variables

1. Dashboard → **Project Settings → API Keys** (older UI: **Settings → API**).
2. Copy `.env.example` to `.env.local` (Windows PowerShell: `copy .env.example .env.local`).
3. Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co         # Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... or sb_publishable_... # anon / publishable key
SUPABASE_SERVICE_ROLE_KEY=eyJ... or sb_secret_...          # service_role / secret key
```

⚠️ The service-role key bypasses RLS. Never commit it, never prefix it with `NEXT_PUBLIC_`, and never paste it into frontend code. `.env.local` is already in `.gitignore`.

### Step 5: Create the demo users

```bash
npm run seed:users
```

Expected output: 3 users created, each with a role. Check in Dashboard → **Authentication → Users** and in **Table Editor → users**.

### Step 6: Run it locally

```bash
npm run dev
```

Open http://localhost:3000. Click **Sign in as Nimal** (Cutting Supervisor) and you should land on `/supervisor`.

### Step 7: Create the GitHub repo and make the first commits

The assessment checks for **atomic commit history**, so commit in logical pieces rather than as one giant commit:

```bash
git init
git branch -M main

git add package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs vitest.config.ts .gitignore .env.example
git commit -m "chore: scaffold Next.js 16 + TypeScript + Tailwind + Vitest"

git add supabase/
git commit -m "feat(db): relational schema, state-machine triggers, audit immutability, RLS, seed recipes"

git add scripts/ src/lib/supabase/ src/lib/demo.ts
git commit -m "feat(auth): Supabase clients and demo user seeding script"
```

On GitHub: **New repository** → name `apparelflow-erp` → **Public** → do NOT add a README → Create. Then:

```bash
git remote add origin https://github.com/<your-username>/apparelflow-erp.git
git push -u origin main
```

### Step 8: Deploy the skeleton to Vercel

1. https://vercel.com/new → **Import** your GitHub repo.
2. Framework preset: **Next.js** (auto-detected).
3. **Environment Variables**: add the same 3 variables from `.env.local`.
4. **Deploy**. Every `git push` will redeploy automatically from now on.
5. Supabase → **Authentication → URL Configuration** → set **Site URL** to your Vercel URL.

> Pushing only the Day-1 commits will fail to build because the app code isn't committed yet. That's expected. Deploy after Day 2's commits, or push everything once and keep the commits separate.

---

## DAY 2: Supervisor & Order Engine

### Read and understand these files

| File | What to understand |
|---|---|
| `src/lib/domain.ts` | Roles, statuses, `canTransition()`, `expectedQty()` (multiplier), `itemStatus()` (traffic light), `checkApprovable()` (hard stop), `wastagePct()` |
| `src/lib/validation.ts` | `strictInt()` rejects `-1`, `2.5`, `"abc"`, `""`, `"1e3"`. Why `Number("")` is dangerous (it's `0`). |
| `src/lib/auth.ts` | Identity comes from a **verified** JWT (cookie or Bearer); role comes from the `users` table |
| `src/lib/http.ts` | `handle()` wrapper: auth → run → map `HttpError` to status code |
| `src/proxy.ts` | Next 16's replacement for `middleware.ts`. Refreshes the session; UX redirect only |
| `src/app/login/*`, `src/components/RoleSwitcher.tsx` | Demo panel + role switcher (real sign-in, not a fake flag) |
| `src/app/(app)/supervisor/*` | Create-order form with live multiplier preview, submit/re-cut actions |

### Try it

1. Sign in as the Supervisor. Pick **REC-BL01**, set qty `50`, roll `FAB-ROLL-882`, fabric `92.5`.
2. Watch the multiplier table: Sleeve Cuffs `50 × 2 = 100`.
3. Type `-5`, `2.5`, `abc` in the quantity field. You should see an inline red error each time.
4. Create the order → **Submit to QC**.

### Commit

```bash
git add src/lib/domain.ts src/lib/validation.ts src/lib/errors.ts
git commit -m "feat(domain): traffic-light rules, multiplier engine, wastage formula, strict input validation"

git add src/lib/repo/ src/lib/services.ts src/lib/auth.ts src/lib/http.ts src/proxy.ts
git commit -m "feat(api): service layer with server-side RBAC and repository pattern"

git add src/app/layout.tsx src/app/page.tsx src/app/globals.css src/app/not-found.tsx src/app/login src/app/\(app\)/layout.tsx src/components src/lib/api-client.ts
git commit -m "feat(ui): login, demo credential panel, role switcher, high-contrast form styles"

git add "src/app/api/me" "src/app/api/recipes" "src/app/api/orders/route.ts" "src/app/api/orders/[id]/route.ts" "src/app/api/orders/[id]/submit" "src/app/api/orders/[id]/recut" "src/app/(app)/supervisor" "src/app/(app)/orders"
git commit -m "feat(supervisor): order creation with live component multiplier and submit-to-QC"
git push
```

---

## DAY 3: Verifier Terminal & Server Hard Stop

### Read and understand

| File | Key idea |
|---|---|
| `src/lib/services.ts` → `approveOrder()` | 403 if not a verifier → 422 bad input → 409 wrong state → every item must be counted → recompute lights from **DB** expected values → any RED gives **422** → atomic finalize |
| `src/lib/services.ts` → `rejectOrder()` | Note must be ≥5 chars, else 422 |
| `supabase/migrations/0001_schema.sql` | Trigger `enforce_order_state_machine` (3rd layer of the hard stop), `finalize_verification` (atomic + `FOR UPDATE` lock), append-only logs |
| `src/app/(app)/verifier/[id]/VerificationTerminal.tsx` | Live traffic lights; Approve is `disabled` on RED (UI convenience only) |

### Try it

1. Switch role → **Cutting Verifier** → open the order.
2. Enter exact counts for everything **except** Sleeve Cuffs = `99`. You should see RED, the HARD STOP banner, and a disabled **Approve Batch** button.
3. Prove the backend blocks it too (see Step 10 below for cURL).
4. Click **Reject Batch** → try empty note (error) → enter a reason → confirm.
5. Switch to Supervisor → see the reason → **Re-cut batch** → **Submit to QC** again.
6. Verifier: enter exact counts (all GREEN) → **Approve Batch**.

### Commit

```bash
git add "src/app/api/orders/[id]/approve" "src/app/api/orders/[id]/reject" "src/app/(app)/verifier"
git commit -m "feat(verifier): traffic-light terminal, server-enforced hard stop (422), mandatory rejection note"
git push
```

---

## DAY 4: Sewing Queue, Tests & AI Report

### Read and understand

- `src/lib/repo/supabase-repo.ts` → `listSewingQueue()` uses `.eq("status", "VERIFIED")`. The filter is in the SQL, not in JavaScript.
- `getOrder()` returns **404** (not 403) to sewing for unverified orders, so it doesn't leak that they exist.
- RLS policy `orders_read` means even the public anon key can't read pending orders as a sewing user.

### Commit the sewing screens and tests

```bash
git add src/app/api/sewing "src/app/(app)/sewing"
git commit -m "feat(sewing): verified-only sewing queue with verifier attribution and start-assembly"

git add tests/
git commit -m "test: required gatekeeper rules, DB guard tests on real migration (PGlite), query isolation"
```

### Step 9: Run the test suite

```bash
npm test
```

| Required test | Where |
|---|---|
| 1. All GREEN approved by verifier | `tests/gatekeeper.test.ts` → "Required test 1" |
| 2. RED blocks approval with error | "Required test 2" (+ DB version in `db-guards.test.ts`) |
| 3. Reject without note fails | "Required test 3" |
| 4. Non-verifier gets 403 | "Required test 4" |
| 5. Unapproved never in sewing queue | "Required test 5" + `sewing-query.test.ts` + DB/RLS test |

### Step 10: Attack your own API (do this, and screenshot it for your report)

Get tokens (use Git Bash on Windows, or Postman):

```bash
SUPABASE_URL=https://xxxx.supabase.co
ANON=your-anon-key
APP=https://your-app.vercel.app

token() { curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" -H "apikey: $ANON" \
  -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"Demo@12345\"}" | sed -E 's/.*"access_token":"([^"]+)".*/\1/'; }
SUP=$(token supervisor@apparelflow.demo)
VER=$(token verifier@apparelflow.demo)
SEW=$(token sewing@apparelflow.demo)
```

Create a pending order in the UI, then get its item IDs:

```bash
curl -s $APP/api/orders/<ORDER_ID> -H "Authorization: Bearer $VER"
```

| Attack | Command | Expected |
|---|---|---|
| Supervisor approves | `curl -i -X POST $APP/api/orders/<ID>/approve -H "Authorization: Bearer $SUP" -H "Content-Type: application/json" -d '{"counts":[]}'` | **403** |
| Shortage approval | same URL with `$VER` and one `actual_qty` below expected | **422** + `shortages` |
| Missing component | send only 4 of 5 counts | **422** |
| Negative / decimal | `"actual_qty": -1` or `2.5` | **422** |
| Reject without note | `POST .../reject -d '{}'` with `$VER` | **422** |
| Sewing reads pending order | `curl -i $APP/api/orders/<PENDING_ID> -H "Authorization: Bearer $SEW"` | **404** |
| Queue param tampering | `curl $APP/api/sewing/queue?status=PENDING_VERIFICATION -H "Authorization: Bearer $SEW"` | Only VERIFIED |
| Verifier opens sewing queue | `curl -i $APP/api/sewing/queue -H "Authorization: Bearer $VER"` | **403** |
| No token | `curl -i $APP/api/orders` | **401** |

### Step 11: Contrast audit

- Click every input, dropdown and the role switcher. Text should always be dark on white.
- Turn your OS to **dark mode** and reload. Inputs must stay legible (the app forces `color-scheme: light`).
- Chrome DevTools → **Lighthouse → Accessibility**. Aim for 95+.
- Try the app at phone width (DevTools device toolbar). Tables scroll horizontally instead of breaking.

### Step 12: Finish the AI report and README

1. **Rewrite `AI_OPTIMIZATION_REPORT.md` in your own words.** Keep only what's true. Add at least one issue **you** found while reviewing or deploying (e.g. something that broke on Vercel, a UX bug you noticed, a test you added).
2. In `README.md`, replace `https://<your-app>.vercel.app` with your live URL.
3. Move this guide out of the project folder. None of the commit steps above include it, so it was never committed.

```bash
git add README.md AI_OPTIMIZATION_REPORT.md
git commit -m "docs: README with architecture, schema, demo credentials; AI optimization report"
git push
```

---

## Step 13: Final pre-submission checklist (the evaluator's 5-minute audit)

On the **live Vercel URL**, in a private/incognito window:

- [ ] Login page shows the demo credentials for all 3 roles
- [ ] **Contrast:** every input and dropdown shows dark text on light background
- [ ] **RBAC:** as Verifier, there is no "Create order" form anywhere
- [ ] **RBAC:** as Sewing, pending and rejected batches are invisible
- [ ] **Hard stop:** as Verifier, a shortage disables **Approve Batch**, and cURL gets 422
- [ ] **Handoff:** approve an all-GREEN batch → it appears in the Sewing Queue with verifier name, time and wastage %
- [ ] **Persistence:** refresh the browser and everything is still there
- [ ] `npm test` passes on a fresh clone (`git clone … && npm install && npm test`)
- [ ] GitHub repo is **public**, has 8+ meaningful commits, and has no `.env.local` committed
- [ ] `AI_OPTIMIZATION_REPORT.md` is in the repo root and written by you

## Submission

Send to Webtezza:

1. Live URL: `https://….vercel.app`
2. GitHub repo URL
3. (Optional) a 2-minute screen recording of the 5-minute audit flow

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm run seed:users` → "Missing NEXT_PUBLIC_SUPABASE_URL" | `.env.local` must be in the project root; Node must be ≥ 20.6 |
| Login works but "no ERP role assigned" | Run `npm run seed:users` again (it upserts profiles) |
| `relation "public.users" does not exist` | You skipped Step 3; run the migration first |
| `permission denied for function finalize_verification` from the app | `SUPABASE_SERVICE_ROLE_KEY` is wrong (you probably pasted the anon key) |
| Vercel build fails: "Missing NEXT_PUBLIC_SUPABASE_URL" | Add all 3 env vars in Vercel → Settings → Environment Variables, then **Redeploy** |
| Works locally, 401 on Vercel | Check that the Supabase Site URL and the env vars on Vercel match the same project |
| Re-running the migration errors on `create trigger` | Already handled with `drop trigger if exists`. If types conflict, reset the project's DB and run again |

## Questions an interviewer may ask (prepare answers)

1. *Why enforce the hard stop in three places?* Because the UI can be bypassed and the API code can have bugs. The DB trigger is the last line of defence, and the service layer gives clean 422 errors.
2. *Why the service-role key on the server instead of RLS-only writes?* So the rules live in one testable TypeScript layer. RLS has no write policies, so the public anon key cannot write anything at all.
3. *How do you prevent two verifiers approving at once?* `SELECT … FOR UPDATE` in `finalize_verification`, plus compare-and-set `WHERE status = …` on transitions. The loser gets 409.
4. *Why does sewing get 404 instead of 403 for a pending order?* So the endpoint doesn't reveal that the order exists.
5. *Why is YELLOW allowed?* Surplus pieces don't stop a garment being assembled. They're recorded as variance for return or as a safety margin.
