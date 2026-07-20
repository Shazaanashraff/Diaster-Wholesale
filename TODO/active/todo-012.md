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

- `DeveloperPortal.tsx`: added `'sandbox'` to `PortalTab`, imported `FlaskConical`, and added a
  `{ id: 'sandbox', label: 'Sandbox', icon: FlaskConical }` sub-nav entry filtered out unless
  `typeof (window as any).sandboxRunner !== 'undefined'`. Renders `<SandboxRunnerPanel />` when
  `portalTab === 'sandbox'`.
- Created `src/components/sandbox/SandboxRunnerPanel.tsx`:
  - Status badge (`role="status"`, `aria-live="polite"`) cycles Idle → Running (pulsing dot) →
    Passed/Failed, driven by a single `status` state derived from each `sandboxRunner.run/reset`
    call's resolved `{ok, code}` (pass = `ok && code === 0`).
  - Broad actions: **Run Unit + Integration** (`run('unit')`), **Run E2E** (loops
    `run('e2e', {spec})` over every distinct `TEST_GROUPS[].e2e` value, sequentially, since the
    IPC layer only accepts one spec per call and one process at a time), **Reset Sandbox Data**
    (destructive-styled, red, gated behind the existing shared `ConfirmModal`). **Cancel**
    (`sandboxRunner.cancel()`) only renders while `status === 'running'`.
  - Per-module grid built from `TEST_GROUPS` + `TEST_CASES[group.id]`: blue/violet/amber count
    pills for unit/integration/e2e, each hidden when its count is 0; per-row "Run Tests" (disabled
    when the group has no vitest files) and "Run E2E" (or a muted "no E2E" label when
    `group.e2e` is null).
  - Expandable rows group `TEST_CASES[group.id]` by `type` into "Unit tests" / "Integration tests
    (real database)" / "End-to-end tests (Playwright)" sections, each case rendered as
    `name — what`.
  - All action buttons (except Cancel) disable while `status === 'running'`, plus an amber
    "tests are running" banner naming the active action.
  - Log panel: fixed `h-64` monospace scroll container, ref-tracked pin-to-bottom that releases
    when the user scrolls away from the bottom (restored via a rAF-free scroll listener), a
    "Scrolled up" hint while unpinned, and a "No output yet" placeholder before the first run.
    Lines are colour + icon coded (`✓ …` → green `CheckCircle2`, `FAIL …` → red `XCircle`), never
    colour alone, matching the `simplify()` line prefixes already emitted by `electron/main.mjs`.
  - `prefers-reduced-motion` handled in `src/index.css`: `.sandbox-status-dot--running`'s pulse
    keyframe and the panel's `posFadeIn` mount animation are both disabled under
    `@media (prefers-reduced-motion: reduce)`.
- `npx tsc --noEmit`: clean. `npm run build` (`tsc -b && vite build`): clean (required switching
  the `TestCase` import to `import type` for `verbatimModuleSyntax`).
- `npm test`: 3 files, 33 passed, 2 skipped — unchanged from before this change.
- **Not verified — same environment limitation as todo-011:** the manual dev-app walkthrough
  (broad run / per-module run / E2E run / cancel / reset-with-confirm actually streaming output
  in a launched Electron window) could not be exercised. `node_modules/electron/dist` does not
  exist in this container — `npm install` was run with `ELECTRON_SKIP_BINARY_DOWNLOAD=1` (the
  Electron binary download is blocked by this sandbox's egress policy, as already documented in
  todo-011), so there is no Electron binary anywhere to launch `npm run dev` with. The
  `sandboxRunner` gating, IPC call shapes, and log-line colour/icon logic were verified by
  re-reading `electron/main.mjs` / `electron/preload.js` against this component's calls, but a
  human with a working Electron dev environment should do the live walkthrough (and confirm the
  "Run E2E" broad action, which sequentially replays every catalog E2E spec, behaves acceptably
  once more specs exist) before flipping this to `completed`.
- `graphify` CLI is not installed in this container, so `graphify update .` could not be run.
