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

### Status: completed (2026-07-13)

**What was done, exactly per the Implementation Steps:**
- `npm i -D pg @types/pg` (types needed because `sandbox-isolation.test.ts` is TypeScript).
- `scripts/sandbox-reset.mjs`: reads `SANDBOX_DB_URL`/`SUPABASE_DB_URL`, errors clearly if unset,
  checks `sandbox.app_meta.schema_marker = 'sandbox'` before doing anything, runs
  `sandbox.reset_all()` + replays `supabase/seed/sandbox-seed.sql` under `search_path = sandbox`,
  all inside one transaction that rolls back on any failure.
- `"sandbox:reset": "node scripts/sandbox-reset.mjs"` added to `package.json`.
- `supabase/seed/sandbox-seed.sql`: curated from the root `sandbox-seed.sql` (3 suppliers, 12
  products with stock batches, 7 customers, 2 purchases, 5 invoices w/ items & payments, 8
  expenses, 2 supplier payments). One real fix while curating: the app hardcodes a Walk-in
  customer at `WALK_IN_CUSTOMER_ID = 'c1000000-0000-0000-0000-000000000001'`
  (`src/pages/POSPage.tsx:62`), but the root file reused that exact id for "Nimal Electronics
  Store" and only ever seeded an un-fixed, auto-UUID "Walk-in Customer" (from the sandbox
  migration's own base seed). Reserved `...001` for a proper fixed-id Walk-in Customer row and
  shifted the other 6 customers to `...002`–`...007`, updating their invoice/payment references,
  so sandbox POS walk-in sales behave the same as production.
- `.env.sandbox.example` documents `SANDBOX_DB_URL` (direct Postgres connection string, separate
  from the existing `VITE_SUPABASE_URL`/anon-key pair used by the app itself).
- `src/sandbox/__tests__/sandbox-isolation.test.ts`: guards on `SANDBOX_DB_URL`/`SUPABASE_DB_URL`
  with `describe.skip` + a printed reason when absent; when present, snapshots
  `public.products/customers/invoices` counts, runs `reset_all()` + reseed, re-asserts the counts
  are unchanged, and asserts the sandbox marker + a known seeded product exist.

**How it was verified** (no live Supabase project reachable in this session — same blocker
todo-008 hit; verified against a throwaway local PostgreSQL 16 instance instead, not connected to
any network service):
- Built a local baseline by applying every file in `supabase/migrations/` in order, interleaved
  with the untracked root scripts that (per todo-008's notes) create tables migrations never do —
  `supabase_migration.sql` (before `20260428130000_cartons_and_batches.sql`, which needs
  `purchases`) and `supplier_module_upgrade.sql` (before `20260603120000_egress_optimization_rpcs.sql`,
  which needs `expenses`). Created the `anon`/`authenticated`/`service_role` roles Postgres itself
  doesn't have so the grants in the migrations succeed.
  - Skipped one migration, `20260527051622_fix_shop_stock_location_filter.sql`: it references
    `stock_adjustments.adjustment_cartons`, a column that does not exist anywhere in this
    codebase's tracked migrations or root scripts (`stock_adjustments` only ever gets
    `adjustment_pieces`). This is a pre-existing gap unrelated to `products`/`customers`/
    `invoices` (what this todo's isolation test checks) or to the `sandbox` schema, so it was
    left as-is and not "fixed" here — flagging for a future todo, same as todo-008 flagged its
    own out-of-scope gaps.
  - `supabase/migrations/20260626000000_sandbox_schema_and_meta.sql` (todo-008's migration)
    applied cleanly as part of this same chain.
- `SANDBOX_DB_URL=postgresql://postgres:***@localhost:5432/diaster_sandbox_test node
  scripts/sandbox-reset.mjs` → `✓ sandbox reset + reseed complete`. Ran it a **second** time —
  same success message, confirming idempotency end-to-end (script + `reset_all()` +
  `ON CONFLICT DO NOTHING` seed).
- After both runs: `sandbox.products` = 12, `sandbox.customers` = 7 (incl. `id
  c1000000-…001` → "Walk-in Customer"), `sandbox.invoices` = 5; `public.products` = 0,
  `public.customers` = 1, `public.invoices` = 0 — unchanged from the pre-reset baseline both times.
- `SANDBOX_DB_URL=... npx vitest run src/sandbox/__tests__/sandbox-isolation.test.ts` → 2 passed.
  Re-ran with `SANDBOX_DB_URL` unset → 2 skipped, printed
  `sandbox-isolation.test.ts: skipped — set SANDBOX_DB_URL or SUPABASE_DB_URL to run against a
  real database`.
- `npm test` → 29 passed, 2 skipped (the isolation test, no creds in the default env) — matches
  the completion test's "passes or skips with reason" bar.
- `npx tsc -b` (the project's actual typecheck path — the root `tsconfig.json` has `files: []`
  and only `references`, so a bare `tsc --noEmit` checks nothing; `tsc -b` is what
  `npm run build:renderer` uses) → clean, 0 errors. `tsconfig.app.json` excludes `*.test.ts` from
  that project, so `sandbox-isolation.test.ts` was additionally typechecked standalone
  (`tsc --noEmit` with the same compiler options as `tsconfig.app.json` plus `--types node`) →
  clean.
- `graphify` CLI is not installed in this environment (`graphify: command not found`) — could not
  run `graphify update .` as instructed by `CLAUDE.md`; flagging so the graph can be refreshed
  from an environment that has it.

**Not done (deliberately out of scope):** registering the isolation test into the catalog's
`sandbox` group as `type:"integration"` (Implementation Step 6) — the catalog manifest itself is
todo-010's deliverable and doesn't exist yet. Whoever implements todo-010 should add this test's
entry then.

**Note on dependency ordering:** `npm i` currently fails in this sandbox environment because
`electron`'s postinstall tries to download its prebuilt binary and gets a 403 from the network
proxy; `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install` works around it for local verification. Not
a change made by this todo — flagging in case a future todo wants to make that the documented
default for sandboxed dev environments.
