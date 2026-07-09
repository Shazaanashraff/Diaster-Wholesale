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

### Status: completed (2026-07-09)

**What was done:**
- Added `pg` as a devDependency (`npm i -D pg`, resolved to `^8.22.0`).
- Created `scripts/sandbox-reset.mjs` (ESM): reads `SANDBOX_DB_URL`/`SUPABASE_DB_URL`, errors
  clearly and exits 1 if unset, checks `sandbox.app_meta.schema_marker = 'sandbox'` before doing
  anything, wraps the reset + reseed in a transaction, and calls only `sandbox.reset_all()` (the
  schema-locked function from todo-008) followed by `supabase/seed/sandbox-seed.sql` replayed
  under `search_path = sandbox`.
- Added `"sandbox:reset": "node scripts/sandbox-reset.mjs"` to `package.json`.
- Created `supabase/seed/sandbox-seed.sql`, curated from the root `sandbox-seed.sql`: 2 locations
  (Main Warehouse, Main Shop), 7 customers (Walk-in + 6 named, incl. wholesale/retail mix), 3
  suppliers, 12 products, 2 purchases, 12 stock batches, 5 invoices (incl. `INV-0001` confirmed
  `paid`), 8 expenses, 2 supplier payments. All rows use fixed UUIDs; every insert that a later
  statement in the file references by id uses `ON CONFLICT (id) DO NOTHING`; leaf line-item rows
  (invoice_items, purchase_items, payments, expenses, supplier_payments — no natural key, always
  inserted into an empty table right after `reset_all()`) use bare `ON CONFLICT DO NOTHING`.
  Added explicit `locations` + a `Walk-in Customer` row with fixed UUIDs, because
  `sandbox.reset_all()` truncates every sandbox table except `app_meta` — including the
  `locations`/`Walk-in Customer` rows the todo-008 migration seeds only once at schema-creation
  time — so the reset script must recreate them itself on every run.
- Added `SANDBOX_DB_URL` documentation to `.env.sandbox.example` (direct Postgres connection
  string, separate from the `VITE_SUPABASE_*` REST/anon-key vars already there).
- Created `src/sandbox/__tests__/sandbox-isolation.test.ts`: `describe.skipIf(!url)` guard prints
  a reason and skips when no `SANDBOX_DB_URL`/`SUPABASE_DB_URL` is set; otherwise snapshots
  `public.products`/`public.customers`/`public.invoices` counts, runs the same reset+reseed
  primitives as the script, asserts the `public` counts are unchanged, and asserts
  `sandbox.app_meta.schema_marker = 'sandbox'` plus a seeded sandbox product exist.

**Verification (local Postgres 16 scratch DB, not connected to any network service — same
approach todo-008 used, since the only Supabase project reachable via this session's MCP
connection is an unrelated app):**
- Applied `supabase/migrations/20260626000000_sandbox_schema_and_meta.sql` to a fresh DB (needed
  to create the `anon`/`authenticated`/`service_role` roles locally first — vanilla Postgres
  doesn't have Supabase's built-in roles — and `CREATE EXTENSION pgcrypto` for `gen_random_uuid`).
  Migration applied cleanly.
- Created minimal `public.products`/`public.customers`/`public.invoices` (`LIKE sandbox.* INCLUDING
  ALL`) with one probe row each, to have something for the isolation check to protect.
- `SANDBOX_DB_URL=postgresql://postgres:postgres@localhost:5432/diaster_test npm run
  sandbox:reset` twice in a row → both times `✓ sandbox reset + reseed complete`, `public` probe
  rows (1/1/1) unchanged both times, `sandbox` counts stable at 7 customers / 12 products / 5
  invoices / 2 locations after each run (idempotent).
- Marker guard: manually set `sandbox.app_meta.schema_marker = 'oops'`, ran the script again →
  `✗ Refusing: sandbox.app_meta.schema_marker is not 'sandbox' — wrong database?`, exit code 1,
  sandbox row counts untouched by the aborted/rolled-back transaction. Restored the marker
  afterward.
- No-env-var case: unset `SANDBOX_DB_URL`/`SUPABASE_DB_URL` → `✗ Set SANDBOX_DB_URL (or
  SUPABASE_DB_URL) to the sandbox database connection string.`, exit code 1.
- `npx vitest run src/sandbox/__tests__/sandbox-isolation.test.ts` with `SANDBOX_DB_URL` set → 1
  passed. Same command with it unset → 1 skipped, reason printed
  (`sandbox-isolation.test.ts: skipped — SANDBOX_DB_URL/SUPABASE_DB_URL not set`).
- `npm test` (full suite, no `SANDBOX_DB_URL` in the ambient shell): 29 passed, 1 skipped, 0
  failed. `npx tsc --noEmit` and `npx tsc -b`: both clean, no errors.
- Scratch DB and local-only roles were dropped after verification; nothing was left running.

**Not done / follow-up:** `npx eslint .` fails in this environment with a pre-existing
`TypeError: Cannot read properties of undefined (reading 'recommended')` in `eslint.config.js`
load, unrelated to any file touched by this todo (reproduces on `main` before this change too).
Lint is not part of this todo's Completion Test, so it was not investigated further here — flagging
for a separate todo. `graphify update .` could not be run — the `graphify` CLI is not installed
in this session's environment.
