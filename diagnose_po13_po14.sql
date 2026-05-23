-- ================================================================
-- DIAGNOSTIC STEP 2: What survived the cleanup for PO13 & PO14?
-- Run ALL at once in Supabase SQL Editor
-- ================================================================

-- A) Check purchase_receive — did receive records survive?
SELECT 
  pu.reference AS po,
  pu.status,
  recv.product_id,
  prod.name AS product_name,
  recv.ordered_units,
  recv.received_units,
  recv.damaged_units,
  recv.received_at
FROM public.purchases pu
LEFT JOIN public.purchase_receive recv ON recv.purchase_id = pu.id
LEFT JOIN public.products prod ON prod.id = recv.product_id
WHERE pu.reference IN ('PO0013', 'PO0014')
ORDER BY pu.reference, prod.name;

-- B) Check stock_batches referencing PO13/14 in notes
SELECT 
  sb.id,
  prod.name AS product_name,
  prod.id AS product_id,
  sb.cartons,
  sb.loose_pieces,
  sb.cost_per_piece,
  sb.notes,
  sb.received_at
FROM public.stock_batches sb
LEFT JOIN public.products prod ON prod.id = sb.product_id
WHERE sb.notes LIKE '%PO0013%' OR sb.notes LIKE '%PO0014%'
ORDER BY sb.received_at;

-- C) Check if the deleted products still exist at all
SELECT id, name, item_code, pieces_per_carton
FROM public.products
WHERE name IN (
  'Test 2', 
  'YM 60 Ricecooker', 
  'ONLY CUP 6PCS SET 220CC', 
  'ONLY CUP 6 PCS SET 220CC', 
  'ONLY CUP 6PCS SET 160CC'
);

-- D) Check ALL purchase_receive records (not just PO13/14)
--    to see if orphaned receive rows exist for deleted products
SELECT 
  recv.purchase_id,
  pu.reference AS po,
  recv.product_id,
  prod.name AS product_name,
  recv.received_units,
  recv.damaged_units
FROM public.purchase_receive recv
JOIN public.purchases pu ON pu.id = recv.purchase_id
LEFT JOIN public.products prod ON prod.id = recv.product_id
WHERE prod.name IS NULL  -- orphaned: product was deleted
ORDER BY pu.reference;

-- E) Total LKR still stored on the PO vs items total (should match 0 now)
SELECT 
  pu.reference,
  pu.status,
  pu.total_lkr,
  pu.total_rmb,
  pu.exchange_rate,
  COALESCE(SUM(pi.quantity_units * pi.unit_price_rmb), 0) AS items_subtotal_rmb
FROM public.purchases pu
LEFT JOIN public.purchase_items pi ON pi.purchase_id = pu.id
WHERE pu.reference IN ('PO0013', 'PO0014')
GROUP BY pu.reference, pu.status, pu.total_lkr, pu.total_rmb, pu.exchange_rate
ORDER BY pu.reference;
