-- ================================================================
-- DIASTAR ERP — Sandbox Baseline Seed
-- Run via: npm run sandbox:reset  (which calls sandbox.reset_all() first)
-- or directly in Supabase SQL Editor after reset_all().
--
-- search_path is set to sandbox by the reset script; all table names
-- below are unqualified and resolve to sandbox.* automatically.
--
-- IDEMPOTENT: all INSERTs use ON CONFLICT (pk) DO NOTHING so
-- re-running without a prior reset is safe (no duplicates).
--
-- Fixed UUIDs: every row has a hard-coded UUID so downstream tests
-- and E2E fixtures can rely on stable IDs.
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- SUPPLIERS  (3 rows)
-- ────────────────────────────────────────────────────────────────
INSERT INTO suppliers (id, name, contact_person, phone, email, country, is_active, credit_limit, credit_days)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Guangzhou Electronics Ltd',  'Mr. Chen Wei',  '+86-20-8800-1234', 'chen@gzelectronics.cn',   'China', true, 5000000, 30),
  ('a1000000-0000-0000-0000-000000000002', 'Shanghai Tech Wholesale',    'Ms. Li Fang',   '+86-21-6600-5678', 'li.fang@shanghaitech.cn', 'China', true, 3000000, 45),
  ('a1000000-0000-0000-0000-000000000003', 'Beijing General Trading Co', 'Mr. Wang Jian', '+86-10-5500-9012', 'wangjian@bgtrading.cn',   'China', true, 2000000, 30)
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- LOCATIONS (must come before stock_batches FK)
-- Seeded by the migration; re-insert with fixed IDs here for determinism.
-- ────────────────────────────────────────────────────────────────
INSERT INTO locations (id, name, type, is_active)
VALUES
  ('l1000000-0000-0000-0000-000000000001', 'Main Warehouse', 'warehouse', true),
  ('l1000000-0000-0000-0000-000000000002', 'Shop',           'shop',      true)
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- PRODUCTS  (12 rows)
-- ────────────────────────────────────────────────────────────────
INSERT INTO products (id, item_code, name, model, category, wholesale_price, retail_price, pieces_per_carton, reorder_level, is_active, cost_price)
VALUES
  ('b1000000-0000-0000-0000-000000000001', '100001', 'Bluetooth Headphones',           'BH-X200',    'electronics',  3200.00,  4500.00, 12, 20, true, 2700.00),
  ('b1000000-0000-0000-0000-000000000002', '100002', 'USB-C Cable 1m',                 'UC-1M-PRO',  'accessories',   280.00,   450.00, 50, 50, true,  200.00),
  ('b1000000-0000-0000-0000-000000000003', '100003', 'Power Bank 10000mAh',            'PB-10K',     'electronics',  2800.00,  4200.00, 10, 15, true, 2400.00),
  ('b1000000-0000-0000-0000-000000000004', '100004', 'Wireless Earbuds',               'WE-PRO3',    'electronics',  4500.00,  6800.00,  6, 10, true, 3800.00),
  ('b1000000-0000-0000-0000-000000000005', '100005', 'Tempered Glass Screen Protector','TG-UNI',     'accessories',   120.00,   250.00,100,100, true,   80.00),
  ('b1000000-0000-0000-0000-000000000006', '100006', 'Phone Case (Universal)',          'PC-UNI-L',  'accessories',   350.00,   650.00, 30, 30, true,  260.00),
  ('b1000000-0000-0000-0000-000000000007', '100007', 'LED Bulb 9W E27',                'LED-9W-E27','lighting',       180.00,   320.00, 24, 48, true,  130.00),
  ('b1000000-0000-0000-0000-000000000008', '100008', 'Extension Cord 5m 3-Pin',        'EXT-5M-3P', 'electrical',    750.00,  1200.00, 10, 20, true,  580.00),
  ('b1000000-0000-0000-0000-000000000009', '100009', 'Smart Watch Fitness Band',       'SW-FIT2',   'electronics',  5500.00,  8500.00,  4,  8, true, 4600.00),
  ('b1000000-0000-0000-0000-000000000010', '100010', 'Laptop Bag 15.6"',               'LB-156-BLK','bags',         1800.00,  2800.00,  6, 12, true, 1400.00),
  ('b1000000-0000-0000-0000-000000000011', '100011', 'Wall Charger 20W USB-C',         'WC-20W-C',  'accessories',   650.00,  1100.00, 20, 30, true,  500.00),
  ('b1000000-0000-0000-0000-000000000012', '100012', 'Portable Bluetooth Speaker',     'BS-MINI2',  'electronics',  2200.00,  3500.00,  8, 10, true, 1900.00)
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- CUSTOMERS  (7 rows — includes Walk-in with fixed UUID)
-- ────────────────────────────────────────────────────────────────
INSERT INTO customers (id, name, phone, email, address, type, credit_limit, outstanding_balance, is_active)
VALUES
  ('c0000000-0000-0000-0000-000000000000', 'Walk-in Customer',          '-',          '',                             '',                              'retail',       0.00,      0.00, true),
  ('c1000000-0000-0000-0000-000000000001', 'Nimal Electronics Store',   '0771234567', 'nimal@nimelectronics.lk',  '45 Main St, Colombo 03',        'wholesale', 500000.00, 125000.00, true),
  ('c1000000-0000-0000-0000-000000000002', 'Perera Mobile World',       '0779876543', 'perera@mobileworldlk.com', '12 Galle Rd, Colombo 06',       'wholesale', 300000.00,  80000.00, true),
  ('c1000000-0000-0000-0000-000000000003', 'Sunil Tech Solutions',      '0712345678', 'sunil.tech@gmail.com',     '78 Kandy Rd, Kurunegala',       'wholesale', 200000.00,      0.00, true),
  ('c1000000-0000-0000-0000-000000000004', 'Kamani Silva',              '0754321987', 'kamani.silva@gmail.com',   '23 Temple Rd, Nugegoda',        'retail',      5000.00,      0.00, true),
  ('c1000000-0000-0000-0000-000000000005', 'Ruwan Jayawardena',         '0763456789', 'ruwan.j@hotmail.com',      '5 Lake Rd, Moratuwa',           'retail',      5000.00,   1200.00, true),
  ('c1000000-0000-0000-0000-000000000006', 'City Electronics Matara',   '0412234567', 'cityelectronics@yahoo.com','88 Hakmana Rd, Matara',         'wholesale', 150000.00,  45000.00, true)
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- PURCHASES  (1 completed, 1 ordered)
-- ────────────────────────────────────────────────────────────────
INSERT INTO purchases (id, reference, supplier_id, location_id, status, exchange_rate, total_rmb, total_lkr, cost_finalized, notes)
VALUES
  ('d1000000-0000-0000-0000-000000000001', 'PO0001',
    'a1000000-0000-0000-0000-000000000001',
    'l1000000-0000-0000-0000-000000000001',
    'completed', 36.50, 28500.00, 1040250.00, true,
    'First shipment — Q1 stock'),
  ('d1000000-0000-0000-0000-000000000002', 'PO0002',
    'a1000000-0000-0000-0000-000000000002',
    'l1000000-0000-0000-0000-000000000001',
    'ordered', 36.80, 15000.00, 552000.00, false,
    'Earbuds and smart watch restock')
ON CONFLICT (id) DO NOTHING;

INSERT INTO purchase_items (id, purchase_id, product_id, quantity_cartons, quantity_units, unit_price_rmb)
VALUES
  ('pi100000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 3, 36,   88.00),
  ('pi100000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 4,200,    7.50),
  ('pi100000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000003', 2, 20,   78.00),
  ('pi100000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000007', 5,120,    4.80),
  ('pi100000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000008', 2, 20,   20.50),
  ('pi100000-0000-0000-0000-000000000006', 'd1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000004', 2, 12,  125.00),
  ('pi100000-0000-0000-0000-000000000007', 'd1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000009', 1,  4,  152.00)
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- STOCK BATCHES  (current inventory — 12 batches)
-- ────────────────────────────────────────────────────────────────
INSERT INTO stock_batches (id, product_id, cartons, loose_pieces, cost_per_piece, notes, received_at)
VALUES
  ('e1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 2,  4, 3200.00, 'Received from PO0001', now() - interval '20 days'),
  ('e1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 3, 20,  280.00, 'Received from PO0001', now() - interval '20 days'),
  ('e1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000003', 1,  5, 2800.00, 'Received from PO0001', now() - interval '20 days'),
  ('e1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000004', 1,  2, 4500.00, 'Initial stock',        now() - interval '35 days'),
  ('e1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000005', 2,  0,  120.00, 'Initial stock',        now() - interval '35 days'),
  ('e1000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000006', 1, 15,  350.00, 'Initial stock',        now() - interval '35 days'),
  ('e1000000-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000007', 4,  0,  180.00, 'Received from PO0001', now() - interval '20 days'),
  ('e1000000-0000-0000-0000-000000000008', 'b1000000-0000-0000-0000-000000000008', 1,  5,  750.00, 'Received from PO0001', now() - interval '20 days'),
  ('e1000000-0000-0000-0000-000000000009', 'b1000000-0000-0000-0000-000000000009', 0,  3, 5500.00, 'Initial stock',        now() - interval '35 days'),
  ('e1000000-0000-0000-0000-000000000010', 'b1000000-0000-0000-0000-000000000010', 2,  0, 1800.00, 'Initial stock',        now() - interval '35 days'),
  ('e1000000-0000-0000-0000-000000000011', 'b1000000-0000-0000-0000-000000000011', 1, 10,  650.00, 'Initial stock',        now() - interval '35 days'),
  ('e1000000-0000-0000-0000-000000000012', 'b1000000-0000-0000-0000-000000000012', 2,  0, 2200.00, 'Initial stock',        now() - interval '35 days')
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- INVOICES + ITEMS + PAYMENTS  (3 invoices: paid, partial, unpaid)
-- ────────────────────────────────────────────────────────────────

-- Invoice 1: Nimal Electronics — wholesale, paid
INSERT INTO invoices (id, invoice_no, customer_id, mode, subtotal, discount, total, payment_status, created_at)
VALUES
  ('f1000000-0000-0000-0000-000000000001', 'INV-0001',
   'c1000000-0000-0000-0000-000000000001',
   'wholesale', 96000.00, 4000.00, 92000.00, 'paid',
   now() - interval '15 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO invoice_items (id, invoice_id, product_id, cartons, pieces, unit_price, total)
VALUES
  ('ii100000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 2,  0, 3200.00, 76800.00),
  ('ii100000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 0, 50,  280.00, 14000.00),
  ('ii100000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000011', 0, 10,  650.00,  6500.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO payments (id, invoice_id, customer_id, amount, method, reference, paid_at)
VALUES
  ('py100000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001',
   92000.00, 'bank_transfer', 'TRF-001', now() - interval '14 days')
ON CONFLICT (id) DO NOTHING;

-- Invoice 2: Perera Mobile World — wholesale, partial
INSERT INTO invoices (id, invoice_no, customer_id, mode, subtotal, discount, total, payment_status, created_at)
VALUES
  ('f1000000-0000-0000-0000-000000000002', 'INV-0002',
   'c1000000-0000-0000-0000-000000000002',
   'wholesale', 80000.00, 0.00, 80000.00, 'partial',
   now() - interval '8 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO invoice_items (id, invoice_id, product_id, cartons, pieces, unit_price, total)
VALUES
  ('ii100000-0000-0000-0000-000000000004', 'f1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000004', 1,  0, 4500.00, 27000.00),
  ('ii100000-0000-0000-0000-000000000005', 'f1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000009', 0,  2, 5500.00, 11000.00),
  ('ii100000-0000-0000-0000-000000000006', 'f1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000012', 0,  4, 2200.00,  8800.00),
  ('ii100000-0000-0000-0000-000000000007', 'f1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000011', 0, 16,  650.00, 10400.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO payments (id, invoice_id, customer_id, amount, method, reference, paid_at)
VALUES
  ('py100000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000002',
   50000.00, 'cash', '', now() - interval '8 days')
ON CONFLICT (id) DO NOTHING;

-- Invoice 3: Kamani Silva — retail, paid
INSERT INTO invoices (id, invoice_no, customer_id, mode, subtotal, discount, total, payment_status, created_at)
VALUES
  ('f1000000-0000-0000-0000-000000000003', 'INV-0003',
   'c1000000-0000-0000-0000-000000000004',
   'retail', 12350.00, 0.00, 12350.00, 'paid',
   now() - interval '5 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO invoice_items (id, invoice_id, product_id, cartons, pieces, unit_price, total)
VALUES
  ('ii100000-0000-0000-0000-000000000008', 'f1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000001', 0, 1,  4500.00,  4500.00),
  ('ii100000-0000-0000-0000-000000000009', 'f1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000002', 0, 2,   450.00,   900.00),
  ('ii100000-0000-0000-0000-000000000010', 'f1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000005', 0, 2,   250.00,   500.00),
  ('ii100000-0000-0000-0000-000000000011', 'f1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000011', 0, 1,  1100.00,  1100.00),
  ('ii100000-0000-0000-0000-000000000012', 'f1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000007', 0, 4,   320.00,  1280.00),
  ('ii100000-0000-0000-0000-000000000013', 'f1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000008', 0, 1,  1200.00,  1200.00),
  ('ii100000-0000-0000-0000-000000000014', 'f1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000006', 0, 3,   650.00,  1950.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO payments (id, invoice_id, customer_id, amount, method, reference, paid_at)
VALUES
  ('py100000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000004',
   12350.00, 'cash', '', now() - interval '5 days')
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- EXPENSES  (8 rows)
-- ────────────────────────────────────────────────────────────────
INSERT INTO expenses (id, category, description, amount, method, reference, created_at)
VALUES
  ('ex100000-0000-0000-0000-000000000001', 'rent',      'Warehouse monthly rent — April',     85000.00, 'bank_transfer', 'RENT-APR-2026', now() - interval '30 days'),
  ('ex100000-0000-0000-0000-000000000002', 'utilities', 'Electricity bill — CEB March',        12400.00, 'cash',          'CEB-MAR-2026',  now() - interval '25 days'),
  ('ex100000-0000-0000-0000-000000000003', 'transport', 'Delivery van fuel — week 1',           8500.00, 'cash',          '',              now() - interval '18 days'),
  ('ex100000-0000-0000-0000-000000000004', 'salaries',  'Staff salaries — April',            125000.00, 'bank_transfer', 'SAL-APR-2026',  now() - interval '15 days'),
  ('ex100000-0000-0000-0000-000000000005', 'utilities', 'Internet & phone bill',               4200.00, 'cash',          'SLT-APR-2026',  now() - interval '10 days'),
  ('ex100000-0000-0000-0000-000000000006', 'transport', 'Delivery charges — Matara run',        6800.00, 'cash',          '',              now() - interval '5 days'),
  ('ex100000-0000-0000-0000-000000000007', 'supplies',  'Packaging material & stationery',     3500.00, 'cash',          '',              now() - interval '3 days'),
  ('ex100000-0000-0000-0000-000000000008', 'rent',      'Warehouse monthly rent — May',        85000.00, 'bank_transfer', 'RENT-MAY-2026', now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- SUPPLIER PAYMENTS  (2 rows)
-- ────────────────────────────────────────────────────────────────
INSERT INTO supplier_payments (id, supplier_id, purchase_id, amount, method, notes, paid_at)
VALUES
  ('sp100000-0000-0000-0000-000000000001',
   'a1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001',
   500000.00, 'bank_transfer', 'Advance payment for PO0001', now() - interval '25 days'),
  ('sp100000-0000-0000-0000-000000000002',
   'a1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001',
   540250.00, 'bank_transfer', 'Final settlement PO0001',   now() - interval '18 days')
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- DONE — sandbox baseline:
--   3 suppliers, 2 locations, 12 products, 7 customers (incl. Walk-in),
--   2 purchases, 12 stock batches, 3 invoices, 8 expenses,
--   2 supplier payments
-- ================================================================
