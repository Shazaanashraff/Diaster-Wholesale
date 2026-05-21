-- 1) Drop and recreate the foreign key on supplier_returns to CASCADE on delete.
-- This will allow you to delete purchases that have related records here.
ALTER TABLE IF EXISTS public.supplier_returns 
  DROP CONSTRAINT IF EXISTS supplier_returns_purchase_id_fkey;

ALTER TABLE IF EXISTS public.supplier_returns 
  ADD CONSTRAINT supplier_returns_purchase_id_fkey 
  FOREIGN KEY (purchase_id) 
  REFERENCES public.purchases(id) 
  ON DELETE CASCADE;

ALTER TABLE IF EXISTS sandbox.supplier_returns 
  DROP CONSTRAINT IF EXISTS supplier_returns_purchase_id_fkey;

ALTER TABLE IF EXISTS sandbox.supplier_returns 
  ADD CONSTRAINT supplier_returns_purchase_id_fkey 
  FOREIGN KEY (purchase_id) 
  REFERENCES sandbox.purchases(id) 
  ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.supplier_payments 
  DROP CONSTRAINT IF EXISTS supplier_payments_purchase_id_fkey;

ALTER TABLE IF EXISTS public.supplier_payments 
  ADD CONSTRAINT supplier_payments_purchase_id_fkey 
  FOREIGN KEY (purchase_id) 
  REFERENCES public.purchases(id) 
  ON DELETE CASCADE;

ALTER TABLE IF EXISTS sandbox.supplier_payments 
  DROP CONSTRAINT IF EXISTS supplier_payments_purchase_id_fkey;

ALTER TABLE IF EXISTS sandbox.supplier_payments 
  ADD CONSTRAINT supplier_payments_purchase_id_fkey 
  FOREIGN KEY (purchase_id) 
  REFERENCES sandbox.purchases(id) 
  ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.purchase_receive 
  DROP CONSTRAINT IF EXISTS purchase_receive_purchase_id_fkey;

ALTER TABLE IF EXISTS public.purchase_receive 
  ADD CONSTRAINT purchase_receive_purchase_id_fkey 
  FOREIGN KEY (purchase_id) 
  REFERENCES public.purchases(id) 
  ON DELETE CASCADE;

ALTER TABLE IF EXISTS sandbox.purchase_receive 
  DROP CONSTRAINT IF EXISTS purchase_receive_purchase_id_fkey;

ALTER TABLE IF EXISTS sandbox.purchase_receive 
  ADD CONSTRAINT purchase_receive_purchase_id_fkey 
  FOREIGN KEY (purchase_id) 
  REFERENCES sandbox.purchases(id) 
  ON DELETE CASCADE;

-- 2) Delete Purchases PO0001 through PO0012 securely
DELETE FROM public.purchases 
WHERE reference IN ('PO0001', 'PO0002', 'PO0003', 'PO0004', 'PO0005', 'PO0006', 'PO0007', 'PO0008', 'PO0009', 'PO0010', 'PO0011', 'PO0012');

DELETE FROM sandbox.purchases 
WHERE reference IN ('PO0001', 'PO0002', 'PO0003', 'PO0004', 'PO0005', 'PO0006', 'PO0007', 'PO0008', 'PO0009', 'PO0010', 'PO0011', 'PO0012');

-- 3) Delete related references manually before deleting mock products
DELETE FROM public.invoice_items WHERE product_id IN (SELECT id FROM public.products WHERE name IN ('Test 2', 'YM 60 Ricecooker', 'ONLY CUP 6PCS SET 220CC', 'ONLY CUP 6 PCS SET 220CC', 'ONLY CUP 6PCS SET 160CC'));
DELETE FROM public.purchase_items WHERE product_id IN (SELECT id FROM public.products WHERE name IN ('Test 2', 'YM 60 Ricecooker', 'ONLY CUP 6PCS SET 220CC', 'ONLY CUP 6 PCS SET 220CC', 'ONLY CUP 6PCS SET 160CC'));
DELETE FROM public.purchase_receive WHERE product_id IN (SELECT id FROM public.products WHERE name IN ('Test 2', 'YM 60 Ricecooker', 'ONLY CUP 6PCS SET 220CC', 'ONLY CUP 6 PCS SET 220CC', 'ONLY CUP 6PCS SET 160CC'));
DELETE FROM public.supplier_return_items WHERE product_id IN (SELECT id FROM public.products WHERE name IN ('Test 2', 'YM 60 Ricecooker', 'ONLY CUP 6PCS SET 220CC', 'ONLY CUP 6 PCS SET 220CC', 'ONLY CUP 6PCS SET 160CC'));
DELETE FROM public.stock_transfer_items WHERE product_id IN (SELECT id FROM public.products WHERE name IN ('Test 2', 'YM 60 Ricecooker', 'ONLY CUP 6PCS SET 220CC', 'ONLY CUP 6 PCS SET 220CC', 'ONLY CUP 6PCS SET 160CC'));
DELETE FROM public.sales_return_items WHERE product_id IN (SELECT id FROM public.products WHERE name IN ('Test 2', 'YM 60 Ricecooker', 'ONLY CUP 6PCS SET 220CC', 'ONLY CUP 6 PCS SET 220CC', 'ONLY CUP 6PCS SET 160CC'));
DELETE FROM public.stock_batches WHERE product_id IN (SELECT id FROM public.products WHERE name IN ('Test 2', 'YM 60 Ricecooker', 'ONLY CUP 6PCS SET 220CC', 'ONLY CUP 6 PCS SET 220CC', 'ONLY CUP 6PCS SET 160CC'));
DELETE FROM public.stock_adjustments WHERE product_id IN (SELECT id FROM public.products WHERE name IN ('Test 2', 'YM 60 Ricecooker', 'ONLY CUP 6PCS SET 220CC', 'ONLY CUP 6 PCS SET 220CC', 'ONLY CUP 6PCS SET 160CC'));
DELETE FROM public.cartons WHERE product_id IN (SELECT id FROM public.products WHERE name IN ('Test 2', 'YM 60 Ricecooker', 'ONLY CUP 6PCS SET 220CC', 'ONLY CUP 6 PCS SET 220CC', 'ONLY CUP 6PCS SET 160CC'));

DELETE FROM sandbox.invoice_items WHERE product_id IN (SELECT id FROM sandbox.products WHERE name IN ('Test 2', 'YM 60 Ricecooker', 'ONLY CUP 6PCS SET 220CC', 'ONLY CUP 6 PCS SET 220CC', 'ONLY CUP 6PCS SET 160CC'));
DELETE FROM sandbox.purchase_items WHERE product_id IN (SELECT id FROM sandbox.products WHERE name IN ('Test 2', 'YM 60 Ricecooker', 'ONLY CUP 6PCS SET 220CC', 'ONLY CUP 6 PCS SET 220CC', 'ONLY CUP 6PCS SET 160CC'));
DELETE FROM sandbox.purchase_receive WHERE product_id IN (SELECT id FROM sandbox.products WHERE name IN ('Test 2', 'YM 60 Ricecooker', 'ONLY CUP 6PCS SET 220CC', 'ONLY CUP 6 PCS SET 220CC', 'ONLY CUP 6PCS SET 160CC'));
DELETE FROM sandbox.supplier_return_items WHERE product_id IN (SELECT id FROM sandbox.products WHERE name IN ('Test 2', 'YM 60 Ricecooker', 'ONLY CUP 6PCS SET 220CC', 'ONLY CUP 6 PCS SET 220CC', 'ONLY CUP 6PCS SET 160CC'));
DELETE FROM sandbox.stock_transfer_items WHERE product_id IN (SELECT id FROM sandbox.products WHERE name IN ('Test 2', 'YM 60 Ricecooker', 'ONLY CUP 6PCS SET 220CC', 'ONLY CUP 6 PCS SET 220CC', 'ONLY CUP 6PCS SET 160CC'));
DELETE FROM sandbox.sales_return_items WHERE product_id IN (SELECT id FROM sandbox.products WHERE name IN ('Test 2', 'YM 60 Ricecooker', 'ONLY CUP 6PCS SET 220CC', 'ONLY CUP 6 PCS SET 220CC', 'ONLY CUP 6PCS SET 160CC'));
DELETE FROM sandbox.stock_batches WHERE product_id IN (SELECT id FROM sandbox.products WHERE name IN ('Test 2', 'YM 60 Ricecooker', 'ONLY CUP 6PCS SET 220CC', 'ONLY CUP 6 PCS SET 220CC', 'ONLY CUP 6PCS SET 160CC'));
DELETE FROM sandbox.stock_adjustments WHERE product_id IN (SELECT id FROM sandbox.products WHERE name IN ('Test 2', 'YM 60 Ricecooker', 'ONLY CUP 6PCS SET 220CC', 'ONLY CUP 6 PCS SET 220CC', 'ONLY CUP 6PCS SET 160CC'));
DELETE FROM sandbox.cartons WHERE product_id IN (SELECT id FROM sandbox.products WHERE name IN ('Test 2', 'YM 60 Ricecooker', 'ONLY CUP 6PCS SET 220CC', 'ONLY CUP 6 PCS SET 220CC', 'ONLY CUP 6PCS SET 160CC'));

-- 4) Finally, delete the test products themselves
DELETE FROM public.products 
WHERE name IN ('Test 2', 'YM 60 Ricecooker', 'ONLY CUP 6PCS SET 220CC', 'ONLY CUP 6 PCS SET 220CC', 'ONLY CUP 6PCS SET 160CC');

DELETE FROM sandbox.products 
WHERE name IN ('Test 2', 'YM 60 Ricecooker', 'ONLY CUP 6PCS SET 220CC', 'ONLY CUP 6 PCS SET 220CC', 'ONLY CUP 6PCS SET 160CC');

-- (Optional) If you also want to remove software licenses created during testing:
-- DELETE FROM public.products WHERE name IN ('Kaspersky Total Security', 'Windows 11 Pro License Key', 'Office 365 Personal', 'Adobe Creative Cloud', 'Steam Gift Card LKR 5000', 'PS Plus Essential', 'PSN $100 Gift Card', 'Windows 11 Pro License', 'EA Sports FC 24', 'Spotify Family Premium');
