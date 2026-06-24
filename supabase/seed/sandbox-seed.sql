-- Sandbox baseline seed data
-- Runs with search_path = sandbox (set by sandbox-reset.mjs).
-- All inserts use ON CONFLICT (id) DO NOTHING so the file is idempotent.
-- UUIDs are fixed so E2E tests can reference them by ID.

-- ── Locations ───────────────────────────────────────────────────────────────
INSERT INTO locations (id, name, type) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Main Warehouse', 'warehouse'),
  ('10000000-0000-0000-0000-000000000002', 'Main Shop',      'shop')
ON CONFLICT (id) DO NOTHING;

-- ── Customers ───────────────────────────────────────────────────────────────
INSERT INTO customers (id, name, phone, type, credit_limit, outstanding_balance) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Walk-in Customer',       '-',           'retail',    0.00,      0.00),
  ('20000000-0000-0000-0000-000000000002', 'Nimal Electronics Store','0771234567',  'wholesale', 500000.00, 0.00),
  ('20000000-0000-0000-0000-000000000003', 'Perera Mobile World',    '0779876543',  'wholesale', 300000.00, 0.00)
ON CONFLICT (id) DO NOTHING;

-- ── Suppliers ───────────────────────────────────────────────────────────────
INSERT INTO suppliers (id, name, contact_person, phone, country, is_active, credit_limit, credit_days) VALUES
  ('30000000-0000-0000-0000-000000000001', 'Guangzhou Electronics Ltd', 'Mr. Chen Wei', '+86-20-8800-1234', 'China', true, 5000000.00, 30)
ON CONFLICT (id) DO NOTHING;

-- ── Products ─────────────────────────────────────────────────────────────────
INSERT INTO products (id, item_code, name, model, category, wholesale_price, retail_price, cost_price, pieces_per_carton, reorder_level, is_active) VALUES
  ('40000000-0000-0000-0000-000000000001', '100001', 'Bluetooth Headphones',  'BH-X200',   'electronics', 3200.00, 4500.00, 2800.00, 12, 20, true),
  ('40000000-0000-0000-0000-000000000002', '100002', 'USB-C Cable 1m',        'UC-1M-PRO', 'accessories',  280.00,  450.00,  220.00, 50, 50, true),
  ('40000000-0000-0000-0000-000000000003', '100003', 'Power Bank 10000mAh',   'PB-10K',    'electronics', 2800.00, 4200.00, 2400.00, 10, 15, true)
ON CONFLICT (id) DO NOTHING;

-- ── Stock Batches (triggers set original_units automatically) ────────────────
INSERT INTO stock_batches (id, product_id, cartons, loose_pieces, cost_per_piece, notes) VALUES
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 5, 0,  2800.00, 'Seed stock'),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 4, 20,  220.00, 'Seed stock'),
  ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', 3, 5,  2400.00, 'Seed stock')
ON CONFLICT (id) DO NOTHING;

-- ── Purchase (1 completed PO) ────────────────────────────────────────────────
INSERT INTO purchases (id, reference, supplier_id, location_id, status, exchange_rate, total_rmb, total_lkr, cost_finalized) VALUES
  ('60000000-0000-0000-0000-000000000001', 'PO-SEED-001',
   '30000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   'completed', 36.50, 10000.00, 365000.00, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO purchase_items (purchase_id, product_id, quantity_cartons, quantity_units, unit_price_rmb) VALUES
  ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 5, 60,  88.00),
  ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 4, 220,  7.50),
  ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 3, 35,  78.00)
ON CONFLICT DO NOTHING;

-- ── Invoice (1 confirmed/paid invoice) ──────────────────────────────────────
INSERT INTO invoices (id, invoice_no, customer_id, mode, subtotal, discount, total, payment_status) VALUES
  ('70000000-0000-0000-0000-000000000001', 'INV-SEED-001',
   '20000000-0000-0000-0000-000000000002',
   'wholesale', 108800.00, 5000.00, 103800.00, 'paid')
ON CONFLICT (id) DO NOTHING;

INSERT INTO invoice_items (invoice_id, product_id, cartons, pieces, unit_price, total) VALUES
  ('70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 2, 0, 3200.00, 76800.00),
  ('70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 0, 50, 280.00, 14000.00),
  ('70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 0, 6, 2800.00, 16800.00)
ON CONFLICT DO NOTHING;

INSERT INTO payments (invoice_id, customer_id, amount, method, reference) VALUES
  ('70000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000002',
   103800.00, 'bank_transfer', 'SEED-TXN-001')
ON CONFLICT DO NOTHING;
