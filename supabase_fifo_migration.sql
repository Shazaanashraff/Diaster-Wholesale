-- ================================================================
-- Diastar ERP — FIFO Stock Deduction Function
-- Run AFTER supabase_migration.sql
-- ================================================================

CREATE OR REPLACE FUNCTION deduct_stock_fifo(
  p_product_id   UUID,
  p_units        INTEGER
)
RETURNS VOID AS $$
DECLARE
  batch          RECORD;
  remaining      INTEGER := p_units;
  ppc            INTEGER;
  batch_pieces   INTEGER;
  new_total      INTEGER;
  new_cartons    INTEGER;
  new_loose      INTEGER;
BEGIN
  FOR batch IN
    SELECT b.id, b.cartons, b.loose_pieces, p.pieces_per_carton
    FROM   stock_batches b
    JOIN   products p ON p.id = b.product_id
    WHERE  b.product_id = p_product_id
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
    RAISE EXCEPTION 'Insufficient stock: % units still undeducted for product %', remaining, p_product_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Movement rate view: units sold per product in the last 30 days
CREATE OR REPLACE VIEW product_movement_30d AS
SELECT
  ii.product_id,
  COALESCE(SUM(ii.pieces + ii.cartons * p.pieces_per_carton), 0)::INTEGER AS units_sold_30d,
  ROUND(
    COALESCE(SUM(ii.pieces + ii.cartons * p.pieces_per_carton), 0)::NUMERIC / 30, 2
  ) AS units_per_day
FROM invoice_items ii
JOIN invoices      inv ON inv.id = ii.invoice_id
JOIN products      p   ON p.id  = ii.product_id
WHERE inv.created_at >= now() - INTERVAL '30 days'
GROUP BY ii.product_id;

-- Grant access
GRANT SELECT ON product_movement_30d TO anon, authenticated;
