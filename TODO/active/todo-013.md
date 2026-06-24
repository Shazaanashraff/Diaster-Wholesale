---
id: todo-013
title: Sandbox feature [6/7] — grow test coverage (initial integration + E2E batch)
priority: 3
created: 2026-06-24
status: active
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
<!-- Sonnet 4.6 fills: which modules were covered this pass, test counts, any deferred to a later
     pass, commit hash. -->
