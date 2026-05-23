-- ================================================================
-- Diastar ERP — Supplier Module & Full Procurement Logic Migration
-- ================================================================

-- 1. Create Location Table
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('warehouse', 'shop')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed basic locations
INSERT INTO locations (name, type) VALUES 
('Main Warehouse', 'warehouse'), 
('Main Shop', 'shop') 
ON CONFLICT DO NOTHING;

-- Add location_id to purchases
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id);

-- Update Purchase Status Flow
-- First drop the old constraint so we can update existing statuses
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_status_check;

-- Update existing data to match new statuses BEFORE applying new constraint
UPDATE purchases SET status = 'ordered' WHERE status IN ('confirmed', 'in_transit');
UPDATE purchases SET status = 'completed' WHERE status = 'closed';

-- Add the new constraint
ALTER TABLE purchases ADD CONSTRAINT purchases_status_check
CHECK (status IN ('draft', 'ordered', 'received', 'completed', 'cancelled'));

-- 1.4 Stock Trigger Logic
-- Ordered → Received: Increase stock at destination
CREATE OR REPLACE FUNCTION trg_purchase_receive_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
BEGIN
  IF OLD.status != 'received' AND NEW.status = 'received' THEN
    -- Loop through all purchase_items for this purchase
    FOR v_item IN SELECT * FROM purchase_items WHERE purchase_id = NEW.id LOOP
      -- Insert into stock_batches
      INSERT INTO stock_batches (
        product_id,
        cartons,
        loose_pieces,
        cost_per_piece,
        notes,
        received_at
      ) VALUES (
        v_item.product_id,
        v_item.quantity_cartons,
        v_item.quantity_units,
        v_item.unit_price_rmb, 
        'Received from PO: ' || NEW.reference,
        now()
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_purchase_receive_trigger ON purchases;
CREATE TRIGGER trg_purchase_receive_trigger
  AFTER UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION trg_purchase_receive_stock();

-- 2. Supplier Return & Exchange
CREATE TABLE IF NOT EXISTS supplier_returns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id  UUID NOT NULL REFERENCES purchases(id),
  supplier_id  UUID NOT NULL REFERENCES suppliers(id),
  reference    TEXT UNIQUE NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  return_value NUMERIC(16,2) DEFAULT 0,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplier_return_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id        UUID NOT NULL REFERENCES supplier_returns(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES products(id),
  quantity_units   INTEGER NOT NULL DEFAULT 0,
  quantity_cartons INTEGER DEFAULT 0,
  unit_price       NUMERIC(12,4) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Trigger for stock deduction on Supplier Return 'completed'
CREATE OR REPLACE FUNCTION trg_supplier_return_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
  v_ppc INT;
BEGIN
  IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
    FOR v_item IN SELECT * FROM supplier_return_items WHERE return_id = NEW.id LOOP
      SELECT p.pieces_per_carton INTO v_ppc FROM products p WHERE p.id = v_item.product_id;
      
      -- Create a negative stock adjustment to reduce stock
      INSERT INTO stock_adjustments (
        product_id,
        adjustment_pieces,
        reason,
        notes
      ) VALUES (
        v_item.product_id,
        -(v_item.quantity_units + (v_item.quantity_cartons * COALESCE(v_ppc, 1))),
        'damage', 
        'Returned to supplier via: ' || NEW.reference
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_supplier_return_trigger ON supplier_returns;
CREATE TRIGGER trg_supplier_return_trigger
  AFTER UPDATE ON supplier_returns
  FOR EACH ROW EXECUTE FUNCTION trg_supplier_return_complete();


-- 3. Supplier Credit (Payables) Logic
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(16,2) DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS credit_days INTEGER DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS current_payable NUMERIC(16,2) DEFAULT 0;

-- 4. Purchase Representative
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS rep_name TEXT;

-- 6. Discount Logic
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(16,2) DEFAULT 0;
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT 0;

-- 8. Payment Types & Partial Payment Logic
ALTER TABLE supplier_payments DROP CONSTRAINT IF EXISTS supplier_payments_method_check;
ALTER TABLE supplier_payments ADD CONSTRAINT supplier_payments_method_check 
CHECK (method IN ('cash', 'card', 'cheque', 'credit', 'online', 'bank_transfer', 'mixed'));

ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS cheque_number TEXT;
ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS due_date DATE;

-- Trigger to update supplier current_payable if method is credit
CREATE OR REPLACE FUNCTION trg_supplier_payable_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.method = 'credit' THEN
    UPDATE suppliers 
    SET current_payable = current_payable + NEW.amount
    WHERE id = NEW.supplier_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_supplier_payments_credit ON supplier_payments;
CREATE TRIGGER trg_supplier_payments_credit
  AFTER INSERT ON supplier_payments
  FOR EACH ROW EXECUTE FUNCTION trg_supplier_payable_update();

-- Enable RLS & Add basic policies for new tables
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All access locations" ON locations FOR ALL USING (true);

ALTER TABLE supplier_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All access supplier_returns" ON supplier_returns FOR ALL USING (true);

ALTER TABLE supplier_return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All access supplier_return_items" ON supplier_return_items FOR ALL USING (true);
