-- Ensure product creation can store the requested per-item cost price.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2) NOT NULL DEFAULT 0;

UPDATE products
SET cost_price = 0
WHERE cost_price IS NULL;
