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
      `products-inventory`. (This app has no textile/roll products — implemented as the real
      equivalent, a cartons/pieces GRN receipt with partial damage, see Completion Notes. Not yet
      run against a live DB — see Completion Notes.)
- [x] **Customers & Credit** test added: credit-limit rule enforced; outstanding balance updates
      correctly after a sale + payment. Registered in `customers-credit`. (Not yet run against a
      live DB — see Completion Notes.)
- [ ] **Refunds & Returns** test added: full + partial return against a confirmed sale reduces the
      customer's outstanding balance by the right amount. Registered in `refunds-returns`.
      **BLOCKED — see Completion Notes: `sandbox.sales_returns` doesn't exist yet.**
- [ ] **Payments & Cheques** test added: cheque lifecycle received → deposited → cleared / bounced;
      invalid transitions rejected with a specific error. Registered in `payments-cheques`.
      **BLOCKED — see Completion Notes: `sandbox.payments.cheque_status` doesn't exist yet.**
- [x] Each new test file appears in **exactly one** group → `test-groups.test.ts` stays green.
- [x] Edge cases covered where relevant: valid, invalid types, negatives, empty, malformed
      payload, empty/wrong fetch — asserting specific error messages/codes. (For the two modules
      implemented this pass: insufficient-stock rejection, zero-sellable receipt, credit-limit
      boundary, and balance-clamps-at-zero.)
- [x] `npm test` green; `npx tsc --noEmit` clean. New `TestCase` descriptions added to
      `test-cases.ts` for every new test, plain-English and money-accurate. (Green only in the
      sense that the new DB-dependent tests compile and skip cleanly with no DB creds configured —
      not yet verified to pass against a live database.)

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

### Status: needs-review (2026-08-02)

**Modules covered this pass: Products & Inventory, Customers & Credit (2 of 4).**

- Created `src/sandbox/__tests__/products-inventory.test.ts` (4 real `it()`s, `type:"integration"`,
  `skipIf(!url)` gated exactly like `sandbox-isolation.test.ts`): drafts a purchase, records a
  partial-damage GRN receipt, flips the purchase to `received` (firing
  `sandbox.trg_purchase_receive_stock()`, `supabase/migrations/20260626000000_sandbox_schema_and_meta.sql:645-668`)
  and asserts the resulting `stock_batches` row is net of the damaged units; asserts a
  fully-damaged receipt creates no batch at all; asserts `deduct_stock_fifo()` (the same RPC
  `posService.ts`'s checkout path calls) removes exactly the sold units from remaining stock; and
  asserts it rejects a sale that exceeds what's in stock. Registered in `products-inventory` in
  `src/sandbox/test-groups.ts` and `src/sandbox/test-cases.ts`.
- Created `src/sandbox/__tests__/customers-credit.test.ts` (3 real `it()`s, same
  `skipIf(!url)` pattern): calls the real (unmocked) `isOverCreditLimit`/`getRemainingCredit`
  from `src/utils/creditCheck.ts` against a live sandbox customer row to confirm a sale exactly at
  the remaining credit limit is allowed and one rupee over is rejected; walks a credit sale +
  cash payment against a real `customers`/`invoices`/`payments` row set, mirroring the
  outstanding-balance read-then-write `posService.ts` does at checkout (`src/services/posService.ts:219-230`);
  and confirms a payment larger than the outstanding balance clamps at 0 rather than going
  negative (the same `GREATEST(0, ...)` invariant every balance-writing RPC in this app uses).
  Registered alongside the existing `customerService.test.ts` in `customers-credit`.
- Both new files fully clean up their own fixtures in `afterAll` and never touch seed rows or
  `public` — each creates its own product/customer/invoice via `gen_random_uuid()`-backed inserts,
  so they can run concurrently with `sandbox-isolation.test.ts` or each other without racing (no
  file calls `sandbox.reset_all()` itself).
- `npx tsc --noEmit`: clean. `npx vitest run`: 7 files, 44 passed, 9 skipped (the 9 are exactly the
  `skipIf(!url)` DB-dependent its across `sandbox-isolation.test.ts` (2) and the two new files
  (4 + 3) — none can execute here, see below). `test-groups.test.ts` precision contract: green.

**Why this is needs-review, not completed — two real blockers, not just environment:**

1. **No live Supabase project reachable, same limitation as todo-008/011/012.** No
   `SANDBOX_DB_URL`/`SUPABASE_DB_URL` is set in this environment, and the only Supabase project
   reachable through this session's MCP connection is unrelated to this app (see todo-008's notes).
   So none of the DB-dependent assertions above — old or new — actually executed against a real
   Postgres this pass; they only compiled and skipped cleanly. Everything above was verified by
   reading the actual migration/service source it exercises (cited above), not by running it.
2. **Refunds & Returns and Payments & Cheques are not just untested — the `sandbox` schema
   cannot support them yet, at all.** Their real logic lives in:
   - `sales_returns` / `sales_return_items` tables and `create_sales_return_atomic()` /
     `complete_sales_return()` / `undo_sales_return_atomic()`
     (`supabase/migrations/20260515000000_loyalty_returns_v2.sql`)
   - `payments.cheque_status`, `customers.cheque_float`, `record_payment_atomic()`,
     `update_cheque_status()` (`supabase/migrations/20260625000000_cheque_management.sql`)
   - `adjust_customer_outstanding()` and the reverse cheque transitions added to
     `update_cheque_status()` (`supabase/migrations/20260726120000_cheque_reversals_and_credit_balance.sql`)

   None of these exist in `supabase/migrations/20260626000000_sandbox_schema_and_meta.sql` — I
   grepped it for every one of the identifiers above and got zero matches. `sandbox.customers` has
   no `cheque_float` column (only `credit_balance`, a different, older column); `sandbox.payments`
   has no `cheque_status` column at all; `sandbox.sales_returns` doesn't exist. Two of these three
   migrations (`20260625...cheque_management`, `20260726...cheque_reversals_and_credit_balance`)
   postdate todo-008 (completed 2026-07-08) and were simply never back-ported; the third
   (`20260515...loyalty_returns_v2`) predates todo-008 but its objects were apparently not part of
   the 26 tables todo-008 carried over from the original `sandbox-setup.sql`. This breaks the
   "future migrations that change `public` apply the identical DDL to `sandbox` in the same file"
   convention todo-008 itself established (see its header comment) — none of these three followed
   it.

   Writing a real integration test for either module against the sandbox schema — as the locked
   decision "Integration tests run against the `sandbox` schema only" requires — is not possible
   until a migration ports these tables/columns/functions into `sandbox`, mirroring how
   `20260626000000_sandbox_schema_and_meta.sql` ported everything else. I did not write that
   migration myself: it's outside this todo's `Files to Modify` / `Implementation Steps`, and per
   the same environment limitation as (1) I'd have no way to verify it applies cleanly or is
   idempotent against a real database in this session. This is a genuine gap for a human (or
   todo-014's code-review pass) to open as its own follow-up, not an environment-only limitation
   like (1).

**What's needed to close this out:**
- Connect the real Diaster-Wholesale Supabase project (or a local Postgres with the migrations
  applied) and re-run `npx vitest run` to confirm the two new integration files actually pass
  against live data, not just skip.
- A migration that ports `sales_returns`/`sales_return_items` + their three RPCs, and
  `payments.cheque_status` + `customers.cheque_float` + `record_payment_atomic()` +
  `update_cheque_status()` + `adjust_customer_outstanding()`, into the `sandbox` schema — after
  which the Refunds & Returns and Payments & Cheques integration tests from this todo's checklist
  can be written the same way the two modules above were.
- This task remains intentionally incremental per its own instructions ("you may stop after any
  module and resume later") — Refunds & Returns and Payments & Cheques are unchecked below and
  should be picked up in a follow-up pass once the schema gap above is closed.
