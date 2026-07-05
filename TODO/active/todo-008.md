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

Created `supabase/migrations/20260626000000_sandbox_schema_and_meta.sql`, porting the
`sandbox` schema (26 core tables + their functions/views/seed data) verbatim from the root
`sandbox-setup.sql`, then adding `app_meta` to both `public` and `sandbox` and the
schema-locked `sandbox.reset_all()` function exactly as specified in this file.

Applied to the live Supabase project (`bqbmveiiyozsmnjvqucm`) via `apply_migration`:
- First apply: `{"success":true}`.
- Re-applied the full, byte-identical migration body a second time: `{"success":true}`,
  zero errors — confirms idempotency (every statement uses `IF NOT EXISTS` / `OR REPLACE` /
  `DROP ... IF EXISTS` + recreate / `ON CONFLICT`).
- `select schema_marker from sandbox.app_meta` → `'sandbox'`.
- `select schema_marker from public.app_meta` → `'public'`.
- Captured `public` row counts before running `reset_all()`: app_meta=1, customers=520,
  products=341, sales=1392, suppliers=7, branches=2, users=2. Ran
  `select sandbox.reset_all()` — completed with no error. Re-queried the same counts
  afterward: byte-for-byte identical. `sandbox.app_meta` still had its 1 row (marker
  survives reset, as designed); `sandbox.customers`/`sandbox.locations` were truncated
  (expected — `reset_all()` truncates every sandbox table except `app_meta`). Re-ran the
  seed inserts from this migration afterward to restore the sandbox environment to its
  pre-test seeded state (1 customer, 2 locations).
- Confirmed via `information_schema`/`pg_catalog` that `EXECUTE` on `sandbox.reset_all()`
  is granted only to `service_role` (and `postgres`), not `anon`/`authenticated`.
- `graphify` CLI is not installed in this environment (`command -v graphify` and
  `npx graphify` both fail) — could not run `graphify update .`. No app source files were
  touched (SQL migration only), so the code graph should be unaffected regardless.

**One completion-test item does not hold as literally written and needed investigation
before I could sign off — see the "Needs human review" note below.**

## Needs human review

The completion-test bullet **"All 26 sandbox tables ... shapes byte-identical to their
public counterparts (same names, same NUMERIC(12,2) columns)" fails as written**, and this
is a pre-existing condition in production, not something introduced by this migration:

- Investigated the live `public` schema (`bqbmveiiyozsmnjvqucm`) and found it holds a
  **retail-POS data model** (`sales`, `sale_items`, `branches`, `exchanges`,
  `damaged_goods`, `stock_movements`, `users`, ...), while `sandbox` holds an
  **independently-designed wholesale purchasing/invoicing model**
  (`purchases`, `purchase_items`, `invoices`, `invoice_items`, `cartons`, `stock_batches`,
  `shipments`, `stock_transfers`, `supplier_returns`, ...). Only 4 table names exist in
  both schemas — `customers`, `expenses`, `products`, `suppliers` — and even those differ
  column-for-column (e.g. sandbox `products` has `item_code`/`wholesale_price`/
  `retail_price`/`margin_pct`/`msp`; public `products` has `price`/`cost_price`/`barcode`/
  `barcode2` instead).
- Of those 4 overlapping tables, `sandbox.suppliers.credit_limit` and
  `.current_payable` are `NUMERIC(16,2)`, not `NUMERIC(12,2)` — and `public.suppliers`
  doesn't have those columns at all (it only has `id, name, contact_person, phone, email,
  address, created_at`), so there's no public value to even compare against. Several other
  sandbox-only tables (`purchases`, `purchase_costs`, `supplier_payments`,
  `purchase_discount_approvals`, `other_income`, `supplier_returns`) also use
  `NUMERIC(16,2)` rather than `NUMERIC(12,2)` for money columns.
- I ported the schema **exactly as it already exists in production** (verbatim from
  `sandbox-setup.sql`, cross-checked live) rather than silently changing money-column
  precision or table shapes to force a "byte-identical" match — altering a live table's
  column type is a separate, riskier migration than what this task authorized ("only
  adding" per the locked decisions), and I did not want to take that action without
  explicit sign-off.
- Also worth flagging: `sandbox`/`public` also each already had two tables not mentioned
  anywhere in this task or in `sandbox-setup.sql`/`sandbox-patch.sql` —
  `audit_metrics_hourly` and `product_deletion_audit` — added to `sandbox` by hand at some
  point, with no `public` counterpart at all (the migrations that define those table shapes,
  `20260604150000_audit_metrics_hourly.sql` and `20260524_delete_product_cascade.sql`,
  create them unqualified/in `public`, but neither actually exists in `public` on the live
  project). I left them untouched — out of scope for this task — but a human should decide
  whether that's intentional drift or a gap to close in a follow-up todo.

**Recommendation:** either (a) accept that `sandbox` is intentionally a different,
independently-evolved data model from `public` and reword this checklist item in future
Sandbox-series todos accordingly, or (b) decide the `NUMERIC(16,2)` sandbox money columns
should be tightened to `NUMERIC(12,2)` to match the "decimal money model" locked decision,
which would need its own careful migration (not done here, since it touches existing
production data/columns and wasn't in this task's explicit scope). Everything else in the
completion test (schema/grants, app_meta in both schemas, reset_all() correctness and
non-destructiveness, migration idempotency) passed and was verified live.
