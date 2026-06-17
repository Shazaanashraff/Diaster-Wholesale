---
id: todo-007
title: Allow Cashier to receive stock transfers (not create); allow Accountant to create
priority: 2
created: 2026-06-17
status: active
---

## Overview

Stock transfers should support a clear send → receive split by role:

- **Cashier (`pos_operator`)** must be able to **open the Stock Transfers page, verify, and
  receive (complete) a pending transfer** that was sent to their location. The cashier must
  **NOT** be able to create/send a transfer, and must not be able to cancel one.
- **Accountant** must be able to **create/send** stock transfers (in addition to admin /
  officer / warehouse who can already do so), matching the workflow "transfers are sent by
  admin or accountant".

Current behaviour (verified in code):
- `/stock-transfers` route and sidebar entry are gated by the **`manage_procurement`**
  permission → only **admin, officer, warehouse** can reach the page. `pos_operator` and
  `accountant` cannot open it at all. (`src/App.tsx` line 74, `src/components/Sidebar.tsx`
  line 55.)
- The "Approve" button that completes/receives a pending transfer is shown only when
  `isManager = role === 'admin' || role === 'officer'`
  (`src/pages/StockTransfersPage.tsx` lines 27 & 235).
- The "New Transfer" create button (line 169) and the "Cancel" button (line 238) are not
  permission-gated beyond page access.

## Completion Test

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` completes successfully
- [ ] **Cashier (PIN `4444`, `pos_operator`):** can open `/stock-transfers`; the **"New
  Transfer"** button is **hidden**; for a **pending** transfer an **"Approve/Receive"**
  button **is shown** and clicking it completes the transfer (stock moves from source to
  destination); the **"Cancel"** button is **hidden** for the cashier
- [ ] **Cashier** cannot reach the create form even via direct interaction (create panel does
  not open)
- [ ] **Accountant (PIN `2222`):** can open `/stock-transfers`, the **"New Transfer"** button
  **is shown**, and can successfully create a warehouse↔shop transfer
- [ ] **Admin (PIN `1234`) and Officer (PIN `3333`):** unchanged — can create, approve, and
  cancel as before
- [ ] **Warehouse (PIN `5555`):** unchanged — retains its existing create + receive ability
- [ ] Shop → Shop create restriction is unchanged (still allowed only for admin/officer)
- [ ] The Stock Transfers item appears in the sidebar for cashier and accountant

## Implementation Guide

The app uses a client-side role/permission model in `src/utils/permissions.ts`
(`Permission` union, `ROLE_PERMISSIONS` map, `can()` / `canAny()` / `usePermissions()`).
Routes are gated by `ProtectedRoute` in `src/App.tsx` (accepts a single `Permission` or a
`Permission[]` and uses `canAny` for arrays). Sidebar items have a single `requires:
Permission`.

**Design — introduce two dedicated transfer permissions** so we can split create vs receive
without handing the cashier the broad `manage_procurement` permission:

- `create_transfers` — granted to **admin, officer, warehouse, accountant**.
- `receive_transfers` — granted to **admin, officer, warehouse, accountant, pos_operator**
  (i.e. everyone who should be able to open the page).

Because every role that should access the page has `receive_transfers`, gate the **route and
sidebar** on `receive_transfers` (single permission — works for both). Then inside the page:
gate the **create** UI on `create_transfers` and the **receive (Approve)** action on
`receive_transfers`, and gate **Cancel** on `create_transfers` (so the cashier is
receive-only).

Keep the existing `isManager` (`admin || officer`) check that blocks **Shop → Shop**
creation (line 102) as-is — accountant will be able to create normal warehouse↔shop
transfers but not shop-to-shop, consistent with the current rule. Note `isManager` is now
only used for the shop-to-shop guard, not for the Approve button.

No database/schema change is required; this is purely the client permission model + UI
gating, consistent with the rest of the app.

## Implementation Steps

1. **`src/utils/permissions.ts`:**
   - Add `'create_transfers'` and `'receive_transfers'` to the `Permission` union (lines
     3-21).
   - In `ROLE_PERMISSIONS`, add **both** `create_transfers` and `receive_transfers` to
     `admin`, `officer`, `warehouse`, and `accountant`.
   - Add **only** `receive_transfers` to `pos_operator`.
2. **`src/App.tsx`:** change the stock-transfers route (line 74) from
   `req="manage_procurement"` to `req="receive_transfers"`.
3. **`src/components/Sidebar.tsx`:** change the Stock Transfers item (line 55)
   `requires: 'manage_procurement'` to `requires: 'receive_transfers'`.
4. **`src/pages/StockTransfersPage.tsx`:**
   - Pull `can` from `usePermissions()` (line 26): `const { role, roleLabel, can } = usePermissions();`
   - Add derived flags: `const canCreate = can('create_transfers'); const canReceive = can('receive_transfers');`
   - Wrap the **"New Transfer"** button (lines 169-171) in `{canCreate && (...)}`.
   - Guard the create slide-over panel so it cannot open for non-creators: only render the
     panel when `panelOpen && canCreate` (and/or set `setPanelOpen(true)` only if `canCreate`).
   - Change the **Approve** button condition (line 235) from `{isManager && (` to
     `{canReceive && (`.
   - Wrap the **Cancel** button (line 238) in `{canCreate && (...)}` so the cashier cannot
     cancel (receive-only).
   - Leave the `isManager` shop-to-shop guard (line 102) unchanged.
5. Build and run the per-role completion test using the default PINs.

## Files to Modify

- `src/utils/permissions.ts`
- `src/App.tsx`
- `src/components/Sidebar.tsx`
- `src/pages/StockTransfersPage.tsx`

## Completion Notes

<!-- Sonnet 4.6 fills this after implementation -->
