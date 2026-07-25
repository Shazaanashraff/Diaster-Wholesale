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

### Status: needs-review (2026-07-25)

**What was done:**
- `src/pages/DeveloperPortal.tsx`: added `'sandbox'` to the `PortalTab` union; the sub-nav array
  now conditionally appends a `{ id: 'sandbox', label: 'Sandbox', icon: FlaskConical }` entry only
  when `typeof (window as any).sandboxRunner !== 'undefined'`; renders `<SandboxRunnerPanel />`
  when `portalTab === 'sandbox'`.
- Created `src/components/sandbox/SandboxRunnerPanel.tsx`:
  - Header with title + `role="status" aria-live="polite"` badge cycling
    Idle (gray) → Running (blue, pulsing dot via new `.sandbox-status-dot--running` CSS class) →
    Passed (green) / Failed (red), showing the currently-running label.
  - Broad actions: **Run Unit + Integration** (`run('unit')`, no filter → `npm test`), **Run E2E**
    (sequentially runs every group with a non-null `e2e` spec — the runner IPC from todo-011 only
    accepts one spec per call, so "broad E2E" chains calls one at a time via a small `runSequence`
    helper rather than a single call), **Reset Sandbox Data** (destructive-styled, red, opens a
    `ConfirmModal` before calling `.reset()`). **Cancel** renders only while `status === 'running'`
    and calls `.cancel()`, which also stops any remaining steps in a broad-E2E sequence via a
    `cancelledRef` guard (status resolves to Idle, not Failed, after an explicit cancel).
  - Per-module grid driven by `TEST_GROUPS`/`TEST_CASES`: coloured pills (Unit blue, DB/Integration
    violet, E2E amber), each hidden when its count is 0; per-row **Run Tests** (disabled when
    `vitestFiles` is empty) and **Run E2E** (or a muted "no E2E" label when `group.e2e` is null).
    Rows expand/collapse into **Unit tests / Integration tests (real database) / End-to-end tests
    (Playwright)** sections, each item rendered as `name — what` straight from `TEST_CASES`.
  - While a run is active, every module action is `disabled` and a "tests are running" banner is
    shown above the grid.
  - Streaming log panel: fixed-height (`h-72`) monospace scroll container; a `pinnedRef` tracks
    whether the user is scrolled to the bottom (within 24px) — new lines auto-scroll only while
    pinned, and scrolling up releases the pin (checked via `onScroll`). Lines are colour- **and**
    icon-coded (`✓` prefix → green + `CheckCircle2`, `FAIL` prefix → red + `XCircle`, matching the
    prefixes `main.mjs`'s `simplify()` already emits), never colour alone. "No output yet."
    placeholder before the first run.
  - Reduced motion: added `@keyframes sandboxStatusPulse` / `.sandbox-status-dot--running` to
    `src/index.css`, with a `@media (prefers-reduced-motion: reduce)` override that disables the
    animation entirely (no separate JS check needed).
  - Colours/typography reuse the existing DeveloperPortal dark-theme tokens (`#171c23` /
    `#1d222a` / `#2b313a` panels, existing badge/pill/button patterns) — no new design tokens
    introduced. Reused the existing `ConfirmModal` component for the reset confirmation rather
    than building a new dialog.
- `npx tsc --noEmit`: clean.
- `npm run build`: clean (pre-existing chunk-size and CSS-selector warnings only, unrelated to
  this change — same warnings present before this todo).
- `npm test`: 3 files, 33 passed, 2 skipped — unchanged (no test files touched by this todo).

**Why this is needs-review, not completed:**
The completion test's last checkbox — *"Manual walkthrough in dev app: broad run, per-module run,
E2E run, cancel, and reset-with-confirm all work and stream output"* — could not be exercised.
Same root cause already recorded in todo-011: `npm install` in this sandbox cannot fetch the
Electron binary (`electron/dist` is absent; `require('electron')` fails with "Electron failed to
install correctly") because the sandbox's egress proxy blocks the Electron download host as an
organisation policy denial, not a transient error, and per its own guidance no workaround was
attempted. `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install` was used instead so `tsc`/`vitest`/`vite
build` could run, but there is no way to launch the actual dev app (`npm run dev` /
`dev:electron`) in this container to click through the Sandbox tab, so the live devtools
walkthrough (window.sandboxRunner interactions, real streamed output, actual cancel/reset
behaviour, `prefers-reduced-motion` rendering) is unverified beyond code inspection and the static
checks above. `graphify` was also not runnable — the `graphify` CLI isn't installed in this
container (`command not found`), so `graphify update .` could not be executed either.

**What's needed to close this out:** a human (or an environment where the Electron binary can be
downloaded) should run `npm run dev` (or `npm run dev:sandbox`), open the Developer Portal as a
`developer`-role user, confirm the Sandbox tab appears, and click through: broad unit run, broad
E2E run, a per-module run, Cancel mid-run, and Reset Sandbox Data with the confirm dialog — then
flip this to `completed`. No further code changes are expected to be needed unless that walkthrough
surfaces a real bug.
