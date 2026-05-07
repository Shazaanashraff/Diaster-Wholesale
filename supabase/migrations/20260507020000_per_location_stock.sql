-- ================================================================
-- Per-location stock tracking
-- Adds location_id to stock_batches and stock_adjustments so that
-- stock transfers properly move stock between specific locations.
-- ================================================================

-- 1. Add location_id columns (nullable for backward compat with existing rows)
ALTER TABLE stock_batches     ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id);
ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id);

-- 2. Update the stock transfer complete trigger to stamp location_id
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
      -- Deduct from source location
      INSERT INTO stock_adjustments (product_id, adjustment_pieces, reason, adjusted_by, location_id)
      VALUES (
        v_item.product_id,
        -(v_item.quantity),
        'Transfer out: ' || NEW.reference,
        COALESCE(NEW.approved_by, NEW.requested_by),
        NEW.from_location_id
      );

      -- Add to destination location
      INSERT INTO stock_batches (product_id, cartons, loose_pieces, notes, received_at, location_id)
      VALUES (
        v_item.product_id,
        0,
        v_item.quantity,
        'Transfer in: ' || NEW.reference,
        now(),
        NEW.to_location_id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger is already attached (created in previous migration), function replace is enough.

-- 3. Per-location stock view
-- Shows net stock per product per location based on batches and adjustments
-- that have a location_id stamped (i.e. from stock transfers).
-- Rows without location_id are pooled as unassigned (NULL location).
CREATE OR REPLACE VIEW product_stock_by_location AS
WITH batch_totals AS (
  SELECT
    product_id,
    location_id,
    SUM(cartons * COALESCE(p.pieces_per_carton, 1) + loose_pieces) AS units_in
  FROM stock_batches sb
  JOIN products p ON p.id = sb.product_id
  GROUP BY product_id, location_id
),
adj_totals AS (
  SELECT
    product_id,
    location_id,
    SUM(adjustment_pieces) AS units_adj
  FROM stock_adjustments
  GROUP BY product_id, location_id
),
combined AS (
  SELECT product_id, location_id, units_in AS net FROM batch_totals
  UNION ALL
  SELECT product_id, location_id, units_adj AS net FROM adj_totals
)
SELECT
  p.id         AS product_id,
  p.name,
  p.item_code,
  p.pieces_per_carton,
  c.location_id,
  l.name       AS location_name,
  l.type       AS location_type,
  SUM(c.net)   AS total_units
FROM combined c
JOIN products p ON p.id = c.product_id
LEFT JOIN locations l ON l.id = c.location_id
GROUP BY p.id, p.name, p.item_code, p.pieces_per_carton, c.location_id, l.name, l.type;

-- RLS on view (inherits from base tables, but make it explicit)
-- No separate RLS needed for views in Postgres — base table policies apply.
