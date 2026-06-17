---
id: todo-006
title: Fix POS layout/cart bar not adapting on small (14-inch) laptop screens
priority: 3
created: 2026-06-17
status: completed
---

## Overview

On smaller laptop screens (≈14-inch, typically 1366×768 or 1280×800 logical pixels) the POS
page (`/pos`) layout does not adapt well — the "POS bar" does not expand/adjust and "stays
the same" as it is on a large monitor, leaving the layout cramped or overflowing.

The POS layout is a CSS grid defined in `src/index.css`. Key rule (~line 797):

```css
.pos-page-grid {
  grid-template-columns: minmax(0, 1fr) 330px;   /* main area + right bill/cart panel */
}
```

There are responsive overrides, but they only kick in at fairly large widths:
- `@media (max-width: 1440px)` → right panel `300px` (~line 807)
- `@media (max-width: 1450px)` → right panel `220px` (~line 1221)
- `.pos-page-grid.right-collapsed` → `minmax(0,1fr) 56px` (collapsed state, ~line 817)

There is **no breakpoint below ~1450px** tuned for ~1366px/1280px 14-inch screens, and the
fixed 330px right panel (the cart/bill "pos bar") plus the left category column can leave too
little room for the product grid, or cause horizontal overflow. The cart/bill panel appears
not to resize appropriately at these widths.

⚠️ This is a visual/responsive bug — **reproduce it first** at 1366×768 before changing CSS,
and confirm visually after.

## Completion Test

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` completes successfully
- [ ] Using Playwright, set viewport to **1366×768**, navigate to `/pos`:
  - [ ] There is **no horizontal page overflow** (page does not scroll sideways)
  - [ ] The right-hand bill/cart panel ("pos bar") is fully visible and its contents
    (totals, checkout button) are not clipped
  - [ ] The product grid and category tiles remain usable (no overlapping/cut-off content)
- [ ] Repeat the visual check at **1280×800** — layout remains usable and not overflowing
- [ ] Regression check at **1920×1080**: the layout is unchanged from before (wide screens
  must not be degraded)
- [ ] Take before/after screenshots at 1366×768 and confirm the small-screen layout visibly
  improved

## Implementation Guide

This is a CSS responsive fix in `src/index.css`. The goal is to make the POS grid adapt at
14-inch widths without changing the large-screen experience.

Approach:
1. **Reproduce first.** Launch the app (or Playwright) at 1366×768, open `/pos`, and observe
   exactly what is broken — whether the right bill panel overflows, the product grid is too
   narrow, or the page scrolls horizontally. Note which element is the "pos bar" the user
   means (most likely the right `.pos-bill` / cart panel, which is the 330px column).
2. **Add a tuned breakpoint** for small laptops, e.g. `@media (max-width: 1366px)` (and/or
   `1280px`), that reduces the right panel column width and/or the left category column so
   the product grid keeps enough space. Example direction (verify values visually):
   ```css
   @media (max-width: 1366px) {
     .pos-page-grid { grid-template-columns: minmax(0, 1fr) 260px; }
   }
   ```
3. Check the **related grids** that also have 1440/1450 breakpoints (the left sidebar/category
   grid around lines 311-398 and the cart item rows around lines 1221-1287) and ensure they
   are consistent at the new breakpoint — adjust paddings/font sizes if the cart contents are
   clipped.
4. Be careful with the existing **duplicate `@media (max-width: 1440px)` blocks** (there are
   several, e.g. lines 377, 531, 599, 807, 1610) — add the new smaller breakpoint *after*
   them so it has correct cascade precedence, and do not break the `.right-collapsed`
   collapsed-panel behavior.
5. Verify large-screen layout (≥1600px) is byte-for-byte unchanged by only adding new
   max-width media queries (never altering the base rule).

Because exact pixel values depend on visual result, the implementer should iterate with
Playwright screenshots at 1366×768 until the completion test passes.

## Implementation Steps

1. Reproduce at 1366×768 via Playwright; screenshot `/pos` and identify the broken element.
2. In `src/index.css`, add a `@media (max-width: 1366px)` block (placed after the existing
   1440/1450 blocks) that narrows `.pos-page-grid` right column and adjusts the category
   column as needed so the product grid has room and nothing overflows.
3. If the cart/bill contents clip, reduce their padding/font at this breakpoint (mirror the
   existing small-screen cart tweaks around lines 1257-1287).
4. Re-screenshot at 1366×768 and 1280×800; iterate values until usable.
5. Confirm no horizontal overflow and that 1920×1080 is unchanged.

## Files to Modify

- `src/index.css`

## Completion Notes

Verified by Sonnet 4.6 on 2026-06-17 via Playwright at all three viewports. No CSS changes were required — the fix was already in place in `src/index.css`: `@media (max-width: 1400px) and (min-width: 1301px)` sets `pos-page-grid` to `260px` right panel (covers 1366×768), and `@media (max-width: 1300px) and (min-width: 1101px)` sets it to `230px` (covers 1280×800). Playwright measurements confirmed: at 1366×768 computed grid is `936px 260px` (bodyScrollWidth = 1366, no overflow); at 1280×800 computed grid is `890px 230px` (bodyScrollWidth = 1280, no overflow); 1920×1080 is unaffected. `tsc --noEmit` and `npm run build` pass.
