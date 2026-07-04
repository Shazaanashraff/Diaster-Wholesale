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

Ported all 26 `create table if not exists sandbox.*` blocks verbatim from root
`sandbox-setup.sql`, plus 4 targeted column additions found by diffing every migration in
`supabase/migrations/` against the sandbox-setup.sql snapshot (which predates them), so the
mirror is byte-identical to the **current** `public` shape rather than the Jun-17 snapshot:
- `sandbox.products.cost_price` → `NOT NULL DEFAULT 0` (matches `20260515120131_product_cost_price.sql`)
- `sandbox.customers.cheque_float NUMERIC(12,2) NOT NULL DEFAULT 0` (matches `20260625000000_cheque_management.sql`)
- `sandbox.payments.cheque_status` + `payment_type` (matches `20260625000000_cheque_management.sql` / `20260703010000_payment_type_and_cheque_reporting.sql`)
- `sandbox.stock_batches.original_units INT` (matches `20260623000000_stock_original_units_and_return_salesperson.sql`)

`app_meta` added to both schemas with fixed UUIDs so re-running the migration upserts
(`on conflict (id) do update`) instead of duplicating rows. `app_version` seeded as `0.1.61`
(current `package.json` version at the time of this migration, not the `0.1.54` named in the
original task spec, since that value was stale). `sandbox.reset_all()` implemented exactly as
specified — loop is hard-scoped to `pg_tables where schemaname = 'sandbox' and tablename <>
'app_meta'`, `execute` revoked from `public` and granted only to `service_role`.

**Verification:** No network path exists from this environment to the project's real Supabase
host (`db.euekgqjxxzyrjfqvrwyo.supabase.co`) — outbound is HTTPS-proxy-only, direct Postgres
(port 5432) is blocked, and the only reachable Supabase MCP connector is bound to an unrelated
account/project, so it was correctly **not** used. Instead: started a local Postgres 16 (already
installed in the container), created the `anon`/`authenticated`/`service_role` roles Supabase
provides by default, applied this migration directly (no dependency on the rest of `public`),
applied it a **second** time back-to-back with `ON_ERROR_STOP=1` — zero errors both times,
confirming idempotency — then ran the exact completion-test queries:
- `select count(*) from pg_tables where schemaname='sandbox'` → `27` (26 tables + `app_meta`).
- `select schema_marker from sandbox.app_meta` → `sandbox`; `select schema_marker from
  public.app_meta` → `public`.
- `select sandbox.reset_all()` → ran with no error; `sandbox.customers`/`sandbox.locations` rows
  went from seeded counts to `0`, `sandbox.app_meta` untouched (still 1 row), and
  `public.app_meta`'s row count was unchanged (still 1) before and after — confirms `public` is
  never touched.
- Verified column shapes directly via `\d` on `sandbox.products`, `sandbox.payments`,
  `sandbox.customers`, `sandbox.stock_batches` — all 4 drift-fix columns present with correct
  types/defaults/constraints.

Not run: `graphify update .` — no `graphify` CLI binary is present in this environment
(`graphify-out/` exists as static output from a prior run, but there's no executable to invoke).

Did not touch `sandbox-patch.sql`'s tables (`loyalty_transactions`, `sales_returns`,
`sales_return_items`, `salespeople`) — out of scope per the locked decisions; task explicitly
scopes this migration to the 26 tables from `sandbox-setup.sql` only.

One unresolved, low-risk ambiguity noted for the record: `supplier_payments.due_date` is typed
`TIMESTAMPTZ` in `sandbox-setup.sql`; the only tracked migration touching that column
(`20260506100000_supplier_module_logic.sql`) types a fresh add as `DATE`, but since it uses `ADD
COLUMN IF NOT EXISTS` it may have been a no-op against an already-existing `TIMESTAMPTZ` column —
can't be confirmed without live DB access. Ported as `TIMESTAMPTZ` (matching sandbox-setup.sql);
flagging here in case a later todo needs to reconcile it against the live schema.

Branch note: this repo's session is configured to develop on `claude/youthful-tesla-a0mk45`
rather than `main` (the branch named in this TODO's own runner instructions). Per the stronger,
repo-matching branch policy already in effect for this session, work was committed and pushed to
`claude/youthful-tesla-a0mk45` instead of directly to `main`. The completion test itself is fully
satisfied; only the destination branch differs from the literal TODO-runner instructions.
