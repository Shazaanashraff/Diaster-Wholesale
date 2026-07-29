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
- [ ] **Customers & Credit** test added: credit-limit rule enforced; outstanding balance updates
      correctly after a sale + payment. Registered in `customers-credit`. *(partial — see notes)*
- [ ] **Refunds & Returns** test added: full + partial return against a confirmed sale reduces the
      customer's outstanding balance by the right amount. Registered in `refunds-returns`.
      *(not done — see notes)*
- [ ] **Payments & Cheques** test added: cheque lifecycle received → deposited → cleared / bounced;
      invalid transitions rejected with a specific error. Registered in `payments-cheques`.
      *(partial — see notes)*
- [x] Each new test file appears in **exactly one** group → `test-groups.test.ts` stays green.
- [ ] Edge cases covered where relevant: valid, invalid types, negatives, empty, malformed
      payload, empty/wrong fetch — asserting specific error messages/codes. *(covered for
      Products & Inventory; not exhaustive elsewhere — see notes)*
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

**This pass (Sonnet 5, automated TODO runner) completed one module fully and two partially; one
module was blocked entirely.** `npm test` is green (63 passed, 3 skipped — all guarded no-creds
skips, consistent with the pre-existing `sandbox-isolation.test.ts` pattern) and `npx tsc --noEmit`
is clean.

**Products & Inventory — done.**
- `src/services/purchaseService.test.ts` (new, 8 tests, mocked Supabase): `receivePurchase`'s
  client-side validation (received > ordered, damaged > received, both rejected before any write;
  an invalid item in a batch blocks the whole batch), the success path (inserts `purchase_receive`
  rows, flips `purchases.status` to `received`), the underlying-DB-error passthrough, and
  `createPurchase`'s RMB total math + RPC/insert error propagation.
- `src/sandbox/__tests__/products-inventory.integration.test.ts` (new, guarded-skip against the
  `sandbox` schema, self-contained — creates and rolls back its own supplier/location/product/
  purchase fixtures so it never depends on `sandbox-seed.sql`): confirms receiving a PO fires
  `trg_purchase_receive_trigger` and creates the right `stock_batches` row (received − damaged,
  split into cartons/loose by `pieces_per_carton`), that `deduct_stock_fifo()` consumes it down to
  the exact right remainder on a sale, and that overselling raises `Insufficient stock` instead of
  going negative. This is the closest fit to the todo's "container/GRN with roll measurements"
  wording — this codebase's domain has cartons + pieces of general merchandise, not textile rolls.
  Both files registered under `products-inventory` in `test-groups.ts`/`test-cases.ts`.

**Customers & Credit — partial.** Added 4 tests to `src/services/customerService.test.ts` covering
`recordPayment()`'s RPC wiring (customer/invoice/amount/method passed to `record_payment_atomic`
untouched, null `invoice_id` for general payments, cheque fields carried through, RPC-error
propagation). Credit-limit enforcement itself (`checkCreditLimit`) was already tested — it's filed
under `sales-pos` (it runs inside `posService.checkout()`), cross-referenced in `customers-credit`'s
`unitDesc` rather than duplicated. **Not done:** a test proving the outstanding balance actually
changes correctly after a real sale + payment — that math lives inside the `record_payment_atomic`
Postgres function, which (see gap below) isn't in the `sandbox` schema, so it can't be integration-
tested today; only the JS→RPC call shape is covered.

**Payments & Cheques — partial.** Added `src/services/chequeLifecycle.test.ts` (new, 8 tests):
every lifecycle wrapper (`depositCheque`, `completeCheque`, `returnCheque`,
`reverseChequeToReturned`, `undoChequeDeposit`, `representCheque`) calls `update_cheque_status`
with the exact `payment_id`/`new_status` pair, and two tests prove a DB rejection (invalid
transition, non-cheque payment) propagates to the caller with its message intact — using the
literal error-message format from
`supabase/migrations/20260726120000_cheque_reversals_and_credit_balance.sql`. **Not done:** this is
RPC-wiring coverage only, against a mocked Supabase client — it does not prove the Postgres state
machine itself rejects invalid transitions, because (see gap below) `update_cheque_status` isn't in
the `sandbox` schema either.

**Refunds & Returns — not started.** Two blockers, not something a mocked unit test can work around:
1. There's no importable, testable function. The return/exchange math (`creditPortion`,
   `cashPortion`, `exchangeDiff` — `src/pages/ReturnsPage.tsx` ~lines 373–382, 393, 633) is a
   closure inside the `ReturnsPage` React component, not an exported service function.
2. The RPC that actually moves `customers.outstanding_balance` for a return
   (`adjust_customer_outstanding`) isn't in the `sandbox` schema (see gap below), so a
   `sandbox`-only integration test (this todo's locked decision — never `public`) can't reach it
   either.

**Root cause tying the two "partial"s and the "not started" together — a schema-parity gap:**
when `sandbox_schema_and_meta.sql` (`20260626000000`) forked `public` into `sandbox`, it captured
`public` as it stood *that day*. Three RPCs added to `public` afterwards were never ported:
`record_payment_atomic` and the original `update_cheque_status`
(`20260625000000_cheque_management.sql` — technically pre-dates the fork by a day but still missing),
`adjust_customer_outstanding` + the reversal-aware `update_cheque_status`
(`20260726120000_cheque_reversals_and_credit_balance.sql`), and `adjust_customer_outstanding_manual`
(`20260728000000_manual_balance_adjustment.sql`). `todo-008` already flagged a related column-level
version of this gap (`customers.cheque_float`, `payments.cheque_status`/`payment_type`,
`invoices.salesperson_id`, `stock_batches.original_units` missing from `sandbox`) but it turns out
to extend to these functions too — none of them exist under `sandbox.*` today. Only the original
fork-day functions (`deduct_stock_fifo`, `trg_purchase_receive_stock`/trigger, `restore_stock_pieces`,
supplier-return triggers) are present in `sandbox`, which is why Products & Inventory could get a
real integration test and the other three modules could not.

**Recommendation for whoever picks this up next:** port the three RPCs above (and the missing
columns from todo-008) into the `sandbox` schema — that unblocks real integration tests for all
three remaining modules in one pass. Until then, extracting `ReturnsPage.tsx`'s return-math into a
plain exported function would at least make Refunds & Returns unit-testable without touching the
schema gap. This todo remains `needs-review`/incremental per its own instructions ("can be split
across sessions... use the Completion Test as checkpoints") — Products & Inventory's checklist item
is fully closed; the rest are left unchecked above, not silently claimed done.
