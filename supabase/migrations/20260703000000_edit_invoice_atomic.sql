-- edit_invoice_atomic RPC
-- Allows admin to edit a wholesale invoice post-sale:
--   • Add / remove / reprice line items (with stock reconciliation)
--   • Adjust discount / total
--   • Change salesperson
--   • Replace editable payments (pending/cash/card — not settled cheques)
-- All side-effects run in one transaction.

CREATE OR REPLACE FUNCTION edit_invoice_atomic(
  p_invoice_id     UUID,
  p_salesperson_id UUID,   -- nullable
  p_notes          TEXT,
  p_discount       NUMERIC,
  p_items          JSONB,  -- [{product_id, cartons, pieces, unit_price, total}]
  p_payments       JSONB,  -- [{method, amount, bank_name, cheque_number, due_date}]
  p_adjusted_by    TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice        RECORD;
  v_item           RECORD;
  v_new_item       JSONB;
  v_product_name   TEXT;

  v_ppc            INT;
  v_old_units      INT;
  v_new_units      INT;
  v_diff_units     INT;
  v_diff_cartons   INT;
  v_diff_pieces    INT;

  v_subtotal        NUMERIC;
  v_total           NUMERIC;
  v_old_paid        NUMERIC;
  v_new_paid        NUMERIC;
  v_old_outstanding NUMERIC;
  v_new_outstanding NUMERIC;
  v_payment_status  TEXT;
  v_sp_name         TEXT;
BEGIN
  -- Guard: at least one item required
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'edit_invoice_atomic: invoice must have at least one item';
  END IF;

  -- ── 1. Lock invoice ────────────────────────────────────────────
  SELECT id, invoice_no, customer_id, total, subtotal
    INTO v_invoice
    FROM invoices
    WHERE id = p_invoice_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % not found', p_invoice_id;
  END IF;

  -- ── 2. Old paid amount (cash/bank/completed cheques only) ──────
  SELECT COALESCE(SUM(amount), 0) INTO v_old_paid
    FROM payments
    WHERE invoice_id = p_invoice_id
      AND (cheque_status IS NULL OR cheque_status = 'completed');

  v_old_outstanding := GREATEST(0, v_invoice.total - v_old_paid);

  -- ── 3. Stock reconciliation: existing items vs new items ───────
  FOR v_item IN
    SELECT
      ii.product_id,
      SUM(ii.cartons) AS old_cartons,
      SUM(ii.pieces)  AS old_pieces,
      p.pieces_per_carton,
      p.name
    FROM invoice_items ii
    JOIN products p ON p.id = ii.product_id
    WHERE ii.invoice_id = p_invoice_id
    GROUP BY ii.product_id, p.pieces_per_carton, p.name
  LOOP
    v_ppc      := GREATEST(v_item.pieces_per_carton, 1);
    v_old_units := v_item.old_cartons * v_ppc + v_item.old_pieces;

    -- Sum units for this product_id in the incoming items list
    SELECT COALESCE(
      (SELECT SUM((ni->>'cartons')::INT * v_ppc + (ni->>'pieces')::INT)
         FROM jsonb_array_elements(p_items) AS ni
        WHERE (ni->>'product_id')::UUID = v_item.product_id),
      0
    ) INTO v_new_units;

    v_diff_units := v_new_units - v_old_units;

    IF v_diff_units < 0 THEN
      -- Qty decreased or item fully removed → restore stock
      v_diff_cartons := ABS(v_diff_units) / v_ppc;
      v_diff_pieces  := ABS(v_diff_units) % v_ppc;
      PERFORM restore_stock_pieces(
        v_item.product_id, v_diff_cartons, v_diff_pieces,
        '[BILL-EDIT] ' || v_invoice.invoice_no
      );
      INSERT INTO stock_adjustments (product_id, adjustment_pieces, reason, adjusted_by)
      VALUES (
        v_item.product_id,
        ABS(v_diff_units),
        '[BILL-EDIT] ' || v_invoice.invoice_no || ' — ' || v_item.name
          || CASE WHEN v_new_units = 0 THEN ' removed' ELSE ' qty decreased' END,
        p_adjusted_by
      );

    ELSIF v_diff_units > 0 THEN
      -- Qty increased → deduct more stock
      PERFORM deduct_stock_fifo(v_item.product_id, v_diff_units);
      INSERT INTO stock_adjustments (product_id, adjustment_pieces, reason, adjusted_by)
      VALUES (
        v_item.product_id,
        -v_diff_units,
        '[BILL-EDIT] ' || v_invoice.invoice_no || ' — ' || v_item.name || ' qty increased',
        p_adjusted_by
      );
    END IF;
  END LOOP;

  -- ── 4. Newly added products (not present in old invoice_items) ─
  FOR v_new_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM invoice_items
       WHERE invoice_id = p_invoice_id
         AND product_id = (v_new_item->>'product_id')::UUID
    ) THEN
      SELECT GREATEST(pieces_per_carton, 1), name
        INTO v_ppc, v_product_name
        FROM products WHERE id = (v_new_item->>'product_id')::UUID;

      v_new_units := (v_new_item->>'cartons')::INT * v_ppc + (v_new_item->>'pieces')::INT;

      IF v_new_units > 0 THEN
        PERFORM deduct_stock_fifo((v_new_item->>'product_id')::UUID, v_new_units);
        INSERT INTO stock_adjustments (product_id, adjustment_pieces, reason, adjusted_by)
        VALUES (
          (v_new_item->>'product_id')::UUID,
          -v_new_units,
          '[BILL-EDIT] ' || v_invoice.invoice_no || ' — ' || v_product_name || ' added',
          p_adjusted_by
        );
      END IF;
    END IF;
  END LOOP;

  -- ── 5. Replace invoice items ───────────────────────────────────
  DELETE FROM invoice_items WHERE invoice_id = p_invoice_id;

  INSERT INTO invoice_items (invoice_id, product_id, cartons, pieces, unit_price, total)
  SELECT
    p_invoice_id,
    (item->>'product_id')::UUID,
    (item->>'cartons')::INT,
    (item->>'pieces')::INT,
    (item->>'unit_price')::NUMERIC,
    (item->>'total')::NUMERIC
  FROM jsonb_array_elements(p_items) AS item;

  -- ── 6. New subtotal / total ────────────────────────────────────
  SELECT SUM((item->>'total')::NUMERIC)
    INTO v_subtotal
    FROM jsonb_array_elements(p_items) AS item;

  v_total := v_subtotal - p_discount;

  -- ── 7. Payment reconciliation ──────────────────────────────────
  -- Delete only editable payments (cash/card/pending cheques)
  DELETE FROM payments
   WHERE invoice_id = p_invoice_id
     AND (cheque_status IS NULL OR cheque_status = 'pending');

  -- Insert new payment rows
  INSERT INTO payments (invoice_id, customer_id, amount, method, reference,
                        bank_name, cheque_number, due_date, cheque_status, paid_at)
  SELECT
    p_invoice_id,
    v_invoice.customer_id,
    (pmt->>'amount')::NUMERIC,
    pmt->>'method',
    '',
    NULLIF(pmt->>'bank_name', ''),
    NULLIF(pmt->>'cheque_number', ''),
    NULLIF(pmt->>'due_date', '')::DATE,
    CASE WHEN pmt->>'method' = 'cheque' THEN 'pending' ELSE NULL END,
    now()
  FROM jsonb_array_elements(p_payments) AS pmt
  WHERE (pmt->>'amount')::NUMERIC > 0;

  -- ── 8. Recalculate paid / outstanding ─────────────────────────
  SELECT COALESCE(SUM(amount), 0) INTO v_new_paid
    FROM payments
    WHERE invoice_id = p_invoice_id
      AND (cheque_status IS NULL OR cheque_status = 'completed');

  v_new_outstanding := GREATEST(0, v_total - v_new_paid);

  UPDATE customers
     SET outstanding_balance = GREATEST(0, outstanding_balance - v_old_outstanding + v_new_outstanding)
   WHERE id = v_invoice.customer_id;

  -- ── 9. Payment status ──────────────────────────────────────────
  v_payment_status :=
    CASE
      WHEN v_new_paid >= v_total THEN 'paid'
      WHEN v_new_paid > 0        THEN 'partial'
      ELSE                            'unpaid'
    END;

  -- ── 10. Resolve salesperson name ──────────────────────────────
  SELECT name INTO v_sp_name FROM salespeople WHERE id = p_salesperson_id;

  -- ── 11. Update invoice header ──────────────────────────────────
  UPDATE invoices SET
    subtotal         = v_subtotal,
    discount         = p_discount,
    total            = v_total,
    payment_status   = v_payment_status,
    salesperson_id   = p_salesperson_id,
    salesperson_name = COALESCE(v_sp_name, salesperson_name),
    notes            = p_notes,
    updated_at       = now()
  WHERE id = p_invoice_id;

  -- ── 12. Return updated invoice ─────────────────────────────────
  RETURN (
    SELECT row_to_json(inv)::JSONB
    FROM (
      SELECT id, invoice_no, customer_id, mode, subtotal, discount, total,
             payment_status, salesperson_id, salesperson_name, notes, created_at, updated_at
      FROM invoices WHERE id = p_invoice_id
    ) inv
  );
END;
$$;
