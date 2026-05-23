-- ================================================================
-- Diastar ERP — Procurement & Supplier Module Migration
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. Suppliers
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  contact_person TEXT,
  phone         TEXT,
  email         TEXT,
  country       TEXT DEFAULT 'China',
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access suppliers" ON suppliers;
CREATE POLICY "All access suppliers" ON suppliers FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 2. Purchases (procurement orders)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       TEXT UNIQUE NOT NULL,
  supplier_id     UUID REFERENCES suppliers(id),
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','confirmed','in_transit','received','closed')),
  exchange_rate   NUMERIC(10,4) NOT NULL DEFAULT 0,
  total_rmb       NUMERIC(16,2) DEFAULT 0,
  total_lkr       NUMERIC(16,2) DEFAULT 0,
  cost_finalized  BOOLEAN DEFAULT false,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access purchases" ON purchases;
CREATE POLICY "All access purchases" ON purchases FOR ALL USING (true) WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS purchases_updated_at ON purchases;
CREATE TRIGGER purchases_updated_at
  BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ────────────────────────────────────────────────────────────────
-- 3. Purchase Items
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id      UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES products(id),
  quantity_units   INTEGER NOT NULL DEFAULT 0,
  quantity_cartons INTEGER DEFAULT 0,
  unit_price_rmb   NUMERIC(12,4) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access purchase_items" ON purchase_items;
CREATE POLICY "All access purchase_items" ON purchase_items FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 4. Purchase Costs (shipping, clearing, tax, other)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_costs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id  UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  cost_type    TEXT NOT NULL DEFAULT 'other'
               CHECK (cost_type IN ('shipping','clearing','tax','other')),
  amount_lkr   NUMERIC(16,2) NOT NULL DEFAULT 0,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE purchase_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access purchase_costs" ON purchase_costs;
CREATE POLICY "All access purchase_costs" ON purchase_costs FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 5. Purchase Receive (actual received/damaged per item)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_receive (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id    UUID NOT NULL REFERENCES purchases(id),
  product_id     UUID NOT NULL REFERENCES products(id),
  ordered_units  INTEGER NOT NULL DEFAULT 0,
  received_units INTEGER NOT NULL DEFAULT 0,
  damaged_units  INTEGER NOT NULL DEFAULT 0,
  notes          TEXT,
  received_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE purchase_receive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access purchase_receive" ON purchase_receive;
CREATE POLICY "All access purchase_receive" ON purchase_receive FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 6. Supplier Payments
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id  UUID NOT NULL REFERENCES suppliers(id),
  purchase_id  UUID REFERENCES purchases(id),
  amount       NUMERIC(16,2) NOT NULL DEFAULT 0,
  method       TEXT NOT NULL DEFAULT 'cash'
               CHECK (method IN ('cash','bank_transfer','credit')),
  notes        TEXT,
  paid_at      TIMESTAMPTZ DEFAULT now(),
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access supplier_payments" ON supplier_payments;
CREATE POLICY "All access supplier_payments" ON supplier_payments FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 7. Audit Log
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  TEXT NOT NULL,
  record_id   TEXT,
  action      TEXT NOT NULL,
  old_values  JSONB,
  new_values  JSONB,
  user_label  TEXT DEFAULT 'System',
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access audit_log" ON audit_log;
CREATE POLICY "All access audit_log" ON audit_log FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 8. Products — add costing & SKU columns
-- ────────────────────────────────────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku        TEXT UNIQUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS margin_pct NUMERIC(5,2) DEFAULT 20;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS msp        NUMERIC(12,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_level INT DEFAULT 0;

-- Backfill item_code as sku for existing products (use item_code if present)
UPDATE products SET sku = item_code WHERE sku IS NULL AND item_code IS NOT NULL AND item_code <> '';

-- ────────────────────────────────────────────────────────────────
-- 9. Purchase reference generator function
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_purchase_reference()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(reference FROM 3) AS INTEGER)), 0
  ) + 1
  INTO next_num
  FROM purchases
  WHERE reference ~ '^PO[0-9]+$';
  RETURN 'PO' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────────
-- Done — verify by running:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
-- ────────────────────────────────────────────────────────────────
