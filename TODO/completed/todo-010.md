---
id: todo-010
title: Sandbox feature [3/7] — test catalog (Layer 1) + precision-contract test
priority: 2
created: 2026-06-24
status: completed
---

## Overview

Part 3 of the Sandbox series. Creates the hand-maintained manifests that drive the Sandbox
screen's catalog, plus a test that keeps the catalog honest. The catalog describes, in plain
English an owner understands, what each automated test guarantees.

**🔒 LOCKED DECISIONS:** There is **NO "Money & Ledger" group** — this app has no ledger and
uses decimal money. Describe **only real tests that exist** today; do not fabricate descriptions
for tests that come later (those are todo-013).

**Depends on:** todo-009 (the `sandbox` group references the isolation test).

## Completion Test

- [ ] `src/sandbox/test-groups.ts` exports `TestGroup` interface + `TEST_GROUPS` with the 12
      feature areas: `products-inventory, sales-pos, refunds-returns, payments-cheques,
      customers-credit, suppliers-purchasing, stock-transfers, salespeople, reports, offline-sync,
      core-infra, sandbox`.
- [ ] `sales-pos` group lists `vitestFiles:['src/services/posService.test.ts']`, `e2e:'pos-checkout'`.
- [ ] `sandbox` group lists the isolation test + the precision-contract test in `vitestFiles`.
- [ ] All other groups start with `vitestFiles: []`, `e2e: null`, and an honest `unitDesc`
      (e.g. "No automated tests yet — covered manually for now").
- [ ] `src/sandbox/test-cases.ts` exports `TestCase` + `TEST_CASES` keyed by group id, with one
      entry per **real** `it(...)` in `posService.test.ts`, plus the E2E flow, plus the 2 sandbox tests.
- [ ] `src/sandbox/__tests__/test-groups.test.ts` asserts (a) every `src/**/*.test.{ts,tsx}` is in
      exactly one group's `vitestFiles`, and (b) every listed path resolves to a real file.
      Path comparison normalises `\` vs `/`.
- [ ] `npm test` is green (all three current test files registered).
- [ ] **Demonstrated:** adding `src/sandbox/__tests__/_dummy.test.ts` makes the precision contract
      FAIL; deleting it makes it pass. The failing message is recorded in Completion Notes.
- [ ] `npx tsc --noEmit` clean.

---

## Implementation Guide

`test-groups.ts` and `test-cases.ts` are the single source of truth for the UI grid (todo-012).
The precision contract is the safety net: it fails the build if any test file is missing from
the catalog, so the catalog can never silently fall out of date. Author descriptions by reading
the actual `it()` blocks in `posService.test.ts` — one catalog entry per test, money-accurate to
this app (LKR, decimals).

## Implementation Steps

1. Create `src/sandbox/test-groups.ts` with the `TestGroup` interface (fields: `id, label,
   vitestFiles, e2e, unitDesc, e2eDesc`) and `TEST_GROUPS` array of all 12 groups. Only
   `sales-pos` and `sandbox` have real files today; the rest are empty-but-listed.
2. Create `src/sandbox/test-cases.ts`. Open `src/services/posService.test.ts`, and for each
   `it(...)` write one `TestCase { name, what, type }`. Keep `what` concrete and plain-English
   (e.g. "If the cart wants more than is in shop stock, checkout stops before the database is
   ever asked to record the sale"). Add the `pos-checkout` E2E flow as a `type:"e2e"` entry, and
   the two sandbox tests under the `sandbox` group.
3. Create `src/sandbox/__tests__/test-groups.test.ts`:
   - Glob all `src/**/*.test.{ts,tsx}` (use Node `fs.globSync` on Node 22+, else recurse
     `readdirSync`). Normalise separators.
   - Assert each globbed file appears in exactly one group's `vitestFiles`.
   - Assert each listed `vitestFiles` path `existsSync`.
   - (Optional) assert each non-null `e2e` resolves to `e2e/<name>.spec.ts`.
   - Remember this file is itself a `*.test.ts` → it must be listed in the `sandbox` group, or
     the contract flags it as an orphan.
4. Run `npm test` (green). Then DEMONSTRATE: create `_dummy.test.ts`, run `npm test` (precision
   contract FAILS — capture the message), delete `_dummy.test.ts`, run `npm test` (green).
5. `graphify update .`.

## Files to Modify

- **Create:** `src/sandbox/test-groups.ts`, `src/sandbox/test-cases.ts`,
  `src/sandbox/__tests__/test-groups.test.ts`

## Completion Notes

- `src/sandbox/test-groups.ts`: 12 `TEST_GROUPS` entries (`products-inventory, sales-pos,
  refunds-returns, payments-cheques, customers-credit, suppliers-purchasing, stock-transfers,
  salespeople, reports, offline-sync, core-infra, sandbox`), no "Money & Ledger" group. Only
  `sales-pos` (`src/services/posService.test.ts`, `e2e:'pos-checkout'`) and `sandbox`
  (`sandbox-isolation.test.ts` + `test-groups.test.ts`) have real files; the other 10 start
  `vitestFiles: []`, `e2e: null`, with an honest "No automated tests yet — covered manually for
  now." `unitDesc`.
- `src/sandbox/test-cases.ts`: 29 `TestCase` entries under `sales-pos` (one per real `it(...)` in
  `posService.test.ts`) + 1 `type:"e2e"` entry for the `pos-checkout` flow = 30. Plus 5 entries
  under `sandbox`: 2 `type:"integration"` (the isolation tests) + 3 `type:"unit"` (the precision
  contract's own three assertions). 35 `TestCase` entries total.
- `src/sandbox/__tests__/test-groups.test.ts`: 3 tests — every `src/**/*.test.{ts,tsx}` is in
  exactly one group's `vitestFiles` (with `\`/`/` normalised via a manual `readdirSync` walk,
  Node 22 was available but `fs.globSync` wasn't needed), every listed path `existsSync`s, and
  every non-null `e2e` resolves to `e2e/<name>.spec.ts`.
- `npm test`: 3 test files, 33 passed + 2 skipped (the 2 DB-dependent isolation assertions skip
  without `SANDBOX_DB_URL`/`SUPABASE_DB_URL`; the "no creds configured" placeholder test covers
  that case and passes).
- **Demonstrated:** created `src/sandbox/__tests__/_dummy.test.ts` (a real `it(...)`, not
  registered anywhere) → `npm test` failed with:
  ```
  AssertionError: src/sandbox/__tests__/_dummy.test.ts should be registered in exactly one
  TEST_GROUPS entry: expected +0 to be 1 // Object.is equality
  ```
  Deleted `_dummy.test.ts` → `npm test` green again (3 files, 33 passed, 2 skipped).
- `npx tsc --noEmit`: clean.
- `npx eslint .` could not be run to verify style: `eslint.config.js` throws `TypeError: Cannot
  read properties of undefined (reading 'recommended')` in this environment — same pre-existing,
  unrelated failure already noted in todo-009's Completion Notes. Not part of this todo's
  completion test.
- `graphify update .` could not be run: no `graphify` binary is installed in this environment
  (same as noted in todo-009). Not a completion-test gate for this todo.
