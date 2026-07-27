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

- `src/pages/DeveloperPortal.tsx`: added `'sandbox'` to the `PortalTab` union; sub-nav tabs are now
  built from a `subNavTabs` list (memoized on `sandboxAvailable = typeof (window as
  any).sandboxRunner !== 'undefined'`) so the "Sandbox" tab (FlaskConical icon) only appears when
  `window.sandboxRunner` is defined; renders `<SandboxRunnerPanel/>` when `portalTab === 'sandbox'`.
- `src/components/sandbox/SandboxRunnerPanel.tsx` (new): header with title + `role="status"
  aria-live="polite"` badge (Idle/Running/Passed/Failed, pulsing dot only while running via a new
  `.sandbox-status-dot--running` CSS class); broad actions **Run Unit + Integration**
  (`run('unit')`), **Run E2E** (loops `run('e2e',{spec})` over every `TEST_GROUPS` entry with a
  non-null `e2e`), **Reset Sandbox Data** (destructive-styled, opens the existing `ConfirmModal`
  before calling `.reset()`), and a **Cancel** button shown only while running; a "tests are
  running" banner and row-level disabling while a run is active; per-module grid driven directly by
  `TEST_GROUPS`/`TEST_CASES` with blue/violet/amber count pills (hidden at 0), expandable rows
  grouped into the three labelled sections, and a **Run Tests** / **Run E2E** (or muted "no E2E")
  per row; streaming log panel (monospace, fixed height, auto-scroll that unpins on user scroll-up,
  pass/fail lines marked by icon **and** colour, "No output yet" placeholder).
- `src/index.css`: added `@keyframes sandboxStatusPulse` / `.sandbox-status-dot--running` with a
  `@media (prefers-reduced-motion: reduce)` override that disables the animation.
- `npx tsc --noEmit`: clean. `npm run build`: clean (pre-existing chunk-size/CSS-selector warnings
  only, unrelated to this change). `npm test`: 3 files, 33 passed, 2 skipped — unchanged.
- **Manual walkthrough — verified live**, not skipped: `node_modules` had to be installed first
  (`npm install`; it was absent at session start). Unlike todo-011's session, the Electron binary
  *was* available here, so the dev app was actually launched (`xvfb-run` + Playwright's `_electron`
  driving the real `electron/main.mjs`, Vite dev server on 5173, Supabase REST calls intercepted,
  `sessionStorage` seeded with `user_role=developer` + `pin_auth=1` to reach `/developer`) and
  driven end-to-end, then torn down (throwaway `.env`/scripts were not committed):
  - `window.sandboxRunner` defined; Sandbox tab visible and gated correctly.
  - Expanding "Sandbox Tooling" showed its case descriptions (precision-contract text).
  - Per-module **Run Tests** on "Sandbox Tooling" → badge Idle → Running → Passed, log panel
    streamed real `vitest` output with `✓` markers.
  - Broad **Run Unit + Integration** → **Cancel** → badge returned to Idle.
  - Per-row **Run E2E** on "Sales / POS" → badge Running, log panel streamed real
    `npx playwright test` output ("Running 9 tests using 1 worker …"); cancelled to avoid waiting
    out the full nested run (no orphaned processes left behind afterward).
  - **Reset Sandbox Data** opened the confirm dialog ("Reset Sandbox Data?").
  - `prefers-reduced-motion` handling was reviewed in code (pure CSS media query) but not exercised
    with an actual OS-level reduced-motion toggle in this container.
- `graphify update .` was **not run**: the `graphify` CLI is not installed/on `PATH` in this
  environment (same gap noted would apply to any session here) — `graphify-out/` was left as-is.
