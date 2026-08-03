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
      `products-inventory`. *(No "roll measurements" concept exists anywhere in this app — see
      Completion Notes; implemented as the real equivalent: a GRN via `purchase_receive` +
      `purchases.status='received'` creates a stock batch, then `deduct_stock_fifo` deducts sold
      units oldest-batch-first.)*
- [x] **Customers & Credit** test added: credit-limit rule enforced; outstanding balance updates
      correctly after a sale + payment. Registered in `customers-credit`.
- [ ] **Refunds & Returns** test added: full + partial return against a confirmed sale reduces the
      customer's outstanding balance by the right amount. Registered in `refunds-returns`.
      **NOT DONE — see Completion Notes (real schema gap, not skipped for convenience).**
- [x] **Payments & Cheques** test added: cheque lifecycle received → deposited → cleared / bounced;
      invalid transitions rejected with a specific error. Registered in `payments-cheques`.
      *(Written as a unit test, not a sandbox-integration test — see Completion Notes.)*
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

### Status: needs-review (2026-08-03)

**What was done — 4 new test files, all registered in the catalog, `npm test` and
`npx tsc --noEmit` both clean:**

- `src/sandbox/__tests__/products-inventory.test.ts` (integration, real Postgres against
  `sandbox`, `.skipIf(!url)` guarded like `sandbox-isolation.test.ts`): receiving a purchase
  (`purchase_receive` rows + flipping `purchases.status` to `'received'`, which fires
  `sandbox.trg_purchase_receive_stock()`) creates a stock batch sized at received-minus-damaged
  units; a fully-damaged receipt creates no batch; `sandbox.deduct_stock_fifo()` consumes the
  oldest batch first and deletes it once emptied; selling more than is in stock raises
  `Insufficient stock` and leaves batches untouched (verified via a savepoint + rollback so the
  raised exception doesn't abort the whole test transaction). Registered in `products-inventory`.
- `src/utils/creditCheck.test.ts` (unit, pure function, no DB): `isOverCreditLimit` — within
  limit allowed, over limit blocked, exact-boundary allowed, `credit_limit <= 0` (incl. negative)
  treated as unlimited, missing fields default to 0; `getRemainingCredit` — exact headroom,
  `Infinity` when unlimited, floors at 0 rather than going negative.
- `src/sandbox/__tests__/customers-credit.test.ts` (integration, real Postgres against
  `sandbox`): a credit sale increases `outstanding_balance` by the credit portion; a payment
  decreases it; an overpayment clamps it at 0, never negative; a sale followed by an equal
  payment nets back to the starting balance. Both files registered in `customers-credit`
  alongside the existing `customerService.test.ts`.
- `src/services/customerService.cheques.test.ts` (unit, mocked Supabase client, mirrors
  `customerService.test.ts`'s pattern): each of `depositCheque`/`completeCheque`/`returnCheque`/
  `reverseChequeToReturned`/`undoChequeDeposit`/`representCheque` sends the exact
  `update_cheque_status` RPC call for its transition; a rejected (invalid) transition propagates
  as a thrown error instead of being swallowed. Registered in `payments-cheques`.

**Why `products-inventory` doesn't literally match "roll measurements":** grepped the entire
codebase (SQL + `src/`) for "roll"/"GRN" — neither concept exists anywhere in this app. Goods
receiving here is carton/piece based (`purchase_receive.received_units`/`damaged_units` →
`pieces_per_carton`-split stock batch), so the test covers that real flow instead — the
substance of the requirement ("record a container/GRN... verify sold units deduct from remaining
stock") is met, just not the literal "roll measurements" phrasing, which appears to not apply to
this app's actual data model.

**Why `Refunds & Returns` was NOT done (real schema/code gap, discovered while researching this
todo, not skipped for convenience):**
- The real customer-facing returns tables (`sales_returns`, `sales_return_items`) and their RPCs
  (`create_sales_return_atomic`, `complete_sales_return`, `undo_sales_return_atomic`, all defined
  in `20260515000000_loyalty_returns_v2.sql`) exist **only in `public`** — they were added after
  the one-time `sandbox` schema snapshot (`20260626000000_sandbox_schema_and_meta.sql`) and were
  never backported, breaking that migration's own stated convention ("future migrations that
  change `public` apply the identical DDL to `sandbox` in the same file"). `sandbox` only has a
  much older, structurally different leftover `sandbox.returns` table with no matching RPC.
- Worse, the app itself (`src/pages/ReturnsPage.tsx`) doesn't call those atomic RPCs at all — it
  does its own non-atomic sequence of plain `.insert()`/`.update()` calls against
  `sales_returns`/`sales_return_items`, plus a call to an RPC named `restore_stock_to_batch`
  (also called from `src/services/posService.ts:418`) that **is not defined in any `.sql` file in
  the repo, tracked or untracked** — this looks like a pre-existing orphaned/broken RPC call, not
  something introduced by this todo. Flagging it here for todo-014's code-review pass to catch
  formally, since it's outside this todo's scope (add tests, not fix bugs).
- Given neither the real DB objects nor an isolated, mockable service function exist for this
  module (the return logic lives directly in the 700+ line `ReturnsPage.tsx` component, not a
  `src/services/*.ts` file), a genuine test — integration or unit — could not be written without
  either (a) a schema migration backporting the returns tables/RPCs to `sandbox`, or (b)
  extracting the return/refund-amount logic out of the page component into a testable module.
  Both are out of scope for "add tests" work and are recommended as a follow-up todo (not opened
  as a new file per the process below, since this file itself stays `active`-eligible for that
  follow-up — see Rules, "maximum 10 todo per run").

**Why `Payments & Cheques` is a unit test, not a sandbox-integration test:** for the same reason
as above — `update_cheque_status`, and the `payments.cheque_status`/`payments.payment_type`/
`customers.cheque_float` columns it depends on, exist only in `public` (added by
`20260625000000_cheque_management.sql` and `20260703010000_payment_type_and_cheque_reporting.sql`,
neither backported to `sandbox`). `sandbox.payments` has no `cheque_status` column at all, so a
`sandbox`-schema integration test for the cheque state machine is not currently possible. The
unit test instead locks down the one piece of this that's actually this app's own code: that each
lifecycle action (`customerService.ts`) requests the correct transition and that RPC rejections
propagate rather than being swallowed.

**Recommended follow-up (not opened as a new todo file this run, to respect the "max 10 todo per
run" rule and because this is a discovery, not yet a scoped fix):** backport to `sandbox` —
`checkout_sale`, `record_payment_atomic`, `adjust_customer_outstanding`, `update_cheque_status`,
the `sales_returns`/`sales_return_items` tables and their three RPCs, and the
`payments.cheque_status`/`payment_type` + `customers.cheque_float` columns — so the sandbox schema
matches `public` per the original migration's own convention. That would unblock a real
`refunds-returns` integration test and upgrade `payments-cheques` from unit to integration. Also
worth a look: the orphaned `restore_stock_to_batch` RPC call noted above.

**Environment limitation:** this session could not reach the project's Supabase Postgres host
(`db.euekgqjxxzyrjfqvrwyo.supabase.co` — DNS resolution failed, egress blocked), so the two new
`.skipIf(!url)`-guarded integration test files were verified statically only: every column,
constraint, and function body they exercise was read directly from
`supabase/migrations/20260626000000_sandbox_schema_and_meta.sql` and cross-checked against the
test's inserts/assertions (in particular `sandbox.trg_purchase_receive_stock()`'s
sellable/cartons/loose_pieces arithmetic and `sandbox.deduct_stock_fifo()`'s FIFO-consumption
loop), but the tests themselves have not been run against a live database in this environment —
consistent with the same DB/Electron connectivity limitations noted in todo-008/011/012's
Completion Notes. They will run for real wherever `SANDBOX_DB_URL`/`SUPABASE_DB_URL` is set to a
reachable database with this migration applied.

`graphify update .` was not run — the `graphify` CLI is not installed/available in this session
(`command not found`).
