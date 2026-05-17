-- Add salesperson tracking to invoices and a simple salespeople table

-- 1. Salespeople lookup table
CREATE TABLE IF NOT EXISTS salespeople (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE salespeople DISABLE ROW LEVEL SECURITY;

-- 2. Add salesperson_name column to invoices (denormalised for historical accuracy)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS salesperson_name TEXT;
