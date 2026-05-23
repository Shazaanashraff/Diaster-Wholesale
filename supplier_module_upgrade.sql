-- ================================================================
-- Diastar ERP — Supplier Module Upgrade Migration
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Safe to run multiple times (uses IF NOT EXISTS / DO $$ patterns)
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. Suppliers — add missing columns
-- ────────────────────────────────────────────────────────────────
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_active      BOOLEAN DEFAULT true;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS credit_limit   NUMERIC(16,2) DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS credit_days    INTEGER DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS current_payable NUMERIC(16,2) DEFAULT 0;

-- ────────────────────────────────────────────────────────────────
-- 2. Purchases — add missing columns
-- ────────────────────────────────────────────────────────────────
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS location_id    UUID REFERENCES locations(id);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS rep_name       TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(16,2) DEFAULT 0;

-- Fix status CHECK constraint to use correct ERP values
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_status_check;
ALTER TABLE purchases ADD CONSTRAINT purchases_status_check
  CHECK (status IN ('draft','ordered','received','completed','cancelled'));

-- ────────────────────────────────────────────────────────────────
-- 3. Locations (required by purchases)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'warehouse' CHECK (type IN ('warehouse','shop')),
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access locations" ON locations;
CREATE POLICY "All access locations" ON locations FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 4. Supplier Payments — expand method constraint & add cheque fields
-- ────────────────────────────────────────────────────────────────
ALTER TABLE supplier_payments DROP CONSTRAINT IF EXISTS supplier_payments_method_check;
ALTER TABLE supplier_payments ADD CONSTRAINT supplier_payments_method_check
  CHECK (method IN ('cash','card','cheque','credit','online','bank_transfer','mixed'));

ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS cheque_number TEXT;
ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS bank_name     TEXT;
ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS due_date      TIMESTAMPTZ;

-- ────────────────────────────────────────────────────────────────
-- 5. Supplier Payment Lines (for mixed/partial payments)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_payment_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id      UUID NOT NULL REFERENCES supplier_payments(id) ON DELETE CASCADE,
  amount          NUMERIC(16,2) NOT NULL DEFAULT 0,
  method          TEXT NOT NULL CHECK (method IN ('cash','card','cheque','credit','online','bank_transfer')),
  cheque_number   TEXT,
  bank_name       TEXT,
  due_date        TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE supplier_payment_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access supplier_payment_lines" ON supplier_payment_lines;
CREATE POLICY "All access supplier_payment_lines" ON supplier_payment_lines FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 6. Supplier Returns
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_returns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference        TEXT UNIQUE NOT NULL,
  supplier_id      UUID NOT NULL REFERENCES suppliers(id),
  purchase_id      UUID REFERENCES purchases(id),
  return_type      TEXT NOT NULL DEFAULT 'return' CHECK (return_type IN ('return','exchange')),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','cancelled')),
  return_value_lkr NUMERIC(16,2) NOT NULL DEFAULT 0,
  replacement_value_lkr NUMERIC(16,2) DEFAULT 0,
  difference_lkr   NUMERIC(16,2) DEFAULT 0,  -- positive = owe supplier, negative = supplier owes us
  settlement_type  TEXT CHECK (settlement_type IN ('payable','refund','credit_note','even')),
  settlement_notes TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  completed_at     TIMESTAMPTZ
);

-- If table already existed from an older migration, add missing columns:
ALTER TABLE supplier_returns ADD COLUMN IF NOT EXISTS return_type TEXT NOT NULL DEFAULT 'return' CHECK (return_type IN ('return','exchange'));
ALTER TABLE supplier_returns ADD COLUMN IF NOT EXISTS return_value_lkr NUMERIC(16,2) NOT NULL DEFAULT 0;
ALTER TABLE supplier_returns ADD COLUMN IF NOT EXISTS replacement_value_lkr NUMERIC(16,2) DEFAULT 0;
ALTER TABLE supplier_returns ADD COLUMN IF NOT EXISTS difference_lkr NUMERIC(16,2) DEFAULT 0;
ALTER TABLE supplier_returns ADD COLUMN IF NOT EXISTS settlement_type TEXT CHECK (settlement_type IN ('payable','refund','credit_note','even'));
ALTER TABLE supplier_returns ADD COLUMN IF NOT EXISTS settlement_notes TEXT;
ALTER TABLE supplier_returns ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE supplier_returns ALTER COLUMN purchase_id DROP NOT NULL;

ALTER TABLE supplier_returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access supplier_returns" ON supplier_returns;
CREATE POLICY "All access supplier_returns" ON supplier_returns FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 7. Supplier Return Items
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_return_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id       UUID NOT NULL REFERENCES supplier_returns(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  item_type       TEXT NOT NULL DEFAULT 'return' CHECK (item_type IN ('return','replacement')),
  quantity        INTEGER NOT NULL DEFAULT 0,
  unit_value_lkr  NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- If table already existed from an older migration, add missing columns:
ALTER TABLE supplier_return_items ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'return' CHECK (item_type IN ('return','replacement'));
ALTER TABLE supplier_return_items ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE supplier_return_items ADD COLUMN IF NOT EXISTS unit_value_lkr NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE supplier_return_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access supplier_return_items" ON supplier_return_items;
CREATE POLICY "All access supplier_return_items" ON supplier_return_items FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 8. Purchase Discount Approvals
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_discount_approvals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id      UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  discount_type    TEXT NOT NULL CHECK (discount_type IN ('item','bill')),
  discount_percent NUMERIC(5,2),
  discount_amount  NUMERIC(16,2),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_by     TEXT NOT NULL DEFAULT 'System',
  approved_by      TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  resolved_at      TIMESTAMPTZ
);

ALTER TABLE purchase_discount_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access purchase_discount_approvals" ON purchase_discount_approvals;
CREATE POLICY "All access purchase_discount_approvals" ON purchase_discount_approvals FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 9. Expenses — upgrade existing table
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category      TEXT NOT NULL DEFAULT 'general',
  description   TEXT NOT NULL DEFAULT '',
  amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  reference     TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add missing columns to existing expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS method       TEXT NOT NULL DEFAULT 'cash';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS location_id  UUID REFERENCES locations(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS notes        TEXT NOT NULL DEFAULT '';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_by   TEXT DEFAULT 'System';

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access expenses" ON expenses;
CREATE POLICY "All access expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 10. Other Income
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS other_income (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL DEFAULT 'other'
              CHECK (source_type IN ('supplier_refund','credit_note','discount_received','other')),
  amount      NUMERIC(16,2) NOT NULL DEFAULT 0,
  method      TEXT NOT NULL DEFAULT 'cash',
  supplier_id UUID REFERENCES suppliers(id),
  notes       TEXT NOT NULL DEFAULT '',
  created_by  TEXT DEFAULT 'System',
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE other_income ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access other_income" ON other_income;
CREATE POLICY "All access other_income" ON other_income FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 11. Purchase Items — add discount_percent column
-- ────────────────────────────────────────────────────────────────
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT 0;

-- ────────────────────────────────────────────────────────────────
-- 12. Supplier Return reference generator
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_return_reference()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  next_num := (
    SELECT COALESCE(MAX(CAST(SUBSTRING(reference FROM 3) AS INTEGER)), 0) + 1
    FROM supplier_returns
    WHERE reference ~ '^SR[0-9]+$'
  );
  RETURN 'SR' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────────
-- 13. Stock trigger for supplier return completion
--     When return status becomes 'completed':
--       - Return items (item_type='return'): decrease stock (stock_adjustments negative)
--       - Replacement items (item_type='replacement'): increase stock (stock_batches positive)
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_supplier_return_complete()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when status changes TO 'completed'
  IF OLD.status <> 'completed' AND NEW.status = 'completed' THEN
    -- Deduct returned items from stock (negative adjustment)
    INSERT INTO stock_adjustments (product_id, adjustment_pieces, reason, adjusted_by)
    SELECT
      sri.product_id,
      -(sri.quantity),
      'Supplier Return: ' || NEW.reference,
      'System'
    FROM supplier_return_items sri
    WHERE sri.return_id = NEW.id AND sri.item_type = 'return';

    -- Add replacement items to stock (stock batch)
    INSERT INTO stock_batches (product_id, cartons, loose_pieces, cost_per_piece, notes)
    SELECT
      sri.product_id,
      0,
      sri.quantity,
      sri.unit_value_lkr,
      'Supplier Exchange Replacement: ' || NEW.reference
    FROM supplier_return_items sri
    WHERE sri.return_id = NEW.id AND sri.item_type = 'replacement';

    -- Set completed_at timestamp
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop legacy triggers/functions from old migrations to prevent conflicts
DROP TRIGGER IF EXISTS trg_supplier_return_trigger ON supplier_returns;
DROP FUNCTION IF EXISTS trg_supplier_return_complete();

DROP TRIGGER IF EXISTS trg_supplier_return_complete ON supplier_returns;
CREATE TRIGGER trg_supplier_return_complete
  BEFORE UPDATE ON supplier_returns
  FOR EACH ROW EXECUTE FUNCTION handle_supplier_return_complete();

-- ────────────────────────────────────────────────────────────────
-- 14. Audit log RLS (ensure it exists)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access audit_log" ON audit_log;
CREATE POLICY "All access audit_log" ON audit_log FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 15. Seed: default locations if none exist
-- ────────────────────────────────────────────────────────────────
INSERT INTO locations (name, type) VALUES ('Main Warehouse', 'warehouse') ON CONFLICT DO NOTHING;
INSERT INTO locations (name, type) VALUES ('Main Shop', 'shop') ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- Done — run SELECT table_name FROM information_schema.tables
--        WHERE table_schema = 'public' ORDER BY table_name;
-- ────────────────────────────────────────────────────────────────
