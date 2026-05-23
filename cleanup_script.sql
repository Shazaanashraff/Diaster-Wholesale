-- Drop the constraint that blocks deletion of purchases
ALTER TABLE supplier_returns DROP CONSTRAINT IF EXISTS supplier_returns_purchase_id_fkey;

-- Re-add the constraint with CASCADE
ALTER TABLE supplier_returns ADD CONSTRAINT supplier_returns_purchase_id_fkey 
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE;

-- Delete purchases PO0001 to PO0012. 
-- Since we added ON DELETE CASCADE to purchase_items and supplier_returns, this shouldn't fail.
DELETE FROM purchases WHERE reference IN (
  'PO0001', 'PO0002', 'PO0003', 'PO0004', 'PO0005', 'PO0006', 
  'PO0007', 'PO0008', 'PO0009', 'PO0010', 'PO0011', 'PO0012'
);

-- Note about removing products:
-- If you want to delete mock products like "Test 2", "Windows 11 Pro", you can delete them in the Products page. 
-- Or use the queries below. Be careful, if they have sales history, deleting them will fail unless you cascade delete sales too.

-- Example to delete mock products by name (Uncomment to use):
-- DELETE FROM products WHERE name ILIKE '%Kaspersky%' OR name ILIKE '%Windows 11%' OR name ILIKE '%Office 365%' OR name ILIKE '%Adobe%' OR name ILIKE '%Steam%' OR name ILIKE '%PSN%' OR name ILIKE '%Spotify%' OR name ILIKE '%Test 2%' OR name ILIKE '%ONLY CUP%' OR name ILIKE '%Ricecooker%';
