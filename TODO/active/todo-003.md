---
id: todo-003
title: Fix replacement-item search in Sales Returns not showing all active products
priority: 2
created: 2026-06-17
status: active
---

## Overview

When creating an **Exchange** in Sales Returns (`/sales-returns` → Returns page), the
"Replacement Items" product search does not list some products that clearly exist and are
sellable — reported example: a product named **"checkout test 1"** is visible in POS and in
the Inventory of the main shop, but does not appear in the replacement search.

Root cause: in `src/pages/ReturnsPage.tsx` the replacement product list is loaded with a
query (around lines 225-227) that differs from how POS loads products:

```ts
supabase.from('products').select('id, name, pieces_per_carton, wholesale_price')
  .limit(500)
  .then(({ data }) => setProducts((data ?? []) as any[]));
```

Problems vs. the canonical `getProducts()` in `src/services/productService.ts` (which POS
uses):
- **No `.eq('is_active', true)` filter** — inconsistent with the rest of the app.
- **No `.order('name')`** — combined with `.limit(500)`, results come back in an arbitrary
  physical row order, so once there are more than 500 products a newly created product can
  fall outside the returned set and never appear in search. This is the most likely reason
  "checkout test 1" is missing.

Fix: make the replacement product query mirror `getProducts()` — filter active products,
order by name, and remove the artificial 500 cap (or raise it well above the catalog size).

## Completion Test

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` completes successfully
- [ ] At `/sales-returns`, start a new return, set type to **Exchange**, and in the
  "Replacement Items" search type part of a known active product name (e.g. "checkout") →
  the product appears in the dropdown and can be added as a replacement
- [ ] The product "checkout test 1" (or any recently created active product) now appears in
  replacement search
- [ ] Only **active** products appear (archived products do not show up as replacements)
- [ ] Selecting a replacement still populates name + wholesale price correctly and the
  exchange difference math is unaffected

## Implementation Guide

The replacement search filters client-side via `filteredProducts` (ReturnsPage ~line 313):
`productSearch.length > 1 ? products.filter(p => p.name...) : []`. That logic is fine; the
bug is purely in what `products` is loaded with. Align the load with the app-wide product
fetch so the data set is complete and consistently ordered.

Prefer reusing the existing service function `getProducts()` from
`src/services/productService.ts` (it already does `.eq('is_active', true).order('name')`)
rather than hand-writing a second query — this keeps a single definition of "sellable
products". `getProducts()` returns full `Product` objects which include `id`, `name`,
`pieces_per_carton`, and `wholesale_price`, so the existing `products` state shape and
`addReplacement(prod)` usage remain compatible.

If reusing `getProducts()` is impractical due to typing, the minimal fix is to add
`.eq('is_active', true).order('name', { ascending: true })` and remove `.limit(500)` (or
raise to `.limit(5000)`).

## Implementation Steps

1. Open `src/pages/ReturnsPage.tsx`. Find the `useEffect` that loads products for Exchange
   (around lines 223-228).
2. **Option A (preferred):** import `getProducts` from `../services/productService` and
   replace the inline supabase query with:
   `getProducts().then(list => setProducts(list as any[]));`
   Keep the `if (returnType !== 'Exchange') return;` guard.
3. **Option B (minimal):** keep the inline query but change it to
   `.select('id, name, pieces_per_carton, wholesale_price').eq('is_active', true).order('name', { ascending: true })`
   and remove `.limit(500)` (or set `.limit(5000)`).
4. Do not change `filteredProducts` (line ~313) or `addReplacement` — they remain valid.
5. Build and verify the replacement search now lists active products including newly
   created ones.

## Files to Modify

- `src/pages/ReturnsPage.tsx`

## Completion Notes

<!-- Sonnet 4.6 fills this after implementation -->
