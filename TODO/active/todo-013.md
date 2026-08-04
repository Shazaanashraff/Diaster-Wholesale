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
      **BLOCKED — see note at bottom.**
- [ ] **Payments & Cheques** test added: cheque lifecycle received → deposited → cleared / bounced;
      invalid transitions rejected with a specific error. Registered in `payments-cheques`.
      **BLOCKED — see note at bottom.**
- [x] Each new test file appears in **exactly one** group → `test-groups.test.ts` stays green.
- [x] Edge cases covered where relevant: valid, invalid types, negatives, empty, malformed
      payload, empty/wrong fetch — asserting specific error messages/codes. (Covered for the two
      modules landed this pass — damaged units on GRN, over-limit credit, overpayment clamp.)
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

Landed this pass: **Products & Inventory** (`src/sandbox/__tests__/products-inventory.test.ts`,
2 integration tests — GRN receipt sizes a stock batch correctly incl. damaged-unit handling, and
`deduct_stock_from_batch` reduces/rebalances it correctly) and **Customers & Credit**
(`src/sandbox/__tests__/customers-credit.test.ts`, 4 integration tests — credit-limit
allow/reject, sale+payment delta, overpayment clamped at 0). Both registered in their
`TEST_GROUPS`/`TEST_CASES` entries. `npm test` green (44 passed, 8 skipped — skips are the
DB-gated integration tests with no `SANDBOX_DB_URL` configured in this environment, same as the
pre-existing `sandbox-isolation.test.ts`), `npx tsc --noEmit` clean.

**Deferred — Refunds & Returns and Payments & Cheques, blocked on sandbox schema drift:**
While implementing these two modules I found `sandbox` (added by todo-008's
`20260626000000_sandbox_schema_and_meta.sql`) has fallen significantly out of sync with `public`
since that snapshot was taken. Specifically missing from `sandbox`:
- Tables: `sales_returns`, `sales_return_items` (ReturnsPage.tsx's actual return flow uses these —
  the `sandbox.returns` table that does exist is a different, older shape).
- Columns: `payments.cheque_status`, `customers.cheque_float`.
- Functions: `checkout_sale`, `record_payment_atomic`, `update_cheque_status`,
  `adjust_customer_outstanding`, `adjust_customer_outstanding_manual`, `restore_stock_to_batch`.
  (Note: `restore_stock_to_batch` and the standalone `deduct_stock_fifo` used by the public app
  aren't in the migrations directory at all for `public` — they appear to have been applied
  directly to the live DB outside version control, so their exact bodies can't be safely mirrored
  by inspection alone.)

A genuine Refunds & Returns test needs `sales_returns`/`sales_return_items` +
`adjust_customer_outstanding`; a genuine Payments & Cheques test needs `cheque_status`/
`cheque_float` + `record_payment_atomic`/`update_cheque_status`. Writing a schema migration to
backfill all of this blind — with no `SANDBOX_DB_URL` available in this sandboxed run to apply
and verify it against a real database — was judged too risky to push straight to `main`. This
needs either a session with real DB credentials to author and verify the parity migration, or a
dedicated schema-sync todo before the remaining two modules of this task can be safely completed.
