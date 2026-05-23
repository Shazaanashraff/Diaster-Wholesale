-- ================================================================
-- FIX: Move P0004 (Dry Iron) batches back to warehouse
-- ================================================================

-- Move ALL stock batches of P0004 products → warehouse
-- (SC-9008 and SC-9801 from P0004 CANTANAR)
UPDATE public.stock_batches
SET location_id = (
  SELECT id FROM public.locations WHERE type = 'warehouse' ORDER BY created_at LIMIT 1
)
WHERE product_id IN (
  SELECT DISTINCT pi.product_id
  FROM public.purchase_items pi
  JOIN public.purchases pu ON pu.id = pi.purchase_id
  WHERE pu.reference ILIKE '%P0004%'
);

-- Verify: dry irons should now show warehouse
SELECT
  prod.name,
  sb.cartons,
  l.name AS location,
  l.type
FROM public.stock_batches sb
JOIN public.products prod ON prod.id = sb.product_id
JOIN public.locations l ON l.id = sb.location_id
WHERE prod.name ILIKE '%dry iron%'
ORDER BY prod.name, sb.cartons DESC;
