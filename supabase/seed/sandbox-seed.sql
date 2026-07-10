-- ================================================================
-- DIASTER ERP — Sandbox reset seed data
-- ================================================================
-- Curated from root `sandbox-seed.sql` for `npm run sandbox:reset`.
-- Every insert is idempotent (ON CONFLICT DO NOTHING) and uses fixed
-- UUIDs so E2E dropdowns stay deterministic across resets.
--
-- Table names are UNqualified on purpose: `sandbox-reset.mjs` runs
-- `set search_path = sandbox` before executing this file, so an
-- unqualified `INSERT INTO products` can only ever resolve inside the
-- `sandbox` schema (never `public`) or fail loudly if it doesn't exist.
-- The same guarantee holds if this file is applied standalone, since
-- the SET below pins the search path regardless of caller.
SET search_path = sandbox;

-- ────────────────────────────────────────────────────────────────
-- LOCATIONS
-- ────────────────────────────────────────────────────────────────
INSERT INTO locations (id, name, type) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Main Warehouse', 'warehouse'),
  ('10000000-0000-0000-0000-000000000002', 'Main Shop',      'shop')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- SUPPLIERS
-- ────────────────────────────────────────────────────────────────
INSERT INTO suppliers (id, name, contact_person, phone, email, country, is_active, credit_limit, credit_days) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Guangzhou Electronics Ltd', 'Mr. Chen Wei', '+86-20-8800-1234', 'chen@gzelectronics.cn', 'China', true, 5000000, 30)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- CUSTOMERS (incl. the default Walk-in customer)
-- ────────────────────────────────────────────────────────────────
INSERT INTO customers (id, name, phone, email, address, type, credit_limit, outstanding_balance, is_active) VALUES
  ('30000000-0000-0000-0000-000000000001', 'Walk-in Customer',        '-',           '',                          '',                        'retail',    0,       0,      true),
  ('30000000-0000-0000-0000-000000000002', 'Nimal Electronics Store', '0771234567', 'nimal@nimelectronics.lk', '45 Main St, Colombo 03', 'wholesale', 500000,  125000, true)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- PRODUCTS
-- ────────────────────────────────────────────────────────────────
INSERT INTO products (id, item_code, name, model, category, wholesale_price, retail_price, pieces_per_carton, reorder_level, is_active) VALUES
  ('40000000-0000-0000-0000-000000000001', 'SBX-100001', 'Bluetooth Headphones', 'BH-X200', 'electronics', 3200.00, 4500.00, 12, 20, true),
  ('40000000-0000-0000-0000-000000000002', 'SBX-100002', 'USB-C Cable 1m',       'UC-1M-PRO', 'accessories', 280.00, 450.00, 50, 50, true),
  ('40000000-0000-0000-0000-000000000003', 'SBX-100003', 'Power Bank 10000mAh',  'PB-10K',  'electronics', 2800.00, 4200.00, 10, 15, true)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- STOCK BATCHES (current inventory — every product above has stock)
-- ────────────────────────────────────────────────────────────────
INSERT INTO stock_batches (id, product_id, location_id, cartons, loose_pieces, cost_per_piece, notes, received_at) VALUES
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 2, 4,  3200.00, 'Initial sandbox stock', now() - interval '20 days'),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 3, 20, 280.00,  'Initial sandbox stock', now() - interval '20 days'),
  ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 1, 5,  2800.00, 'Initial sandbox stock', now() - interval '20 days')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- PURCHASE (completed — the stock batches above came from this PO)
-- ────────────────────────────────────────────────────────────────
INSERT INTO purchases (id, reference, supplier_id, location_id, status, exchange_rate, total_rmb, total_lkr, cost_finalized, notes) VALUES
  ('60000000-0000-0000-0000-000000000001', 'SBX-PO0001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'completed', 36.50, 15680.00, 572320.00, true, 'Sandbox baseline stock')
ON CONFLICT DO NOTHING;

INSERT INTO purchase_items (purchase_id, product_id, quantity_cartons, quantity_units, unit_price_rmb) VALUES
  ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 2, 28, 88.00),
  ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 3, 170, 7.50),
  ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 1, 15, 78.00)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- INVOICE (confirmed / paid) + items + payment
-- ────────────────────────────────────────────────────────────────
INSERT INTO invoices (id, invoice_no, customer_id, mode, subtotal, discount, total, payment_status, created_at) VALUES
  ('70000000-0000-0000-0000-000000000001', 'SBX-INV0001', '30000000-0000-0000-0000-000000000002', 'wholesale', 90800.00, 800.00, 90000.00, 'paid', now() - interval '5 days')
ON CONFLICT DO NOTHING;

INSERT INTO invoice_items (invoice_id, product_id, batch_id, cartons, pieces, unit_price, total) VALUES
  ('70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 2, 0, 3200.00, 76800.00),
  ('70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 0, 50, 280.00, 14000.00)
ON CONFLICT DO NOTHING;

INSERT INTO payments (invoice_id, customer_id, amount, method, reference, paid_at) VALUES
  ('70000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 90000.00, 'bank_transfer', 'SBX-TXN-0001', now() - interval '4 days')
ON CONFLICT DO NOTHING;

-- ================================================================
-- DONE — sandbox now has:
--   2 locations, 1 supplier, 2 customers (incl. Walk-in), 3 products
--   w/ stock, 1 completed purchase, 1 confirmed (paid) invoice
-- ================================================================
