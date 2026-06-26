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
<!-- Sonnet 4.6 fills after implementation: migration applied how, idempotency verified,
     marker query outputs, reset_all() verified non-destructive to public, commit hash. -->
