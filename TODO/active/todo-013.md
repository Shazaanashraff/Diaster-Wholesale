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

- [x] **Products & Inventory** integration test added (against sandbox): receiving a purchase
      (net of damaged units) creates a stock batch, and FIFO deduction reduces it correctly.
      Registered in `products-inventory`. *(This app has no "container/GRN with roll
      measurements" concept — the analogous real flow is purchase → receive → stock_batches,
      tested instead; see notes below.)*
- [~] **Customers & Credit** test added: credit-limit rule enforced (integration, against real
      sandbox data) — done. Outstanding balance updates correctly after a sale + payment — only a
      **unit** test of `recordPayment`'s RPC call could be added; not a real integration test. See
      notes below for why. Registered in `customers-credit`.
- [ ] **Refunds & Returns** test added: full + partial return against a confirmed sale reduces the
      customer's outstanding balance by the right amount. **Not done this pass** — see notes below.
      `refunds-returns` still has no tests registered.
- [~] **Payments & Cheques** test added: cheque lifecycle received → deposited → cleared / bounced;
      invalid transitions rejected with a specific error — done, but only as **unit** tests
      (mocked RPC); not a real database-backed lifecycle test. See notes below for why. Registered
      in `payments-cheques`.
- [x] Each new test file appears in **exactly one** group → `test-groups.test.ts` stays green
      (verified: 3 tests pass).
- [x] Edge cases covered where relevant, for the modules actually implemented: over-receive,
      over-damage, RPC failure, invalid cheque transition, non-cheque payment, unknown payment id,
      over-limit credit sale — asserting specific error messages.
- [x] `npm test` green (9 files, 60 passed / 6 skipped — up from 5 files/42 passed/2 skipped);
      `npx tsc --noEmit` clean (both `tsconfig.json` and `tsconfig.app.json`). New `TestCase`
      descriptions added to `test-cases.ts` for every new test, plain-English and money-accurate.

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

**Why this is needs-review, not completed:** one of the four required modules (Refunds & Returns)
has no test at all, and two others (Payments & Cheques, and half of Customers & Credit) could only
get unit-level coverage instead of the real sandbox-database integration coverage the checklist
asks for. All three gaps trace back to the same root cause: the `sandbox` schema applied by
`supabase/migrations/20260626000000_sandbox_schema_and_meta.sql` (todo-008, itself still
`needs-review`) only ever covered the 26 tables/functions in the *original* `sandbox-setup.sql`.
Real app functionality added since then in **untracked root SQL files** (`returns_setup.sql`, the
live-project-only `restore_stock_to_batch` RPC) or in **later `public`-only migrations**
(`20260703010000_payment_type_and_cheque_reporting.sql`,
`20260726120000_cheque_reversals_and_credit_balance.sql`) was never ported into `sandbox`:

- `sandbox.payments` has no `cheque_status` / `payment_type` columns, `sandbox.customers` has no
  `cheque_float` column, and `update_cheque_status(...)` / `record_payment_atomic(...)` /
  `adjust_customer_outstanding(...)` don't exist as `sandbox.*` functions at all — only in
  `public`.
- `sandbox.sales_returns` / `sandbox.sales_return_items` don't exist — the real app's returns
  tables (per `returns_setup.sql`, which is what `src/pages/ReturnsPage.tsx` actually queries) were
  never applied to `sandbox` at all. (The `sandbox.sales_returns` + `create_sales_return_atomic`
  etc. in the root `sandbox-patch.sql` are a *different, unused* design — `ReturnsPage.tsx` calls
  `restore_stock_to_batch` / `deduct_stock_fifo` / `adjust_customer_outstanding` directly, none of
  which match that patch file's RPCs.)
- There is also no dedicated `returnsService.ts` — the returns logic lives inline in the
  `ReturnsPage.tsx` React component, and `vitest.config.ts` runs in `environment: 'node'` (no DOM),
  so it can't be exercised by a `*.test.ts` file without either extracting a testable service layer
  or adding a browser test environment — both out of this todo's declared `Files to Modify` scope.

**What was actually implemented this pass** (9 test files total, 60 passed / 6 skipped, up from
5 files / 42 passed / 2 skipped; `npx tsc --noEmit` clean on both configs):

- `src/services/purchaseService.test.ts` (new, unit, mocked Supabase): `receivePurchase`'s
  over-receive / over-damage guardrails, the happy-path insert + status flip, and RPC-failure
  propagation.
- `src/sandbox/__tests__/products-inventory.integration.test.ts` (new, integration, guarded-skip
  like `sandbox-isolation.test.ts`): inserts a fresh product/purchase/purchase_items/
  purchase_receive row set inside a transaction that's always rolled back, flips the purchase to
  `received` to fire `trg_purchase_receive_trigger`, confirms the resulting stock batch is net of
  damaged units, then calls the real `sandbox.deduct_stock_fifo` RPC (the same one POS checkout
  calls) and confirms it deducts correctly and raises `Insufficient stock` when over-deducted.
  **Fully real** — no gaps here, since all the objects this module needs do exist in `sandbox`.
- `src/sandbox/__tests__/customers-credit.integration.test.ts` (new, integration, guarded-skip):
  confirms `available = limit − outstanding_balance` against the real seeded Nimal Electronics
  customer row, and that a within-headroom sale is allowed / an over-limit one is rejected — this
  mirrors `posService.checkCreditLimit`'s exact formula against real sandbox data.
- `src/services/customerService.test.ts` (extended): added 3 unit tests for `recordPayment`
  (exact RPC params for cash and cheque payments, error propagation). This is the "outstanding
  balance updates after a sale + payment" checklist item, but only at the level of "the client
  asks the database to do the right thing" — the actual balance arithmetic lives inside
  `record_payment_atomic`, which isn't reachable in `sandbox` (see above), so it could not be
  integration-tested there.
- `src/services/cheques.test.ts` (new, unit, mocked Supabase): each of the 6 cheque-lifecycle
  wrapper functions (`depositCheque`, `completeCheque`, `returnCheque`, `reverseChequeToReturned`,
  `undoChequeDeposit`, `representCheque`) requests the exact right `p_new_status`; the DB's
  "invalid transition", "not a cheque payment", and "not found" errors all propagate untouched.
  The actual transition rules are enforced entirely inside `update_cheque_status` (see
  `20260726120000_cheque_reversals_and_credit_balance.sql`), which doesn't exist in `sandbox`, so
  this could not be a real lifecycle integration test.
- `src/sandbox/test-groups.ts` / `src/sandbox/test-cases.ts` updated: `products-inventory` and
  `payments-cheques` now have real `unitDesc`/vitestFiles/TestCase entries instead of the
  "No automated tests yet" placeholder; `customers-credit` gained the new files + cases above.
  `refunds-returns` is untouched (still the placeholder) since nothing could be added for it.

**To close this out**, in order:
1. Finish todo-008 for real (apply the sandbox migration to the actual Diaster-Wholesale Supabase
   project, not just verify it locally).
2. Write and apply a migration that ports `cheque_status`/`payment_type`/`cheque_float` +
   `update_cheque_status`/`record_payment_atomic`/`adjust_customer_outstanding` into `sandbox`
   (mirroring the two later `public`-only migrations named above), and separately a migration
   for `sales_returns`/`sales_return_items` + `restore_stock_to_batch` that matches what
   `ReturnsPage.tsx` actually calls (not the unused `sandbox-patch.sql` design).
3. Re-run this todo's remaining checklist items as real sandbox-database integration tests once
   those objects exist, and either extract a `returnsService.ts` or add a browser test environment
   so Refunds & Returns can be tested at all.

Not run: `graphify update .` — the `graphify` CLI is not installed/on `PATH` in this environment
(same limitation as prior todos in this series).
