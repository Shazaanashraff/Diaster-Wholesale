-- Add is_active column to customers, suppliers, and products
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Update existing rows to be active
UPDATE customers SET is_active = TRUE WHERE is_active IS NULL;
UPDATE suppliers SET is_active = TRUE WHERE is_active IS NULL;
UPDATE products SET is_active = TRUE WHERE is_active IS NULL;
