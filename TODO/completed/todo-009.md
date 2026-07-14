---
id: todo-009
title: Sandbox feature [2/7] — guarded reset script (npm run sandbox:reset), seed, isolation test
priority: 1
created: 2026-06-24
status: completed
---

## Overview

Part 2 of the Sandbox series. Builds on **todo-008** (which must be done first). Adds the
developer-facing reset path: a Node script that wipes + reseeds the `sandbox` schema **only**,
fixed-UUID baseline seed data, and an automated test proving `public` is never touched.

**🔒 LOCKED DECISIONS:** decimal money model unchanged; launch-time schema switch unchanged.
The script's ONLY data-clearing call is `sandbox.reset_all()` (created in todo-008), which is
schema-locked. **Never** add a `public` branch or any raw `TRUNCATE/DELETE` against `public`.

**Depends on:** todo-008.

## Completion Test

- [ ] `pg` is a devDependency (`npm i -D pg`).
- [ ] `scripts/sandbox-reset.mjs` exists (ESM) and reads a connection string from
      `SANDBOX_DB_URL` (or `SUPABASE_DB_URL`); errors clearly if unset.
- [ ] Script guards: aborts unless `sandbox.app_meta.schema_marker = 'sandbox'`; wraps work in a
      transaction; calls `sandbox.reset_all()` then replays the seed under `search_path = sandbox`.
- [ ] `package.json` has `"sandbox:reset": "node scripts/sandbox-reset.mjs"`.
- [ ] `supabase/seed/sandbox-seed.sql` exists, idempotent (`ON CONFLICT`), fixed UUIDs, ≥2
      products w/ stock, 1 supplier, ≥1 customer incl. Walk-in, ≥1 confirmed invoice.
- [ ] `.env.sandbox.example` documents `SANDBOX_DB_URL`.
- [ ] `npm run sandbox:reset` runs end-to-end, prints a success summary, and is safe to run twice.
- [ ] `src/sandbox/__tests__/sandbox-isolation.test.ts` exists: snapshots `public` counts, runs
      reset, asserts `public` unchanged; asserts sandbox marker + a seeded sandbox product exist.
      Skips with a printed reason if no DB creds.
- [ ] `npm test` passes (isolation test passes or skips with reason); `npx tsc --noEmit` clean.

---

## Implementation Guide

Direct Postgres connection via `pg` is the most robust path (the JS client can't `TRUNCATE`).
The schema-lock lives in the DB function from todo-008; the script adds a second belt-and-braces
guard (marker check) and a transaction so a failed reseed rolls back. The isolation test is the
proof the whole feature is safe — it must be deterministic and skip gracefully without creds.

## Implementation Steps

1. `npm i -D pg`.
2. Create `scripts/sandbox-reset.mjs`:
   ```js
   import pg from 'pg';
   import { readFileSync } from 'node:fs';
   const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;
   if (!url) { console.error('Set SANDBOX_DB_URL'); process.exit(1); }
   const client = new pg.Client({ connectionString: url });
   await client.connect();
   await client.query('begin');
   try {
     const m = await client.query('select schema_marker from sandbox.app_meta limit 1');
     if (m.rows[0]?.schema_marker !== 'sandbox') throw new Error('Refusing: sandbox marker missing');
     await client.query('select sandbox.reset_all()');
     await client.query('set search_path = sandbox');
     await client.query(readFileSync('supabase/seed/sandbox-seed.sql', 'utf8'));
     await client.query('commit');
     console.log('✓ sandbox reset + reseed complete');
   } catch (e) { await client.query('rollback'); console.error('✗', e.message); process.exitCode = 1; }
   finally { await client.end(); }
   ```
3. Add `"sandbox:reset"` to `package.json` scripts.
4. Create `supabase/seed/sandbox-seed.sql` — curate from root `sandbox-seed.sql`; ensure every
   insert is `ON CONFLICT (...) DO NOTHING/UPDATE`, writes only `sandbox.*` (rely on search_path),
   and uses stable UUIDs so E2E dropdowns are deterministic.
5. Add `SANDBOX_DB_URL=postgresql://...` line to `.env.sandbox.example` with a comment.
6. Create `src/sandbox/__tests__/sandbox-isolation.test.ts`:
   - Guard: if no `SANDBOX_DB_URL` → `it.skip(...)` with reason.
   - Else: `select count(*)` for `public.products`, `public.customers`, `public.invoices`;
     call `sandbox.reset_all()` + replay seed; re-count `public`; `expect` unchanged.
   - Assert `sandbox.app_meta.schema_marker === 'sandbox'` and a seeded sandbox product exists.
   - Mark in catalog (todo-010) as `type:"integration"` under the `sandbox` group.
7. Run the Completion Test. `graphify update .`.

## Files to Modify

- **Create:** `scripts/sandbox-reset.mjs`, `supabase/seed/sandbox-seed.sql`,
  `src/sandbox/__tests__/sandbox-isolation.test.ts`
- **Modify:** `package.json` (script + `pg` devDep), `.env.sandbox.example`
- **Reference:** root `sandbox-seed.sql`

## Completion Notes
<!-- Sonnet 4.6 fills: how reset was run, seed contents summary, isolation test pass/skip + reason,
     edge cases, commit hash. -->

### Status: completed (2026-07-14)

**What was done, exactly per the Implementation Steps:**
- `npm i -D pg` (+ `@types/pg` so the isolation test type-checks under `npx tsc --noEmit`).
- `scripts/sandbox-reset.mjs` (ESM): reads `SANDBOX_DB_URL`/`SUPABASE_DB_URL`, exits with a clear
  error if unset, guards on `sandbox.app_meta.schema_marker = 'sandbox'` before doing anything,
  wraps `reset_all()` + seed replay in one transaction, rolls back and prints `✗ <message>` on any
  failure, and prints a before/after row-count summary (products/customers/invoices) on success.
- `"sandbox:reset": "node scripts/sandbox-reset.mjs"` added to `package.json` scripts.
- `supabase/seed/sandbox-seed.sql`: curated from root `sandbox-seed.sql` — trimmed to 1 location,
  2 suppliers, 4 products (all with stock batches), 4 customers, 1 completed purchase, 2 paid/
  confirmed invoices, 2 expenses, 1 supplier payment, all `ON CONFLICT DO NOTHING` (bare, not
  column-targeted, since some target tables' only unique constraint isn't `id`), fixed UUIDs on
  every parent-level entity. **Fixed a real bug while curating:** the root seed reused
  `c1000000-0000-0000-0000-000000000001` for "Nimal Electronics Store", but that exact UUID is
  hardcoded as `WALK_IN_CUSTOMER_ID` in `src/pages/POSPage.tsx` and is `'Walk-in Customer'` in
  `supabase/seed.sql` (the `public` seed) — so the sandbox seed silently had no Walk-in customer.
  Reassigned that id to `'Walk-in Customer'` (matching the `public` convention exactly: same
  phone/address placeholder values) and moved the other customers to `...002`–`...004`, updating
  every downstream `customer_id` reference in the invoice/payment inserts to match.
- `.env.sandbox.example` documents `SANDBOX_DB_URL` (direct Postgres connection string, distinct
  from the existing `VITE_SUPABASE_*` vars used by the app itself), with a note on where to find
  it and that the script's marker guard refuses to run against a non-sandbox database.
- `src/sandbox/__tests__/sandbox-isolation.test.ts`: `describe.skipIf`-free, uses `it.skipIf(!url)`
  per-test so the file always reports 3 tests (2 real + 1 "skipped: no creds" placeholder) whether
  or not `SANDBOX_DB_URL`/`SUPABASE_DB_URL` is set, rather than the whole file vanishing. Snapshots
  `public.products`/`customers`/`invoices` counts, runs `reset_all()` + seed replay, asserts counts
  unchanged; asserts `sandbox.app_meta.schema_marker === 'sandbox'` and that seeded product
  `b1000000-…0001` exists. To be registered in the Sandbox catalog as `type:"integration"` under
  the `sandbox` group in todo-010 (not yet done — that's todo-010's job, out of scope here).

**How it was verified (no live Supabase project reachable — same constraint as todo-008; see that
file's completion notes):** built a local scratch PostgreSQL 16 database (`sandbox_scratch`),
applied `supabase/migrations/20260421162200_init_schema.sql` (gives a real `public.products` /
`customers` / `invoices`) then `supabase/migrations/20260626000000_sandbox_schema_and_meta.sql`
(todo-008's migration — applied with zero errors) on top, with the `anon`/`authenticated`/
`service_role` roles created manually to satisfy the migration's grants.
- Ran `SANDBOX_DB_URL=postgresql://postgres:postgres@localhost:5432/sandbox_scratch node
  scripts/sandbox-reset.mjs` twice in a row: both runs printed `✓ sandbox reset + reseed complete`
  with correct before/after counts (0→4/4/2, then 4/4/2→4/4/2) — confirmed safe to run twice.
- Ran the marker guard against the *wrong* database (`postgres`, no `sandbox` schema): script
  printed `✗ relation "sandbox.app_meta" does not exist` and exited non-zero, rather than doing
  anything destructive — guard confirmed working.
- `npx tsc --noEmit`: clean.
- `npm test` with `SANDBOX_DB_URL` **unset**: both new isolation-test assertions skip via
  `it.skipIf`, all 30 pre-existing tests still pass (30 passed, 2 skipped).
- `npm test` with `SANDBOX_DB_URL` set to the scratch DB: both isolation assertions run for real
  and pass (31 passed, 1 skipped — only the "no creds" placeholder skips, as expected).
- `npx eslint` could not be run to verify style: `eslint.config.js` throws
  `TypeError: Cannot read properties of undefined (reading 'recommended')` in this environment —
  confirmed pre-existing and unrelated to this change (reproduces identically on `main` via
  `git stash` before any of these edits). Not part of this todo's completion test, which only
  requires `npm test` and `npx tsc --noEmit`.
- `graphify update .` could not be run: no `graphify` binary is installed anywhere in this
  environment (checked `which graphify`, `npx graphify`, and a filesystem-wide search). Flagging
  for whoever has graphify available — not a completion-test gate for this todo either.

**Depends on todo-008:** todo-008 itself is still `needs-review` (blocked on the correct Supabase
project not being reachable from this environment — see its notes), but its migration file is
complete, committed, and was verified locally (idempotent, schema-locked `reset_all()`, correct
markers) both by that todo and again here as this todo's baseline. Nothing in this todo required
the *real* Supabase project to be reachable — the completion test's DB-dependent checks were all
satisfiable against the local scratch database, and the isolation test degrades gracefully (skips
with a printed reason) when no DB creds are configured, exactly as specified.
