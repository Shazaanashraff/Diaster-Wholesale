-- Atomic checkout RPC
-- Wraps invoice header + items + payments in a single Postgres transaction so
-- a mid-flight failure can never leave an invoice row with no items (the root
-- cause of the "sale with no items" complaint).

CREATE OR REPLACE FUNCTION checkout_sale(
  p_invoice_no     TEXT,
  p_customer_id    UUID,
  p_mode           TEXT,
  p_subtotal       NUMERIC,
  p_discount       NUMERIC,
  p_total          NUMERIC,
  p_payment_status TEXT,
  p_salesperson_id UUID,
  -- [{product_id, cartons, pieces, unit_price, total, batch_id}]
  p_items          JSONB,
  -- [{amount, method, reference, cheque_number, bank_name, due_date, paid_at}]
  p_payments       JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice_id UUID;
BEGIN
  -- Guard: reject an empty cart at the DB level so no invoice header is ever
  -- committed without items, regardless of what the client sends.
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'checkout_sale: cart is empty — invoice not created';
  END IF;

  -- 1. Insert invoice header
  INSERT INTO invoices (
    invoice_no, customer_id, mode, subtotal, discount, total,
    payment_status, salesperson_id
  ) VALUES (
    p_invoice_no, p_customer_id, p_mode, p_subtotal, p_discount, p_total,
    p_payment_status, p_salesperson_id
  )
  RETURNING id INTO v_invoice_id;

  -- 2. Insert all invoice items in one statement
  INSERT INTO invoice_items (invoice_id, product_id, cartons, pieces, unit_price, total, batch_id)
  SELECT
    v_invoice_id,
    (item->>'product_id')::UUID,
    (item->>'cartons')::INT,
    (item->>'pieces')::INT,
    (item->>'unit_price')::NUMERIC,
    (item->>'total')::NUMERIC,
    NULLIF(item->>'batch_id', '')::UUID
  FROM jsonb_array_elements(p_items) AS item;

  -- 3. Insert payment rows (skip zero-amount entries)
  INSERT INTO payments (
    invoice_id, customer_id, amount, method, reference,
    cheque_number, bank_name, due_date, paid_at
  )
  SELECT
    v_invoice_id,
    p_customer_id,
    (pay->>'amount')::NUMERIC,
    pay->>'method',
    COALESCE(pay->>'reference', ''),
    NULLIF(pay->>'cheque_number', ''),
    NULLIF(pay->>'bank_name', ''),
    NULLIF(pay->>'due_date', '')::DATE,
    COALESCE(NULLIF(pay->>'paid_at', ''), now()::TEXT)::TIMESTAMPTZ
  FROM jsonb_array_elements(p_payments) AS pay
  WHERE (pay->>'amount')::NUMERIC > 0;

  RETURN v_invoice_id;
END;
$$;
