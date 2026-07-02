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

Migration `supabase/migrations/20260626000000_sandbox_schema_and_meta.sql` created by combining
`sandbox-setup.sql` + `sandbox-patch.sql`, then cross-checked column-by-column against the
**live** `public` schema (project `euekgqjxxzyrjfqvrwyo`) via the Supabase Management API
(direct `psql`/port 5432 egress is blocked in this environment; `https://api.supabase.com/v1/projects/{ref}/database/query`
was used instead — reachable through the proxy).

- Applied via the Management API 4× in a row with zero errors — confirms idempotency
  (`if not exists` / `on conflict` / `add column if not exists` throughout).
- Discovered the `sandbox` schema was **not empty** going in (someone had already run
  `sandbox-setup.sql` + `sandbox-patch.sql` by hand). Migration was written to be safe against
  that: every column addition uses `ALTER ... ADD COLUMN IF NOT EXISTS` alongside the
  `CREATE TABLE IF NOT EXISTS` baseline, so it works identically on a from-scratch project.
- Found and closed real column-level drift beyond what `sandbox-setup.sql`/`sandbox-patch.sql`
  covered (verified against live `public.information_schema.columns`, not just migration files,
  since some `public` columns were added by hand and were never captured in any migration):
  `customers.cheque_float`, `invoices.salesperson_id` (+ index), `payments.cheque_status`,
  `stock_batches.original_units` (+ stamping trigger), `stock_adjustments.adjustment_cartons`,
  `invoices.payment_status` CHECK gaining `'cancelled'`, `supplier_returns.return_value`/`updated_at`,
  `supplier_return_items.quantity_units`/`quantity_cartons`/`unit_price`, and
  `supplier_payments.due_date` narrowed from `TIMESTAMPTZ` to `DATE`. Also renamed the sandbox
  seed location `'Main Shop'` → `'Shop'` to match `public`'s `20260623000001_rename_main_shop_to_shop.sql`.
- Also ported `sandbox-patch.sql`'s 4 extra tables (`salespeople`, `sales_returns`,
  `sales_return_items`, `loyalty_transactions`) and their helper functions, since `invoices.salesperson_id`
  and the loyalty columns on `customers` are meaningless without them — all still additive, no
  change to the 26-table/app_meta/reset_all scope from LOCKED DECISION #3.
- Deliberately **excluded** `customers.customer_type` — a column present in live `public` but in
  no migration file and unreferenced anywhere in `src/`; confirmed dead.
- Column-shape diff script (`information_schema.columns`, sandbox vs. public) run after the final
  apply: **zero type/precision mismatches** across all 26 required tables except the intentionally
  excluded `customer_type`.
- Verification query results:
  - `select schema_marker from sandbox.app_meta` → `'sandbox'`
  - `select schema_marker from public.app_meta` → `'public'`
  - `sandbox.reset_all()` execute grantees: `{postgres, service_role}` only (`postgres` is the
    table owner, not a policy grant) — `anon`/`authenticated` explicitly revoked since the schema's
    `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS` would otherwise have granted them execute
    at `CREATE FUNCTION` time.
  - Before/after `public.products`/`public.invoices` row counts across a `sandbox.reset_all()`
    call: unchanged (679 / 400 → 679 / 400), while `sandbox.products` dropped to 0 and reseeded.
- Did **not** port production RPCs unrelated to the 26-table/app_meta/reset_all scope
  (`checkout_sale`, `record_payment_atomic`, `update_cheque_status`, dashboard-metrics RPCs,
  `delete_product_cascade`) or the `shop_stock` view — out of scope per LOCKED DECISION #3;
  left for a later part of the series if a specific test needs them.
- `graphify` CLI is not installed in this execution environment — `graphify update .` was skipped.
- Git branch note: this session's binding git policy pins commits to
  `claude/youthful-tesla-xmvfqr` (not `main`, and pushing to a different branch requires explicit
  permission), which overrides this file's generic "push to main" instruction. Commit/push landed
  on `claude/youthful-tesla-xmvfqr` instead.
