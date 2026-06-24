-- ============================================================
-- FIX: purchase-receive stock batches had no location_id
--
-- Root cause:
--   trg_purchase_receive_stock() inserted into stock_batches
--   WITHOUT the purchase's location_id (NULL). The Inventory page
--   reads product_stock_by_location and filters by location_type,
--   so NULL-location batches were invisible under both the Shop and
--   Warehouse tabs (and the POS shop_stock view ignored them too).
--   Symptom: POs received after the per-location inventory rework
--   (PO0050+) showed in Supabase but added no visible stock.
--
-- Fix in three steps:
--   1. Trigger fix: stamp the purchase's location_id on each batch
--      (fall back to the default warehouse if a PO has no location).
--   2. Data repair: backfill existing NULL-location batches to the
--      destination location of the PO named in their notes.
--   3. View hardening: coalesce any remaining NULL batch location to
--      the default warehouse so a stray NULL can never hide again.
-- ============================================================

-- ── Step 1: Trigger now stamps location_id ──────────────────────────────────
CREATE OR REPLACE FUNCTION trg_purchase_receive_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_recv     RECORD;
  v_ppc      INT;
  v_sellable INT;
  v_cartons  INT;
  v_loose    INT;
  v_location UUID;
BEGIN
  IF OLD.status IS DISTINCT FROM 'received' AND NEW.status = 'received' THEN
    -- Destination location for this purchase; default to main warehouse.
    v_location := COALESCE(
      NEW.location_id,
      (SELECT id FROM locations WHERE type = 'warehouse' ORDER BY created_at LIMIT 1)
    );

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
          v_location
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

-- ── Step 2: Backfill existing NULL-location PO batches ──────────────────────
-- Assign each orphaned batch to the destination location of the PO it came
-- from (matched via the "Received from PO: <reference>" note).
UPDATE public.stock_batches sb
SET location_id = pu.location_id
FROM public.purchases pu
WHERE sb.location_id IS NULL
  AND pu.location_id IS NOT NULL
  AND sb.notes = 'Received from PO: ' || pu.reference;

-- Any remaining NULL-location batches (PO had no location, or non-PO origin)
-- fall back to the default warehouse so they are visible.
UPDATE public.stock_batches
SET location_id = (
  SELECT id FROM public.locations WHERE type = 'warehouse' ORDER BY created_at LIMIT 1
)
WHERE location_id IS NULL;

-- ── Step 3: Harden product_stock_by_location against NULL batch locations ────
CREATE OR REPLACE VIEW public.product_stock_by_location AS
WITH batch_totals AS (
  SELECT
    sb.product_id,
    -- Treat NULL location as the default warehouse (defensive)
    COALESCE(sb.location_id, (
      SELECT id FROM public.locations WHERE type = 'warehouse' ORDER BY created_at LIMIT 1
    )) AS location_id,
    SUM(sb.cartons * COALESCE(p.pieces_per_carton, 1) + sb.loose_pieces) AS units_in
  FROM public.stock_batches sb
  JOIN public.products p ON p.id = sb.product_id AND p.is_active = true
  GROUP BY sb.product_id, COALESCE(sb.location_id, (
    SELECT id FROM public.locations WHERE type = 'warehouse' ORDER BY created_at LIMIT 1
  ))
),
adj_totals AS (
  SELECT
    sa.product_id,
    COALESCE(sa.location_id, (
      SELECT id FROM public.locations WHERE type = 'warehouse' ORDER BY created_at LIMIT 1
    )) AS location_id,
    SUM(sa.adjustment_pieces) AS units_adj
  FROM public.stock_adjustments sa
  JOIN public.products p ON p.id = sa.product_id AND p.is_active = true
  GROUP BY sa.product_id, COALESCE(sa.location_id, (
    SELECT id FROM public.locations WHERE type = 'warehouse' ORDER BY created_at LIMIT 1
  ))
),
combined AS (
  SELECT product_id, location_id, units_in AS net FROM batch_totals
  UNION ALL
  SELECT product_id, location_id, units_adj AS net FROM adj_totals
)
SELECT
  p.id AS product_id,
  p.name,
  p.item_code,
  p.pieces_per_carton,
  c.location_id,
  l.name AS location_name,
  l.type AS location_type,
  SUM(c.net) AS total_units
FROM combined c
JOIN public.products p ON p.id = c.product_id AND p.is_active = true
LEFT JOIN public.locations l ON l.id = c.location_id
GROUP BY p.id, p.name, p.item_code, p.pieces_per_carton, c.location_id, l.name, l.type;

GRANT SELECT ON public.product_stock_by_location TO anon, authenticated;
