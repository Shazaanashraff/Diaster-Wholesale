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

> _Empty until todo-014 runs. todo-014 writes its findings here — one block per section, dated._

<!--
### Review run YYYY-MM-DD (commit <hash>)
- A. Schema & isolation: PASS/GAP — ...
- B. Catalog: PASS/GAP — ...
- C. Runner: PASS/GAP — ...
- D. Screen: PASS/GAP — ...
- E. Gating & quality: PASS/GAP — ...
- F. Coverage: progress note — ...
- Locked-decision violations found: none / <list>
- Follow-up todos opened: <ids or none>
- Verdict: SHIP / NEEDS FIXES
-->
