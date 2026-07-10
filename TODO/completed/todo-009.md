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

### Status: completed (2026-07-10)

**What was done:**
- `npm i -D pg` (resolved `^8.22.0`).
- Created `scripts/sandbox-reset.mjs` (ESM): reads `SANDBOX_DB_URL`/`SUPABASE_DB_URL`, errors
  clearly if unset, connects, wraps the whole run (connect included) in a try/catch so any
  failure — missing creds, bad connection string, marker check, query error — prints one clean
  `✗ <message>` line and exits 1 instead of an uncaught-exception stack trace. Inside the
  transaction: aborts unless `sandbox.app_meta.schema_marker = 'sandbox'`, calls
  `sandbox.reset_all()` (the only data-clearing call — todo-008's schema-locked function), then
  `set search_path = sandbox` and replays the seed file, commits, prints a success summary; rolls
  back on any error.
- Added `"sandbox:reset": "node scripts/sandbox-reset.mjs"` to `package.json`.
- Created `supabase/seed/sandbox-seed.sql`, curated from the root `sandbox-seed.sql`: fixed UUIDs,
  every insert `ON CONFLICT DO NOTHING`, 2 locations, 1 supplier, 2 customers (Walk-in +
  1 wholesale), 3 products each with a stock batch, 1 completed purchase, 1 **paid** invoice +
  items + payment. Table names are unqualified (`INSERT INTO products`, not
  `INSERT INTO sandbox.products`) and the file opens with `SET search_path = sandbox;` — this is
  the second belt-and-braces guard: an unqualified insert can only ever land in `sandbox` (or fail
  loudly), even if the file is ever run standalone outside the reset script's own
  `set search_path`.
- Documented `SANDBOX_DB_URL` in `.env.sandbox.example` (direct Postgres connection string,
  separate from the `VITE_SUPABASE_*` anon-key vars the app itself uses).
- Created `src/sandbox/__tests__/sandbox-isolation.test.ts`: skips via the vitest test-context
  `ctx.skip()` with a printed reason when no `SANDBOX_DB_URL`/`SUPABASE_DB_URL` is set; when a DB
  is available, snapshots `public.{products,customers,invoices}` counts, runs
  `sandbox.reset_all()` + seed replay, asserts the counts are unchanged, and asserts
  `sandbox.app_meta.schema_marker = 'sandbox'` plus a seeded sandbox product exists.

**How it was verified (no reachable Supabase project for this app in this session — same
constraint todo-008 hit; used the same local-Postgres workaround):**
- Reused this sandbox's local PostgreSQL 16 instance. Rebuilt a faithful `public` baseline by
  replaying `supabase/migrations/*.sql` in order, interleaved with the untracked root scripts that
  actually created parts of live `public` (`supabase_migration.sql`, `supplier_module_upgrade.sql`
  — same gap todo-008 already documented as pre-existing and out of scope). Two more pre-existing
  gaps surfaced while replaying and were patched **locally only** (not committed — they are
  environment reconstruction workarounds, not app changes): a migration referencing
  `stock_adjustments.adjustment_cartons` before any script adds that column, and the `anon` /
  `authenticated` / `service_role` roles Supabase provisions automatically but a vanilla local
  Postgres doesn't have. All 29 migrations then applied cleanly, ending with todo-008's
  `20260626000000_sandbox_schema_and_meta.sql`, giving a working `sandbox` schema + `reset_all()`.
- Seeded two probe rows directly into `public` (1 product, 1 customer) to make the isolation
  check meaningful, then ran `npm run sandbox:reset` against this DB **twice**: both runs printed
  `✓ sandbox reset + reseed complete`; `public` stayed at 1 product / 2 customers / 0 invoices
  both times (unchanged), while `sandbox` was correctly wiped and reseeded to 3 products / 1
  invoice each time — confirming both idempotency and non-destructiveness to `public`.
- Ran `src/sandbox/__tests__/sandbox-isolation.test.ts` with `SANDBOX_DB_URL` pointed at that same
  DB: passed for real (not skipped) — asserted `public` counts unchanged, `schema_marker` =
  `'sandbox'`, and the seeded `SBX-100001` product exists.
- Ran `npm test` twice: once with no `SANDBOX_DB_URL` set — 29 passed, 1 skipped, with the printed
  skip reason (`sandbox-isolation.test.ts: skipped — set SANDBOX_DB_URL to run against a live
  DB`); once with it set — 30 passed, 0 skipped.
- `npx tsc --noEmit` — clean.
- `npm run lint` — fails with a pre-existing `eslint.config.js` crash
  (`TypeError: Cannot read properties of undefined (reading 'recommended')`) confirmed present
  on this branch **before** any file in this todo was touched (reproduced via `git stash`); not
  part of this todo's completion test and left untouched.
- `graphify update .` was not run: the `graphify` CLI is not installed in this session (no binary
  on `PATH`, `npx graphify` fails with "could not determine executable to run"). Flagging for
  whoever has the CLI available.

**Files changed:** `package.json`, `package-lock.json` (added `pg` devDependency +
`sandbox:reset` script), `.env.sandbox.example`, `scripts/sandbox-reset.mjs` (new),
`supabase/seed/sandbox-seed.sql` (new), `src/sandbox/__tests__/sandbox-isolation.test.ts` (new).
