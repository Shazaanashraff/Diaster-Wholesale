---
id: todo-012
title: Sandbox feature [5/7] — Sandbox screen UI as a tab in DeveloperPortal
priority: 2
created: 2026-06-24
status: needs-review
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

- [ ] `PortalTab` union in `DeveloperPortal.tsx` includes `'sandbox'`; a "Sandbox" tab appears in
      the sub-nav, but **only** when `(window as any).sandboxRunner` is defined.
- [ ] New component `src/components/sandbox/SandboxRunnerPanel.tsx` renders the tab content.
- [ ] Header shows a title + status badge transitioning **Idle → Running (pulsing dot) →
      Passed (green) / Failed (red)** with `role="status"` and `aria-live`.
- [ ] Broad actions: **Run Unit + Integration**, **Run E2E**, **Reset Sandbox Data** (reset is
      destructive-styled and behind a confirm dialog). A **Cancel** button appears only while running.
- [ ] Per-module grid from `TEST_GROUPS`: each row shows the label + coloured count pills —
      Unit (blue), DB/Integration (violet), E2E (amber) — each hidden when 0 — plus per-row
      **Run Tests** and **Run E2E** (or a muted "no E2E").
- [ ] Rows expand into sections **Unit tests / Integration tests (real database) / End-to-end
      tests (Playwright)** listing each case as `name — what` from `TEST_CASES`.
- [ ] While a run is active: other modules are disabled and a "tests are running" banner shows.
- [ ] Streaming log panel: monospace, fixed height, auto-scroll pinned to bottom but releasing
      the pin when the user scrolls up; pass lines green, fail/error lines red, distinguished by
      **icon + label, not colour alone**; "No output yet" placeholder before the first run.
- [ ] `prefers-reduced-motion` honoured (no pulse/fade). Light + dark via existing tokens.
- [ ] `npx tsc --noEmit` clean; `npm run build` clean.
- [ ] Manual walkthrough in dev app: broad run, per-module run, E2E run, cancel, and
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

- `src/pages/DeveloperPortal.tsx`: added `'sandbox'` to `PortalTab`; added a `Sandbox` sub-nav
  entry (using `FlaskConical`) that is filtered out of the tab list unless
  `typeof (window as any).sandboxRunner !== 'undefined'`; renders `<SandboxRunnerPanel />` when
  `portalTab === 'sandbox'`.
- Created `src/components/sandbox/SandboxRunnerPanel.tsx`:
  - Status badge (`role="status"` + `aria-live="polite"`) cycling Idle → Running (pulsing dot,
    `motion-safe:animate-pulse` so `prefers-reduced-motion` disables it automatically) →
    Passed (green) / Failed (red).
  - Broad actions: Run Unit + Integration (`runner.run('unit')`), Run E2E (`runner.run('e2e')`),
    Reset Sandbox Data (destructive-styled, routed through the existing `ConfirmModal` component
    before calling `runner.reset()`). A Cancel button (`runner.cancel()`) appears only while a
    run is active.
  - Per-module grid built from `TEST_GROUPS`, with Unit (blue) / DB-Integration (violet) /
    E2E (amber) count pills derived from `TEST_CASES[group.id]`, each hidden when its count is 0.
    Per-row "Run Tests" (`runner.run('unit', {files: group.vitestFiles})`) and "Run E2E"
    (`runner.run('e2e', {spec: group.e2e})`) buttons, or a muted "no E2E" label when `group.e2e`
    is `null`.
  - Expandable rows group `TEST_CASES[group.id]` by `type` into "Unit tests" / "Integration tests
    (real database)" / "End-to-end tests (Playwright)" sections, each entry rendered as
    `name — what`; groups with no cases yet fall back to the catalog's own `unitDesc` placeholder
    text instead of a hard-coded string.
  - All per-module and broad-action buttons (and Reset) disable while a run is in flight; a
    "tests are running" banner is shown.
  - Streaming log panel subscribes to `runner.onOutput` in a `useEffect`, is monospace with a
    fixed height, auto-scrolls while pinned to the bottom, and releases the pin once the user
    scrolls up (tracked via a scroll-distance check in an `onScroll` handler, not state, to avoid
    fighting the auto-scroll effect). Lines are classified pass/fail by leading `✓`/`✗` markers or
    `PASS`/`FAIL`/`error` text; pass/fail lines get both a `CheckCircle2`/`XCircle` icon *and* a
    `[PASS]`/`[FAIL]` text label ahead of the colour, per the icon-plus-label requirement. A
    "No output yet." placeholder shows before the first run.
- `npx tsc --noEmit`: clean.
- `npm run build`: clean (pre-existing chunk-size and CSS-selector warnings only, unrelated to
  this change).
- `npm test`: 3 files, 33 passed, 2 skipped — unchanged, no test files touched.

**Not verified — environment limitation:** the "Manual walkthrough in dev app" checklist item
(broad run, per-module run, E2E run, cancel, reset-with-confirm all streaming real output) could
not be exercised. Unlike todo-011's environment, the Electron binary *is* available here
(`node_modules/.bin/electron --version` → `v36.9.5`), but there is no `.env` or `.env.sandbox` in
this container — both are git-ignored and neither exists — so `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` are unset. Without a real Supabase connection the app cannot
authenticate any user, so the `role === 'developer'` gate on `DeveloperPortal` itself cannot be
passed, let alone the `window.sandboxRunner` IPC calls exercised against a live sandbox database.
`eslint` was also attempted for extra confidence but fails on this repo's `eslint.config.js`
(`TypeError: Cannot read properties of undefined (reading 'recommended')`) independent of this
change — not part of this task's completion test, left as-is. `graphify` is not installed in this
container (`graphify: command not found`), so `graphify update .` could not be run per
CLAUDE.md — flagging for a human/future session with graphify available to run it.
A human with real Supabase sandbox credentials should do the live devtools walkthrough (and the
Windows-specific `taskkill` cancel path, which is separately still unverified per todo-011) before
flipping this to `completed`.
