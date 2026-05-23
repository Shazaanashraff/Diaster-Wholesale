-- ================================================================
-- Diastar ERP — POS Payment Expansion Migration
-- ================================================================

-- 1. Update the 'payments' table constraint to allow the new methods
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_method_check 
CHECK (method IN ('cash', 'card', 'cheque', 'credit', 'online', 'bank_transfer', 'mixed'));

-- 2. Add Cheque metadata columns to the customer 'payments' table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS cheque_number TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS due_date DATE;

-- Note: The UI will submit 'online' for Online Transfer, 
-- 'card' for Card payments, and 'cheque' for Cheques.
