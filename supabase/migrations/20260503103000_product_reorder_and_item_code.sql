-- Product reorder level + auto item code generation

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS reorder_level INT NOT NULL DEFAULT 0;

UPDATE products
SET reorder_level = 0
WHERE reorder_level IS NULL;

CREATE OR REPLACE FUNCTION generate_product_item_code()
RETURNS TEXT AS $$
DECLARE
  candidate TEXT;
BEGIN
  LOOP
    candidate := LPAD((FLOOR(random() * 1000000))::INT::TEXT, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM products WHERE item_code = candidate
    );
  END LOOP;

  RETURN candidate;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_product_item_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.item_code IS NULL OR BTRIM(NEW.item_code) = '' THEN
    NEW.item_code := generate_product_item_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_set_item_code ON products;
CREATE TRIGGER products_set_item_code
  BEFORE INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION set_product_item_code();

CREATE OR REPLACE VIEW product_stock AS
SELECT
  p.id AS product_id,
  p.item_code,
  p.name,
  p.model,
  p.category,
  p.wholesale_price,
  p.retail_price,
  p.pieces_per_carton,
  p.reorder_level,
  COALESCE(batch_totals.cartons_in, 0) AS cartons_in,
  COALESCE(batch_totals.pieces_in, 0) AS pieces_in,
  COALESCE(sold_totals.cartons_sold, 0) AS cartons_sold,
  COALESCE(sold_totals.pieces_sold, 0) AS pieces_sold,
  COALESCE(adj_totals.carton_adj, 0::bigint) AS carton_adj,
  COALESCE(adj_totals.piece_adj, 0) AS piece_adj
FROM products p
LEFT JOIN (
  SELECT
    product_id,
    SUM(cartons) AS cartons_in,
    SUM(loose_pieces) AS pieces_in
  FROM stock_batches
  GROUP BY product_id
) batch_totals ON batch_totals.product_id = p.id
LEFT JOIN (
  SELECT
    ii.product_id,
    SUM(ii.cartons) AS cartons_sold,
    SUM(ii.pieces) AS pieces_sold
  FROM invoice_items ii
  JOIN invoices inv ON inv.id = ii.invoice_id
  WHERE inv.payment_status IN ('partial', 'paid')
  GROUP BY ii.product_id
) sold_totals ON sold_totals.product_id = p.id
LEFT JOIN (
  SELECT
    product_id,
    0::bigint AS carton_adj,
    SUM(adjustment_pieces) AS piece_adj
  FROM stock_adjustments
  GROUP BY product_id
) adj_totals ON adj_totals.product_id = p.id;
