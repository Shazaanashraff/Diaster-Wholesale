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
  credit_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
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
  pieces        INT NOT NULL DEFAULT 0,
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
  invoice_number TEXT NOT NULL UNIQUE,
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  subtotal      NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','confirmed','paid','cancelled')),
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
  quantity_cartons INT NOT NULL DEFAULT 0,
  quantity_pieces  INT NOT NULL DEFAULT 0,
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total    NUMERIC(12,2) NOT NULL DEFAULT 0,
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
--
-- Formula:
--   total_pieces_in  = SUM(batch.cartons * product.pieces_per_carton + batch.pieces)
--   total_pieces_out = SUM(inv_item.quantity_cartons * product.pieces_per_carton + inv_item.quantity_pieces)
--                      from confirmed/paid invoices only
--   adjustment_pieces = SUM(stock_adjustments.adjustment_pieces)
--   available_pieces  = total_pieces_in - total_pieces_out + adjustment_pieces
--   avail_cartons     = available_pieces / pieces_per_carton   (integer division)
--   avail_pieces      = available_pieces % pieces_per_carton   (remainder)
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

  -- Total pieces received from all batches
  COALESCE(batch_totals.total_pieces_in, 0)     AS total_pieces_in,

  -- Total pieces sold via confirmed/paid invoices
  COALESCE(sold_totals.total_pieces_out, 0)      AS total_pieces_out,

  -- Net manual adjustments
  COALESCE(adj_totals.total_adjustment, 0)        AS total_adjustment,

  -- Final available
  (
    COALESCE(batch_totals.total_pieces_in, 0)
    - COALESCE(sold_totals.total_pieces_out, 0)
    + COALESCE(adj_totals.total_adjustment, 0)
  ) AS available_pieces

FROM products p

-- Subquery: total pieces received per product
LEFT JOIN (
  SELECT
    sb.product_id,
    SUM(sb.cartons * p2.pieces_per_carton + sb.pieces) AS total_pieces_in
  FROM stock_batches sb
  JOIN products p2 ON p2.id = sb.product_id
  GROUP BY sb.product_id
) batch_totals ON batch_totals.product_id = p.id

-- Subquery: total pieces sold per product (only confirmed/paid invoices)
LEFT JOIN (
  SELECT
    ii.product_id,
    SUM(ii.quantity_cartons * p3.pieces_per_carton + ii.quantity_pieces) AS total_pieces_out
  FROM invoice_items ii
  JOIN products p3 ON p3.id = ii.product_id
  JOIN invoices inv ON inv.id = ii.invoice_id
  WHERE inv.status IN ('confirmed', 'paid')
  GROUP BY ii.product_id
) sold_totals ON sold_totals.product_id = p.id

-- Subquery: net stock adjustments per product
LEFT JOIN (
  SELECT
    sa.product_id,
    SUM(sa.adjustment_pieces) AS total_adjustment
  FROM stock_adjustments sa
  GROUP BY sa.product_id
) adj_totals ON adj_totals.product_id = p.id;

-- ============================================================
-- SEED: Insert a default walk-in customer
-- ============================================================
INSERT INTO customers (name, phone) VALUES ('Walk-in Customer', '-')
ON CONFLICT DO NOTHING;

-- ============================================================
-- DONE! All tables created, RLS disabled, view ready.
-- ============================================================
