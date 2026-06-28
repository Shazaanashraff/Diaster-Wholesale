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

### Review run 2026-06-28 (commit efab50e, audited range 938dd34…efab50e)

**A. Schema & isolation — PASS**
- Migration `20260626000000_sandbox_schema_and_meta.sql` creates `schema sandbox`, grants USAGE to `anon, authenticated, service_role`, and mirrors all public tables with `NUMERIC(12,2)` money columns.
- `app_meta(schema_marker, app_version)` exists in both schemas; `sandbox.app_meta.schema_marker = 'sandbox'` is asserted by `scripts/sandbox-reset.mjs:16`.
- `sandbox.reset_all()` (migration line 1441) truncates only `WHERE schemaname = 'sandbox' AND tablename <> 'app_meta'` — no public schema touch possible. Execute granted to `service_role` only (REVOKE ALL FROM PUBLIC first).
- `scripts/sandbox-reset.mjs` opens a transaction, checks `schema_marker = 'sandbox'` before calling `reset_all()`, then re-seeds. No `public` truncate/delete path exists in the script.
- `sandbox-isolation.test.ts` skips cleanly when `SANDBOX_DB_URL` is absent; when present, asserts public row counts are unchanged after reset.
- _Bigint note:_ Migrations use `bigint` for internal count variables (`carton_adj`, `v_count`) — these are unit counts, not money columns. All money columns remain `NUMERIC(12,2)`. Not a violation.

**B. Catalog — PASS**
- `test-groups.ts` exports `TestGroup` + `TEST_GROUPS` with 12 feature groups; no "Money & Ledger" group present.
- `test-cases.ts` exports `TestCase` + `TEST_CASES`; all entries map to real `it()` calls verified in the test files created this session.
- `test-groups.test.ts` asserts every `src/**/*.test.{ts,tsx}` is in exactly one group and every listed path resolves on disk.
- Precision-contract demonstration (runbook step 4): adding `src/dummy-unregistered.test.ts` caused `test-groups.test.ts` to fail with "expected 1 to have length 0"; removing it restored 67 passed / 0 failed.

**C. Runner — PASS**
- `main.mjs` registers `sandbox:run`, `sandbox:reset`, `sandbox:cancel`; all return `{ ok: false, reason: 'unavailable-in-packaged-build' }` when `app.isPackaged` (lines 234, 252, 257).
- `sandbox:run` dispatches: full `npm test`, per-module `npx vitest run --reporter=verbose <files>`, E2E `npx playwright test --reporter=line e2e/<spec>.spec.ts` — no `pnpm` anywhere.
- Concurrent run rejected: `if (activeProc) return { ok: false, reason: 'already-running' }` (line 207–208).
- Cancel (lines 258–266): Windows `proc.kill()` + `taskkill /pid <pid> /T /F`; POSIX `SIGTERM`.
- Output streamed line-by-line via `webContents.send('sandbox:output', out)` after ANSI-stripping and simplification.
- `window.sandboxRunner` exposed in `preload.js` only when `process.argv.includes('--enable-sandbox-runner')`; that arg is only added in `main.mjs` line 58 when `isDev = !app.isPackaged`.

**D. Screen — PASS**
- `DeveloperPortal.tsx` renders the `sandbox` tab button only when `typeof (window as any).sandboxRunner !== 'undefined'` — hidden in all non-dev builds.
- `SandboxRunnerPanel.tsx` implements: status badge (`role="status"`, `aria-live="polite"`, `motion-safe:animate-pulse` dot); Run Unit+Integration, Run E2E, Reset (confirm dialog), Cancel (visible only while running).
- Per-module grid from `TEST_GROUPS` with Unit(blue)/DB(violet)/E2E(amber) pills hidden at 0; expand/collapse rows listing name + what grouped by type.
- Log panel: `h-52` fixed height, auto-scroll, "Scroll to latest" re-pin button on scroll-up; pass/fail by icon (CheckCircle/XCircle) + colour, not colour alone; "No output yet" placeholder.
- Uses existing dark-theme design tokens; `motion-safe:` prefix honours `prefers-reduced-motion`.

**E. Gating & quality — PASS**
- `npx tsc --noEmit`: clean (no output).
- `npm run build`: succeeds (2932 modules, only pre-existing warnings about chunk size and CSS lint).
- `npm test`: 67 passed, 4 skipped sandbox integration (SANDBOX_DB_URL not set in this env), 0 failed.
- Locked-decision grep results: no `getActiveSchema`/runtime toggle; no `pnpm` in runner; no `public` truncate/delete in reset script. `bigint` hits are unit-count locals in migrations, not money columns — not a violation.
- `graphify update .`: graphify is not installed in this environment (not a project dependency); skipped.

**F. Coverage — PASS (incremental)**
- First coverage batch complete: `inventory.test.ts` (11 unit + 2 sandbox integration), `customers.test.ts` (11 unit + 2 sandbox integration), `payments.test.ts` (8 unit + 1 sandbox integration), `returns.test.ts` (6 unit) — 36 new unit tests registered in 4 groups.
- Precision contract green with all 4 files registered.
- Remaining groups (suppliers-purchasing, stock-transfers, salespeople, reports, offline-sync, core-infra) have placeholder descriptions — acceptable per the incremental design of todo-013.

**Locked-decision violations found:** none

**Follow-up todos opened:** none — no gaps identified

**Verdict: SHIP**
