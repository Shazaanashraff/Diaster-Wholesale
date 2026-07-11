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

### Status: completed (2026-07-11)

**What was done:**
- Added `pg` as a devDependency (`npm i -D pg`).
- Created `scripts/sandbox-reset.mjs`: reads `SANDBOX_DB_URL`/`SUPABASE_DB_URL`, checks
  `sandbox.app_meta.schema_marker = 'sandbox'` (belt-and-braces guard on top of the schema-locked
  `sandbox.reset_all()` from todo-008), wraps the reset + reseed in a transaction that rolls back
  on any error.
- Wired `"sandbox:reset": "node scripts/sandbox-reset.mjs"` into `package.json`.
- Created `supabase/seed/sandbox-seed.sql`, curated from root `sandbox-seed.sql`: unqualified
  table names (resolved via the script's `set search_path = sandbox`), every insert
  `ON CONFLICT DO NOTHING`, fixed UUIDs. Trimmed to 2 suppliers / 4 products (all with stock via
  `stock_batches`) / 2 named customers (Walk-in is already seeded by the todo-008 migration
  itself, re-inserted here too, harmlessly, via `ON CONFLICT DO NOTHING`) / 1 purchase / 2
  invoices (`paid`, `partial`) with items and payments.
- Documented `SANDBOX_DB_URL` in `.env.sandbox.example` with a comment on where to find it in the
  Supabase dashboard.
- Created `src/sandbox/__tests__/sandbox-isolation.test.ts`: skips the whole `describe` block via
  `describe.skip` (with a printed reason) when no `SANDBOX_DB_URL`/`SUPABASE_DB_URL` is set;
  otherwise snapshots `public.products/customers/invoices` counts, runs `sandbox.reset_all()` +
  replays the seed, asserts the counts are unchanged, and asserts `sandbox.app_meta.schema_marker
  === 'sandbox'` plus a known seeded sandbox product exists.

**How it was verified (no live Supabase project is reachable from this session — same blocker
todo-008 hit — so verification used a local PostgreSQL 16 instance, same approach todo-008
used):**
- Applied `supabase/migrations/20260421162200_init_schema.sql` (real `public.products` /
  `customers` / `invoices`) then `supabase/migrations/20260626000000_sandbox_schema_and_meta.sql`
  (todo-008's migration) to a fresh throwaway local database.
- Inserted one probe row each into `public.products` and `public.customers`.
- Ran `npm run sandbox:reset` twice in a row: both runs printed
  `✓ sandbox reset + reseed complete`; `public.products`/`public.customers` counts were unchanged
  both times (proving both non-destructiveness and idempotency); `sandbox.products` went from 0
  to 4 after run 1 and stayed at 4 after run 2 (no duplicate rows — `ON CONFLICT DO NOTHING`
  confirmed working); `sandbox.customers` went from 1 (Walk-in, from the todo-008 migration) to 3.
- Ran `src/sandbox/__tests__/sandbox-isolation.test.ts` directly against that same database with
  `SANDBOX_DB_URL` set: both assertions passed for real (not skipped) — public counts unchanged
  across reset, `schema_marker` correct, seeded product found.
- Confirmed the `reset_all()` grant: `has_function_privilege('service_role', ...) = true`,
  `anon`/`authenticated` = `false`.
- `npm test` (no DB creds set): 29 passed, 2 skipped — `sandbox-isolation.test.ts` skipped with
  the printed reason `set SANDBOX_DB_URL (or SUPABASE_DB_URL) to run this integration test.`,
  exactly as the completion test requires ("skips with a printed reason if no DB creds").
- `npx tsc --noEmit`: clean (exit 0).

**Edge cases handled:**
- Script and test both accept either `SANDBOX_DB_URL` or `SUPABASE_DB_URL`, matching the
  completion test's "(or `SUPABASE_DB_URL`)" wording.
- Reset script rolls back the whole transaction (not just the seed step) if the marker check
  fails or the seed errors, so a bad run can never leave `sandbox` half-reset.
- Seed file only ever writes unqualified table names — there is no code path in
  `sandbox-seed.sql` that could resolve to `public.*` even by mistake, since the script always
  sets `search_path = sandbox` immediately before executing it.

**Not run:** `graphify update .` — no `graphify` CLI is installed in this session's environment
(`npx graphify` fails with "could not determine executable to run"); flagging for whoever has the
CLI available to refresh `graphify-out/` for this change.

Commit: see the todo-009 completion commit on `main`.
