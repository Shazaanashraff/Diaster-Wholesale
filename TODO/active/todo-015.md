---
id: todo-015
title: Sandbox schema has drifted from public — port missing RPCs/tables (blocks todo-013)
priority: 2
created: 2026-08-06
status: active
---

## Overview

Discovered while working todo-013 ("grow test coverage — initial integration + E2E batch").

`supabase/migrations/20260626000000_sandbox_schema_and_meta.sql` (todo-008) states a
going-forward convention: "future migrations that change `public` apply the identical DDL to
`sandbox` in the same file." Four migrations landed **after** that date and did not follow it —
they added `public`-only functions/tables with no `sandbox` counterpart:

- `supabase/migrations/20260625000000_cheque_management.sql` → `update_cheque_status` (public only)
- `supabase/migrations/20260703010000_payment_type_and_cheque_reporting.sql` → cheque reporting
  additions (public only)
- `supabase/migrations/20260726120000_cheque_reversals_and_credit_balance.sql` → cheque reversal
  logic (public only)
- `supabase/migrations/20260728000000_manual_balance_adjustment.sql` →
  `adjust_customer_outstanding_manual` (public only)
- `supabase/migrations/20260515000000_loyalty_returns_v2.sql` → `sales_returns`,
  `sales_return_items` tables + `create_sales_return_atomic`, `complete_sales_return`,
  `undo_sales_return_atomic`, `restore_stock_pieces`, `get_available_stock_pieces` functions
  (public only — a `sandbox` mirror of these two tables + functions was drafted in the untracked
  root `sandbox-patch.sql` but never ported into a real migration by todo-008, which explicitly
  scoped itself to the 26 tables in `sandbox-setup.sql` only)
- `record_payment_atomic` and `checkout_sale` (the RPC POS checkout actually calls) are **also**
  missing from `sandbox` — grep confirms neither name appears anywhere in
  `supabase/migrations/20260626000000_sandbox_schema_and_meta.sql`.

Net effect: only `deduct_stock_fifo`, `deduct_stock_from_batch`, and the purchase-receive trigger
exist in `sandbox` today. Any integration test that needs to simulate a **full sale**
(`checkout_sale`), a **payment/cheque lifecycle** (`record_payment_atomic`,
`update_cheque_status`), a **manual balance adjustment**, or a **sales return**
(`create_sales_return_atomic` and friends) cannot run against `sandbox` at all — the functions
and/or tables simply don't exist there, regardless of DB credentials.

This blocked 3 of the 4 modules in todo-013's Completion Test: **Customers & Credit** (needs
`checkout_sale` + `record_payment_atomic`), **Refunds & Returns** (needs `sales_returns` /
`sales_return_items` + the return RPCs), and **Payments & Cheques** (needs
`record_payment_atomic` + `update_cheque_status`). Only **Products & Inventory** was completable,
since its primitives (`purchase_receive` trigger, `deduct_stock_fifo`, `product_stock` view)
already exist in `sandbox`.

**🔒 LOCKED DECISIONS (same as the rest of the Sandbox series — do not deviate):**
1. Money stays `NUMERIC(12,2)`. No bigint, no ledger.
2. Do not alter any `public` table, function, or view — this task only **adds** `sandbox`
   mirrors, exactly as the going-forward convention already requires.
3. Every added function/table must be schema-qualified to `sandbox.*` and use
   `SET search_path = sandbox` (or explicit `sandbox.` prefixes throughout), matching the style
   already used by `sandbox.deduct_stock_fifo` etc. in the todo-008 migration. Never let a
   `sandbox.*` function reach into `public.*` by an unqualified table name.

## Completion Test

- [ ] New migration exists (e.g. `supabase/migrations/<timestamp>_sandbox_catchup.sql`) that adds,
      inside `schema sandbox` only:
  - [ ] `sandbox.sales_returns`, `sandbox.sales_return_items` tables (port from the drafted
        `sandbox-patch.sql`; cross-check columns against the `public` versions in
        `20260515000000_loyalty_returns_v2.sql` for drift, same way todo-008 did for its 26 tables).
  - [ ] `sandbox.create_sales_return_atomic`, `sandbox.complete_sales_return`,
        `sandbox.undo_sales_return_atomic`, `sandbox.restore_stock_pieces`,
        `sandbox.get_available_stock_pieces` functions, schema-locked to `sandbox.*`.
  - [ ] `sandbox.checkout_sale` (mirrors `public.checkout_sale` — check
        `supabase/migrations/` for the current definition; POS checkout's actual RPC).
  - [ ] `sandbox.record_payment_atomic`, `sandbox.update_cheque_status`,
        `sandbox.adjust_customer_outstanding_manual` functions (mirror the `public` versions from
        the four migrations listed above).
- [ ] Migration applies cleanly and twice without error (idempotent, matching todo-008's pattern).
- [ ] None of the new `sandbox.*` functions reference an unqualified or `public.`-prefixed table.
- [ ] `npm run sandbox:reset` still succeeds afterward (no conflicts with the new objects).
- [ ] `npx tsc --noEmit` clean (no app code changes expected, but verify).
- [ ] Leave a note in this file's Completion Notes listing exactly which todo-013 modules are now
      unblocked, so todo-013 can resume.

---

## Implementation Guide

Same approach as todo-008: this is a DDL-only, additive migration. For each public function,
open its defining migration, copy the body, and re-qualify every table reference from
`public.<table>` (or the unqualified default) to `sandbox.<table>`, and set
`SET search_path = sandbox` on the function itself so any remaining unqualified reference resolves
to `sandbox` rather than `public`. The `sales_returns`/`sales_return_items` DDL and their
functions already exist in a mostly-correct form in the untracked root `sandbox-patch.sql` —
verify it against the current `public.sales_returns` shape before trusting it verbatim, the same
way todo-008 found and fixed drift in `sandbox-setup.sql`.

## Implementation Steps

1. Read `supabase/migrations/20260515000000_loyalty_returns_v2.sql`,
   `20260625000000_cheque_management.sql`, `20260703010000_payment_type_and_cheque_reporting.sql`,
   `20260726120000_cheque_reversals_and_credit_balance.sql`,
   `20260728000000_manual_balance_adjustment.sql`, and whichever migration currently defines
   `public.checkout_sale`, in full.
2. Create `supabase/migrations/<timestamp>_sandbox_catchup.sql`. Port `sales_returns` /
   `sales_return_items` DDL from `sandbox-patch.sql`, cross-checked column-by-column against
   `public.sales_returns` / `public.sales_return_items` as they stand today (there have been
   migrations since `sandbox-patch.sql` was drafted — check for drift).
3. Port each function body, re-qualified to `sandbox.*`, with `SET search_path = sandbox`.
4. Apply locally (this sandbox environment can run a scratch PostgreSQL 16 instance the same way
   todo-008's notes describe, if no live Supabase project is reachable) — verify idempotency and
   that nothing touches `public`.
5. Run `npm run sandbox:reset` against the same instance to confirm no conflicts.
6. Update this file's Completion Notes, then move on to unblocking todo-013 (separate task).

## Files to Modify

- **Create:** `supabase/migrations/<timestamp>_sandbox_catchup.sql`
- **Reference (do not delete):** `sandbox-patch.sql` (draft source for `sales_returns` DDL),
  the five `public`-only migrations listed above.

## Completion Notes
<!-- Fills after implementation: which functions/tables were ported, any column drift found and
     fixed, idempotency verification, which todo-013 modules are unblocked, commit hash. -->
