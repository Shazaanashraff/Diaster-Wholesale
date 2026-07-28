-- Admin-only manual customer outstanding-balance adjustment.
-- Adds an auditable "reason" ledger entry alongside the balance change so it
-- shows up in the customer's existing Payment History table.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS adjusted_by TEXT;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_method_check
  CHECK (method IN ('cash', 'bank_transfer', 'cheque', 'credit', 'adjustment'));

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_type_check;
ALTER TABLE payments ADD CONSTRAINT payments_payment_type_check
  CHECK (payment_type IN ('sale', 'credit_settlement', 'manual_adjustment'));

CREATE OR REPLACE FUNCTION adjust_customer_outstanding_manual(
  p_customer_id UUID,
  p_delta       NUMERIC,
  p_reason      TEXT,
  p_adjusted_by TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'A reason is required for a manual balance adjustment';
  END IF;

  IF p_delta IS NULL OR p_delta = 0 THEN
    RAISE EXCEPTION 'Adjustment amount cannot be zero';
  END IF;

  UPDATE customers
    SET outstanding_balance = GREATEST(0, outstanding_balance + p_delta),
        updated_at = now()
    WHERE id = p_customer_id
    RETURNING outstanding_balance INTO v_new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer % not found', p_customer_id;
  END IF;

  INSERT INTO payments (
    customer_id, invoice_id, amount, method, payment_type,
    reason, adjusted_by, paid_at
  ) VALUES (
    p_customer_id, NULL, -p_delta, 'adjustment', 'manual_adjustment',
    p_reason, p_adjusted_by, now()
  );

  RETURN v_new_balance;
END;
$$;
