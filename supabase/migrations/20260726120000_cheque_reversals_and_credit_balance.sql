-- Cheque status reversals + shared atomic customer-balance helper +
-- sales_returns.credit_adjustment column.
--
-- Context: general (no-invoice) payments were locked to cash-only because
-- staff never noticed a recorded cheque sitting in 'pending' — nothing
-- deducted outstanding until it was manually walked through
-- pending -> processing -> completed. That lock is being removed at the UI
-- layer; this migration adds the missing reverse transitions so a mistake
-- (wrong deposit click, a cheque that bounces after being marked cleared)
-- can be corrected instead of being a dead end, plus a single atomic RPC
-- for adjusting customer.outstanding_balance so returns/exchanges stop
-- doing non-atomic read-then-write updates from the client.

-- ── RPC: adjust_customer_outstanding ─────────────────────────────
-- Single atomic UPDATE, clamped at 0 same as the existing balance writers.
-- Returns the resulting balance so callers can detect a clamp.
CREATE OR REPLACE FUNCTION adjust_customer_outstanding(
  p_customer_id UUID,
  p_delta       NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  UPDATE customers
    SET outstanding_balance = GREATEST(0, outstanding_balance + p_delta)
    WHERE id = p_customer_id
    RETURNING outstanding_balance INTO v_new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer % not found', p_customer_id;
  END IF;

  RETURN v_new_balance;
END;
$$;

-- ── sales_returns: track the credit-side adjustment ──────────────
-- Positive or negative net delta applied to outstanding_balance for this
-- return/exchange (e.g. -50000 for a credit return, +20000 net for a
-- 50k->70k credit-to-credit exchange). Used by undoReturn to reverse it.
ALTER TABLE sales_returns
  ADD COLUMN IF NOT EXISTS credit_adjustment NUMERIC(12,2) NOT NULL DEFAULT 0;

-- ── update_cheque_status: add reverse transitions ────────────────
-- Existing transitions (unchanged):
--   pending    -> processing  : cheque_float += amount
--   processing -> completed   : cheque_float -= amount, outstanding -= amount
--   processing -> returned    : cheque_float -= amount
-- New transitions:
--   completed  -> returned    : outstanding += amount (reverse the clearing)
--   returned   -> processing  : cheque_float += amount (re-presented)
--   processing -> pending     : cheque_float -= amount (undo an accidental deposit)
CREATE OR REPLACE FUNCTION update_cheque_status(
  p_payment_id UUID,
  p_new_status TEXT   -- 'pending' | 'processing' | 'completed' | 'returned'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment     RECORD;
  v_total_paid  NUMERIC;
  v_inv_total   NUMERIC;
BEGIN
  -- Lock the payment row
  SELECT id, customer_id, invoice_id, amount, cheque_status
    INTO v_payment
    FROM payments
    WHERE id = p_payment_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment % not found', p_payment_id;
  END IF;

  IF v_payment.cheque_status IS NULL THEN
    RAISE EXCEPTION 'Payment % is not a cheque payment', p_payment_id;
  END IF;

  -- Validate allowed transitions
  IF NOT (
    (v_payment.cheque_status = 'pending'    AND p_new_status = 'processing') OR
    (v_payment.cheque_status = 'processing' AND p_new_status IN ('completed','returned','pending')) OR
    (v_payment.cheque_status = 'completed'  AND p_new_status = 'returned') OR
    (v_payment.cheque_status = 'returned'   AND p_new_status = 'processing')
  ) THEN
    RAISE EXCEPTION 'Invalid cheque transition: % → %', v_payment.cheque_status, p_new_status;
  END IF;

  -- Update cheque status
  UPDATE payments SET cheque_status = p_new_status WHERE id = p_payment_id;

  -- Apply side-effects per transition
  IF p_new_status = 'processing' AND v_payment.cheque_status = 'pending' THEN
    -- Cheque deposited at bank — add to float
    UPDATE customers
      SET cheque_float = cheque_float + v_payment.amount
      WHERE id = v_payment.customer_id;

  ELSIF p_new_status = 'processing' AND v_payment.cheque_status = 'returned' THEN
    -- Cheque re-presented after bouncing — back in float
    UPDATE customers
      SET cheque_float = cheque_float + v_payment.amount
      WHERE id = v_payment.customer_id;

  ELSIF p_new_status = 'pending' AND v_payment.cheque_status = 'processing' THEN
    -- Undo an accidental "Deposit" click — remove from float, still held
    UPDATE customers
      SET cheque_float = GREATEST(0, cheque_float - v_payment.amount)
      WHERE id = v_payment.customer_id;

  ELSIF p_new_status = 'completed' THEN
    -- Cheque cleared — reduce float and outstanding
    UPDATE customers
      SET cheque_float        = GREATEST(0, cheque_float        - v_payment.amount),
          outstanding_balance = GREATEST(0, outstanding_balance - v_payment.amount)
      WHERE id = v_payment.customer_id;

    -- Update invoice payment_status if linked
    IF v_payment.invoice_id IS NOT NULL THEN
      SELECT total INTO v_inv_total
        FROM invoices WHERE id = v_payment.invoice_id;

      SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
        FROM payments
        WHERE invoice_id = v_payment.invoice_id
          AND (cheque_status IS NULL OR cheque_status = 'completed');

      IF v_total_paid >= v_inv_total THEN
        UPDATE invoices SET payment_status = 'paid'    WHERE id = v_payment.invoice_id;
      ELSIF v_total_paid > 0 THEN
        UPDATE invoices SET payment_status = 'partial' WHERE id = v_payment.invoice_id;
      END IF;
    END IF;

  ELSIF p_new_status = 'returned' AND v_payment.cheque_status = 'processing' THEN
    -- Cheque bounced before clearing — remove from float, outstanding unchanged
    UPDATE customers
      SET cheque_float = GREATEST(0, cheque_float - v_payment.amount)
      WHERE id = v_payment.customer_id;

  ELSIF p_new_status = 'returned' AND v_payment.cheque_status = 'completed' THEN
    -- Cheque bounced AFTER being marked cleared — reverse the clearing.
    -- cheque_float was already zeroed out at completion; only outstanding
    -- needs to go back up.
    UPDATE customers
      SET outstanding_balance = outstanding_balance + v_payment.amount
      WHERE id = v_payment.customer_id;

    -- Recompute invoice payment_status now that this payment no longer counts
    IF v_payment.invoice_id IS NOT NULL THEN
      SELECT total INTO v_inv_total
        FROM invoices WHERE id = v_payment.invoice_id;

      SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
        FROM payments
        WHERE invoice_id = v_payment.invoice_id
          AND (cheque_status IS NULL OR cheque_status = 'completed');

      IF v_total_paid >= v_inv_total AND v_inv_total > 0 THEN
        UPDATE invoices SET payment_status = 'paid'    WHERE id = v_payment.invoice_id;
      ELSIF v_total_paid > 0 THEN
        UPDATE invoices SET payment_status = 'partial' WHERE id = v_payment.invoice_id;
      ELSE
        UPDATE invoices SET payment_status = 'unpaid'  WHERE id = v_payment.invoice_id;
      END IF;
    END IF;
  END IF;

  -- Return the updated payment row as JSONB
  RETURN (
    SELECT row_to_json(p)::JSONB
    FROM (
      SELECT id, customer_id, invoice_id, amount, method,
             bank_name, cheque_number, due_date,
             cheque_status, paid_at, created_at
      FROM payments WHERE id = p_payment_id
    ) p
  );
END;
$$;
