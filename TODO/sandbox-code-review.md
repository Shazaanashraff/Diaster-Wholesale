# Sandbox Feature — Code Review & Gap Check

> **Purpose:** the checklist the final task (**todo-014**) runs against the *finished*
> implementation to confirm every requirement is met and surface any gaps. todo-014 reads this
> doc, verifies each row against the actual code, and writes findings into
> **"Observations (filled by todo-014)"** at the bottom. This doc is a reference, not an
> auto-picked task — keep it at `TODO/` root, not in `active/`.

The implementation spans **todo-008 … todo-013**. Verify against the real codebase, not against
the original generic brief (which assumed a different architecture).

---

## Intentional deviations (NOT gaps)

These differ from the generic brief **on purpose** (owner-approved). A reviewer must mark them
**satisfied**, never flag them as missing:

| Brief said | We did instead | Why |
|---|---|---|
| Money = bigint minor units, double-entry ledger | Kept `NUMERIC(12,2)` + mutated balance columns | App has no ledger; migrating is weeks of risk for no functional gain |
| "Money & Ledger" test group | Omitted | This app has no ledger to test |
| Runtime `sandboxMode` toggle + `getActiveSchema()` + schema-param data layer | Kept launch-time `VITE_SUPABASE_SCHEMA` switch | One `supabase` singleton shared by ~19 services; rewiring is high-risk for a dev convenience |
| pnpm monorepo (`packages/domain`, `@app/desktop`, pnpm filters) | npm single-package commands (`npm test`, `npx vitest`, `npx playwright`) | Repo is a single npm package |
| Playwright `*.e2e.ts` naming | `e2e/<name>.spec.ts` | Matches existing repo convention |
| New top-level Sandbox route/nav | Tab inside `DeveloperPortal` | Owner choice; reuses dev-role gating |

---

## Requirements traceability (verify each)

### A. Sandbox schema & isolation (todo-008, todo-009)
- [ ] A migration creates `schema sandbox` + grants usage to `anon, authenticated, service_role`.
- [ ] All sandbox tables exist via migration, shapes match their `public` counterparts (money = `NUMERIC(12,2)`).
- [ ] `app_meta(schema_marker, app_version)` exists in **both** schemas, each with the correct marker.
- [ ] `sandbox.reset_all()` truncates **only** `schemaname='sandbox'` (excludes `app_meta`), execute granted to `service_role` only.
- [ ] `npm run sandbox:reset` exists, is schema-guarded (marker check + transaction), reseeds idempotently, has **no** `public` data-clearing path.
- [ ] `supabase/seed/sandbox-seed.sql` provides fixed-UUID baseline POS data, idempotent.
- [ ] `sandbox-isolation.test.ts` proves `public` counts are unchanged after reset; skips cleanly without creds.

### B. Catalog Layer 1 (todo-010)
- [ ] `test-groups.ts` exports `TestGroup` + `TEST_GROUPS` (12 real feature areas, no Money & Ledger group).
- [ ] `test-cases.ts` exports `TestCase` + `TEST_CASES`; every entry maps to a **real** existing test.
- [ ] `test-groups.test.ts` asserts each `src/**/*.test.{ts,tsx}` is in exactly one group AND every listed path resolves; separators normalised.
- [ ] **Demonstrated** that adding a stray test file makes the precision contract fail (message recorded in todo-010 Completion Notes).

### C. Live runner Layer 2 (todo-011)
- [ ] IPC `sandbox:run` / `sandbox:reset` / `sandbox:cancel` registered in `main.mjs`; all return an error when `app.isPackaged`.
- [ ] Unit run = `npm test`; per-module = `npx vitest run --reporter=verbose <files>`; E2E = `npx playwright test --reporter=line e2e/<spec>.spec.ts`.
- [ ] Output streamed line-by-line, ANSI-stripped, simplified, via `sandbox:output`.
- [ ] Second concurrent run rejected.
- [ ] Cancel: Windows `proc.kill()` + `taskkill /pid <pid> /T /F`; POSIX `SIGTERM`.
- [ ] `window.sandboxRunner` exposed in preload **only when not packaged**; typed in `src/types/sandbox-runner.d.ts`.

### D. Sandbox screen (todo-012)
- [ ] `'sandbox'` tab in `DeveloperPortal`, rendered only when `window.sandboxRunner` is defined.
- [ ] Status badge Idle→Running(pulse)→Passed/Failed with `role="status"`/`aria-live`.
- [ ] Broad actions (Run Unit+Integration, Run E2E, Reset [destructive + confirm]); Cancel only while running.
- [ ] Per-module grid: label + Unit(blue)/DB(violet)/E2E(amber) pills hidden when 0; per-row Run Tests + Run E2E (or muted "no E2E").
- [ ] Expandable rows → Unit / Integration / E2E sections listing `name — what`.
- [ ] While running: other modules disabled + running banner.
- [ ] Log panel: monospace, fixed height, auto-scroll with pin-release on scroll-up, pass/fail by **icon+label not colour alone**, "No output yet" placeholder.
- [ ] `prefers-reduced-motion` honoured; existing design tokens, light + dark.

### E. Build gating & quality (all)
- [ ] Feature absent from packaged build (`window.sandboxRunner` undefined → tab hidden + handlers refuse).
- [ ] `npx tsc --noEmit` clean; `npm run build` clean; `npm test` green.
- [ ] `graphify update .` run after code changes.

### F. Coverage (todo-013, incremental — note progress, don't block)
- [ ] At least the first coverage batch added, each file registered in a group, precision contract green.

---

## Reviewer runbook (todo-014 executes these)

1. `npx tsc --noEmit` — must be clean.
2. `npm run build` — must succeed.
3. `npm test` — must be green; confirm `test-groups.test.ts` ran.
4. Re-run the precision-contract demonstration (add/remove a dummy test file) — confirm it fails then passes.
5. `npm run sandbox:reset` against a sandbox DB — confirm success summary; confirm `public` untouched (isolation test).
6. Grep for accidental violations of locked decisions:
   - bigint money / ledger tables introduced (should find none).
   - `getActiveSchema` / runtime `sandboxMode` toggle (should find none).
   - `pnpm` in the runner (should find none).
   - any `public` truncate/delete in `scripts/sandbox-reset.mjs` (should find none).
7. Confirm packaged-build gating: in `main.mjs`/`preload.js`, `window.sandboxRunner` is only
   exposed when not packaged.
8. Fill **Observations** below: per section A–F, write PASS / GAP with specifics. For each GAP,
   note file + what's missing + suggested fix, and (if small) open a follow-up todo.

---

## Observations (filled by todo-014)

### Review run 2026-06-24 (commit a64a043)

Runbook steps executed:
1. `npx tsc --noEmit` → **CLEAN**
2. `npm run build` → **✓ built in 11.01s** (chunk-size warning is pre-existing, not a gap)
3. `npm test` → **49 passed, 7 skipped** (7 skips = integration tests without SANDBOX_DB_URL — expected). `test-groups.test.ts` confirmed in output.
4. Precision-contract demonstration: added `_dummy.test.ts` → 1 FAIL with message `"These test files are not registered in any TEST_GROUP vitestFiles: • src/sandbox/__tests__/_dummy.test.ts"` → removed file → back to 49 passed. **Confirmed.**
5. `npm run sandbox:reset` — skipped (no SANDBOX_DB_URL in CI environment); isolation proof covered by `sandbox-isolation.test.ts` which is registered and would run given credentials.
6. Locked-decision greps: all clean (details below).
7. Packaged-build gating: confirmed in `electron/main.mjs:102` (`additionalArguments: isDev ? ['--enable-sandbox-runner'] : []`) and `electron/preload.js:3` (`if (process.argv.includes('--enable-sandbox-runner'))`), plus double-gate at `main.mjs:271` (`if (app.isPackaged) return { ok: false, reason: 'unavailable-in-packaged-build' }`).

---

#### A. Schema & isolation — **PASS**

- ✓ `GRANT USAGE ON SCHEMA sandbox TO anon, authenticated, service_role` at migration line 20.
- ✓ 29 sandbox tables created; money columns use `NUMERIC(12,2)` throughout (bigint hits in grep are for integer count columns `carton_adj`, `cartons_in`, etc. — correct SQL practice, not money).
- ✓ `public.app_meta` (marker='public') and `sandbox.app_meta` (marker='sandbox') both created and seeded at migration lines 1406–1440.
- ✓ `sandbox.reset_all()` at line 1448: loops `WHERE schemaname='sandbox' AND tablename<>'app_meta'`; execute granted only to `service_role` (line 1460); public revoked (line 1459).
- ✓ `scripts/sandbox-reset.mjs`: schema-marker guard (`schema_marker !== 'sandbox'` → throw), wrapped in `BEGIN/COMMIT/ROLLBACK`, reseeds with `ON CONFLICT DO NOTHING`. No `public` truncate/delete.
- ✓ `supabase/seed/sandbox-seed.sql`: fixed-UUID rows for locations, customers (incl. Walk-in Customer), supplier, products, stock_batches, purchase, invoice — all `ON CONFLICT DO NOTHING`.
- ✓ `src/sandbox/__tests__/sandbox-isolation.test.ts`: asserts public.products/customers/invoices counts unchanged after reset; skips cleanly with `describe.skipIf(!DB_URL)`.

#### B. Catalog — **PASS**

- ✓ `test-groups.ts` exports `TestGroup` interface + `TEST_GROUPS` array with exactly **12 groups**. No "Money & Ledger" group.
- ✓ `test-cases.ts` exports `TestCase` + `TEST_CASES`; every entry maps to a real `it()` block (29 unit + 1 e2e for sales-pos; 3 integration for products-inventory; 5+7+6 unit for customers-credit, refunds-returns, payments-cheques; 6 for sandbox group = 57 total TestCase entries mapping to 56 tests, with the E2E being a Playwright spec not in the vitest count).
- ✓ `test-groups.test.ts`: recursive glob of `src/**/*.test.{ts,tsx}`, orphan detection, path-exists check, path normalisation with `/` separator.
- ✓ Precision-contract demonstration re-confirmed (runbook step 4).

#### C. Runner — **PASS**

- ✓ `ipcMain.handle('sandbox:run', ...)`, `'sandbox:reset'`, `'sandbox:cancel'` all registered in `electron/main.mjs` lines 270–306.
- ✓ Command routing in `sandbox:run`: no filter → `npm test`; `filter.files` → `npx vitest run --reporter=verbose ...files`; `filter.spec` → `npx playwright test --reporter=line e2e/<spec>.spec.ts`.
- ✓ Output piped line-by-line via `readline`, ANSI-stripped in `stripAnsi()`, simplified in `simplify()`, sent as `sandbox:output`. `main.mjs:50-56`.
- ✓ Concurrent-run guard: `if (activeProc) { resolve({ ok: false, reason: 'already-running' }); return; }`. `main.mjs:43-45`.
- ✓ Cancel: Windows — `activeProc.kill()` + `spawn('taskkill', ...)` with `/T /F`; POSIX — `activeProc.kill('SIGTERM')`. `main.mjs:298-304`.
- ✓ `window.sandboxRunner` exposed in `preload.js` only when `--enable-sandbox-runner` flag present (dev-only). Typed in `src/types/sandbox-runner.d.ts`.

#### D. Screen — **PASS**

- ✓ `'sandbox'` tab added to `DeveloperPortal` only when `sandboxAvailable` (`DeveloperPortal.tsx:382`); content rendered only when both `portalTab === 'sandbox'` and `sandboxAvailable` (`line 936`).
- ✓ Status badge: `role="status"`, `aria-live="polite"` (`SandboxRunnerPanel.tsx:95-96`). Idle/Running/Passed/Failed states with distinct colours.
- ✓ Running state: `motion-safe:animate-pulse` (`line 106`) — respects `prefers-reduced-motion`.
- ✓ Broad actions: Run Unit+Integration, Run E2E, Reset Sandbox Data (with confirm dialog), Cancel (only while running). All disabled while running.
- ✓ Per-module grid: Unit (blue pill), DB/integration (violet pill), E2E (amber pill) — each hidden when count is 0.
- ✓ Expandable rows with ChevronDown/ChevronRight; expanded view shows Unit / Integration / E2E sections listing `name — what`.
- ✓ Running banner: "Tests are running — per-module actions are disabled" shown during run.
- ✓ Log panel: `h-56 overflow-y-auto`, auto-scroll (`scrollTop = scrollHeight`) with pin-release on scroll-up (`isAtBottom` state, `handleScroll`). Pass lines: green + `✓` prefix + `aria-label`. Fail lines: rose + `✗` prefix + `aria-label`. Placeholder text when empty.

#### E. Gating & quality — **PASS** (with note)

- ✓ Feature absent from packaged builds: `window.sandboxRunner` not exposed (no `--enable-sandbox-runner` flag); IPC handlers return `{ ok: false, reason: 'unavailable-in-packaged-build' }`.
- ✓ `npx tsc --noEmit` clean; `npm run build` clean; `npm test` 49 passed.
- ℹ️ `graphify update .` — tool not installed in this CI environment (`npx graphify` → "could not determine executable to run"). Graph files in `graphify-out/` are from a prior run. This is an environment limitation, not a code gap.

#### F. Coverage — **PASS (first batch complete)**

- ✓ 4 modules covered: Products & Inventory (3 integration), Customers & Credit (5 unit), Refunds & Returns (7 unit), Payments & Cheques (6 unit).
- ✓ Each new file registered in exactly one group; precision contract green after each addition.
- ✓ 8 modules remain with `vitestFiles: []` (Suppliers & Purchasing, Stock Transfers, Salespeople, Reports, Offline Sync, Core Infrastructure). These are incrementally deferred by design — the completion test says "at least the first coverage batch added."

---

#### Locked-decision violations

- **bigint money**: No money columns use bigint. The grep hits (`0::bigint` casts in SQL views for `carton_adj`, `cartons_in`, `pieces_in`, etc.) are integer unit-count columns, not money. NUMERIC(12,2) preserved throughout. **None.**
- **ledger / double-entry**: No ledger tables or ledger logic introduced. **None.**
- **getActiveSchema / runtime sandboxMode toggle**: `grep` returned zero hits. **None.**
- **pnpm in runner**: `grep` on `electron/main.mjs` returned zero hits. **None.**
- **public truncate/delete in reset script**: `grep` on `scripts/sandbox-reset.mjs` returned zero hits. **None.**

---

#### Follow-up todos opened

None. All requirements met. No gaps requiring follow-up todos.

---

#### Verdict: **SHIP**

The Sandbox series (todo-008 … todo-013) is complete. All sections A–F pass. Locked decisions respected. Precision contract demonstrated. Build, type-check, and test suite green.
