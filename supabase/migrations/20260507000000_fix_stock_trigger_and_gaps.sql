-- ================================================================
-- Diastar ERP — Gap-fix migration
-- 1. Fix purchase receive stock trigger (use actual received qty)
-- 2. Add audit_log adjusted_by column guard
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. Fix stock trigger: reads from purchase_receive, not purchase_items
--    Fires when purchases.status changes to 'received'
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_purchase_receive_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_recv    RECORD;
  v_ppc     INT;
  v_sellable INT;
  v_cartons  INT;
  v_loose    INT;
BEGIN
  IF OLD.status IS DISTINCT FROM 'received' AND NEW.status = 'received' THEN
    FOR v_recv IN
      SELECT product_id, received_units, damaged_units
      FROM purchase_receive
      WHERE purchase_id = NEW.id
    LOOP
      v_sellable := GREATEST(0, v_recv.received_units - COALESCE(v_recv.damaged_units, 0));
      IF v_sellable > 0 THEN
        SELECT COALESCE(pieces_per_carton, 1) INTO v_ppc
        FROM products WHERE id = v_recv.product_id;
        v_ppc     := COALESCE(v_ppc, 1);
        v_cartons := v_sellable / v_ppc;
        v_loose   := v_sellable % v_ppc;

        INSERT INTO stock_batches (product_id, cartons, loose_pieces, notes, received_at)
        VALUES (
          v_recv.product_id,
          v_cartons,
          v_loose,
          'Received from PO: ' || NEW.reference,
          now()
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-attach trigger (DROP first to reset any old version)
DROP TRIGGER IF EXISTS trg_purchase_receive_trigger ON purchases;
CREATE TRIGGER trg_purchase_receive_trigger
  AFTER UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION trg_purchase_receive_stock();

-- ────────────────────────────────────────────────────────────────
-- 2. Ensure stock_adjustments.adjusted_by has a default
--    (supplier return trigger uses 'System' but column may be NOT NULL)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE stock_adjustments ALTER COLUMN adjusted_by SET DEFAULT 'System';
