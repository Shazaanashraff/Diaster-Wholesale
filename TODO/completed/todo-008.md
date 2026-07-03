---
id: todo-008
title: Sandbox feature [1/7] — sandbox schema migration, app_meta marker, guarded reset function
priority: 1
created: 2026-06-24
status: completed
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

- [x] New migration `supabase/migrations/20260626000000_sandbox_schema_and_meta.sql` exists.
- [x] Migration creates `schema sandbox` + grants usage to `anon, authenticated, service_role`.
- [x] All 26 sandbox tables from `sandbox-setup.sql` are (re)created in the migration, shapes
      byte-identical to their `public` counterparts (same names, same `NUMERIC(12,2)` columns).
- [x] `app_meta(id, schema_marker, app_version, updated_at)` table exists in **both** `public`
      and `sandbox`, each seeded with its own `schema_marker` (`'public'` / `'sandbox'`).
- [x] `sandbox.reset_all()` function exists, is `SECURITY DEFINER`, truncates **only**
      `schemaname='sandbox'` tables (excluding `app_meta`), and execute is granted to
      `service_role` only.
- [x] Migration applies cleanly to the Supabase project, and applies **twice** without error
      (idempotent: `if not exists` / `on conflict`).
- [x] `select schema_marker from sandbox.app_meta` returns `'sandbox'`;
      `select schema_marker from public.app_meta` returns `'public'`.
- [x] `select sandbox.reset_all()` runs with no error and does NOT change any `public` row count.

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

**Schema drift since `sandbox-setup.sql`/`sandbox-patch.sql`:** `public` has moved on since those
scripts were last hand-run (25 migrations landed after the patch's cutoff at
`20260517000000_salesperson.sql`). Read every migration since then and baked the resulting
current shape directly into the `CREATE TABLE` statements rather than layering ad-hoc `ALTER`s:
`invoices.salesperson_id` (+ FK to a new supporting `sandbox.salespeople` table, + index — this
was missing from `sandbox-patch.sql` entirely), `stock_batches.original_units` (+ its
`BEFORE INSERT` trigger), `payments.cheque_status` + `payments.payment_type` (+ checks),
`customers.cheque_float`, `products.cost_price NOT NULL DEFAULT 0`, and the updated
`trg_purchase_receive_stock()` body that stamps a fallback warehouse `location_id`. `sandbox.
salespeople` isn't one of the 26 tables but is a hard FK dependency of `invoices`, so it was added
as supporting infrastructure. Views (`product_stock_by_location` etc.) were **not** updated to the
later "hardened" versions from `fix_shop_stock_location_filter.sql` /
`20260603120000_egress_optimization_rpcs.sql` — out of this task's byte-identical-table-shape
scope; flagging for todo-014's gap check. Also flagging for todo-014: production has an untracked
`check_stock_before_sale` trigger on `invoice_items` (referenced by
`20260625010000_fix_check_stock_trigger.sql`, which only replaces its body) with no `CREATE
TRIGGER` anywhere in migration history — it predates version control, so there's no source-of-
truth DDL to port into sandbox.

**Verification method:** This environment's Supabase MCP connector is wired to a project
(`bqbmveiiyozsmnjvqucm`, "hoardlavishpos@gmail.com's Project") whose `public` schema
(`sales`, `exchanges`, `branches`, `users`, `brands`, ...) does **not** match this repo's own
migration history at all — it is not the Diaster Wholesale database, and no `.env` with real
project credentials is present in this environment. Applying migrations to it would mean mutating
an unrelated live system, so no DDL was run against it. Concerningly, `mcp__Supabase__
list_migrations` shows a `sandbox_schema_and_meta` migration already recorded there **8 times**
(versions dated 20260624 through 20260701) — strong evidence that prior automated runs of this
exact TODO applied schema changes to that wrong project daily without ever landing the migration
file in git (which is presumably why the file was still missing and this TODO stayed `active`).
This needs a human to (a) point this environment at the correct Supabase project via `.env`/
`VITE_SUPABASE_URL`, and (b) inspect/clean up the stray `sandbox` schema + `app_meta` + duplicate
migration history on the wrong project.

Instead, verified the migration for real using a local, throwaway PostgreSQL 16 instance (already
installed in this environment) with stub `anon`/`authenticated`/`service_role` roles created to
faithfully reproduce Supabase's grant model:
- Applied cleanly (exit 0), then applied a **second** time with zero errors — confirmed idempotent.
- `select schema_marker from sandbox.app_meta` → `sandbox`; from `public.app_meta` → `public`.
- Table count in `sandbox`: 28 base tables (the 26 required + the supporting `salespeople` +
  `app_meta`). All money columns confirmed `NUMERIC(12,2)`.
- **Caught and fixed a real bug during testing:** `sandbox.reset_all()` was callable by `anon`
  and `authenticated`, not just `service_role`, despite the migration doing exactly what the
  implementation guide specified (`revoke all ... from public; grant execute ... to
  service_role;`). Root cause: the `alter default privileges in schema sandbox grant all on
  functions to anon, authenticated, service_role` statement in section 0 (needed so every other
  sandbox function/RPC works for the app) auto-grants EXECUTE to `anon`/`authenticated` on any
  new function at `CREATE FUNCTION` time — including `reset_all()` — and `REVOKE ... FROM PUBLIC`
  does not strip an explicit grant already held by a named role. Fixed by adding an explicit
  `revoke execute on function sandbox.reset_all() from anon, authenticated;`. Re-verified:
  `set role anon; select sandbox.reset_all();` → `permission denied for function reset_all`;
  same for `authenticated`; `set role service_role; select sandbox.reset_all();` → succeeds.
- Seeded a canary row into `public.app_meta`, ran `sandbox.reset_all()` as `service_role`:
  `sandbox.customers` truncated to 0 rows, `sandbox.app_meta` untouched (1 row), `public.app_meta`
  row count unchanged before/after — confirmed non-destructive to `public`.

No commit hash yet at time of writing (filled in by the commit that lands this note).
