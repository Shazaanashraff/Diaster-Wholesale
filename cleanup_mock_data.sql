-- ================================================================
-- DIASTAR ERP — Fix Mock Data Cleanup + Inventory View Filter
-- Run in Supabase SQL Editor
-- ================================================================

BEGIN;

-- ── DIAGNOSTIC: Check current state ─────────────────────────────
-- (View this output first to understand what's in the DB)
SELECT
  id,
  item_code,
  name,
  is_active,
  'MOCK - needs removal' AS status
FROM products
WHERE item_code IN ('SW-PRO-11','CC-YEAR-AD','GG-PSN-100','GM-FC24-ULT','CL-AWS-500','SB-SPOT-FAM')
   OR (is_active = false AND name IN (
     'Windows 11 Pro License',
     'Adobe Creative Cloud',
     'PSN $100 Gift Card',
     'EA Sports FC 24',
     'AWS Credit Voucher',
     'Spotify Family Premium'
   ));

-- ── Step 1: Force delete all related data (by item_code OR name) ─

-- Stock adjustments
DELETE FROM stock_adjustments WHERE product_id IN (
  SELECT id FROM products WHERE item_code IN ('SW-PRO-11','CC-YEAR-AD','GG-PSN-100','GM-FC24-ULT','CL-AWS-500','SB-SPOT-FAM')
  UNION
  SELECT id FROM products WHERE is_active = false AND name IN ('Windows 11 Pro License','Adobe Creative Cloud','PSN $100 Gift Card','EA Sports FC 24','AWS Credit Voucher','Spotify Family Premium')
);

-- Sales return items
DELETE FROM sales_return_items WHERE product_id IN (
  SELECT id FROM products WHERE item_code IN ('SW-PRO-11','CC-YEAR-AD','GG-PSN-100','GM-FC24-ULT','CL-AWS-500','SB-SPOT-FAM')
  UNION
  SELECT id FROM products WHERE is_active = false AND name IN ('Windows 11 Pro License','Adobe Creative Cloud','PSN $100 Gift Card','EA Sports FC 24','AWS Credit Voucher','Spotify Family Premium')
);

-- Sales returns (via invoice linkage)
DELETE FROM sales_returns WHERE original_invoice_id IN (
  SELECT DISTINCT ii.invoice_id FROM invoice_items ii WHERE ii.product_id IN (
    SELECT id FROM products WHERE item_code IN ('SW-PRO-11','CC-YEAR-AD','GG-PSN-100','GM-FC24-ULT','CL-AWS-500','SB-SPOT-FAM')
    UNION
    SELECT id FROM products WHERE is_active = false AND name IN ('Windows 11 Pro License','Adobe Creative Cloud','PSN $100 Gift Card','EA Sports FC 24','AWS Credit Voucher','Spotify Family Premium')
  )
);

-- Stock transfer items
DELETE FROM stock_transfer_items WHERE product_id IN (
  SELECT id FROM products WHERE item_code IN ('SW-PRO-11','CC-YEAR-AD','GG-PSN-100','GM-FC24-ULT','CL-AWS-500','SB-SPOT-FAM')
  UNION
  SELECT id FROM products WHERE is_active = false AND name IN ('Windows 11 Pro License','Adobe Creative Cloud','PSN $100 Gift Card','EA Sports FC 24','AWS Credit Voucher','Spotify Family Premium')
);

-- Invoice items
DELETE FROM invoice_items WHERE product_id IN (
  SELECT id FROM products WHERE item_code IN ('SW-PRO-11','CC-YEAR-AD','GG-PSN-100','GM-FC24-ULT','CL-AWS-500','SB-SPOT-FAM')
  UNION
  SELECT id FROM products WHERE is_active = false AND name IN ('Windows 11 Pro License','Adobe Creative Cloud','PSN $100 Gift Card','EA Sports FC 24','AWS Credit Voucher','Spotify Family Premium')
);

-- Purchase items
DELETE FROM purchase_items WHERE product_id IN (
  SELECT id FROM products WHERE item_code IN ('SW-PRO-11','CC-YEAR-AD','GG-PSN-100','GM-FC24-ULT','CL-AWS-500','SB-SPOT-FAM')
  UNION
  SELECT id FROM products WHERE is_active = false AND name IN ('Windows 11 Pro License','Adobe Creative Cloud','PSN $100 Gift Card','EA Sports FC 24','AWS Credit Voucher','Spotify Family Premium')
);

-- Purchase receive
DELETE FROM purchase_receive WHERE product_id IN (
  SELECT id FROM products WHERE item_code IN ('SW-PRO-11','CC-YEAR-AD','GG-PSN-100','GM-FC24-ULT','CL-AWS-500','SB-SPOT-FAM')
  UNION
  SELECT id FROM products WHERE is_active = false AND name IN ('Windows 11 Pro License','Adobe Creative Cloud','PSN $100 Gift Card','EA Sports FC 24','AWS Credit Voucher','Spotify Family Premium')
);

-- Stock batches
DELETE FROM stock_batches WHERE product_id IN (
  SELECT id FROM products WHERE item_code IN ('SW-PRO-11','CC-YEAR-AD','GG-PSN-100','GM-FC24-ULT','CL-AWS-500','SB-SPOT-FAM')
  UNION
  SELECT id FROM products WHERE is_active = false AND name IN ('Windows 11 Pro License','Adobe Creative Cloud','PSN $100 Gift Card','EA Sports FC 24','AWS Credit Voucher','Spotify Family Premium')
);

-- INITIAL_LOAD shipment
DELETE FROM shipments WHERE reference = 'INITIAL_LOAD';

-- Finally delete the products themselves
DELETE FROM products
WHERE item_code IN ('SW-PRO-11','CC-YEAR-AD','GG-PSN-100','GM-FC24-ULT','CL-AWS-500','SB-SPOT-FAM');

DELETE FROM products
WHERE is_active = false
  AND name IN ('Windows 11 Pro License','Adobe Creative Cloud','PSN $100 Gift Card','EA Sports FC 24','AWS Credit Voucher','Spotify Family Premium');

-- ── Step 2: Fix the inventory views to filter archived products ───
-- product_stock view: add WHERE p.is_active = true
CREATE OR REPLACE VIEW product_stock AS
SELECT
  p.id               AS product_id,
  p.item_code,
  p.name,
  p.model,
  p.category,
  p.wholesale_price,
  p.retail_price,
  p.pieces_per_carton,
  COALESCE(batch_totals.cartons_in, 0)       AS cartons_in,
  COALESCE(batch_totals.pieces_in,  0)       AS pieces_in,
  COALESCE(sold_totals.cartons_sold, 0)      AS cartons_sold,
  COALESCE(sold_totals.pieces_sold,  0)      AS pieces_sold,
  COALESCE(adj_totals.carton_adj, 0::BIGINT) AS carton_adj,
  COALESCE(adj_totals.piece_adj,  0)         AS piece_adj
FROM products p
LEFT JOIN (
  SELECT product_id,
         SUM(cartons)      AS cartons_in,
         SUM(loose_pieces) AS pieces_in
  FROM stock_batches
  GROUP BY product_id
) batch_totals ON batch_totals.product_id = p.id
LEFT JOIN (
  SELECT ii.product_id,
         SUM(ii.cartons) AS cartons_sold,
         SUM(ii.pieces)  AS pieces_sold
  FROM invoice_items ii
  JOIN invoices inv ON inv.id = ii.invoice_id
  WHERE inv.payment_status IN ('partial','paid')
  GROUP BY ii.product_id
) sold_totals ON sold_totals.product_id = p.id
LEFT JOIN (
  SELECT product_id,
         0::BIGINT              AS carton_adj,
         SUM(adjustment_pieces) AS piece_adj
  FROM stock_adjustments
  GROUP BY product_id
) adj_totals ON adj_totals.product_id = p.id
WHERE p.is_active = true;                        -- ← only active products

-- shop_stock view: add WHERE p.is_active = true
CREATE OR REPLACE VIEW shop_stock AS
SELECT
  p.id               AS product_id,
  p.item_code,
  p.name,
  p.model,
  p.category,
  p.wholesale_price,
  p.retail_price,
  p.pieces_per_carton,
  p.reorder_level,
  COALESCE(sb_totals.cartons_in, 0)  AS cartons_in,
  COALESCE(sb_totals.pieces_in,  0)  AS pieces_in,
  0::BIGINT                          AS cartons_sold,
  0                                  AS pieces_sold,
  0::BIGINT                          AS carton_adj,
  0                                  AS piece_adj
FROM products p
LEFT JOIN (
  SELECT sb.product_id,
         SUM(sb.cartons)      AS cartons_in,
         SUM(sb.loose_pieces) AS pieces_in
  FROM stock_batches sb
  JOIN locations l ON l.id = sb.location_id
  WHERE l.type = 'shop'
  GROUP BY sb.product_id
) sb_totals ON sb_totals.product_id = p.id
WHERE p.is_active = true;                        -- ← only active products

GRANT SELECT ON product_stock TO anon, authenticated;
GRANT SELECT ON shop_stock    TO anon, authenticated;

-- ── Verify ───────────────────────────────────────────────────────
SELECT 'Mock products remaining' AS result, COUNT(*) AS count
FROM products
WHERE item_code IN ('SW-PRO-11','CC-YEAR-AD','GG-PSN-100','GM-FC24-ULT','CL-AWS-500','SB-SPOT-FAM')
UNION ALL
SELECT 'Archived products in inventory view', COUNT(*)
FROM product_stock ps
JOIN products p ON p.id = ps.product_id
WHERE p.is_active = false
UNION ALL
SELECT 'Total active products', COUNT(*)
FROM products WHERE is_active = true;

COMMIT;
