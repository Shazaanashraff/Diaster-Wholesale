---
id: todo-013
title: Sandbox feature [6/7] — grow test coverage (initial integration + E2E batch)
priority: 3
created: 2026-06-24
status: needs-review
---

## Overview

Part 6 of the Sandbox series. With the infra in place, populate the catalog with a first batch
of real tests so the Sandbox grid shows meaningful pill counts beyond `sales-pos`. Each new test
file MUST be registered into a `TEST_GROUPS` entry **in the same change** so the precision
contract (todo-010) stays green.

**🔒 LOCKED DECISIONS:** Tests assert this app's **decimal** money behaviour (no bigint, no
ledger). Integration tests run against the **`sandbox`** schema only — never `public`. There is
no "Money & Ledger" group.

**Depends on:** todo-010 (catalog) and todo-009 (sandbox seed/reset for integration tests).
This task is intentionally **incremental** — pick the highest-value modules first; it can be
split across sessions. Use the Completion Test as checkpoints.

## Completion Test

- [ ] **Products & Inventory** integration test added (against sandbox): record a container/GRN
      with roll measurements; verify sold units deduct from remaining stock. Registered in
      `products-inventory`.
- [ ] **Customers & Credit** test added: credit-limit rule enforced; outstanding balance updates
      correctly after a sale + payment. Registered in `customers-credit`.
- [ ] **Refunds & Returns** test added: full + partial return against a confirmed sale reduces the
      customer's outstanding balance by the right amount. Registered in `refunds-returns`.
- [ ] **Payments & Cheques** test added: cheque lifecycle received → deposited → cleared / bounced;
      invalid transitions rejected with a specific error. Registered in `payments-cheques`.
- [ ] Each new test file appears in **exactly one** group → `test-groups.test.ts` stays green.
- [ ] Edge cases covered where relevant: valid, invalid types, negatives, empty, malformed
      payload, empty/wrong fetch — asserting specific error messages/codes.
- [ ] `npm test` green; `npx tsc --noEmit` clean. New `TestCase` descriptions added to
      `test-cases.ts` for every new test, plain-English and money-accurate.

---

## Implementation Guide

Follow the patterns already in `posService.test.ts` for unit tests (mocked `supabase`) and use
the sandbox DB for integration tests (guarded skip when no creds, like `sandbox-isolation.test.ts`).
Keep descriptions honest: one catalog `TestCase` per real `it()`. Reset the sandbox
(`npm run sandbox:reset`) before integration runs that need a clean baseline.

## Implementation Steps

1. For each module above, add a test file under `src/services/__tests__/` or
   `src/sandbox/__tests__/` (integration). Mirror the existing mock/proxy style for unit tests.
2. Immediately add the file path to the right `TEST_GROUPS[*].vitestFiles`, set `e2e` if you add a
   Playwright spec, and update the group's `unitDesc`/`e2eDesc` from the placeholder to a real summary.
3. Add one `TestCase` per `it()` to `TEST_CASES[groupId]`.
4. Run `npm test` after each file (precision contract must stay green). `graphify update .`.
5. Repeat per module; you may stop after any module and resume later — tick the checklist above.

## Files to Modify

- **Create:** new `*.test.ts` files per module (locations above)
- **Modify:** `src/sandbox/test-groups.ts`, `src/sandbox/test-cases.ts`

## Completion Notes

### Status: needs-review (2026-08-06)

**What was done — Products & Inventory (complete):**
- Added `src/sandbox/__tests__/products-inventory.test.ts`, an integration test against the real
  `sandbox` schema (guarded `it.skipIf(!url)`, same pattern as `sandbox-isolation.test.ts`), two
  real assertions:
  1. Marking a `sandbox.purchases` row `'received'` (a GRN/container receipt) fires
     `sandbox.trg_purchase_receive_stock()` and turns `received_units - damaged_units` into a
     `sandbox.stock_batches` row — verified via `sandbox.product_stock` (130 received, 10 damaged,
     ppc=10 → `cartons_in=12, pieces_in=0`).
  2. `sandbox.deduct_stock_fifo()` — the same function POS checkout's stock-deduction path calls
     — removes exactly the sold units from the oldest batch (120 on hand, sell 35 → 85 remain =
     `cartons_in=8, pieces_in=5`).
  - Each test creates its own throwaway product/purchase rows with random suffixes and deletes
    them in a `finally`, so it's safe to run repeatedly against a shared sandbox DB.
- Registered in `src/sandbox/test-groups.ts` (`products-inventory.vitestFiles` +
  real `unitDesc`) and `src/sandbox/test-cases.ts` (2 new `type:"integration"` entries).
- `npm test`: 6 files, 43 passed, 4 skipped (2 pre-existing `sandbox-isolation` skips + these 2
  new ones — this sandbox environment has no `SANDBOX_DB_URL`/`SUPABASE_DB_URL`, so they skip
  rather than run for real, matching the guarded pattern the guide specifies).
- `npx tsc --noEmit`: clean.
- `test-groups.test.ts` (the precision contract) stays green — file registered in exactly one group.

**Why the other 3 modules are NOT done — a real infrastructure gap, not a shortcut:**
While building the Customers & Credit test, discovered that the `sandbox` schema
(`supabase/migrations/20260626000000_sandbox_schema_and_meta.sql`, todo-008) is missing every RPC
a true integration test for the remaining 3 modules would need to call:
- **Customers & Credit** needs `checkout_sale` (credit-limit enforcement lives inside it) and
  `record_payment_atomic` (to record the "sale + payment" the Completion Test describes) — neither
  exists in `sandbox`, only in `public`.
- **Refunds & Returns** needs `sandbox.sales_returns` / `sandbox.sales_return_items` tables and
  `create_sales_return_atomic` / `complete_sales_return` / `undo_sales_return_atomic` — none exist
  in `sandbox` (a draft mirror sits in the untracked root `sandbox-patch.sql`, but todo-008 never
  ported it — it explicitly scoped itself to the 26 tables in `sandbox-setup.sql` only).
- **Payments & Cheques** needs `record_payment_atomic` and `update_cheque_status` for the
  received → deposited → cleared/bounced lifecycle — neither exists in `sandbox`.

Confirmed by grepping `supabase/migrations/20260626000000_sandbox_schema_and_meta.sql` for each
name — zero matches for `checkout_sale`, `record_payment_atomic`, `update_cheque_status`,
`adjust_customer_outstanding_manual`, or `sales_return`. These were all added to `public` by four
later migrations (`20260625000000_cheque_management.sql`,
`20260703010000_payment_type_and_cheque_reporting.sql`,
`20260726120000_cheque_reversals_and_credit_balance.sql`,
`20260728000000_manual_balance_adjustment.sql`) plus the older
`20260515000000_loyalty_returns_v2.sql`, none of which followed the "going-forward convention"
the sandbox migration's own header commits to (mirror every `public`-changing migration to
`sandbox` in the same file).

Writing these 3 tests against tables/functions that don't exist in `sandbox` would either fail
outright the moment someone points `SANDBOX_DB_URL` at a real instance, or (worse) require
calling `public.*` from a "sandbox integration test," silently violating the series' core
isolation guarantee. Neither is acceptable, so they were left undone rather than faked.

**Follow-up opened:** `TODO/active/todo-015.md` — describes exactly which functions/tables to
port into `sandbox` (re-qualified, schema-locked, same style as todo-008) to unblock all 3
remaining modules. Once todo-015 lands, resume this file for Customers & Credit, Refunds &
Returns, and Payments & Cheques (this task is explicitly incremental — "you may stop after any
module and resume later").

**Checklist status:** Products & Inventory ✅ done. Customers & Credit / Refunds & Returns /
Payments & Cheques ⛔ blocked on todo-015. `npm test` green, `npx tsc --noEmit` clean (both true
for what exists today, but the Completion Test as a whole is not yet fully satisfied).
