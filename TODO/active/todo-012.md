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

- `src/pages/DeveloperPortal.tsx`: added `'sandbox'` to `type PortalTab`; the sub-nav array now
  includes a `{ id:'sandbox', label:'Sandbox', icon: FlaskConical }` entry that is filtered out
  unless `typeof (window as any).sandboxRunner !== 'undefined'`; renders `<SandboxRunnerPanel/>`
  inside the existing card wrapper when `portalTab === 'sandbox'`.
- Created `src/components/sandbox/SandboxRunnerPanel.tsx`:
  - Status badge (`role="status" aria-live="polite"`) cycles Idle (gray) → Running (blue,
    pulsing dot gated by `motion-safe:` so `prefers-reduced-motion` disables it automatically,
    no custom media query needed) → Passed (emerald) / Failed (rose), each paired with an icon
    (not colour alone).
  - Broad actions: **Run Unit + Integration** (`sandboxRunner.run('unit')`), **Run E2E** (loops
    `sandboxRunner.run('e2e', {spec})` sequentially over every distinct `TEST_GROUPS[].e2e` spec,
    since the todo-011 IPC layer only accepts one spec per call and has no "run all e2e" mode —
    this stays UI-only and doesn't touch `electron/main.mjs`'s locked contract), and **Reset
    Sandbox Data** (destructive-styled, red, behind `ConfirmModal` `variant="danger"`). **Cancel**
    renders only while `status==='running'`.
  - Per-module grid built from `TEST_GROUPS`/`TEST_CASES`: coloured pills (blue=unit,
    violet=integration/db, amber=e2e), each hidden at count 0 via early-return; per-row **Run
    Tests** (disabled when the group has no `vitestFiles`) and **Run E2E** (or a muted "No E2E"
    label when `group.e2e` is null).
  - Rows expand (chevron, disabled/hidden when the group has zero cases) into the three labelled
    sections, each listing `name — what` from `TEST_CASES`.
  - All run/reset buttons disable while `status==='running'`, plus a blue "tests are running"
    banner naming the active run.
  - Log panel: fixed-height (`h-[280px]`) monospace `overflow-y-auto` box; a scroll-position
    effect pins to bottom on new lines and a `handleLogScroll` handler releases the pin once the
    user scrolls more than 24px from the bottom; lines are parsed by the `✓ ` / `FAIL ` prefixes
    `main.mjs`'s `simplify()` already emits into pass (emerald, `CheckCircle`) / fail (rose,
    `XCircle`) / neutral rows, icon + text always paired; "No output yet." placeholder before the
    first line arrives.
  - Run status on completion is derived from every awaited `SandboxRunResult` in the batch:
    `passed` only if all results have `ok && (code ?? 0) === 0`, else `failed` — covers both the
    single-call broad-unit/module/reset paths and the multi-call broad-E2E loop.
- `npx tsc --noEmit`: clean. `npm run build`: clean (pre-existing unrelated chunk-size and CSS
  attribute-selector warnings only, not from this change). `npm test`: 3 files, 33 passed, 2
  skipped — unchanged from before this change (no test files touched).
- **Not verified — environment limitation, same as todo-011:** the "Manual walkthrough in dev
  app: broad run, per-module run, E2E run, cancel, and reset-with-confirm all work and stream
  output" checklist item could not be exercised. `npm install` needed
  `ELECTRON_SKIP_BINARY_DOWNLOAD=1` to complete (this sandbox's egress proxy denies the Electron
  binary download as an organization policy, not a transient error), so there is no `electron`
  binary in this container to launch the app with and drive the new Sandbox tab by hand. The IPC
  contract this panel calls (`run`/`reset`/`cancel`/`onOutput`) was implemented in todo-011 and
  is itself still flagged `needs-review` for the identical reason. All UI logic here was reviewed
  by re-reading the component against every completion-test bullet, but a human with a working
  Electron dev environment should do the live walkthrough (including confirming the "Run E2E"
  sequential-loop behaviour looks right with more than one registered E2E spec, since only
  `pos-checkout` exists in the catalog today) before flipping this to `completed`.
- `graphify` is also not available as a command in this container, so `graphify update .` could
  not be run per CLAUDE.md; the graph will be stale for these two file changes until it's run
  from an environment that has it.
