-- Migration: Cartons and Batches
-- Adds the cartons table for tracking individual carton codes per purchase item
-- Adds batch_id to invoice_items to support manual batch selection in POS

-- 1. Create cartons table
CREATE TABLE IF NOT EXISTS cartons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  carton_index INT NOT NULL,
  carton_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'sold', 'damaged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cartons DISABLE ROW LEVEL SECURITY;

-- 2. Add batch_id to invoice_items
ALTER TABLE invoice_items 
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES stock_batches(id) ON DELETE SET NULL;

-- 3. Create function for manual batch deduction
CREATE OR REPLACE FUNCTION deduct_stock_from_batch(p_batch_id UUID, p_units INT)
RETURNS VOID AS $$
DECLARE
  v_ppc INT;
  v_needed_cartons INT;
  v_needed_loose INT;
BEGIN
  -- Get pieces per carton for this batch
  SELECT p.pieces_per_carton INTO v_ppc
  FROM stock_batches b
  JOIN products p ON p.id = b.product_id
  WHERE b.id = p_batch_id;

  v_needed_cartons := p_units / v_ppc;
  v_needed_loose := p_units % v_ppc;

  UPDATE stock_batches
  SET 
    cartons = cartons - v_needed_cartons,
    loose_pieces = loose_pieces - v_needed_loose
  WHERE id = p_batch_id;

  -- Re-balance if loose_pieces becomes negative
  UPDATE stock_batches
  SET 
    cartons = cartons - 1,
    loose_pieces = loose_pieces + v_ppc
  WHERE id = p_batch_id AND loose_pieces < 0;
END;
$$ LANGUAGE plpgsql;
