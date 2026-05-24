-- Link invoices to salespeople so renames update everywhere automatically

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS salesperson_id UUID REFERENCES salespeople(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_salesperson_id ON invoices(salesperson_id);

UPDATE invoices inv
SET salesperson_id = sp.id
FROM salespeople sp
WHERE inv.salesperson_id IS NULL
  AND inv.salesperson_name IS NOT NULL
  AND inv.salesperson_name = sp.name;
