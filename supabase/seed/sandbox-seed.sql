-- ================================================================
-- DIASTAR ERP — Sandbox Seed Data
--
-- Curated from the root `sandbox-seed.sql` for use by
-- `scripts/sandbox-reset.mjs` (npm run sandbox:reset). Every insert is
-- `ON CONFLICT ... DO NOTHING` and every parent-level entity (suppliers,
-- products, customers, purchases, invoices, stock batches) uses a fixed
-- UUID so E2E dropdowns are deterministic across resets.
--
-- Runs with `search_path = sandbox` (set by sandbox-reset.mjs) against an
-- already-truncated `sandbox` schema (via sandbox.reset_all()), so plain
-- unqualified table names below resolve to `sandbox.*`.
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- LOCATIONS
-- ────────────────────────────────────────────────────────────────
INSERT INTO locations (id, name, type) VALUES
  ('9a000000-0000-0000-0000-000000000001', 'Main Warehouse', 'warehouse')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- SUPPLIERS
-- ────────────────────────────────────────────────────────────────
INSERT INTO suppliers (id, name, contact_person, phone, email, country, is_active, credit_limit, credit_days) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Guangzhou Electronics Ltd',  'Mr. Chen Wei',    '+86-20-8800-1234', 'chen@gzelectronics.cn',    'China', true, 5000000, 30),
  ('a1000000-0000-0000-0000-000000000002', 'Shanghai Tech Wholesale',    'Ms. Li Fang',     '+86-21-6600-5678', 'li.fang@shanghaitech.cn',  'China', true, 3000000, 45)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- PRODUCTS
-- ────────────────────────────────────────────────────────────────
INSERT INTO products (id, item_code, name, model, category, wholesale_price, retail_price, pieces_per_carton, reorder_level, is_active) VALUES
  ('b1000000-0000-0000-0000-000000000001', '100001', 'Bluetooth Headphones',     'BH-X200',    'electronics',  3200.00,  4500.00, 12,  20, true),
  ('b1000000-0000-0000-0000-000000000002', '100002', 'USB-C Cable 1m',           'UC-1M-PRO',  'accessories',   280.00,   450.00, 50,  50, true),
  ('b1000000-0000-0000-0000-000000000003', '100003', 'Power Bank 10000mAh',      'PB-10K',     'electronics',  2800.00,  4200.00, 10,  15, true),
  ('b1000000-0000-0000-0000-000000000004', '100004', 'Wireless Earbuds',         'WE-PRO3',    'electronics',  4500.00,  6800.00,  6,  10, true)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- CUSTOMERS (incl. Walk-in — same fixed id the app's POS screen
-- hardcodes as WALK_IN_CUSTOMER_ID / falls back to when unset)
-- ────────────────────────────────────────────────────────────────
INSERT INTO customers (id, name, phone, email, address, type, credit_limit, outstanding_balance, is_active) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Walk-in Customer',        '-',            '',                          'Default Store Location',  'retail',      0.00,      0.00, true),
  ('c1000000-0000-0000-0000-000000000002', 'Nimal Electronics Store', '0771234567',   'nimal@nimelectronics.lk',   '45 Main St, Colombo 03',  'wholesale', 500000.00, 125000.00, true),
  ('c1000000-0000-0000-0000-000000000003', 'Perera Mobile World',     '0779876543',   'perera@mobileworldlk.com', '12 Galle Rd, Colombo 06',  'wholesale', 300000.00,  80000.00, true),
  ('c1000000-0000-0000-0000-000000000004', 'Kamani Silva',            '0754321987',   'kamani.silva@gmail.com',   '23 Temple Rd, Nugegoda',   'retail',      5000.00,      0.00, true)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- PURCHASES (1 completed) + ITEMS
-- ────────────────────────────────────────────────────────────────
INSERT INTO purchases (id, reference, supplier_id, location_id, status, exchange_rate, total_rmb, total_lkr, cost_finalized, notes) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'PO0001',
    'a1000000-0000-0000-0000-000000000001',
    '9a000000-0000-0000-0000-000000000001',
    'completed', 36.50, 28500.00, 1040250.00, true,
    'First shipment — Q1 stock')
ON CONFLICT DO NOTHING;

INSERT INTO purchase_items (purchase_id, product_id, quantity_cartons, quantity_units, unit_price_rmb) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 3, 36,  88.00),
  ('d1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 4, 200,  7.50)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- STOCK BATCHES (current inventory — gives every seeded product stock)
-- ────────────────────────────────────────────────────────────────
INSERT INTO stock_batches (id, product_id, location_id, cartons, loose_pieces, cost_per_piece, notes, received_at) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', '9a000000-0000-0000-0000-000000000001', 2, 4,  3200.00, 'Received from PO0001', now() - interval '20 days'),
  ('e1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', '9a000000-0000-0000-0000-000000000001', 3, 20,  280.00, 'Received from PO0001', now() - interval '20 days'),
  ('e1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000003', '9a000000-0000-0000-0000-000000000001', 1, 5,  2800.00, 'Initial stock',        now() - interval '35 days'),
  ('e1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000004', '9a000000-0000-0000-0000-000000000001', 1, 2,  4500.00, 'Initial stock',        now() - interval '35 days')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- INVOICES + ITEMS + PAYMENTS
-- ────────────────────────────────────────────────────────────────

-- Invoice 1: Nimal Electronics — wholesale, paid (confirmed)
INSERT INTO invoices (id, invoice_no, customer_id, mode, subtotal, discount, total, payment_status, created_at) VALUES
  ('f1000000-0000-0000-0000-000000000001', 'INV-0001',
   'c1000000-0000-0000-0000-000000000002',
   'wholesale', 90800.00, 5000.00, 85800.00, 'paid',
   now() - interval '15 days')
ON CONFLICT DO NOTHING;

INSERT INTO invoice_items (invoice_id, product_id, cartons, pieces, unit_price, total) VALUES
  ('f1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 2, 0, 3200.00, 76800.00),
  ('f1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 0, 50, 280.00, 14000.00)
ON CONFLICT DO NOTHING;

INSERT INTO payments (invoice_id, customer_id, amount, method, reference, paid_at) VALUES
  ('f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002',
   85800.00, 'bank_transfer', 'BOC-TXN-88421', now() - interval '14 days')
ON CONFLICT DO NOTHING;

-- Invoice 2: Kamani Silva — retail, paid (a Walk-in-style POS sale)
INSERT INTO invoices (id, invoice_no, customer_id, mode, subtotal, discount, total, payment_status, created_at) VALUES
  ('f1000000-0000-0000-0000-000000000002', 'INV-0002',
   'c1000000-0000-0000-0000-000000000004',
   'retail', 5400.00, 0.00, 5400.00, 'paid',
   now() - interval '5 days')
ON CONFLICT DO NOTHING;

INSERT INTO invoice_items (invoice_id, product_id, cartons, pieces, unit_price, total) VALUES
  ('f1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003', 0, 1, 4200.00, 4200.00),
  ('f1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 0, 4,  300.00, 1200.00)
ON CONFLICT DO NOTHING;

INSERT INTO payments (invoice_id, customer_id, amount, method, reference, paid_at) VALUES
  ('f1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000004',
   5400.00, 'cash', '', now() - interval '5 days')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- EXPENSES
-- ────────────────────────────────────────────────────────────────
INSERT INTO expenses (category, description, amount, method, reference, created_at) VALUES
  ('rent',      'Warehouse monthly rent — April', 85000.00, 'bank_transfer', 'RENT-APR-2026', now() - interval '30 days'),
  ('utilities', 'Electricity bill — CEB March',    12400.00, 'cash',          'CEB-MAR-2026',  now() - interval '25 days')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- SUPPLIER PAYMENTS
-- ────────────────────────────────────────────────────────────────
INSERT INTO supplier_payments (supplier_id, purchase_id, amount, method, notes, paid_at) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001',
   1040250.00, 'bank_transfer', 'Full settlement PO0001', now() - interval '18 days')
ON CONFLICT DO NOTHING;

-- ================================================================
-- DONE — sandbox now has: 1 location, 2 suppliers, 4 products (all with
-- stock), 4 customers (incl. Walk-in), 1 completed purchase, 2 invoices
-- (both paid/confirmed), 2 expenses, 1 supplier payment.
-- ================================================================
