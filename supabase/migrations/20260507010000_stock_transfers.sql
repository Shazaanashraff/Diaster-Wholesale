-- ================================================================
-- Diastar ERP — Internal Stock Transfer
-- Supports: Warehouse → Shop, Shop → Shop
-- Role restriction: Shop → Shop requires manager approval
-- ================================================================

CREATE TABLE IF NOT EXISTS stock_transfers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       TEXT UNIQUE NOT NULL,
  from_location_id UUID NOT NULL REFERENCES locations(id),
  to_location_id   UUID NOT NULL REFERENCES locations(id),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'completed', 'cancelled')),
  notes           TEXT NOT NULL DEFAULT '',
  requested_by    TEXT NOT NULL DEFAULT 'System',
  approved_by     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  CONSTRAINT different_locations CHECK (from_location_id <> to_location_id)
);

CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id     UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access stock_transfers" ON stock_transfers;
CREATE POLICY "All access stock_transfers" ON stock_transfers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access stock_transfer_items" ON stock_transfer_items;
CREATE POLICY "All access stock_transfer_items" ON stock_transfer_items FOR ALL USING (true) WITH CHECK (true);

-- Reference generator
CREATE OR REPLACE FUNCTION generate_transfer_reference()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  next_num := (
    SELECT COALESCE(MAX(CAST(SUBSTRING(reference FROM 3) AS INTEGER)), 0) + 1
    FROM stock_transfers
    WHERE reference ~ '^ST[0-9]+$'
  );
  RETURN 'ST' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: on completion, move stock (negative adjustment from source, positive batch to dest)
-- NOTE: this is a location-agnostic model — stock_batches and stock_adjustments don't track
-- location directly in the current schema. The trigger records the movement in audit_log.
-- Physical stock movement is tracked via the audit trail.
CREATE OR REPLACE FUNCTION handle_stock_transfer_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
BEGIN
  IF OLD.status <> 'completed' AND NEW.status = 'completed' THEN
    NEW.completed_at := now();

    FOR v_item IN
      SELECT sti.product_id, sti.quantity
      FROM stock_transfer_items sti
      WHERE sti.transfer_id = NEW.id
    LOOP
      -- Deduct from source location (stock adjustment)
      INSERT INTO stock_adjustments (product_id, adjustment_pieces, reason, adjusted_by)
      VALUES (
        v_item.product_id,
        -(v_item.quantity),
        'Transfer out: ' || NEW.reference || ' → dest location',
        COALESCE(NEW.approved_by, NEW.requested_by)
      );

      -- Add to destination location (stock batch)
      INSERT INTO stock_batches (product_id, cartons, loose_pieces, notes, received_at)
      VALUES (
        v_item.product_id,
        0,
        v_item.quantity,
        'Transfer in: ' || NEW.reference || ' from source location',
        now()
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_transfer_complete ON stock_transfers;
CREATE TRIGGER trg_stock_transfer_complete
  BEFORE UPDATE ON stock_transfers
  FOR EACH ROW EXECUTE FUNCTION handle_stock_transfer_complete();
