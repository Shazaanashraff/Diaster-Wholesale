---
id: todo-004
title: Hide Day End report CSV export for POS Operator (cashier); keep for Admin & Accountant
priority: 2
created: 2026-06-17
status: active
---

## Overview

The **Day End report** (the **Daily Finance Report**, shown in the "Day End" tab of the
Day Transactions page and in Reports) has an **Export CSV** button. We want to **disable /
hide the Export CSV button for the cashier role only**. Admin and Accountant must still be
able to export it.

Important terminology: in this codebase there is **no role literally called "cashier"**.
The cashier is the **`pos_operator`** role (see `src/utils/permissions.ts` —
`ROLE_LABELS.pos_operator = 'POS Operator'`). So "cashier only" means the `pos_operator`
role. Admin and Accountant both keep the export.

The Export CSV button lives in the shared `ExportBar` component
(`src/pages/reports/shared/ExportBar.tsx`), which renders an "Export CSV" button and a
"Print" button. The Daily Finance Report renders it at
`src/pages/reports/DailyFinanceReport.tsx` ~line 110:
`<ExportBar filename="Daily_Finance_Report" headers={exportHeaders} rows={exportRows} />`.

Scope: only the **Daily Finance Report's** CSV export needs to be gated (that is the
"Day End report"). Do not change CSV export behavior on the other reports. The cleanest way
to keep the change scoped is to gate it at the Daily Finance Report's usage of `ExportBar`,
not inside `ExportBar` itself (which is shared by ~25 reports).

## Completion Test

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` completes successfully
- [ ] Log in as **POS Operator** (default PIN `4444`) and open the Daily Finance / Day End
  report → the **Export CSV** button is hidden (or disabled). The Print button behaviour is
  unchanged
- [ ] Log in as **Admin** (default PIN `1234`) → Export CSV is visible and works (downloads a CSV)
- [ ] Log in as **Accountant** (default PIN `2222`) → Export CSV is visible and works
- [ ] Other reports' Export CSV buttons are unaffected (still visible for all roles that can reach them)

## Implementation Guide

Use the existing permission utilities in `src/utils/permissions.ts`. Two clean approaches —
pick the explicit one:

**Preferred (explicit role check):** import `getCurrentRole` (or `usePermissions`) and
compute a boolean `canExport = getCurrentRole() !== 'pos_operator'`. Conditionally render
the `ExportBar` (or pass a prop to hide just the CSV button) when `canExport` is true.

To avoid hiding the **Print** button too (the user only asked about CSV export), add an
optional `hideCsv?: boolean` (or `showCsv?: boolean`) prop to `ExportBar` and have the Daily
Finance Report pass it based on role. This keeps Print available to the cashier while hiding
only CSV. `ExportBar` is shared, so the new prop must default to showing CSV (so all other
reports are unchanged).

Note: `pos_operator` does not have the `view_reports` permission, so the only place a
cashier actually reaches this report is the **Day End tab of the Day Transactions page**.
Gating by role (not by route) is robust regardless of where it is embedded.

## Implementation Steps

1. In `src/pages/reports/shared/ExportBar.tsx`, add an optional prop to the interface:
   `showCsv?: boolean;` (default `true`). In the component signature destructure
   `showCsv = true`. Wrap the Export CSV `<button>` in `{showCsv && (...)}`. Leave the Print
   button always rendered. This is backward-compatible: every existing caller omits the prop
   and keeps CSV.
2. In `src/pages/reports/DailyFinanceReport.tsx`:
   - Import the role helper: `import { getCurrentRole } from '../../utils/permissions';`
   - Compute near the top of the component: `const canExportCsv = getCurrentRole() !== 'pos_operator';`
   - Update the `ExportBar` usage (~line 110) to pass `showCsv={canExportCsv}`.
3. Do not modify any other report file.
4. Verify by switching `sessionStorage.user_role` (or logging in with each role's PIN) that
   the CSV button shows for admin/accountant and is hidden for pos_operator.

## Files to Modify

- `src/pages/reports/shared/ExportBar.tsx`
- `src/pages/reports/DailyFinanceReport.tsx`

## Completion Notes

<!-- Sonnet 4.6 fills this after implementation -->
