-- ================================================================
-- Diastar ERP — Warehouse / Shop Stock Separation
-- Run in Supabase SQL Editor AFTER fix_po13_po14.sql
-- ================================================================

-- ── 1. Create shop_stock view ────────────────────────────────────
-- POS reads this view — only shows stock physically in shop locations.
-- FIFO deduction directly reduces stock_batches, so no invoice subtraction needed.
CREATE OR REPLACE VIEW shop_stock AS
SELECT
  p.id               AS product_id,
  p.item_code,
  p.name,
  p.model,
  p.category,
  p.wholesale_price,
  p.retail_price,
  p.pieces_per_carton,
  p.reorder_level,
  COALESCE(sb_totals.cartons_in, 0)  AS cartons_in,
  COALESCE(sb_totals.pieces_in,  0)  AS pieces_in,
  0::BIGINT                          AS cartons_sold,
  0                                  AS pieces_sold,
  0::BIGINT                          AS carton_adj,
  0                                  AS piece_adj
FROM products p
LEFT JOIN (
  SELECT
    sb.product_id,
    SUM(sb.cartons)      AS cartons_in,
    SUM(sb.loose_pieces) AS pieces_in
  FROM stock_batches sb
  JOIN locations l ON l.id = sb.location_id
  WHERE l.type = 'shop'
  GROUP BY sb.product_id
) sb_totals ON sb_totals.product_id = p.id;

GRANT SELECT ON shop_stock TO anon, authenticated;

-- ── 2. Backfill existing NULL-location batches → shop ───────────
-- Existing batches were already being sold at POS before this migration.
-- Tag them as SHOP so current products remain visible to the cashier.
-- Only NEW batches from PO receives (going forward) will go to warehouse.
UPDATE stock_batches
SET location_id = (
  SELECT id FROM locations WHERE type = 'shop' ORDER BY created_at LIMIT 1
)
WHERE location_id IS NULL;

-- ── 3. Update purchase receive trigger ───────────────────────────
-- Tags new stock batches with the PO's destination location.
-- Falls back to first warehouse if PO has no location_id set.
CREATE OR REPLACE FUNCTION trg_purchase_receive_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_recv     RECORD;
  v_ppc      INT;
  v_sellable INT;
  v_cartons  INT;
  v_loose    INT;
  v_loc_id   UUID;
BEGIN
  IF OLD.status IS DISTINCT FROM 'received' AND NEW.status = 'received' THEN
    -- Use the PO's chosen location.
    -- If no location is set on the PO, default to the SHOP
    -- (most POs go straight to store; only explicit warehouse POs stay in warehouse).
    v_loc_id := NEW.location_id;
    IF v_loc_id IS NULL THEN
      SELECT id INTO v_loc_id
      FROM locations WHERE type = 'shop' ORDER BY created_at LIMIT 1;
    END IF;

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

        INSERT INTO stock_batches (product_id, cartons, loose_pieces, notes, received_at, location_id)
        VALUES (
          v_recv.product_id,
          v_cartons,
          v_loose,
          'Received from PO: ' || NEW.reference,
          now(),
          v_loc_id
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-attach trigger
DROP TRIGGER IF EXISTS trg_purchase_receive_trigger ON purchases;
CREATE TRIGGER trg_purchase_receive_trigger
  AFTER UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION trg_purchase_receive_stock();

-- ── 4. Update deduct_stock_fifo — shop batches only ─────────────
-- Sales at POS only deduct from shop-location batches.
CREATE OR REPLACE FUNCTION deduct_stock_fifo(
  p_product_id UUID,
  p_units      INTEGER
)
RETURNS VOID AS $$
DECLARE
  batch        RECORD;
  remaining    INTEGER := p_units;
  ppc          INTEGER;
  batch_pieces INTEGER;
  new_total    INTEGER;
  new_cartons  INTEGER;
  new_loose    INTEGER;
BEGIN
  FOR batch IN
    SELECT b.id, b.cartons, b.loose_pieces, pr.pieces_per_carton
    FROM   stock_batches b
    JOIN   products  pr ON pr.id = b.product_id
    JOIN   locations l  ON l.id  = b.location_id
    WHERE  b.product_id = p_product_id
      AND  l.type = 'shop'
    ORDER  BY b.received_at ASC NULLS LAST, b.created_at ASC
  LOOP
    EXIT WHEN remaining <= 0;

    ppc          := GREATEST(batch.pieces_per_carton, 1);
    batch_pieces := batch.cartons * ppc + batch.loose_pieces;

    IF remaining >= batch_pieces THEN
      DELETE FROM stock_batches WHERE id = batch.id;
      remaining := remaining - batch_pieces;
    ELSE
      new_total   := batch_pieces - remaining;
      new_cartons := new_total / ppc;
      new_loose   := new_total % ppc;
      UPDATE stock_batches
         SET cartons = new_cartons, loose_pieces = new_loose
       WHERE id = batch.id;
      remaining := 0;
    END IF;
  END LOOP;

  IF remaining > 0 THEN
    RAISE EXCEPTION 'Insufficient shop stock: % units undeducted for product %', remaining, p_product_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 5. Verify ────────────────────────────────────────────────────
-- After running, all existing stock should show as warehouse (0 in shop_stock)
SELECT
  l.name AS location,
  l.type,
  COUNT(sb.id) AS batch_count,
  SUM(sb.cartons) AS total_cartons
FROM stock_batches sb
JOIN locations l ON l.id = sb.location_id
GROUP BY l.name, l.type
ORDER BY l.type;
