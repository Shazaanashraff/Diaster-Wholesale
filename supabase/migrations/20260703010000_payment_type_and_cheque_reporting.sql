-- payment_type column + record_payment_atomic update
--
-- Distinguishes a brand-new sale's payment (payment_type = 'sale', the
-- default — used by checkout_sale and edit_invoice_atomic) from a payment
-- collected later against an existing customer balance/invoice
-- (payment_type = 'credit_settlement' — used exclusively by
-- record_payment_atomic, called from the "Record Payment" UI).
--
-- Reports must treat these differently: a settlement is money collected
-- against revenue already recognized when the original invoice was
-- created, so it must never be added to "Sales" again — but it should
-- still show up as "Payments Received" and, if collected in cash, still
-- count toward the day's cash-drawer reconciliation.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'sale';

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_type_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_payment_type_check
    CHECK (payment_type IN ('sale', 'credit_settlement'));

-- ── record_payment_atomic: tag every insert as a settlement ─────────
-- This RPC is only ever called from CustomerDetailPage's "Record Payment"
-- modal, which has no invoice-creation flow — every payment it inserts is,
-- by design, a collection against an existing balance/invoice, never a
-- new sale. Body otherwise unchanged from 20260625000000_cheque_management.sql.

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
