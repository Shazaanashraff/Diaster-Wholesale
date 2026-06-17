---
id: todo-005
title: Add "Lunch" and "Dinner" expense categories
priority: 3
created: 2026-06-17
status: completed
---

## Overview

The Expenses feature needs two additional expense categories: **Lunch** and **Dinner**.
These should appear in the category dropdown wherever an expense is created or edited.

The category list is defined in **one place** —
`src/services/expenseService.ts`, the `EXPENSE_CATEGORIES` constant (lines 5-9):

```ts
export const EXPENSE_CATEGORIES = [
  'Rent', 'Utilities', 'Salaries', 'Transport', 'Packaging',
  'Maintenance', 'Marketing', 'Office Supplies', 'Bank Charges',
  'Insurance', 'Other',
] as const;
```

Both the standalone **Expenses page** (`src/pages/ExpensesPage.tsx`) and the **Day
Transactions page** (`src/pages/DayTransactionsPage.tsx`) import `EXPENSE_CATEGORIES` from
this service and render it into their `<select>` dropdowns, so a single edit to the constant
updates both UIs automatically.

## Completion Test

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` completes successfully
- [ ] On the **Expenses page** (`/expenses`), open the Add Expense form → the category
  dropdown lists **Lunch** and **Dinner** alongside the existing categories
- [ ] On the **Day Transactions** page Expenses tab, the same two categories appear in the
  category dropdown
- [ ] Create an expense with category **Lunch** → it saves and displays "Lunch" as its
  category in the list
- [ ] Create an expense with category **Dinner** → it saves and displays correctly

## Implementation Guide

This is a one-line data change in a single shared constant. No schema migration is required —
the `expenses.category` column stores a free-text string, and the app validates only that a
category is selected (see `createExpense` in `expenseService.ts`, which requires
`data.category` to be non-empty but does not constrain it to an enum).

Place the new categories in a sensible spot in the array (e.g. grouped near other
operational costs, before `'Other'`, since `'Other'` conventionally stays last).

## Implementation Steps

1. In `src/services/expenseService.ts`, edit the `EXPENSE_CATEGORIES` array to add
   `'Lunch'` and `'Dinner'`. Keep `'Other'` as the final element. For example:
   ```ts
   export const EXPENSE_CATEGORIES = [
     'Rent', 'Utilities', 'Salaries', 'Transport', 'Packaging',
     'Maintenance', 'Marketing', 'Office Supplies', 'Bank Charges',
     'Insurance', 'Lunch', 'Dinner', 'Other',
   ] as const;
   ```
2. No other files need editing — `ExpensesPage.tsx` and `DayTransactionsPage.tsx` both map
   over `EXPENSE_CATEGORIES` for their dropdowns and will pick up the new values
   automatically.

## Files to Modify

- `src/services/expenseService.ts`

## Completion Notes

Implemented by Sonnet 4.6 on 2026-06-17. Added `'Lunch'` and `'Dinner'` to `EXPENSE_CATEGORIES` in `expenseService.ts` before `'Other'`. Single-file, one-line change. Both ExpensesPage and DayTransactionsPage pick them up automatically. `tsc --noEmit` and `npm run build` pass.
