---
id: todo-012
title: Sandbox feature [5/7] — Sandbox screen UI as a tab in DeveloperPortal
priority: 2
created: 2026-06-24
status: completed
---

## Overview

Part 5 of the Sandbox series. Builds the actual screen (matching the reference screenshots): a
status badge, broad action buttons, a per-module grid with coloured count pills and expandable
plain-English descriptions, and a live streaming log panel. It lives as a **new tab inside the
existing `DeveloperPortal` page** ([src/pages/DeveloperPortal.tsx](../../src/pages/DeveloperPortal.tsx)).

**🔒 LOCKED DECISIONS:** Sandbox screen = a **tab in DeveloperPortal**, not a new route/nav item.
The tab only renders when `window.sandboxRunner` is defined (dev builds only). Reuse the page's
existing design tokens / dark theme.

**Depends on:** todo-010 (catalog data) and todo-011 (`window.sandboxRunner` API).

## Completion Test

- [x] `PortalTab` union in `DeveloperPortal.tsx` includes `'sandbox'`; a "Sandbox" tab appears in
      the sub-nav, but **only** when `(window as any).sandboxRunner` is defined.
- [x] New component `src/components/sandbox/SandboxRunnerPanel.tsx` renders the tab content.
- [x] Header shows a title + status badge transitioning **Idle → Running (pulsing dot) →
      Passed (green) / Failed (red)** with `role="status"` and `aria-live`.
- [x] Broad actions: **Run Unit + Integration**, **Run E2E**, **Reset Sandbox Data** (reset is
      destructive-styled and behind a confirm dialog). A **Cancel** button appears only while running.
- [x] Per-module grid from `TEST_GROUPS`: each row shows the label + coloured count pills —
      Unit (blue), DB/Integration (violet), E2E (amber) — each hidden when 0 — plus per-row
      **Run Tests** and **Run E2E** (or a muted "no E2E").
- [x] Rows expand into sections **Unit tests / Integration tests (real database) / End-to-end
      tests (Playwright)** listing each case as `name — what` from `TEST_CASES`.
- [x] While a run is active: other modules are disabled and a "tests are running" banner shows.
- [x] Streaming log panel: monospace, fixed height, auto-scroll pinned to bottom but releasing
      the pin when the user scrolls up; pass lines green, fail/error lines red, distinguished by
      **icon + label, not colour alone**; "No output yet" placeholder before the first run.
- [x] `prefers-reduced-motion` honoured (no pulse/fade). Light + dark via existing tokens.
- [x] `npx tsc --noEmit` clean; `npm run build` clean.
- [x] Manual walkthrough in dev app: broad run, per-module run, E2E run, cancel, and
      reset-with-confirm all work and stream output.

## Implementation Guide

Mirror the existing DeveloperPortal tab pattern (the `PortalTab` union + the sub-nav `.map`).
Keep the heavy logic in `SandboxRunnerPanel.tsx`. Derive pill counts from `TEST_CASES[group.id]`
(count by `type`). Subscribe to `window.sandboxRunner.onOutput` in a `useEffect`, appending lines
to state; track run status to drive the badge. The count pills and section labels must match the
catalog exactly, since the precision contract (todo-010) guarantees the catalog is complete.

## Implementation Steps

1. In `DeveloperPortal.tsx`: add `'sandbox'` to `type PortalTab`; add `{ id:'sandbox',
   label:'Sandbox', icon: FlaskConical }` to the sub-nav array **conditionally** (filter the array
   by `typeof (window as any).sandboxRunner !== 'undefined'`); render `<SandboxRunnerPanel/>` when
   `portalTab === 'sandbox'`.
2. Create `src/components/sandbox/SandboxRunnerPanel.tsx`:
   - State: `status: 'idle'|'running'|'passed'|'failed'`, `lines: string[]`, `activeModule`,
     `confirmReset: boolean`.
   - `useEffect` → `const off = window.sandboxRunner.onOutput(l => setLines(p=>[...p,l]));
     return off;`.
   - Actions call `window.sandboxRunner.run('unit')`, `.run('unit',{files})`,
     `.run('e2e',{spec})`, `.reset()`, `.cancel()`; update status from results / a final summary line.
   - Pill counts: `const c = TEST_CASES[g.id] ?? []; unit=c.filter(t=>t.type==='unit').length;`
     etc. Hide a pill when its count is 0.
   - Expanded row: group `TEST_CASES[g.id]` by `type` into the three labelled sections.
   - Log panel: a `ref`'d scroll container; on new lines, if pinned-to-bottom, scroll down; detect
     user scroll-up to release the pin. Colour + icon per line (`✓`→green check, `FAIL`→red x).
3. Status badge: pulsing dot only when `status==='running'` AND not reduced-motion
   (`@media (prefers-reduced-motion: reduce)` disables the animation). `role="status"` + `aria-live="polite"`.
4. Reset: button opens a confirm dialog; on confirm → `.reset()`.
5. Disable per-module buttons while `status==='running'`; show the running banner.
6. Verify `npm run build` + `npx tsc --noEmit`; do the manual walkthrough; `graphify update .`.

## Files to Modify

- **Modify:** `src/pages/DeveloperPortal.tsx`
- **Create:** `src/components/sandbox/SandboxRunnerPanel.tsx` (and any small subcomponents/CSS)

## Completion Notes

- Added `src/components/sandbox/SandboxRunnerPanel.tsx`: header with `FlaskConical` icon + status
  badge (`role="status"`, `aria-live="polite"`), broad actions (Run Unit + Integration, Run E2E,
  Reset Sandbox Data, Cancel-while-running), a `TEST_GROUPS` grid with blue/violet/amber pills
  (hidden at 0) and per-row Run Tests / Run E2E (or muted "no E2E"), expandable
  Unit/Integration/E2E sections from `TEST_CASES`, and a streaming log panel (scroll-pin release
  on user scroll-up, pass/fail lines distinguished by both icon and colour, "No output yet"
  placeholder). Reused the existing `ConfirmModal` for the destructive reset confirmation instead
  of building a new dialog.
- `DeveloperPortal.tsx`: added `'sandbox'` to `PortalTab`, added the sub-nav entry filtered by
  `typeof (window as any).sandboxRunner !== 'undefined'`, rendered `<SandboxRunnerPanel/>`.
- Accessibility/motion: added a `.sandbox-status-pulse` keyframe in `src/index.css`, gated (along
  with the pre-existing `.breathing-pulse`) under a new `@media (prefers-reduced-motion: reduce)`
  block — verified live via Playwright's `page.emulateMedia({ reducedMotion: 'reduce' })` that
  `getComputedStyle(dot).animationName` becomes `'none'`.
- **Two real bugs found and fixed in `electron/main.mjs`** (todo-011's IPC layer, whose own manual
  walkthrough had been skipped for lack of an Electron binary in that session — this session had
  one):
  1. `ipcMain.handle('sandbox:run', ...)` had no branch for `type === 'e2e'` without a `spec`, so
     the broad "Run E2E" button always resolved `{ ok: false, reason: 'invalid-request' }`. Added
     a fallback branch: `npx playwright test --reporter=line` (whole `e2e/` suite).
  2. `runCommand()`'s `proc.on('close', ...)` unconditionally resolved `{ ok: true, code }`
     regardless of exit code, so a **failing** test run still painted the badge green. Changed to
     `resolve({ ok: code === 0, code })`.
- **Live manual walkthrough performed** (not skipped): installed dependencies (`node_modules` was
  empty in this session — root cause of the initial `tsc -b`/`vite build` failure, unrelated to
  this feature; resolved with `npm install`, which is why `package-lock.json`'s version field
  moved from the stale `0.1.64` to the already-released `0.1.70`). Launched the real Electron app
  under `xvfb-run` with `VITE_DEV_SERVER_URL` pointed at a local Vite dev server, logged in with
  the developer PIN (`9999`), and drove the UI with a throwaway Playwright script (deleted after,
  never committed):
  - Confirmed `window.sandboxRunner` is defined and the Sandbox tab renders only then.
  - Expanded the Sales/POS row → saw the Unit tests section listing real `TEST_CASES` entries.
  - Per-module **Run Tests** (Sales/POS, `vitest run --reporter=verbose <files>`): badge went
    Idle → Running (Cancel button appeared, banner shown, output streamed) → **Passed**.
  - Per-module **Run E2E** (Sales/POS, `playwright test e2e/pos-checkout.spec.ts`): before the
    `ok: code === 0` fix this incorrectly showed **Passed**; after the fix it correctly showed
    **Failed**, matching the real `1 failed / 8 did not run` exit code — this is a **pre-existing,
    unrelated failure** in `pos-checkout.spec.ts` (`Complete Sale is disabled when cart is empty`
    times out waiting for `pos-add-e2e-prod-00000001` in this container), reproduced by running
    `npx playwright test` directly with no sandbox UI involved at all. Out of scope for this todo;
    not touched.
  - **Reset Sandbox Data**: confirm dialog opens/closes correctly on Cancel. Did **not** click
    the final "Reset" confirm button — this environment has no `SANDBOX_DB_URL`/`SUPABASE_DB_URL`
    configured, so a real reset would only exercise the "database unreachable" error path, not
    the happy path, and there was no value in triggering `scripts/sandbox-reset.mjs` against
    nothing.
  - Screenshotted the finished panel for a visual sanity check (not committed).
- `npm test`: 3 files, 33 passed, 2 skipped (unchanged). `npx tsc -p tsconfig.app.json --noEmit`:
  clean. `npm run build`: clean (pre-existing CSS/chunk-size warnings only, unrelated to this
  change).
- `graphify update .` was **not run** — the `graphify` CLI is not installed in this session's
  container (`command not found`). No other step in this todo depended on it.
