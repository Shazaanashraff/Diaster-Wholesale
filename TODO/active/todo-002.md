---
id: todo-002
title: Do not show earned loyalty points on receipt when no customer is selected
priority: 1
created: 2026-06-17
status: active
---

## Overview

At the POS (`/pos`), when a sale is completed **without selecting a customer** (a Walk-in
sale), the printed/preview receipt still shows a "Loyalty pts earned: +N" line. This is
wrong — no customer means no loyalty account, and indeed no points are actually saved to
the database. Only the **bill/receipt display** is incorrectly showing earned points.

Root cause: in `src/services/posService.ts`, the `checkout()` function computes
`earnedPoints = computeLoyaltyEarned(netTotal)` **unconditionally** (around line 156) and
returns it, even though the points are only persisted when `customerId` is truthy (the
`if (customerId)` guard around line 241). The POS page then snapshots this returned
`earnedPoints` into the receipt (`src/pages/POSPage.tsx` ~line 649), and the receipt
component renders the line whenever `earnedPoints > 0`
(`src/components/POSSaleReceipt.tsx` ~line 256).

Fix: earned points returned from checkout should be **0 when there is no customer**, so the
receipt naturally hides the line. Gate it at the service (single source of truth) so both
the on-screen loyalty refresh and the receipt stay correct.

## Completion Test

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` completes successfully
- [ ] At `/pos`, add items to the cart, **do not select a customer** (Walk-in), complete the sale → the receipt does **NOT** show any "Loyalty pts earned" line
- [ ] At `/pos`, add items, **select a real customer**, complete the sale → the receipt **DOES** show "Loyalty pts earned: +N" with the correct amount (1 point per LKR 100 of net total)
- [ ] Redeeming points still works for a selected customer and the receipt shows the redeemed line as before
- [ ] No regression: the customer's loyalty balance still updates correctly after a sale with a customer selected

## Implementation Guide

The cleanest fix is at the service layer so every consumer (receipt snapshot, on-screen
loyalty refresh) gets a consistent value. `checkout()` already only writes points to the DB
when `customerId` is set; we make the **returned** `earnedPoints` follow the same rule.

`computeLoyaltyEarned(netTotal)` returns 1 point per LKR 100 (see posService ~line 104).
We keep computing it for the DB-write path, but the value returned to the caller must be
0 when `customerId` is falsy.

Add a defensive guard in the receipt snapshot too, so even if the service contract changes
later, a Walk-in receipt never shows points.

## Implementation Steps

1. In `src/services/posService.ts` `checkout()`, locate where the function returns its
   result object containing `earnedPoints` (the `return { invoiceId, invoiceNo, earnedPoints }`
   near the end). Change the returned points to be customer-gated:
   `earnedPoints: customerId ? earnedPoints : 0`.
   (Do NOT change the internal `earnedPoints` used in the `if (customerId)` DB-update block —
   only the returned value.)
2. In `src/pages/POSPage.tsx`, in the `setLastSaleReceipt({...})` call (~line 638-651),
   make the snapshot defensive: `earnedPoints: selectedCustomerId ? earnedPoints : 0`.
3. Confirm `src/components/POSSaleReceipt.tsx` line ~256 already guards with
   `{earnedPoints > 0 && (...)}` — no change needed there; with earnedPoints 0 it hides.
4. Verify the on-screen loyalty refresh block in POSPage (~line 654) still behaves: with
   no customer, `earnedPoints` is 0 and `safeRedeem` is 0, so it correctly skips the refresh.

## Files to Modify

- `src/services/posService.ts`
- `src/pages/POSPage.tsx`

## Completion Notes

<!-- Sonnet 4.6 fills this after implementation -->
