-- Cheque lifecycle management + atomic record_payment RPC
-- Adds cheque_status to payments, cheque_float to customers,
-- and two RPCs: record_payment_atomic() and update_cheque_status()

-- ── Schema additions ────────────────────────────────────────────

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS cheque_status TEXT
    CHECK (cheque_status IN ('pending','processing','completed','returned'));

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS cheque_float NUMERIC(12,2) NOT NULL DEFAULT 0;

-- ── RPC 1: record_payment_atomic ────────────────────────────────
-- Replaces the 4-step JS flow. All side-effects in one transaction.
-- method: 'cash' | 'bank_transfer' — deducts outstanding immediately
-- method: 'cheque'                 — inserts as pending, no balance change

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
    cheque_status, reference, paid_at
  ) VALUES (
    p_customer_id,
    p_invoice_id,
    p_amount,
    p_method,
    NULLIF(p_bank_name, ''),
    NULLIF(p_cheque_number, ''),
    NULLIF(NULLIF(p_due_date, ''), '')::DATE,
    CASE WHEN p_method = 'cheque' THEN 'pending' ELSE NULL END,
    '',
    now()
  )
  RETURNING id INTO v_payment_id;

  -- 2. For cash / bank_transfer: apply to outstanding immediately
  IF p_method IN ('cash', 'bank_transfer') THEN
    UPDATE customers
      SET outstanding_balance = GREATEST(0, outstanding_balance - p_amount)
      WHERE id = p_customer_id;

    -- 3. Update invoice payment_status if an invoice was linked
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


-- ── RPC 2: update_cheque_status ─────────────────────────────────
-- Handles all cheque state transitions atomically.
--
--  pending → processing  : cheque_float += amount
--  processing → completed: cheque_float -= amount, outstanding -= amount,
--                          invoice payment_status updated
--  processing → returned : cheque_float -= amount

CREATE OR REPLACE FUNCTION update_cheque_status(
  p_payment_id UUID,
  p_new_status TEXT   -- 'processing' | 'completed' | 'returned'
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
    (v_payment.cheque_status = 'processing' AND p_new_status IN ('completed','returned'))
  ) THEN
    RAISE EXCEPTION 'Invalid cheque transition: % → %', v_payment.cheque_status, p_new_status;
  END IF;

  -- Update cheque status
  UPDATE payments SET cheque_status = p_new_status WHERE id = p_payment_id;

  -- Apply side-effects per transition
  IF p_new_status = 'processing' THEN
    -- Cheque deposited at bank — add to float
    UPDATE customers
      SET cheque_float = cheque_float + v_payment.amount
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

  ELSIF p_new_status = 'returned' THEN
    -- Cheque bounced — remove from float, outstanding unchanged
    UPDATE customers
      SET cheque_float = GREATEST(0, cheque_float - v_payment.amount)
      WHERE id = v_payment.customer_id;
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
