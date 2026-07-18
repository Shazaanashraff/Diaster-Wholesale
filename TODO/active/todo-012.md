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
<!-- Sonnet 4.6 fills: components created, accessibility handling, walkthrough result, commit hash. -->

- `src/pages/DeveloperPortal.tsx`: added `'sandbox'` to `PortalTab`, added a `FlaskConical`-iconed
  "Sandbox" entry to the sub-nav array, filtered out of that array unless
  `typeof (window as any).sandboxRunner !== 'undefined'`, and rendered `<SandboxRunnerPanel/>` when
  `portalTab === 'sandbox'`.
- `src/components/sandbox/SandboxRunnerPanel.tsx` (new): status badge (`role="status"`,
  `aria-live="polite"`, Idle/Running/Passed/Failed, pulsing dot only while running), broad actions
  (Run Unit + Integration → `sandboxRunner.run('unit')`; Run E2E → sequentially runs every non-null
  `TEST_GROUPS[].e2e` spec since the IPC layer from todo-011 only supports running one named spec
  at a time, no "run all" mode; Reset Sandbox Data → destructive-styled, gated behind `ConfirmModal`;
  Cancel shown only while running), per-module grid driven by `TEST_GROUPS`/`TEST_CASES` with
  blue/violet/amber count pills hidden at 0, expandable rows grouping cases into "Unit tests" /
  "Integration tests (real database)" / "End-to-end tests (Playwright)" sections as `name — what`,
  a running banner that disables every other module's buttons, and a monospace streaming log panel
  (pass lines green with a check icon, fail/error lines red with an X icon — never colour alone,
  auto-scroll pinned to bottom that releases when the user scrolls up, "No output yet" before the
  first run). Pulse/spinner animations use Tailwind's `motion-reduce:animate-none` so
  `prefers-reduced-motion` removes them; existing `posFadeIn` entrance animation is left as-is,
  matching every other tab in this page (none of which gate that entrance fade on reduced-motion
  either).
- Deliberate deviation from the literal checklist: the per-row "Run Tests" button is disabled (not
  just the E2E slot) for modules with zero `vitestFiles`, instead of calling
  `sandboxRunner.run('unit', {files: []})`. `electron/main.mjs`'s handler treats an empty/absent
  `files` array as "run the whole suite" (`if (type === 'unit' && filter?.files?.length) {...}
  else if (type === 'unit') { npm test }`), so leaving it enabled would make a "Run Tests" click on
  e.g. Products & Inventory silently run every test in the repo instead of doing nothing useful.
  Fixing the root cause would mean touching `electron/main.mjs`, which is out of this todo's `Files
  to Modify` list (todo-011's scope) — flagging instead of expanding scope.
- `npx tsc --noEmit`: clean. `npm run build`: clean (pre-existing chunk-size and CSS optimizer
  warnings only, unrelated to this change). `npm test`: 3 files, 33 passed, 2 skipped — unchanged.
- **Not verified — same environment limitation as todo-011:** the manual dev-app walkthrough
  (broad run, per-module run, E2E run, cancel, reset-with-confirm streaming output; tab hidden when
  `window.sandboxRunner` is undefined) could not be exercised. `npm install` succeeds, but
  `node_modules/electron` has no binary — `npm rebuild electron` fails with `HTTPError: Response
  code 403 (Forbidden)` fetching the Electron binary, which this sandbox's egress proxy reports as
  an organization policy denial rather than a transient error, so no retry/workaround was
  attempted. There is no Electron runtime anywhere in this container to launch the app against a
  live `window.sandboxRunner`. A human with a working Electron dev environment should run the
  walkthrough (including the packaged-build gating and the reduced-motion check in an actual
  browser) before flipping this to `completed`.
- `graphify` CLI is not installed in this container (`graphify update .` → command not found), so
  the knowledge graph was not refreshed after this change.
