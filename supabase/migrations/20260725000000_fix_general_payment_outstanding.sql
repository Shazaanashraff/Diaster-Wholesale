-- Fix: general (no-invoice) payments not reducing customer outstanding
--
-- Symptom: recording a payment against a specific invoice reduced the
-- customer's outstanding_balance, but recording a "General (No Invoice)"
-- payment did not. The live database was running an older revision of
-- record_payment_atomic in which the `UPDATE customers ... outstanding_balance`
-- statement was nested INSIDE the `IF p_invoice_id IS NOT NULL` block, so a
-- payment with a NULL invoice inserted the payment row but skipped the
-- balance deduction.
--
-- This re-applies the canonical body (identical to the one committed in
-- 20260703010000): the deduction runs for any cash/bank_transfer payment,
-- and the invoice-status update is the only thing gated on an invoice link.
-- Idempotent CREATE OR REPLACE — safe to run on an already-correct DB.

CREATE OR REPLACE FUNCTION record_payment_atomic(
  p_customer_id   UUID,
  p_invoice_id    UUID,        -- NULL = general (no invoice link)
  p_amount        NUMERIC,
  p_method        TEXT,        -- 'cash' | 'bank_transfer' | 'cheque'
  p_bank_name     TEXT DEFAULT '',
  p_cheque_number TEXT DEFAULT '',
  p_due_date      TEXT DEFAULT ''  -- ISO date string or empty
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment_id  UUID;
  v_total_paid  NUMERIC;
  v_inv_total   NUMERIC;
BEGIN
  -- 1. Insert payment row
  INSERT INTO payments (
    customer_id, invoice_id, amount, method,
    bank_name, cheque_number, due_date,
    cheque_status, payment_type, reference, paid_at
  ) VALUES (
    p_customer_id,
    p_invoice_id,
    p_amount,
    p_method,
    NULLIF(p_bank_name, ''),
    NULLIF(p_cheque_number, ''),
    NULLIF(NULLIF(p_due_date, ''), '')::DATE,
    CASE WHEN p_method = 'cheque' THEN 'pending' ELSE NULL END,
    'credit_settlement',
    '',
    now()
  )
  RETURNING id INTO v_payment_id;

  -- 2. For cash / bank_transfer: apply to outstanding immediately
  --    (runs whether or not an invoice is linked)
  IF p_method IN ('cash', 'bank_transfer') THEN
    UPDATE customers
      SET outstanding_balance = GREATEST(0, outstanding_balance - p_amount)
      WHERE id = p_customer_id;

    -- 3. Update invoice payment_status ONLY if an invoice was linked
    IF p_invoice_id IS NOT NULL THEN
      SELECT total INTO v_inv_total
        FROM invoices WHERE id = p_invoice_id;

      SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
        FROM payments
        WHERE invoice_id = p_invoice_id;

      IF v_total_paid >= v_inv_total THEN
        UPDATE invoices SET payment_status = 'paid'    WHERE id = p_invoice_id;
      ELSIF v_total_paid > 0 THEN
        UPDATE invoices SET payment_status = 'partial' WHERE id = p_invoice_id;
      END IF;
    END IF;
  END IF;

  -- Cheque: no balance change, no invoice update (deferred until cleared)

  RETURN v_payment_id;
END;
$$;
