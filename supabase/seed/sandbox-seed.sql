-- ================================================================
-- DIASTAR ERP — Sandbox Seed Dataset
--
-- Replayed by `scripts/sandbox-reset.mjs` (npm run sandbox:reset) after
-- `sandbox.reset_all()` truncates every sandbox.* table (except
-- app_meta). Every insert uses a fixed UUID and ON CONFLICT so the
-- script is safe to run twice and produces a deterministic dataset for
-- E2E tests (stable dropdown ids).
--
-- Curated from the root `sandbox-seed.sql` (kept for reference), plus
-- explicit locations + a Walk-in customer, which `reset_all()` wipes
-- and the migration only seeds once at schema-creation time.
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- LOCATIONS
-- ────────────────────────────────────────────────────────────────
INSERT INTO sandbox.locations (id, name, type) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Main Warehouse', 'warehouse'),
  ('00000000-0000-0000-0000-000000000002', 'Main Shop',      'shop')
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- CUSTOMERS (Walk-in first — required by POS checkout as the default)
-- ────────────────────────────────────────────────────────────────
INSERT INTO sandbox.customers (id, name, phone, email, address, type, credit_limit, outstanding_balance, is_active) VALUES
  ('c1000000-0000-0000-0000-000000000000', 'Walk-in Customer',          '-',          '-',                        '-',                             'retail',        0.00,      0.00, true),
  ('c1000000-0000-0000-0000-000000000001', 'Nimal Electronics Store',   '0771234567', 'nimal@nimelectronics.lk',  '45 Main St, Colombo 03',        'wholesale', 500000.00, 125000.00, true),
  ('c1000000-0000-0000-0000-000000000002', 'Perera Mobile World',       '0779876543', 'perera@mobileworldlk.com', '12 Galle Rd, Colombo 06',       'wholesale', 300000.00,  80000.00, true),
  ('c1000000-0000-0000-0000-000000000003', 'Sunil Tech Solutions',      '0712345678', 'sunil.tech@gmail.com',     '78 Kandy Rd, Kurunegala',       'wholesale', 200000.00,      0.00, true),
  ('c1000000-0000-0000-0000-000000000004', 'Kamani Silva',              '0754321987', 'kamani.silva@gmail.com',   '23 Temple Rd, Nugegoda',        'retail',      5000.00,      0.00, true),
  ('c1000000-0000-0000-0000-000000000005', 'Ruwan Jayawardena',         '0763456789', 'ruwan.j@hotmail.com',      '5 Lake Rd, Moratuwa',           'retail',      5000.00,   1200.00, true),
  ('c1000000-0000-0000-0000-000000000006', 'City Electronics Matara',   '0412234567', 'cityelectronics@yahoo.com','88 Hakmana Rd, Matara',         'wholesale', 150000.00,  45000.00, true)
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- SUPPLIERS
-- ────────────────────────────────────────────────────────────────
INSERT INTO sandbox.suppliers (id, name, contact_person, phone, email, country, is_active, credit_limit, credit_days) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Guangzhou Electronics Ltd',  'Mr. Chen Wei',    '+86-20-8800-1234', 'chen@gzelectronics.cn',    'China', true, 5000000, 30),
  ('a1000000-0000-0000-0000-000000000002', 'Shanghai Tech Wholesale',    'Ms. Li Fang',     '+86-21-6600-5678', 'li.fang@shanghaitech.cn',  'China', true, 3000000, 45),
  ('a1000000-0000-0000-0000-000000000003', 'Beijing General Trading Co', 'Mr. Wang Jian',   '+86-10-5500-9012', 'wangjian@bgtrading.cn',    'China', true, 2000000, 30)
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- PRODUCTS
-- ────────────────────────────────────────────────────────────────
INSERT INTO sandbox.products (id, item_code, name, model, category, wholesale_price, retail_price, pieces_per_carton, reorder_level, is_active) VALUES
  ('b1000000-0000-0000-0000-000000000001', '100001', 'Bluetooth Headphones',     'BH-X200',    'electronics',  3200.00,  4500.00, 12,  20, true),
  ('b1000000-0000-0000-0000-000000000002', '100002', 'USB-C Cable 1m',           'UC-1M-PRO',  'accessories',   280.00,   450.00, 50,  50, true),
  ('b1000000-0000-0000-0000-000000000003', '100003', 'Power Bank 10000mAh',      'PB-10K',     'electronics',  2800.00,  4200.00, 10,  15, true),
  ('b1000000-0000-0000-0000-000000000004', '100004', 'Wireless Earbuds',         'WE-PRO3',    'electronics',  4500.00,  6800.00,  6,  10, true),
  ('b1000000-0000-0000-0000-000000000005', '100005', 'Tempered Glass Screen Protector', 'TG-UNI', 'accessories', 120.00, 250.00, 100, 100, true),
  ('b1000000-0000-0000-0000-000000000006', '100006', 'Phone Case (Universal)',   'PC-UNI-L',   'accessories',   350.00,   650.00, 30,  30, true),
  ('b1000000-0000-0000-0000-000000000007', '100007', 'LED Bulb 9W E27',          'LED-9W-E27', 'lighting',      180.00,   320.00, 24,  48, true),
  ('b1000000-0000-0000-0000-000000000008', '100008', 'Extension Cord 5m 3-Pin',  'EXT-5M-3P',  'electrical',    750.00,  1200.00, 10,  20, true),
  ('b1000000-0000-0000-0000-000000000009', '100009', 'Smart Watch Fitness Band', 'SW-FIT2',    'electronics',  5500.00,  8500.00,  4,   8, true),
  ('b1000000-0000-0000-0000-000000000010', '100010', 'Laptop Bag 15.6"',         'LB-156-BLK', 'bags',         1800.00,  2800.00,  6,  12, true),
  ('b1000000-0000-0000-0000-000000000011', '100011', 'Wall Charger 20W USB-C',   'WC-20W-C',   'accessories',   650.00,  1100.00, 20,  30, true),
  ('b1000000-0000-0000-0000-000000000012', '100012', 'Portable Bluetooth Speaker', 'BS-MINI2', 'electronics',  2200.00,  3500.00,  8,  10, true)
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- PURCHASES (1 completed, 1 ordered)
-- ────────────────────────────────────────────────────────────────
INSERT INTO sandbox.purchases (id, reference, supplier_id, location_id, status, exchange_rate, total_rmb, total_lkr, cost_finalized, notes) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'PO0001',
    'a1000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'completed', 36.50, 28500.00, 1040250.00, true,
    'First shipment — Q1 stock'),
  ('d1000000-0000-0000-0000-000000000002', 'PO0002',
    'a1000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'ordered', 36.80, 15000.00, 552000.00, false,
    'Earbuds and smart watch restock')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sandbox.purchase_items (purchase_id, product_id, quantity_cartons, quantity_units, unit_price_rmb) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 3, 36,  88.00),
  ('d1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 4, 200,  7.50),
  ('d1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000003', 2, 20,  78.00),
  ('d1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000007', 5, 120,  4.80),
  ('d1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000008', 2, 20,  20.50),
  ('d1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000004', 2, 12, 125.00),
  ('d1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000009', 1,  4, 152.00)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- STOCK BATCHES (current inventory)
-- ────────────────────────────────────────────────────────────────
INSERT INTO sandbox.stock_batches (id, product_id, location_id, cartons, loose_pieces, cost_per_piece, notes, received_at) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 2, 4,   3200.00, 'Received from PO0001', now() - interval '20 days'),
  ('e1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 3, 20,   280.00, 'Received from PO0001', now() - interval '20 days'),
  ('e1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 1, 5,   2800.00, 'Received from PO0001', now() - interval '20 days'),
  ('e1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 1, 2,   4500.00, 'Initial stock',        now() - interval '35 days'),
  ('e1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 2, 0,    120.00, 'Initial stock',        now() - interval '35 days'),
  ('e1000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 1, 5,    350.00, 'Initial stock',        now() - interval '35 days'),
  ('e1000000-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 3, 8,    180.00, 'Received from PO0001', now() - interval '20 days'),
  ('e1000000-0000-0000-0000-000000000008', 'b1000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 1, 3,    750.00, 'Received from PO0001', now() - interval '20 days'),
  ('e1000000-0000-0000-0000-000000000009', 'b1000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 0, 3,   5500.00, 'Initial stock',        now() - interval '35 days'),
  ('e1000000-0000-0000-0000-000000000010', 'b1000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 1, 2,   1800.00, 'Initial stock',        now() - interval '35 days'),
  ('e1000000-0000-0000-0000-000000000011', 'b1000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 1, 5,    650.00, 'Initial stock',        now() - interval '35 days'),
  ('e1000000-0000-0000-0000-000000000012', 'b1000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 1, 0,   2200.00, 'Initial stock',        now() - interval '35 days')
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- INVOICES + ITEMS + PAYMENTS
-- ────────────────────────────────────────────────────────────────

-- Invoice 1: Nimal Electronics — wholesale, confirmed/paid
INSERT INTO sandbox.invoices (id, invoice_no, customer_id, mode, subtotal, discount, total, payment_status, created_at) VALUES
  ('f1000000-0000-0000-0000-000000000001', 'INV-0001',
   'c1000000-0000-0000-0000-000000000001',
   'wholesale', 108800.00, 5000.00, 103800.00, 'paid',
   now() - interval '15 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sandbox.invoice_items (invoice_id, product_id, cartons, pieces, unit_price, total) VALUES
  ('f1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 2, 0,  3200.00, 76800.00),
  ('f1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 0, 50,  280.00, 14000.00),
  ('f1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000011', 0, 10,  650.00,  6500.00),
  ('f1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000005', 0, 50,  120.00,  6000.00),
  ('f1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000006', 0, 15,  350.00,  5250.00)
ON CONFLICT DO NOTHING;

INSERT INTO sandbox.payments (invoice_id, customer_id, amount, method, reference, paid_at) VALUES
  ('f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   103800.00, 'bank_transfer', 'BOC-TXN-88421', now() - interval '14 days')
ON CONFLICT DO NOTHING;

-- Invoice 2: Perera Mobile World — wholesale, partial
INSERT INTO sandbox.invoices (id, invoice_no, customer_id, mode, subtotal, discount, total, payment_status, created_at) VALUES
  ('f1000000-0000-0000-0000-000000000002', 'INV-0002',
   'c1000000-0000-0000-0000-000000000002',
   'wholesale', 85000.00, 0.00, 85000.00, 'partial',
   now() - interval '10 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sandbox.invoice_items (invoice_id, product_id, cartons, pieces, unit_price, total) VALUES
  ('f1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000004', 1, 0,  4500.00, 27000.00),
  ('f1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003', 1, 0,  2800.00, 28000.00),
  ('f1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000009', 0, 2,  5500.00, 11000.00),
  ('f1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000012', 0, 4,  2200.00,  8800.00),
  ('f1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000011', 0, 16,  650.00, 10400.00)
ON CONFLICT DO NOTHING;

INSERT INTO sandbox.payments (invoice_id, customer_id, amount, method, reference, paid_at) VALUES
  ('f1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002',
   50000.00, 'cash', '', now() - interval '8 days')
ON CONFLICT DO NOTHING;

-- Invoice 3: Kamani Silva — retail, paid
INSERT INTO sandbox.invoices (id, invoice_no, customer_id, mode, subtotal, discount, total, payment_status, created_at) VALUES
  ('f1000000-0000-0000-0000-000000000003', 'INV-0003',
   'c1000000-0000-0000-0000-000000000004',
   'retail', 12350.00, 0.00, 12350.00, 'paid',
   now() - interval '5 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sandbox.invoice_items (invoice_id, product_id, cartons, pieces, unit_price, total) VALUES
  ('f1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000001', 0, 1,  4500.00,  4500.00),
  ('f1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000002', 0, 2,   450.00,   900.00),
  ('f1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000005', 0, 2,   250.00,   500.00),
  ('f1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000011', 0, 1,  1100.00,  1100.00),
  ('f1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000007', 0, 4,   320.00,  1280.00),
  ('f1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000006', 0, 3,   650.00,  1950.00),
  ('f1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000008', 0, 1,  1200.00,  1200.00),
  ('f1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000006', 0, 1,   650.00,   650.00)
ON CONFLICT DO NOTHING;

INSERT INTO sandbox.payments (invoice_id, customer_id, amount, method, reference, paid_at) VALUES
  ('f1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000004',
   12350.00, 'cash', '', now() - interval '5 days')
ON CONFLICT DO NOTHING;

-- Invoice 4: City Electronics Matara — wholesale, unpaid
INSERT INTO sandbox.invoices (id, invoice_no, customer_id, mode, subtotal, discount, total, payment_status, created_at) VALUES
  ('f1000000-0000-0000-0000-000000000004', 'INV-0004',
   'c1000000-0000-0000-0000-000000000006',
   'wholesale', 67500.00, 2500.00, 65000.00, 'unpaid',
   now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sandbox.invoice_items (invoice_id, product_id, cartons, pieces, unit_price, total) VALUES
  ('f1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000001', 1, 0,  3200.00, 38400.00),
  ('f1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000010', 0, 5,  1800.00,  9000.00),
  ('f1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000008', 0, 8,   750.00,  6000.00),
  ('f1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000007', 0, 24,  180.00,  4320.00),
  ('f1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000002', 0, 35,  280.00,  9800.00)
ON CONFLICT DO NOTHING;

-- Invoice 5: Ruwan Jayawardena — retail, partial
INSERT INTO sandbox.invoices (id, invoice_no, customer_id, mode, subtotal, discount, total, payment_status, created_at) VALUES
  ('f1000000-0000-0000-0000-000000000005', 'INV-0005',
   'c1000000-0000-0000-0000-000000000005',
   'retail', 15300.00, 0.00, 15300.00, 'partial',
   now() - interval '7 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sandbox.invoice_items (invoice_id, product_id, cartons, pieces, unit_price, total) VALUES
  ('f1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000009', 0, 1,  8500.00,  8500.00),
  ('f1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000001', 0, 1,  4500.00,  4500.00),
  ('f1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000002', 0, 1,   450.00,   450.00),
  ('f1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000005', 0, 3,   250.00,   750.00),
  ('f1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000011', 0, 1,  1100.00,  1100.00)
ON CONFLICT DO NOTHING;

INSERT INTO sandbox.payments (invoice_id, customer_id, amount, method, reference, paid_at) VALUES
  ('f1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000005',
   14100.00, 'cash', '', now() - interval '6 days')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- EXPENSES
-- ────────────────────────────────────────────────────────────────
INSERT INTO sandbox.expenses (category, description, amount, method, reference, created_at) VALUES
  ('rent',      'Warehouse monthly rent — April',     85000.00, 'bank_transfer', 'RENT-APR-2026', now() - interval '30 days'),
  ('utilities', 'Electricity bill — CEB March',       12400.00, 'cash',          'CEB-MAR-2026',  now() - interval '25 days'),
  ('transport', 'Delivery van fuel — week 1',          8500.00, 'cash',          '',              now() - interval '18 days'),
  ('salaries',  'Staff salaries — April',            125000.00, 'bank_transfer', 'SAL-APR-2026',  now() - interval '15 days'),
  ('utilities', 'Internet & phone bill',               4200.00, 'cash',          'SLT-APR-2026',  now() - interval '10 days'),
  ('transport', 'Delivery charges — Matara run',       6800.00, 'cash',          '',              now() - interval '5 days'),
  ('supplies',  'Packaging material & stationery',     3500.00, 'cash',          '',              now() - interval '3 days'),
  ('rent',      'Warehouse monthly rent — May',       85000.00, 'bank_transfer', 'RENT-MAY-2026', now() - interval '1 day')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- SUPPLIER PAYMENTS
-- ────────────────────────────────────────────────────────────────
INSERT INTO sandbox.supplier_payments (supplier_id, purchase_id, amount, method, notes, paid_at) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001',
   500000.00, 'bank_transfer', 'Advance payment for PO0001', now() - interval '25 days'),
  ('a1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001',
   540250.00, 'bank_transfer', 'Final settlement PO0001',   now() - interval '18 days')
ON CONFLICT DO NOTHING;

-- ================================================================
-- DONE — sandbox now has:
--   2 locations, 1 Walk-in + 6 named customers, 3 suppliers, 12 products,
--   2 purchases, 12 stock batches, 5 invoices (incl. 1 confirmed/paid),
--   8 expenses, 2 supplier payments
-- ================================================================
