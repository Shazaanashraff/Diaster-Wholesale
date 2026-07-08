---
id: todo-008
title: Sandbox feature [1/7] — sandbox schema migration, app_meta marker, guarded reset function
priority: 1
created: 2026-06-24
status: needs-review
---

## Overview

First of a 7-part series that adds a **Sandbox developer/QA screen** to the app (a catalog of
every automated test + a live in-app test runner). This task lays the database foundation.

Today the `sandbox` schema (a throwaway mirror of `public` used by tests) exists only as an
ad-hoc root file `sandbox-setup.sql` run by hand — it is **not** in migrations, has **no**
`app_meta` marker, and has **no** reset path. This task makes it first-class.

**🔒 LOCKED DECISIONS (do not deviate — these were agreed with the owner):**
1. **Keep the decimal money model.** Money stays `NUMERIC(12,2)`. **No** bigint, **no** ledger.
   Do not alter any `public` money column.
2. **Keep the launch-time schema switch** (`VITE_SUPABASE_SCHEMA` / `npm run dev:sandbox`).
   No runtime toggle, no refactor of the `supabase` singleton.
3. You are only **adding**: the `sandbox` schema via migration, an `app_meta` marker table in
   **both** schemas, and a schema-locked reset function.

Series order: **008 (this) → 009 → 010 → 011 → 012 → 013 → 014.**

## Completion Test

- [ ] New migration `supabase/migrations/20260626000000_sandbox_schema_and_meta.sql` exists.
- [ ] Migration creates `schema sandbox` + grants usage to `anon, authenticated, service_role`.
- [ ] All 26 sandbox tables from `sandbox-setup.sql` are (re)created in the migration, shapes
      byte-identical to their `public` counterparts (same names, same `NUMERIC(12,2)` columns).
- [ ] `app_meta(id, schema_marker, app_version, updated_at)` table exists in **both** `public`
      and `sandbox`, each seeded with its own `schema_marker` (`'public'` / `'sandbox'`).
- [ ] `sandbox.reset_all()` function exists, is `SECURITY DEFINER`, truncates **only**
      `schemaname='sandbox'` tables (excluding `app_meta`), and execute is granted to
      `service_role` only.
- [ ] Migration applies cleanly to the Supabase project, and applies **twice** without error
      (idempotent: `if not exists` / `on conflict`).
- [ ] `select schema_marker from sandbox.app_meta` returns `'sandbox'`;
      `select schema_marker from public.app_meta` returns `'public'`.
- [ ] `select sandbox.reset_all()` runs with no error and does NOT change any `public` row count.

---

## Implementation Guide

The migration must be reproducible and idempotent. Port the existing `sandbox-setup.sql`
verbatim into a timestamped migration so the schema lives in version control like everything
else. Add the marker table to *both* schemas in the same file so they cannot drift. The reset
function is the only data-clearing primitive in the whole feature and must be **schema-locked**
so it is structurally impossible for it to touch `public`.

## Implementation Steps

1. Create `supabase/migrations/20260626000000_sandbox_schema_and_meta.sql`. Header comment:
   note the going-forward convention "future migrations that change `public` apply the identical
   DDL to `sandbox` in the same file."
2. Begin with:
   ```sql
   create schema if not exists sandbox;
   grant usage on schema sandbox to anon, authenticated, service_role;
   ```
3. Port all 26 `create table if not exists sandbox.*` blocks from root `sandbox-setup.sql`.
   Cross-check each against its `public` equivalent in the existing migrations to confirm the
   column list and types match (especially money = `NUMERIC(12,2)`). Port any RLS policies,
   views, functions, or triggers the sandbox tables need for tests, sandbox-qualified.
4. Re-grant: `grant select, insert, update, delete on all tables in schema sandbox to
   authenticated, service_role;` plus sequence grants matching public.
5. Add the `app_meta` table to BOTH schemas (identical structure), single-row, with a
   `schema_marker` and `app_version` ('0.1.54'), seeded via `insert ... on conflict (id) do
   update`. Grant `select` to `authenticated, service_role`.
6. Add `sandbox.reset_all()` exactly as below (the loop over `pg_tables where schemaname =
   'sandbox'` is the hard guard):
   ```sql
   create or replace function sandbox.reset_all()
   returns void language plpgsql security definer
   set search_path = sandbox, pg_temp as $$
   declare r record;
   begin
     for r in select tablename from pg_tables
              where schemaname = 'sandbox' and tablename <> 'app_meta'
     loop
       execute format('truncate table sandbox.%I restart identity cascade', r.tablename);
     end loop;
   end $$;
   revoke all on function sandbox.reset_all() from public;
   grant execute on function sandbox.reset_all() to service_role;
   ```
7. Apply via `supabase db push` (or paste into the Supabase SQL editor). Run the Completion
   Test checks. Run `graphify update .`.

## Files to Modify

- **Create:** `supabase/migrations/20260626000000_sandbox_schema_and_meta.sql`
- **Reference (do not delete):** root `sandbox-setup.sql`, `sandbox-patch.sql` — source of the DDL.

## Completion Notes
<!-- Sonnet 4.6 fills after implementation: migration applied how, idempotency verified,
     marker query outputs, reset_all() verified non-destructive to public, commit hash. -->

### Status: needs-review (2026-07-08)

**What was done:**
- Created `supabase/migrations/20260626000000_sandbox_schema_and_meta.sql`, porting all 26
  `sandbox.*` tables from root `sandbox-setup.sql`, plus their functions/triggers/views/grants/
  seed data, plus `public.app_meta` + `sandbox.app_meta` marker tables and the schema-locked
  `sandbox.reset_all()` function, exactly as specified in the Implementation Steps.
- While porting, reconstructed the actual current `public` schema by replaying
  `supabase/migrations/*.sql` **plus** the untracked root scripts that originally created it
  (`supabase_migration.sql`, `supplier_module_upgrade.sql`, `supabase_fifo_migration.sql`,
  `pos_location_stock_split.sql`, `pos_payment_upgrade.sql` — 18 of the 26 tables, e.g.
  `suppliers`, `purchases`, `expenses`, `locations`, are never `CREATE TABLE`'d anywhere under
  `supabase/migrations/`, only in these ad-hoc root files run by hand against production; this
  is a pre-existing gap, out of scope for this todo). Cross-checked all 26 tables column-by-
  column against that reconstruction and fixed three real drifts so the migration is faithful to
  today's `public`, not just to the stale `sandbox-setup.sql` copy:
  - `supplier_payments.due_date`: `TIMESTAMPTZ` → `DATE` (matches live `public` type).
  - `supplier_returns`: added back legacy `return_value NUMERIC(16,2)` and `updated_at` columns
    that exist in `public` but were dropped from `sandbox-setup.sql` at some point.
  - `supplier_return_items`: added back legacy `quantity_units`, `quantity_cartons`,
    `unit_price NUMERIC(12,4)` columns, same reason.
  - No `NUMERIC(12,2)` money-column type mismatches were found otherwise — all money columns in
    `sandbox-setup.sql` already match `public` exactly (including `products.cost_price`, which
    is nullable in both — the `20260515120131_product_cost_price.sql` migration's `NOT NULL` never
    took effect against real `public` because it used `ADD COLUMN IF NOT EXISTS ... NOT NULL` on
    a column that already existed, which Postgres silently no-ops).
  - Known, not fixed (out of scope — see below): `public.customers.cheque_float`,
    `public.payments.cheque_status` / `payment_type`, `public.invoices.salesperson_id`,
    `public.stock_batches.original_units` are recent feature columns added to `public` that
    neither `sandbox-setup.sql` nor `sandbox-patch.sql` ever covered. Adding `salesperson_id`
    would also require creating `sandbox.salespeople`, which belongs to `sandbox-patch.sql`
    (out of scope — this todo covers only the 26 tables from `sandbox-setup.sql`). Flagging for
    a future todo.

**Why this is needs-review, not completed:**
The completion test requires applying the migration to "the Supabase project" and verifying
`schema_marker` / `reset_all()` against it directly. The only Supabase project reachable through
this session's Supabase MCP connection (project ref `bqbmveiiyozsmnjvqucm`, "hoardlavishpos@
gmail.com's Project") is **not this app's database** — its `public` schema has tables named
`branches`, `brands`, `categories`, `sales`, `exchanges`, `damaged_goods`, `users`,
`v_products_with_stock`, none of which this codebase's `src/services/*.ts` ever queries (it
queries `products`, `invoices`, `customers`, `purchases`, etc., per `supabase/migrations/`).
Applying this migration there would create schema objects in an unrelated live application, so
it was **not** applied there.

Instead, the migration was fully verified in an isolated local PostgreSQL 16 instance (this
sandbox's own `postgresql-16` package, a throwaway scratch database, not connected to any
network service):
- Rebuilt a faithful `public` baseline (all migrations + the untracked root scripts above) and
  applied this migration on top — succeeded with zero errors.
- Applied it a **second** time on the same database — zero errors (idempotent).
- `select schema_marker from sandbox.app_meta` → `sandbox`; `select schema_marker from
  public.app_meta` → `public`.
- `select sandbox.reset_all()` ran with no error. Seeded a probe row in both `public.customers`
  and `sandbox.customers` beforehand; after `reset_all()`, `sandbox.customers` was truncated to
  0 rows while `public.customers` kept its 2 rows unchanged (including the probe row) —
  confirmed non-destructive to `public`.
- `reset_all()` EXECUTE grant: initially leaked to `anon`/`authenticated` because the
  `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS` statement earlier in the file
  auto-grants EXECUTE to every role it lists for functions created afterwards, including
  `reset_all()` itself. Fixed by explicitly revoking from `anon, authenticated` (not just
  `PUBLIC`) right after creating the function — re-verified only `service_role` (and the table
  owner) can execute it.

**What's needed to close this out:** connect the correct Diaster-Wholesale Supabase project via
this environment's Supabase MCP integration (or supply its project ref/credentials), then run
`supabase db push` (or apply the migration file directly) against it, and re-run the three
DB-dependent completion-test checks above against the real project. The migration file itself
should not need further changes — it was validated end-to-end locally.
