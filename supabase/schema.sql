-- ============================================================
-- DIASTAR ERP — Full Database Schema
-- Run this in Supabase SQL Editor (one shot)
-- ============================================================

-- =========================
-- 1. PRODUCTS
-- =========================
CREATE TABLE IF NOT EXISTS products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code     TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  model         TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  category      TEXT NOT NULL DEFAULT 'general',
  wholesale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  retail_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  pieces_per_carton INT NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE products DISABLE ROW LEVEL SECURITY;

-- =========================
-- 2. CUSTOMERS
-- =========================
CREATE TABLE IF NOT EXISTS customers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL DEFAULT '',
  address       TEXT NOT NULL DEFAULT '',
  type          TEXT NOT NULL DEFAULT 'retail' CHECK (type IN ('wholesale', 'retail')),
  credit_limit  NUMERIC(12,2) NOT NULL DEFAULT 0,
  outstanding_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  credit_balance NUMERIC(12,2) NOT NULL DEFAULT 0, -- legacy compatibility
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE customers DISABLE ROW LEVEL SECURITY;

-- =========================
-- 3. SHIPMENTS
-- =========================
CREATE TABLE IF NOT EXISTS shipments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference     TEXT NOT NULL DEFAULT '',
  supplier      TEXT NOT NULL DEFAULT '',
  notes         TEXT NOT NULL DEFAULT '',
  arrived_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE shipments DISABLE ROW LEVEL SECURITY;

-- =========================
-- 4. STOCK BATCHES
-- (Each row = a batch of product received in a shipment)
-- =========================
CREATE TABLE IF NOT EXISTS stock_batches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  shipment_id   UUID REFERENCES shipments(id) ON DELETE SET NULL,
  cartons       INT NOT NULL DEFAULT 0,
  loose_pieces  INT NOT NULL DEFAULT 0,
  cost_per_piece NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes         TEXT NOT NULL DEFAULT '',
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE stock_batches DISABLE ROW LEVEL SECURITY;

-- =========================
-- 5. INVOICES
-- =========================
CREATE TABLE IF NOT EXISTS invoices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no    TEXT NOT NULL UNIQUE,
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  mode          TEXT NOT NULL DEFAULT 'retail' CHECK (mode IN ('wholesale','retail')),
  subtotal      NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
                  CHECK (payment_status IN ('unpaid','partial','paid')),
  notes         TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;

-- =========================
-- 6. INVOICE ITEMS
-- =========================
CREATE TABLE IF NOT EXISTS invoice_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  cartons       INT NOT NULL DEFAULT 0,
  pieces        INT NOT NULL DEFAULT 0,
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invoice_items DISABLE ROW LEVEL SECURITY;

-- =========================
-- 7. PAYMENTS
-- =========================
CREATE TABLE IF NOT EXISTS payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  method        TEXT NOT NULL DEFAULT 'cash'
                  CHECK (method IN ('cash','bank_transfer','cheque','credit')),
  reference     TEXT NOT NULL DEFAULT '',
  paid_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payments DISABLE ROW LEVEL SECURITY;

-- =========================
-- 8. STOCK ADJUSTMENTS
-- (Manual corrections: damage, returns, miscounts)
-- =========================
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  adjustment_pieces INT NOT NULL DEFAULT 0,  -- positive = add, negative = remove
  reason        TEXT NOT NULL DEFAULT '',
  adjusted_by   TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE stock_adjustments DISABLE ROW LEVEL SECURITY;

-- =========================
-- 9. VIEW: product_stock
-- Calculates available stock per product
-- =========================
CREATE OR REPLACE VIEW product_stock AS
SELECT
  p.id               AS product_id,
  p.item_code,
  p.name,
  p.model,
  p.category,
  p.wholesale_price,
  p.retail_price,
  p.pieces_per_carton,
  COALESCE(batch_totals.cartons_in, 0)     AS cartons_in,
  COALESCE(batch_totals.pieces_in, 0)      AS pieces_in,
  COALESCE(sold_totals.cartons_sold, 0)    AS cartons_sold,
  COALESCE(sold_totals.pieces_sold, 0)     AS pieces_sold,
  COALESCE(adj_totals.carton_adj, 0::bigint) AS carton_adj,
  COALESCE(adj_totals.piece_adj, 0)        AS piece_adj
FROM products p
LEFT JOIN (
  SELECT
    product_id,
    SUM(cartons) AS cartons_in,
    SUM(loose_pieces) AS pieces_in
  FROM stock_batches
  GROUP BY product_id
) batch_totals ON batch_totals.product_id = p.id
LEFT JOIN (
  SELECT
    ii.product_id,
    SUM(ii.cartons) AS cartons_sold,
    SUM(ii.pieces) AS pieces_sold
  FROM invoice_items ii
  JOIN invoices inv ON inv.id = ii.invoice_id
  WHERE inv.payment_status IN ('partial', 'paid')
  GROUP BY ii.product_id
) sold_totals ON sold_totals.product_id = p.id
LEFT JOIN (
  SELECT
    product_id,
    0::bigint AS carton_adj,
    SUM(adjustment_pieces) AS piece_adj
  FROM stock_adjustments
  GROUP BY product_id
) adj_totals ON adj_totals.product_id = p.id;

-- =========================
-- 10. EXPENSES
-- =========================
CREATE TABLE IF NOT EXISTS expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category      TEXT NOT NULL DEFAULT 'general',
  description   TEXT NOT NULL DEFAULT '',
  amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  reference     TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;

-- =========================
-- 11. RETURNS
-- =========================
CREATE TABLE IF NOT EXISTS returns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID REFERENCES invoices(id) ON DELETE SET NULL,
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  cartons       INT NOT NULL DEFAULT 0,
  pieces        INT NOT NULL DEFAULT 0,
  reason        TEXT NOT NULL DEFAULT '',
  refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE returns DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- SEED: Insert a default walk-in customer
-- ============================================================
INSERT INTO customers (name, phone) VALUES ('Walk-in Customer', '-')
ON CONFLICT DO NOTHING;

-- ============================================================
-- DONE! All tables created, RLS disabled, view ready.
-- ============================================================
