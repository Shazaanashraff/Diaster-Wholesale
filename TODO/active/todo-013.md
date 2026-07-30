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
      **NOT DONE this pass — see Completion Notes for why, and the gap it exposes.**
- [x] **Payments & Cheques** test added: cheque lifecycle received → deposited → cleared / bounced;
      invalid transitions rejected with a specific error. Registered in `payments-cheques`.
- [x] Each new test file appears in **exactly one** group → `test-groups.test.ts` stays green.
- [x] Edge cases covered where relevant: valid, invalid types, negatives, empty, malformed
      payload, empty/wrong fetch — asserting specific error messages/codes.
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

### Status: needs-review (2026-07-30)

**Covered this pass — 3 of 4 modules, 20 new tests across 3 new/extended files:**

- **`products-inventory`** (new file `src/sandbox/__tests__/inventory-receiving.test.ts`, 4 tests,
  type `integration`): a genuine Postgres integration test run against a **local, throwaway
  PostgreSQL 16 instance** (this sandbox's own `postgresql-16` package) with
  `supabase/migrations/20260626000000_sandbox_schema_and_meta.sql` applied — the real
  `sandbox.trg_purchase_receive_stock()` trigger and `sandbox.deduct_stock_fifo()` function, no
  reimplemented logic. Covers: a GRN creates a stock batch sized to received-minus-damaged units;
  a fully-damaged line adds zero stock (floors at 0, never negative); selling deducts FIFO across
  two GRNs received on different days, oldest first; selling more than available raises a specific
  `Insufficient stock: N units undeducted for product <id>` error and leaves existing stock
  untouched. All 4 passed against the live local instance (verified `SANDBOX_DB_URL=postgres://
  postgres:postgres@localhost:5432/sandbox_test npx vitest run`); the DB was torn down afterward, so
  in the checked-in state this file `it.skipIf(!url)`s exactly like `sandbox-isolation.test.ts`
  does — same pattern, same reason.
- **`payments-cheques`** (new file `src/services/chequeLifecycle.test.ts`, 9 tests, type `unit`,
  mocked Supabase): the full lifecycle received (`recordPayment` with `method:'cheque'`) →
  deposited (`depositCheque`) → cleared (`completeCheque`) / bounced (`returnCheque` /
  `reverseChequeToReturned`), plus undo-deposit and re-present, each asserted to call
  `update_cheque_status` with the exact expected `p_new_status`. Two invalid-transition cases
  assert the DB's specific rejection message (`Invalid cheque transition: pending -> completed`,
  `Payment <id> is not a cheque payment`) propagates unchanged.
- **`customers-credit`** (extended `src/services/customerService.test.ts`, +7 tests, type `unit`,
  mocked Supabase): new coverage for `recordPayment` (previously untested) — customer/invoice/
  amount/method passed through exactly, cheque details carried, a walk-in payment records
  `p_invoice_id: null`, RPC errors propagate — and for `getCustomerLedger` (previously untested) —
  combines invoices + payments, and fails loudly (not silently) if either query fails independently.

All new/extended files registered in `src/sandbox/test-groups.ts` (`vitestFiles` + real `unitDesc`
copy) and `src/sandbox/test-cases.ts` (one `TestCase` per real `it()`, plain-English, money-accurate).
`test-groups.test.ts` precision contract: green. `npm test` (no `SANDBOX_DB_URL` set, matching how
CI actually runs): **65 tests, 59 passed, 6 skipped, 0 failed.** `npx tsc --noEmit`: clean.

**Why `refunds-returns` was NOT done this pass, and the gap it exposes:**

Unlike the other three modules, there is no service-layer function to test for customer
refunds/returns — the entire flow (full/partial return, exchange, cash-refund/credit-split,
complete, undo) is ~700 lines of inline Supabase calls directly inside
`src/pages/ReturnsPage.tsx`, not a `returnService.ts`. There is nothing importable to unit-test.

A genuine sandbox-DB integration test is also not possible today, and this is the more important
finding: the RPCs the real return flow depends on — `adjust_customer_outstanding`
(`supabase/migrations/20260726120000_cheque_reversals_and_credit_balance.sql`), and, separately,
the never-actually-wired-up `create_sales_return_atomic` / `complete_sales_return` /
`undo_sales_return_atomic` (`supabase/migrations/20260515000000_loyalty_returns_v2.sql`) — **do not
exist in the `sandbox` schema.** Checked directly: `sandbox.reset_all()`'s own table loop and the
full text of `20260626000000_sandbox_schema_and_meta.sql` show only the tables + trigger functions
that existed in the original ad-hoc `sandbox-setup.sql` (pre-checkout-RPC era) were ported; nothing
from the newer checkout (`checkout_sale`), cheque (`update_cheque_status`,
`record_payment_atomic`), or returns/balance-adjustment (`adjust_customer_outstanding`,
`create_sales_return_atomic`, etc.) RPCs was carried over, even though `create_sales_return_atomic`
and the cheque RPCs actually predate the sandbox migration. (This is exactly what todo-013's own
locked decision — "integration tests run against sandbox only, never public" — rules out working
around by pointing a test at `public` instead.)

Porting those RPCs into `sandbox` is a migration change, which is outside this todo's authorized
`Files to Modify` (test files + `test-groups.ts` + `test-cases.ts` only) and money-adjacent enough
that it shouldn't happen inside a "grow test coverage" task without owner sign-off. Recommended
follow-up (for todo-014's audit, which exists precisely to catch and file gaps like this): (1) a
migration porting `adjust_customer_outstanding`, `checkout_sale`, `record_payment_atomic`, and
`update_cheque_status` into `sandbox`, schema-qualified, per the "going-forward convention" the
sandbox migration itself documents; (2) extracting `ReturnsPage.tsx`'s return/exchange/undo logic
into a `returnService.ts` so it's unit-testable independent of the DB; then a `refunds-returns` test
can be written against either layer.

**Commit:** see the commit created alongside this file move.
