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

- Added `pg` + `@types/pg` as devDependencies, `scripts/sandbox-reset.mjs` (ESM), and
  `"sandbox:reset": "node scripts/sandbox-reset.mjs"` in `package.json`.
- Curated `supabase/seed/sandbox-seed.sql` from the root `sandbox-seed.sql`: unqualified table
  names (relies on `search_path = sandbox` set by the reset script), fixed UUIDs throughout, and
  — since `sandbox.reset_all()` (todo-008) truncates every sandbox table including `locations`
  and `customers` — added back `Main Warehouse` / `Main Shop` locations and the `Walk-in Customer`
  row that the migration seeds once but which reset wipes, so every reseed is self-contained.
  Contents: 2 locations, 3 suppliers, 12 products (all with stock batches), 7 customers (incl.
  Walk-in), 2 purchases + items, 12 stock batches, 5 invoices + items + payments (INV-0001 is the
  "confirmed"/paid one), 8 expenses, 2 supplier payments. Dropped one accidental duplicate
  line-item row present in the original root seed (same product listed twice on INV-0003) —
  cosmetic, not a correctness requirement.
- `.env.sandbox.example` documents `SANDBOX_DB_URL` (falls back to `SUPABASE_DB_URL`), same
  precedence as the reset script.
- `src/sandbox/__tests__/sandbox-isolation.test.ts` added, `it.skipIf(!SANDBOX_DB_URL)` with the
  skip reason printed as the test name. No DB creds are available in this environment (same
  blocker `todo-008` hit: the only Supabase project reachable via this session's MCP connection
  — `bqbmveiiyozsmnjvqucm`, "hoardlavishpos@gmail.com's Project" — has an unrelated `public`
  schema, e.g. `branches`/`brands`/`sales`/`exchanges` instead of this app's `products`/
  `invoices`/`purchases`; re-checked it at the start of this todo and it's still the same wrong
  project), so `npm test` exercises the skip path.
- Unlike todo-008, this todo's completion test ("`npm run sandbox:reset` runs end-to-end...")
  isn't phrased as project-specific, so it was fully exercised end-to-end against an isolated
  local PostgreSQL 16 instance (this sandbox's own `postgresql-16` package, throwaway scratch DB,
  no network) rather than left unverified:
  - Applied the todo-008 migration (creating stand-in `anon`/`authenticated`/`service_role`
    roles first, since plain Postgres lacks Supabase's built-in roles) + `init_schema.sql` for
    `public.products`/`customers`/`invoices`.
  - `npm run sandbox:reset` (via `SANDBOX_DB_URL`) → `✓ sandbox reset + reseed complete`; ran a
    second time back-to-back with the same result and no errors — safe to run twice.
  - Verified row counts after reset: 12 products, 7 customers, 3 suppliers, 5 invoices, 26
    invoice_items, 12 stock_batches, 2 locations, 2 purchases, 8 expenses, 2 supplier_payments.
  - `select schema_marker from sandbox.app_meta` → `sandbox`.
  - Seeded a probe row directly into `public.customers` beforehand; ran the isolation test
    (`SANDBOX_DB_URL` pointed at the scratch DB) — it **passed for real** (not skipped): asserted
    `public.products`/`customers`/`invoices` counts unchanged across the reset, sandbox marker
    correct, seeded sandbox product present. Independently re-queried `public.customers` after
    and confirmed the probe row was still there.
  - Dropped the scratch database and stopped the local Postgres service afterward, leaving no
    residual state in the sandbox environment.
- `npm test`: 29 passed, 1 skipped (the isolation test, reason printed). `npx tsc --noEmit` and
  `npx tsc -b`: clean.
- **What's still needed to fully close the loop against the real project:** connect the actual
  Diaster-Wholesale Supabase project (per todo-008's note) and set `SANDBOX_DB_URL` in a real
  `.env.sandbox`, then the same `npm run sandbox:reset` + `npm test` will exercise the isolation
  test for real there too — no code changes anticipated, this was validated end-to-end locally.
