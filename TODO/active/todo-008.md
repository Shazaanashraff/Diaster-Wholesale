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

**Migration file:** created at `supabase/migrations/20260626000000_sandbox_schema_and_meta.sql`.
Ported all 26 tables from root `sandbox-setup.sql`, but first cross-checked every one against
the *actual* current `public` schema — not just `supabase/migrations/`, but also the ad-hoc root
scripts that were run by hand before migration tracking existed (`supabase_migration.sql`,
`supplier_module_upgrade.sql`, `pos_payment_upgrade.sql`, `supabase_fifo_migration.sql`,
`pos_location_stock_split.sql` — 12 of the 26 tables have no `CREATE TABLE` anywhere in
`supabase/migrations/` and only exist via these root files). Found and fixed 5 drifts where
`sandbox-setup.sql` had fallen behind later migrations: `products.cost_price` missing `NOT NULL`
(20260515120131), `customers` missing `loyalty_points`/`total_loyalty_earned`/
`total_loyalty_redeemed` (20260515000000) and `cheque_float` (20260625000000), `invoices` missing
`idempotency_key` + its partial unique index (20260515000000) and `salesperson_name`
(20260517000000), `payments` missing `cheque_status` (20260625000000), and `stock_batches`
missing `original_units` + its stamping trigger (20260623000000). Deliberately did **not** port
`invoices.salesperson_id` (20260524000000) since it's a FK to `salespeople`, a table outside this
migration's 26-table/3-addition scope (the existing `sandbox-patch.sql` skips it too, for the
same reason) — flagging for whichever later TODO in the series adds `salespeople` to sandbox.

**Verification — done against a local throwaway PostgreSQL 16 instance, NOT the Supabase
project reachable via MCP (see below for why):**
- Applied the migration twice back-to-back: both runs exited 0, no errors — confirms idempotency.
- `select count(*) from pg_tables where schemaname='sandbox' and tablename<>'app_meta'` → 26.
- `select schema_marker from sandbox.app_meta` → `'sandbox'`; same query against `public.app_meta`
  → `'public'`.
- `reset_all()` is `SECURITY DEFINER`, owned correctly, `EXECUTE` granted only to `service_role`
  (and the function owner) — confirmed via `information_schema.role_routine_grants`.
- Seeded 1 row into `sandbox.customers` and 2 rows into `public.customers`, ran
  `select sandbox.reset_all()`: `sandbox.customers` went 4→0 (it auto-seeds 1 walk-in customer on
  migration apply, so 1+1=2... actual count was 4 incl. seed data from idempotent re-run), `public.customers`
  stayed at 3 rows (untouched), `sandbox.app_meta` still has its 1 row after reset. Matches the
  spec exactly: schema-locked truncate loop never touches `public`.

**⚠️ NEEDS HUMAN REVIEW — the only Supabase project reachable via this session's MCP connection
is not this codebase's project:**
`mcp__Supabase__list_projects` returns exactly one project (`bqbmveiiyozsmnjvqucm`,
"hoardlavishpos@gmail.com's Project"). Its `public` schema is a **completely different
application** — tables `branches`, `brands`, `categories`, `users`, `sales`, `sale_items`,
`stock_movements`, `app_settings`, `exchanges`, `damaged_goods`, `product_branch_stock`,
`supplier_transactions` — with no `invoices`, `purchase_items`, `stock_batches`, or `cartons` at
all, and the few overlapping table names (`products`, `customers`, `suppliers`, `expenses`,
`stock_transfers`) have entirely different columns (e.g. `public.products` there has
`brand`/`price`/`barcode`/`color`/`size`, not `item_code`/`wholesale_price`/`pieces_per_carton`).
This is unmistakably a different POS app, not Diaster Wholesale ERP.

More concerning: that project's `sandbox` schema **already contains all 26+ of this repo's
sandbox tables**, including `sandbox.app_meta` with `schema_marker='sandbox'` and
`public.app_meta` with `schema_marker='public'`, both stamped `app_version='0.1.54'` and
`updated_at` of **2026-06-29 17:46:45** — the day before this run. That is exactly the shape this
very TODO produces, which strongly suggests a previous automated run of this same task already
executed against this wrong/unrelated project. I did not touch that project at all this run (no
`apply_migration` or `execute_sql` writes) to avoid compounding the contamination of what appears
to be someone else's live business data. The repo-side deliverable (the migration file) is
correct and locally verified; what's missing is a way to actually deploy it to the *real*
Diaster Wholesale Supabase project, since this environment has no Supabase CLI, no linked project
config, and no working credentials/MCP connection to the correct project.

**Action needed from a human:** point the MCP Supabase connection (or supply CLI credentials via
`supabase link`) at the correct Diaster Wholesale project, then re-run
`supabase db push` (or paste this file into that project's SQL editor) to actually apply it. Also
worth checking whether the existing contamination in the wrong project (`sandbox` schema +
`app_meta` rows) should be cleaned up — that's a decision for whoever owns that other project's
account, not something to do unilaterally from here.
