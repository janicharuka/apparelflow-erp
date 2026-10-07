# AI Optimization Report

> **Before you submit:** this is a starting draft. Rewrite it in your own words. Add anything **you** changed or caught while reviewing and testing the code. Evaluators are looking for honest, specific engineering judgement, so delete anything that isn't true for you.

## 1. Tools & Prompting

| Tool | Used for |
|---|---|
| Claude (Anthropic) | Initial scaffolding of the Next.js + Supabase project, SQL schema/triggers/RPCs, service layer, UI components, test suite, README |
| _(add yours: Cursor / Copilot / ChatGPT…)_ | _(e.g. autocomplete while refactoring, debugging Vercel deploy)_ |

Prompting approach: I gave the AI the full assessment PDF and asked for a production-style implementation. I then reviewed every file, ran the migration against a real Postgres engine, ran the tests and build, and clicked through every role on the deployed app.

## 2. Flawed / Broken AI Code (instances caught)

### 2.1 Migration depended on an unavailable extension
The first schema began with `create extension if not exists "pgcrypto";` for `gen_random_uuid()`. When the migration ran in an in-process Postgres (PGlite) for the DB test suite, it failed with `extension "pgcrypto" is not available`. `gen_random_uuid()` has been built into core Postgres since v13, so the extension was unnecessary and made the migration less portable. **Fix:** I removed it, and `tests/db-guards.test.ts` now runs the real migration on every `npm test`, so a regression like this is caught automatically.

### 2.2 Numeric coercion trap: `Number("") === 0`
The obvious way to parse a count is `Number(input)` or `z.coerce.number().int().min(0)`. That silently turns an **empty** field into `0`, and `"1e3"` into `1000`. For the verification terminal this is dangerous: a blank count becomes 0, which turns into a RED shortage instead of a validation error, and `" 12 "` or `"0x10"` slip through. **Fix:** `strictInt()` in `src/lib/validation.ts` only accepts a JS integer or a string matching `/^\d+$/`. Tests cover `-1`, `2.5`, `"abc"`, `""`, `"1e3"` and `null`.

### 2.3 Client-only gatekeeping
A UI that only disables the "Approve" button when a component is RED looks finished in a demo, but anyone can `POST` to the API with Postman. Trusting `verifier_id` from the request body is the same kind of hole. **Fix:** (a) the service layer recomputes every traffic light from `expected_qty` stored in the DB and returns 422; (b) the verifier ID comes from the verified JWT; (c) a Postgres trigger refuses `status = 'VERIFIED'` while any item is short or uncounted. A test sends a spoofed `verifier_id` and checks that it is ignored.

### 2.4 Tooling version incompatibility
Installing `vitest@4` with npm 10 crashed the dependency resolver (`Cannot read properties of null (reading 'edgesOut')`). **Fix:** pinned `vitest@^3.2`, which installs cleanly and supports everything the suite needs.

_(Add any you found yourself, e.g. a re-render loop, a contrast issue on a specific browser, a Vercel env-var mistake.)_

## 3. Human Refactoring

- **Separated concerns:** pure rules (`domain.ts`) → authoritative services (`services.ts`) → repository interface (`repo/types.ts`) → Supabase adapter. Because of this split the business rules are tested against an in-memory repository without mocking HTTP or Supabase.
- **Atomic writes:** approval writes counts, appends the audit log and changes status in **one** Postgres function (`finalize_verification`) with `SELECT … FOR UPDATE`. Without that, a failure halfway could leave counts saved with no log, or a VERIFIED order with no attribution.
- **Compare-and-set transitions:** `UPDATE … WHERE id = ? AND status = <expected>`, so a stale browser tab can't double-approve. It gets a 409 instead.
- **No existence leaks:** when the sewing role asks for a pending order, it gets **404**, not 403, so it can't confirm the order exists.
- **Contrast:** forced `color-scheme: light` and explicit colours on all form controls, including `<option>`, `:-webkit-autofill`, `:disabled` and placeholders. Checked with the OS in dark mode.

## 4. Defensive Architecture

| Layer | Guard |
|---|---|
| UI | Live traffic lights; Approve disabled on RED/uncounted; inline errors; mandatory note box |
| Proxy | Redirects anonymous users (UX only, not a security boundary) |
| Route handler | Verifies the JWT with Supabase Auth; role loaded from `public.users`; errors mapped to 401/403/404/409/422 |
| Service | `requireRole()`, strict zod schemas, state-machine check, recomputed traffic lights, hard stop |
| Database | Transition trigger + HARD STOP trigger, immutable audit columns, append-only logs, CHECK constraints, RPCs executable only by `service_role`, RLS with no write policies |

Sewing Queue isolation is enforced in the SQL itself (`.eq("status", "VERIFIED")`). The handler ignores query parameters. A unit test asserts that the filter is part of the query, and RLS limits the sewing role to `VERIFIED` / `SEWING_IN_PROGRESS` even when someone calls Supabase REST directly with the public anon key.
