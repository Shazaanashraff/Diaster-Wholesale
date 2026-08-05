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

- [x] **Products & Inventory** integration test added (against sandbox): record a container/GRN
      with roll measurements; verify sold units deduct from remaining stock. Registered in
      `products-inventory`.
- [x] **Customers & Credit** test added: credit-limit rule enforced; outstanding balance updates
      correctly after a sale + payment. Registered in `customers-credit`.
- [ ] **Refunds & Returns** test added: full + partial return against a confirmed sale reduces the
      customer's outstanding balance by the right amount. Registered in `refunds-returns`.
      **NOT DONE THIS PASS — see Completion Notes.**
- [x] **Payments & Cheques** test added: cheque lifecycle received → deposited → cleared / bounced;
      invalid transitions rejected with a specific error. Registered in `payments-cheques`.
- [x] Each new test file appears in **exactly one** group → `test-groups.test.ts` stays green.
- [x] Edge cases covered where relevant: valid, invalid types, negatives, empty, malformed
      payload, empty/wrong fetch — asserting specific error messages/codes. (For the 3 modules
      completed this pass; refunds-returns has none yet.)
- [x] `npm test` green; `npx tsc --noEmit` clean. New `TestCase` descriptions added to
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

Covered this pass (3 of 4 modules — incremental per this task's own design):

- **Products & Inventory** (`products-inventory`): new integration test
  `src/sandbox/__tests__/products-inventory.test.ts`, guarded skip on
  `SANDBOX_DB_URL`/`SUPABASE_DB_URL` (same convention as
  `sandbox-isolation.test.ts`), self-contained in one rolled-back transaction.
  Verifies a container/GRN receipt (`purchase_receive` → `purchases.status =
  'received'` trigger) creates a correctly-sized stock batch from
  received-minus-damaged units, and that `deduct_stock_fifo` (the function the
  real checkout flow calls) reduces remaining stock by exactly the units sold,
  plus the "insufficient stock" edge case. Could not execute this against a
  live DB in this sandboxed session — `SANDBOX_DB_URL`/`SUPABASE_DB_URL` are
  not set here (only an unrelated `DATABASE_URL` is, and its host isn't
  reachable from this network), so this test skips cleanly in this
  environment, same as the pre-existing sandbox integration test. Verified
  correct by hand against `20260626000000_sandbox_schema_and_meta.sql`
  (`trg_purchase_receive_stock`, `deduct_stock_fifo`) — please confirm it
  actually passes once run somewhere with real sandbox DB creds.
- **Customers & Credit** (`customers-credit`): new unit test
  `src/utils/creditCheck.test.ts` for `isOverCreditLimit`/`getRemainingCredit`
  (credit-limit rule, including the exactly-on-the-limit boundary and the
  credit_limit=0 "no limit" case), plus new `recordPayment` tests added to
  `src/services/customerService.test.ts` (cash vs. cheque params passed to
  `record_payment_atomic`, and RPC-error propagation). Backfilled missing
  `TEST_CASES['customers-credit']` entries for the pre-existing
  `adjustCustomerOutstandingManual` tests too, since that group had none.
- **Payments & Cheques** (`payments-cheques`): new unit test
  `src/services/chequeService.test.ts` covering the full cheque lifecycle
  (`depositCheque`, `completeCheque`, `returnCheque`,
  `reverseChequeToReturned`, `undoChequeDeposit`, `representCheque`) as thin
  passthroughs to `update_cheque_status`, plus rejection of an invalid
  transition and of completing a non-cheque payment, both asserting the
  RPC's exact error text.

**Not done this pass — Refunds & Returns (`refunds-returns`)**: all of this
app's return/exchange settlement logic (return vs. exchange, cash/credit
split against `paidSoFar`, exchange invoice creation, stock
restore/re-deduct, rollback-on-failure) lives inline in
`src/pages/ReturnsPage.tsx` — there is no service module to unit-test, and
the repo has no component-testing library (`@testing-library/react` etc.)
set up to test the page directly. Writing a real test here would require
either extracting the settlement math into a testable module (a page
refactor I did not want to risk unverified, with no way to run the app in a
browser in this session) or standing up component-testing tooling from
scratch — both bigger than a same-pass addition. Left `status:
needs-review` rather than moving to `TODO/completed/`; next pass should
either extract `returnedValue`/`exchangeDiff`/`creditPortion`/`cashPortion`
into `src/utils/returnCalc.ts` (pure functions, same shape as
`creditCheck.ts`) and test those, or add `@testing-library/react` for a
proper component test.

`npm test`: 62 passed, 4 skipped (the 2 new products-inventory integration
tests + the 2 pre-existing sandbox-isolation ones, all skipped for the same
"no DB creds reachable here" reason). `npx tsc -b --noEmit`: clean.
`graphify update .` was not run — the `graphify` CLI is not installed in
this session's environment.
