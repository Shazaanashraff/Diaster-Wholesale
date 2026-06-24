---
id: todo-014
title: Sandbox feature [7/7] — code-review gap check + write observations
priority: 3
created: 2026-06-24
status: completed
---

## Overview

Final part of the Sandbox series. This is a **verification-only** task: it does not add features.
It reads the code-review checklist at [`TODO/sandbox-code-review.md`](../sandbox-code-review.md),
audits the finished implementation (todo-008 … todo-013) against every requirement, confirms no
**locked decision** was violated, and **writes its findings into the "Observations" section of
that same doc**.

**🔒 LOCKED DECISIONS (these are NOT gaps — confirm they were respected):** decimal money model
kept; no ledger / no "Money & Ledger" group; launch-time schema switch kept (no runtime toggle);
npm single-package commands; Sandbox screen is a DeveloperPortal tab; feature gated to dev builds.
See the "Intentional deviations" table in the code-review doc.

**Depends on:** all of todo-008 … todo-013 being complete (or note which are incomplete).
**Run this whenever the series is finished, and re-run after any later fixes.**

## Completion Test

- [ ] Ran the full **Reviewer runbook** in `TODO/sandbox-code-review.md` (steps 1–7):
  - [ ] `npx tsc --noEmit` clean.
  - [ ] `npm run build` succeeds.
  - [ ] `npm test` green and `test-groups.test.ts` executed.
  - [ ] Precision-contract demonstration re-verified (add dummy test → fails → remove → passes).
  - [ ] `npm run sandbox:reset` succeeds and `public` is provably untouched (isolation test).
  - [ ] Grepped for locked-decision violations (bigint/ledger, `getActiveSchema`/runtime toggle,
        `pnpm` in runner, any `public` truncate/delete in the reset script) — recorded results.
  - [ ] Confirmed packaged-build gating (`window.sandboxRunner` exposed only when not packaged).
- [ ] Every checkbox in the code-review doc's **Requirements traceability** sections A–F has been
      evaluated PASS or GAP against the actual code (not assumed).
- [ ] The **Observations (filled by todo-014)** section of `TODO/sandbox-code-review.md` now
      contains a dated review block: per-section PASS/GAP with specifics, any locked-decision
      violations, follow-up todos opened for gaps, and a final verdict **SHIP / NEEDS FIXES**.
- [ ] For each GAP found: a new `todo-0NN.md` was created in `active/` describing the fix
      (file + what's missing + suggested fix), and its id is listed in the Observations block.

---

## Implementation Guide

This task produces **no product code** (except possibly tiny follow-up todos). Treat it like a QA
pass: open `TODO/sandbox-code-review.md`, walk every requirement row, and verify it by reading the
relevant file and/or running the command — do not trust the earlier Completion Notes blindly,
re-check. Be specific in findings: cite `file:line`. If everything passes, the verdict is SHIP;
if anything is missing, verdict is NEEDS FIXES and you must open follow-up todos so nothing is lost.

## Implementation Steps

1. Read `TODO/sandbox-code-review.md` in full, including the "Intentional deviations" table.
2. Execute the **Reviewer runbook** steps 1–7; capture each command's result.
3. Go section by section (A schema/isolation, B catalog, C runner, D screen, E gating/quality,
   F coverage). For each checkbox, open the cited file(s) and confirm. Mark PASS or GAP.
4. Run the locked-decision greps; confirm none are violated. (If a violation exists, it is a GAP.)
5. Write a dated review block into the **Observations (filled by todo-014)** section using the
   commented template already in that doc. Include the audited commit hash and the verdict.
6. For every GAP: copy `TODO/template.md` to a new `active/todo-0NN.md`, describe the fix, and
   list its id in the Observations block.
7. `graphify update .`. (No app code changed unless follow-up todos were authored.)

## Files to Modify

- **Modify:** `TODO/sandbox-code-review.md` (write the Observations block)
- **Create (only if gaps found):** new `TODO/active/todo-0NN.md` follow-up tasks

## Completion Notes

Runbook steps 1–7 executed against commit a64a043.

- Sections A–F: all **PASS**
- Locked-decision violations: **none** (bigint hits in SQL views are integer count columns, not money)
- Precision contract demonstrated: dummy file → fail → remove → green
- graphify update skipped (tool not installed in CI environment; code graph not relied on for this audit)
- Follow-up todos: **none** — no gaps found
- Verdict: **SHIP**

Full findings written to `TODO/sandbox-code-review.md` Observations section.
