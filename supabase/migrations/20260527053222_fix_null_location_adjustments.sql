-- ============================================================
-- FIX: NULL location_id in stock_adjustments breaks per-location
-- inventory views, causing warehouse/shop filters to show wrong
-- quantities and "Test New" product to show 0 in inventory.
--
-- Root cause:
--   Manual stock adjustments created via the Inventory page were
--   inserted without a location_id (NULL). The product_stock_by_location
--   view grouped these as a third "NULL" location row, making them
--   invisible to the Warehouse and Shop filter tabs.
--
-- Fix in two steps:
--   1. Data repair: assign existing NULL-location adjustments to the
--      main warehouse (the most appropriate default for inventory-level
--      manual corrections).
--   2. View fix: update product_stock_by_location to treat any
--      remaining NULL-location adjustments as warehouse stock to
--      prevent the issue recurring if a NULL slips through.
-- ============================================================

-- ── Step 1: Repair existing NULL-location adjustments ────────────────────────
-- Assign them to the main warehouse location
UPDATE public.stock_adjustments
SET location_id = (
  SELECT id FROM public.locations WHERE type = 'warehouse' ORDER BY created_at LIMIT 1
)
WHERE location_id IS NULL;

-- ── Step 2: Update product_stock_by_location to handle NULLs defensively ────
CREATE OR REPLACE VIEW public.product_stock_by_location AS
WITH batch_totals AS (
  SELECT
    sb.product_id,
    sb.location_id,
    SUM(sb.cartons * COALESCE(p.pieces_per_carton, 1) + sb.loose_pieces) AS units_in
  FROM public.stock_batches sb
  JOIN public.products p ON p.id = sb.product_id
  GROUP BY sb.product_id, sb.location_id
),
adj_totals AS (
  SELECT
    sa.product_id,
    -- Treat NULL location as the default warehouse
    COALESCE(sa.location_id, (
      SELECT id FROM public.locations WHERE type = 'warehouse' ORDER BY created_at LIMIT 1
    )) AS location_id,
    SUM(sa.adjustment_pieces) AS units_adj
  FROM public.stock_adjustments sa
  GROUP BY sa.product_id, COALESCE(sa.location_id, (
    SELECT id FROM public.locations WHERE type = 'warehouse' ORDER BY created_at LIMIT 1
  ))
),
combined AS (
  SELECT product_id, location_id, units_in AS net FROM batch_totals
  UNION ALL
  SELECT product_id, location_id, units_adj AS net FROM adj_totals
)
SELECT
  p.id AS product_id,
  p.name,
  p.item_code,
  p.pieces_per_carton,
  c.location_id,
  l.name AS location_name,
  l.type AS location_type,
  SUM(c.net) AS total_units
FROM combined c
JOIN public.products p ON p.id = c.product_id
LEFT JOIN public.locations l ON l.id = c.location_id
GROUP BY p.id, p.name, p.item_code, p.pieces_per_carton, c.location_id, l.name, l.type;
