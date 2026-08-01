---
id: todo-013
title: Sandbox feature [6/7] — grow test coverage (initial integration + E2E batch)
priority: 3
created: 2026-06-24
status: completed
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
- [x] **Refunds & Returns** test added: full + partial return against a confirmed sale reduces the
      customer's outstanding balance by the right amount. Registered in `refunds-returns`.
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

All four checklist modules covered in one pass. 34 new tests across 4 new files (all `npm test`
green, `npx tsc --noEmit` clean, `test-groups.test.ts` precision contract green):

- `src/sandbox/__tests__/products-inventory.integration.test.ts` (6 tests, integration/pg) — GRN
  receiving via `purchases`→`purchase_receive`→trigger, FIFO deduction, insufficient-stock error.
- `src/sandbox/__tests__/customers-credit.integration.test.ts` (8 tests, integration/pg) — sale+payment
  balance mechanics via `adjust_customer_outstanding`, plus `adjust_customer_outstanding_manual`
  validation paths.
- `src/sandbox/__tests__/refunds-returns.integration.test.ts` (8 tests, integration/pg) — credit
  release on full/partial returns, `restore_stock_pieces`, `create_sales_return_atomic`.
- `src/services/customerService.cheque.test.ts` (12 tests, **unit**, mocked Supabase — see gap #1
  below for why this group isn't an integration test).

None of the pg-based integration tests could be executed live: this runner's network policy allows
HTTPS-via-proxy only (confirmed — direct TCP to Postgres port 5432, including the connection
pooler, times out/fails at the socket level; PostgREST over HTTPS does work and was used read-only
to confirm the `sandbox` schema/marker are real). Every query is written and reasoned from a full
read of the relevant migration source, and all four files follow the same guarded-skip pattern as
`sandbox-isolation.test.ts` (`SANDBOX_DB_URL`/`SUPABASE_DB_URL`), so they'll actually run wherever
that env var is set. **A human with real `SANDBOX_DB_URL` access should run these once before
trusting them at face value.**

### Real gaps/bugs found while writing these tests (not fixed here — out of this todo's scope, but
### worth acting on; flagged prominently to the user)

1. **`sandbox` is missing two columns `public` has**: `sandbox.customers` has no `cheque_float`,
   and `sandbox.payments` has no `cheque_status` (both added to `public` by
   `20260625000000_cheque_management.sql`, never mirrored into
   `20260626000000_sandbox_schema_and_meta.sql`, which violates that migration's own "GOING-FORWARD
   CONVENTION"). Result: `update_cheque_status()` and `record_payment_atomic()` — **any** payment,
   not just cheques — both error with "column does not exist" against `sandbox`, and would 404 via
   the app's own `dev:sandbox` mode too (confirmed live: `sandbox.update_cheque_status` isn't
   resolvable via PostgREST's `Accept-Profile: sandbox`, PGRST202). This is why Payments & Cheques
   is unit-tested here instead of integration-tested.
2. **`adjust_customer_outstanding_manual()` cannot ever succeed**, in `public` OR `sandbox` — this
   is a live app bug, not a sandbox-only gap. It inserts `payments.invoice_id = NULL` for the audit
   row, but `payments.invoice_id` is `NOT NULL` (unchanged since `init_schema.sql`). Every valid
   call (real customer, non-empty reason, non-zero delta) throws a NOT NULL violation and rolls
   back its own balance update. Its input-validation paths (empty reason / zero delta / unknown
   customer) all raise correctly since they run before the broken INSERT — only the happy path is
   broken. Covered by a test named `BUG: adjust_customer_outstanding_manual with valid input always
   fails` in `customers-credit.integration.test.ts`. **Admin manual balance corrections are
   currently non-functional in production if this path is ever exercised.**
3. `src/pages/ReturnsPage.tsx`'s `restoreStock()` calls an RPC named `restore_stock_to_batch` that
   has no `CREATE FUNCTION` anywhere under `supabase/migrations/` — its real behavior couldn't be
   verified from source, so no test touches it. Worth a follow-up to find where it actually lives
   (ad-hoc SQL never checked in, à la the original `sandbox-setup.sql` problem todo-008 fixed) or to
   confirm it's actually broken.
4. **Confirmed, not a bug**: the credit-limit rule (a sale can't push a customer over their credit
   limit) is enforced **only** client-side, in `checkCreditLimit()`
   (`src/services/posService.ts`, tested under `sales-pos`). Nothing in the database — not
   `checkout_sale()`, not `adjust_customer_outstanding()` — stops `outstanding_balance` from
   exceeding `credit_limit`. Documented directly in a test rather than assumed.

Deferred to a later pass: none of the 4 checklist modules — all 4 have real test files. What's
deferred is deeper coverage beyond what's here (e.g. the Exchange path of
`create_sales_return_atomic`, which wasn't exercised — only the standard Return path was).
