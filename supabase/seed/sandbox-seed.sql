-- ================================================================
-- Sandbox Baseline Seed
-- Runs under search_path = sandbox (set by sandbox-reset.mjs).
-- reset_all() has already wiped sandbox tables (except app_meta).
-- Fixed UUIDs make E2E dropdowns and test assertions stable.
-- ON CONFLICT (id) DO NOTHING makes the seed safe to replay.
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- LOCATIONS (wiped by reset_all — must be re-seeded)
-- ────────────────────────────────────────────────────────────────
INSERT INTO locations (id, name, type) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Walk-in Customer', 'shop'),
  ('00000000-0000-0000-0000-000000000002', 'Main Warehouse',   'warehouse'),
  ('00000000-0000-0000-0000-000000000003', 'Main Shop',        'shop')
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- SUPPLIERS (≥1 required)
-- ────────────────────────────────────────────────────────────────
INSERT INTO suppliers (id, name, contact_person, phone, email, country, is_active, credit_limit, credit_days) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Guangzhou Electronics Ltd', 'Mr. Chen Wei', '+86-20-8800-1234', 'chen@gzelectronics.cn', 'China', true, 5000000.00, 30),
  ('a1000000-0000-0000-0000-000000000002', 'Shanghai Tech Wholesale',   'Ms. Li Fang',  '+86-21-6600-5678', 'li.fang@shanghaitech.cn', 'China', true, 3000000.00, 45)
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- PRODUCTS (≥2 with stock required)
-- ────────────────────────────────────────────────────────────────
INSERT INTO products (id, item_code, name, model, category, wholesale_price, retail_price, cost_price, pieces_per_carton, reorder_level, is_active) VALUES
  ('b1000000-0000-0000-0000-000000000001', '100001', 'Bluetooth Headphones', 'BH-X200',   'electronics', 3200.00, 4500.00, 2800.00, 12, 20, true),
  ('b1000000-0000-0000-0000-000000000002', '100002', 'USB-C Cable 1m',       'UC-1M-PRO', 'accessories',  280.00,  450.00,  200.00, 50, 50, true),
  ('b1000000-0000-0000-0000-000000000003', '100003', 'Power Bank 10000mAh',  'PB-10K',    'electronics', 2800.00, 4200.00, 2400.00, 10, 15, true),
  ('b1000000-0000-0000-0000-000000000004', '100004', 'Wireless Earbuds',     'WE-PRO3',   'electronics', 4500.00, 6800.00, 3800.00,  6, 10, true)
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- CUSTOMERS (includes Walk-in Customer for retail flow)
-- ────────────────────────────────────────────────────────────────
INSERT INTO customers (id, name, phone, email, address, type, credit_limit, outstanding_balance, is_active) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Walk-in Customer',        '0000000000', '', '', 'retail',    0.00,      0.00, true),
  ('c1000000-0000-0000-0000-000000000001', 'Nimal Electronics Store', '0771234567', 'nimal@nimelectronics.lk',   '45 Main St, Colombo 03', 'wholesale', 500000.00, 0.00, true),
  ('c1000000-0000-0000-0000-000000000002', 'Perera Mobile World',     '0779876543', 'perera@mobileworldlk.com', '12 Galle Rd, Colombo 06', 'wholesale', 300000.00, 0.00, true)
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- STOCK BATCHES (≥2 products with stock)
-- ────────────────────────────────────────────────────────────────
INSERT INTO stock_batches (id, product_id, location_id, cartons, loose_pieces, cost_per_piece, notes) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 5, 0,  2800.00, 'Seed stock'),
  ('e1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 3, 0,   200.00, 'Seed stock'),
  ('e1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 4, 0,  2400.00, 'Seed stock'),
  ('e1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 3, 0,  3800.00, 'Seed stock')
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- INVOICE (confirmed / paid — required by completion test)
-- ────────────────────────────────────────────────────────────────
INSERT INTO invoices (id, invoice_no, customer_id, mode, subtotal, discount, total, payment_status) VALUES
  ('f1000000-0000-0000-0000-000000000001', 'INV-S001',
   'c1000000-0000-0000-0000-000000000001',
   'wholesale', 128000.00, 0.00, 128000.00, 'paid')
ON CONFLICT (id) DO NOTHING;

INSERT INTO invoice_items (invoice_id, product_id, cartons, pieces, unit_price, total) VALUES
  ('f1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 2,  0, 3200.00,  76800.00),
  ('f1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000003', 1,  0, 2800.00,  28000.00),
  ('f1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 0, 82,  280.00,  22960.00)
ON CONFLICT DO NOTHING;

INSERT INTO payments (invoice_id, customer_id, amount, method, reference) VALUES
  ('f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   128000.00, 'bank_transfer', 'SEED-TXN-0001')
ON CONFLICT DO NOTHING;
