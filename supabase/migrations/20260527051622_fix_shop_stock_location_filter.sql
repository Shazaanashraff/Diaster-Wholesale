-- ============================================================
-- FIX: shop_stock view incorrectly applied ALL stock_adjustments
-- regardless of location_id, causing stock transfers to show
-- 0 in POS (transfer-out warehouse adjustment was deducted from
-- shop batch as well).
--
-- Correct behaviour:
--   shop_stock.piece_adj = only adjustments WHERE location = 'shop'
-- This ensures warehouse deductions (transfer-out) do not affect
-- the POS shop stock calculation.
-- ============================================================

CREATE OR REPLACE VIEW public.shop_stock AS
SELECT
  p.id AS product_id,
  p.item_code,
  p.name,
  p.model,
  p.category,
  p.wholesale_price,
  p.retail_price,
  p.pieces_per_carton,
  p.reorder_level,
  COALESCE(sb_totals.cartons_in, 0)::bigint  AS cartons_in,
  COALESCE(sb_totals.pieces_in,  0)::bigint   AS pieces_in,
  0::bigint  AS cartons_sold,
  0::integer AS pieces_sold,
  COALESCE(adj_totals.carton_adj, 0)::bigint  AS carton_adj,
  COALESCE(adj_totals.piece_adj,  0)::integer  AS piece_adj
FROM products p
LEFT JOIN (
  -- Only batches physically in a shop location
  SELECT sb.product_id,
    SUM(sb.cartons)      AS cartons_in,
    SUM(sb.loose_pieces) AS pieces_in
  FROM stock_batches sb
  JOIN locations l ON l.id = sb.location_id
  WHERE l.type = 'shop'
  GROUP BY sb.product_id
) sb_totals ON sb_totals.product_id = p.id
LEFT JOIN (
  -- Only adjustments that target a shop location (excludes warehouse transfer-out deductions)
  SELECT sa.product_id,
    SUM(sa.adjustment_cartons) AS carton_adj,
    SUM(sa.adjustment_pieces)  AS piece_adj
  FROM stock_adjustments sa
  JOIN locations l ON l.id = sa.location_id
  WHERE l.type = 'shop'
  GROUP BY sa.product_id
) adj_totals ON adj_totals.product_id = p.id
WHERE p.is_active = true;
