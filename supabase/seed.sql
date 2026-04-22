-- ============================================================
-- SEED DATA — Initial Products, Customers, and Stock
-- ============================================================

-- 1. Insert Initial Products
INSERT INTO products (id, item_code, name, model, description, category, wholesale_price, retail_price, pieces_per_carton)
VALUES 
  ('e1000000-0000-0000-0000-000000000001', 'SW-PRO-11', 'Windows 11 Pro License', 'Global Retail', 'Lifetime activation key for Windows 11 Professional.', 'software', 45.00, 89.00, 10),
  ('e1000000-0000-0000-0000-000000000002', 'CC-YEAR-AD', 'Adobe Creative Cloud', '12 Month Sub', 'Full suite access for 1 user, 100GB cloud storage.', 'software', 320.00, 549.00, 10),
  ('e1000000-0000-0000-0000-000000000003', 'GG-PSN-100', 'PSN $100 Gift Card', 'US Region', 'Digital code for PlayStation Store US accounts.', 'giftcards', 88.00, 100.00, 10),
  ('e1000000-0000-0000-0000-000000000004', 'GM-FC24-ULT', 'EA Sports FC 24', 'Ultimate Edition', 'Digital key for EA App (PC) platform.', 'gaming', 42.00, 69.99, 10),
  ('e1000000-0000-0000-0000-000000000005', 'CL-AWS-500', 'AWS Credit Voucher', '$500 Credit', 'Redeemable credit for Amazon Web Services.', 'cloud', 350.00, 480.00, 10),
  ('e1000000-0000-0000-0000-000000000006', 'SB-SPOT-FAM', 'Spotify Family Premium', '6 Months Plan', 'Premium subscription for up to 6 family members.', 'subscriptions', 32.00, 54.00, 10)
ON CONFLICT (item_code) DO NOTHING;

-- 2. Insert Initial Customers
INSERT INTO customers (id, name, phone, email, address, credit_balance)
VALUES 
  ('c1000000-0000-0000-0000-000000000001', 'Walk-in Customer', '-', '-', 'Default Store Location', 0),
  ('c1000000-0000-0000-0000-000000000002', 'Rijal', '+62 1234 5678', 'rijal@example.com', 'Jakarta, Indonesia', 15400)
ON CONFLICT DO NOTHING;

-- 3. Add Initial Stock (Shipment + Batches)
-- This ensures products have stock available in POS immediately
DO $$
DECLARE
    v_shipment_id UUID;
BEGIN
    -- Create a default initial shipment
    INSERT INTO shipments (reference, supplier, notes)
    VALUES ('INITIAL_LOAD', 'Digital Wholesale Distro', 'Initial system setup stock')
    RETURNING id INTO v_shipment_id;

    -- Add 100 cartons of stock for each product
    INSERT INTO stock_batches (product_id, shipment_id, cartons, loose_pieces, cost_per_piece, notes)
    SELECT id, v_shipment_id, 100, 0, wholesale_price, 'Auto-seeded stock'
    FROM products;
END $$;
