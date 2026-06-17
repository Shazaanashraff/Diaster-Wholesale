---
id: todo-001
title: Include Other Income in Cashier Summary cash-in-hand total
priority: 1
created: 2026-06-17
status: active
---

## Overview

On the **Cashier Summary** page (`/cashier`, the "Cashier Page"), the daily total does
not include **Other Income** entries. Example: if sales for the day are LKR 14,000 and
LKR 1,000 was recorded as Other Income, the cashier should see **LKR 15,000** total cash
in hand — but today the page only shows LKR 14,000.

The root cause: `src/pages/CashierPage.tsx` loads `payments`, `invoices`, and `expenses`,
but it **never queries the `other_income` table**. As a result Other Income is completely
absent from the KPI row and from the `netCash` calculation.

For reference, the **Daily Finance Report** (`src/pages/reports/DailyFinanceReport.tsx`)
already does this correctly: it loads `other_income`, shows a "Other Income" KPI, and
includes it in income via `totalIncome = totalSales - totalReturns + totalOtherInc`.
We want the Cashier Summary to be consistent with that report.

## Completion Test

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` completes successfully
- [ ] Open `/cashier` for a date that has both sales and at least one Other Income entry. A new **"Other Income"** KPI card shows the correct other-income total for that day
- [ ] The **Net Cash** KPI now equals: Total Sales − Returns − Expenses **+ Other Income**. Verify with the user's example: 14,000 sales + 1,000 other income (no returns/expenses) → Net Cash shows **15,000**
- [ ] A new "Other Income" section/list renders the individual other-income entries for the day (source type + amount), and shows the empty state when there are none
- [ ] Changing the date to a day with no other income shows 0 in the Other Income KPI and does not break the Net Cash math

---
<!-- Everything below this line is filled by the routine — do not edit manually -->

## Implementation Guide

The Cashier Summary page mirrors a subset of the Daily Finance Report but is missing the
Other Income data source. The fix is to add `other_income` to the parallel data load,
extend the `CashierData` shape, surface it as a KPI + a list section, and add it into the
`netCash` formula. Match the existing visual style (rounded `bg-accent` cards, `fmt()`
currency helper, lucide icons) so it looks native to the page.

**Schema note:** the `other_income` table has columns
`id, source_type, amount, method, notes, created_at` (confirmed in DailyFinanceReport's
`OtherIncRow` interface). Filter by `created_at` within the selected day range using the
existing `dayRange(date)` helper, exactly like the `expenses` query already does.

**Consistency decision:** include **all** other-income entries for the day in the total
(regardless of `method`), matching how `DailyFinanceReport` computes `totalOtherInc`. Do
not filter by `method='cash'` — the user's expectation (15k total) is the full other-income
amount, and staying consistent with the existing report avoids two different "day totals".

## Implementation Steps

1. In `src/pages/CashierPage.tsx`, add an `OtherIncomeRow` interface near the other
   row interfaces (around lines 18-22):
   `interface OtherIncomeRow { id: string; source_type: string; amount: number; method: string; created_at: string }`
2. Add `otherIncome: OtherIncomeRow[]` to the `CashierData` interface (lines 24-30).
3. In the `load` callback (around lines 47-72), add a fourth query to the
   `Promise.all([...])` array:
   `supabase.from('other_income').select('id, source_type, amount, method, created_at').gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false })`
   Destructure it as `otherIncomeRes` and add an error check like the others.
4. In the `setData({...})` call (lines 119-125), add
   `otherIncome: (otherIncomeRes.data ?? []) as OtherIncomeRow[]`.
5. Add a derived total near the other totals (lines 135-138):
   `const otherIncomeTotal = data?.otherIncome.reduce((s, o) => s + Number(o.amount), 0) ?? 0;`
6. Update the `netCash` formula (line 138) to:
   `const netCash = salesTotal + otherIncomeTotal - returnsTotal - expensesTotal;`
7. In the KPI Summary Row (lines 175-186), add a new `KPICard` for "Other Income"
   (use the `PlusCircle` lucide icon, import it; color `text-sky-400`, `positive`).
   The grid is `grid-cols-2 md:grid-cols-4` — adding a 5th card is fine; change to
   `md:grid-cols-5` so they lay out evenly, or place Other Income beside Total Sales.
8. Add an "Other Income" `<section>` to the data grid (mirror the "Returns" section
   markup, lines 247-273) listing each entry's `source_type` (capitalized, `_`→space)
   and amount in `text-sky-400`, with a "No other income for this date." empty state.
9. Import `PlusCircle` from `lucide-react` in the top import (line 4).

## Files to Modify

- `src/pages/CashierPage.tsx`

## Completion Notes

<!-- Sonnet 4.6 fills this after implementation -->
