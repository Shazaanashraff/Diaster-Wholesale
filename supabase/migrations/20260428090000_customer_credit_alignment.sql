-- Align customers table with Phase 1 credit requirements.
-- Safe to run multiple times.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'retail';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customers_type_check'
  ) THEN
    ALTER TABLE customers
      ADD CONSTRAINT customers_type_check
      CHECK (type IN ('wholesale', 'retail'));
  END IF;
END $$;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outstanding_balance NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Backfill outstanding balance from legacy column where useful.
UPDATE customers
SET outstanding_balance = COALESCE(credit_balance, 0)
WHERE outstanding_balance = 0
  AND credit_balance IS NOT NULL;
