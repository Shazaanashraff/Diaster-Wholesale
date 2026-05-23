-- ================================================================
-- DIASTAR ERP — Sandbox Patch Script
-- Brings an existing sandbox schema up to date with production.
-- Run in Supabase Dashboard → SQL Editor (with sandbox exposed).
--
-- Covers all production migrations after the original sandbox-setup.sql:
--   • 20260515000000  loyalty + full returns module v2
--   • 20260515120131  product cost_price NOT NULL
--   • 20260517000000  salesperson tracking
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- PART 1 — Loyalty columns on customers
-- ────────────────────────────────────────────────────────────────
ALTER TABLE sandbox.customers
  ADD COLUMN IF NOT EXISTS loyalty_points        INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_loyalty_earned  INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_loyalty_redeemed INT NOT NULL DEFAULT 0;

-- ────────────────────────────────────────────────────────────────
-- PART 2 — Loyalty transactions table
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.loyalty_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID NOT NULL REFERENCES sandbox.customers(id) ON DELETE RESTRICT,
  invoice_id       UUID REFERENCES sandbox.invoices(id) ON DELETE SET NULL,
  return_id        UUID,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('EARN','REDEEM','RETURN_REVERSAL','RETURN_UNDO')),
  points           INT NOT NULL DEFAULT 0,
  notes            TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE sandbox.loyalty_transactions DISABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- PART 3 — Idempotency key on invoices
-- ────────────────────────────────────────────────────────────────
ALTER TABLE sandbox.invoices
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS sandbox_invoices_idempotency_key_idx
  ON sandbox.invoices (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ────────────────────────────────────────────────────────────────
-- PART 4 — Sales returns table
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.sales_returns (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number         TEXT NOT NULL UNIQUE,
  original_invoice_id   UUID NOT NULL REFERENCES sandbox.invoices(id) ON DELETE RESTRICT,
  exchange_invoice_id   UUID REFERENCES sandbox.invoices(id) ON DELETE SET NULL,
  exchange_invoice_no   TEXT,
  return_type           TEXT NOT NULL DEFAULT 'Return'
                          CHECK (return_type IN ('Return','Exchange')),
  reason                TEXT NOT NULL DEFAULT '',
  status                TEXT NOT NULL DEFAULT 'Pending'
                          CHECK (status IN ('Pending','Completed','Cancelled')),
  resolution_type       TEXT CHECK (resolution_type IN ('Repaired','Replaced')),
  settlement_type       TEXT CHECK (settlement_type IN ('UpgradePayment','CashRefund','EvenExchange')),
  exchange_difference   NUMERIC(12,2),
  refund_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  returned_by           TEXT NOT NULL DEFAULT '',
  workflow_snapshot     JSONB,
  cancelled_at          TIMESTAMPTZ,
  cancelled_by          TEXT,
  cancel_reason         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE sandbox.sales_returns DISABLE ROW LEVEL SECURITY;

-- Back-fill FK from loyalty_transactions now that sales_returns exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'sandbox'
      AND table_name        = 'loyalty_transactions'
      AND constraint_name   = 'fk_sandbox_loyalty_return'
  ) THEN
    ALTER TABLE sandbox.loyalty_transactions
      ADD CONSTRAINT fk_sandbox_loyalty_return
      FOREIGN KEY (return_id) REFERENCES sandbox.sales_returns(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- PART 5 — Sales return items table
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.sales_return_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id       UUID NOT NULL REFERENCES sandbox.sales_returns(id) ON DELETE CASCADE,
  invoice_item_id UUID REFERENCES sandbox.invoice_items(id) ON DELETE SET NULL,
  product_id      UUID NOT NULL REFERENCES sandbox.products(id) ON DELETE RESTRICT,
  product_name    TEXT NOT NULL DEFAULT '',
  return_cartons  INT NOT NULL DEFAULT 0,
  return_pieces   INT NOT NULL DEFAULT 0,
  unit_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE sandbox.sales_return_items DISABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- PART 6 — Salespeople table
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.salespeople (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE sandbox.salespeople DISABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- PART 7 — Salesperson name on invoices
-- ────────────────────────────────────────────────────────────────
ALTER TABLE sandbox.invoices
  ADD COLUMN IF NOT EXISTS salesperson_name TEXT;

-- ────────────────────────────────────────────────────────────────
-- PART 8 — products.cost_price NOT NULL enforcement
-- ────────────────────────────────────────────────────────────────
ALTER TABLE sandbox.products
  ALTER COLUMN cost_price SET NOT NULL,
  ALTER COLUMN cost_price SET DEFAULT 0;

UPDATE sandbox.products SET cost_price = 0 WHERE cost_price IS NULL;

-- ────────────────────────────────────────────────────────────────
-- PART 9 — Helper functions (all scoped to sandbox)
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sandbox.get_available_stock_pieces(p_product_id UUID)
RETURNS INT AS $$
DECLARE
  v_ppc    INT;
  v_result INT;
BEGIN
  SELECT GREATEST(pieces_per_carton, 1) INTO v_ppc
  FROM sandbox.products WHERE id = p_product_id;

  SELECT COALESCE(SUM(b.cartons * v_ppc + b.loose_pieces), 0)
  INTO v_result
  FROM sandbox.stock_batches b
  WHERE b.product_id = p_product_id;

  RETURN GREATEST(v_result, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = sandbox;

CREATE OR REPLACE FUNCTION sandbox.restore_stock_pieces(
  p_product_id  UUID,
  p_cartons     INT,
  p_pieces      INT,
  p_notes       TEXT DEFAULT 'Customer return'
)
RETURNS VOID AS $$
DECLARE
  v_total_pieces INT;
  v_ppc          INT;
  v_new_cartons  INT;
  v_new_pieces   INT;
BEGIN
  IF p_cartons = 0 AND p_pieces = 0 THEN RETURN; END IF;

  SELECT GREATEST(pieces_per_carton, 1) INTO v_ppc
  FROM sandbox.products WHERE id = p_product_id;

  v_total_pieces := p_cartons * v_ppc + p_pieces;
  v_new_cartons  := v_total_pieces / v_ppc;
  v_new_pieces   := v_total_pieces % v_ppc;

  INSERT INTO sandbox.stock_batches (product_id, cartons, loose_pieces, notes, received_at)
  VALUES (p_product_id, v_new_cartons, v_new_pieces, p_notes, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = sandbox;

CREATE OR REPLACE FUNCTION sandbox.create_sales_return_atomic(p_payload JSONB)
RETURNS JSONB AS $$
DECLARE
  v_invoice           RECORD;
  v_inv_item          RECORD;
  v_return_id         UUID;
  v_exchange_inv_id   UUID;
  v_exchange_inv_no   TEXT;
  v_return_type       TEXT;
  v_status            TEXT;
  v_settlement_type   TEXT;
  v_refund_amount     NUMERIC := 0;
  v_exchange_diff     NUMERIC := 0;
  v_ret_item          JSONB;
  v_repl_item         JSONB;
  v_ppc               INT;
  v_need              INT;
  v_avail             INT;
  v_item_total        NUMERIC;
BEGIN
  IF (p_payload->>'original_invoice_id') IS NULL THEN
    RETURN jsonb_build_object('ok',false,'step','validation','message','original_invoice_id required');
  END IF;

  SELECT * INTO v_invoice
  FROM sandbox.invoices
  WHERE id = (p_payload->>'original_invoice_id')::UUID
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'step','load_invoice','message','Invoice not found');
  END IF;

  v_return_type := COALESCE(p_payload->>'return_type','Return');

  FOR v_ret_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'returned_items','[]'::jsonb))
  LOOP
    IF (v_ret_item->>'invoice_item_id') IS NOT NULL THEN
      SELECT id INTO v_inv_item
      FROM sandbox.invoice_items
      WHERE id = (v_ret_item->>'invoice_item_id')::UUID
        AND invoice_id = v_invoice.id;

      IF NOT FOUND THEN
        RETURN jsonb_build_object('ok',false,'step','validate_return_items',
          'message','Item ' || (v_ret_item->>'invoice_item_id') || ' not on this invoice');
      END IF;
    END IF;
  END LOOP;

  FOR v_ret_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'returned_items','[]'::jsonb))
  LOOP
    SELECT GREATEST(pieces_per_carton,1) INTO v_ppc
    FROM sandbox.products WHERE id = (v_ret_item->>'product_id')::UUID;
    v_refund_amount := v_refund_amount
      + COALESCE((v_ret_item->>'unit_price')::NUMERIC,0)
        * (COALESCE((v_ret_item->>'return_cartons')::INT,0) * v_ppc
           + COALESCE((v_ret_item->>'return_pieces')::INT,0));
  END LOOP;

  IF v_return_type = 'Exchange' THEN
    v_exchange_diff   := COALESCE((p_payload->>'exchange_difference')::NUMERIC, 0);
    v_settlement_type := COALESCE(p_payload->>'settlement_type','EvenExchange');

    FOR v_repl_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'replacement_items','[]'::jsonb))
    LOOP
      SELECT GREATEST(pieces_per_carton,1) INTO v_ppc
      FROM sandbox.products WHERE id = (v_repl_item->>'product_id')::UUID;
      v_need  := COALESCE((v_repl_item->>'cartons')::INT,0) * v_ppc
               + COALESCE((v_repl_item->>'pieces')::INT,0);
      v_avail := sandbox.get_available_stock_pieces((v_repl_item->>'product_id')::UUID);

      IF v_avail < v_need THEN
        RETURN jsonb_build_object('ok',false,'step','validate_replacement_stock',
          'message','Insufficient stock for ' || COALESCE(v_repl_item->>'product_name','product'));
      END IF;
    END LOOP;

    FOR v_ret_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'returned_items','[]'::jsonb))
    LOOP
      PERFORM sandbox.restore_stock_pieces(
        (v_ret_item->>'product_id')::UUID,
        COALESCE((v_ret_item->>'return_cartons')::INT,0),
        COALESCE((v_ret_item->>'return_pieces')::INT,0),
        'Exchange return for ' || v_invoice.invoice_no
      );
    END LOOP;

    v_exchange_inv_no := 'EXC-' || to_char(now(), 'YYYYMMDDHH24MISS');

    INSERT INTO sandbox.invoices (invoice_no, customer_id, mode, subtotal, discount, total, payment_status, notes)
    VALUES (
      v_exchange_inv_no,
      v_invoice.customer_id,
      v_invoice.mode,
      ABS(v_exchange_diff),
      0,
      ABS(v_exchange_diff),
      CASE
        WHEN ABS(v_exchange_diff) <= 0.01 THEN 'paid'
        WHEN (p_payload->>'settlement_method') IS NOT NULL THEN 'paid'
        ELSE 'unpaid'
      END,
      'Exchange for ' || v_invoice.invoice_no
    )
    RETURNING id INTO v_exchange_inv_id;

    FOR v_repl_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'replacement_items','[]'::jsonb))
    LOOP
      SELECT GREATEST(pieces_per_carton,1) INTO v_ppc
      FROM sandbox.products WHERE id = (v_repl_item->>'product_id')::UUID;
      v_item_total := COALESCE((v_repl_item->>'unit_price')::NUMERIC,0)
                    * (COALESCE((v_repl_item->>'cartons')::INT,0) * v_ppc
                       + COALESCE((v_repl_item->>'pieces')::INT,0));

      INSERT INTO sandbox.invoice_items (invoice_id, product_id, cartons, pieces, unit_price, total)
      VALUES (
        v_exchange_inv_id,
        (v_repl_item->>'product_id')::UUID,
        COALESCE((v_repl_item->>'cartons')::INT,0),
        COALESCE((v_repl_item->>'pieces')::INT,0),
        COALESCE((v_repl_item->>'unit_price')::NUMERIC,0),
        v_item_total
      );

      PERFORM sandbox.deduct_stock_fifo(
        (v_repl_item->>'product_id')::UUID,
        COALESCE((v_repl_item->>'cartons')::INT,0) * v_ppc
          + COALESCE((v_repl_item->>'pieces')::INT,0)
      );
    END LOOP;

    IF ABS(v_exchange_diff) > 0.01 AND (p_payload->>'settlement_method') IS NOT NULL THEN
      INSERT INTO sandbox.payments (invoice_id, customer_id, amount, method, reference, paid_at)
      VALUES (
        v_exchange_inv_id,
        v_invoice.customer_id,
        v_exchange_diff,
        p_payload->>'settlement_method',
        v_exchange_inv_no,
        now()
      );
    END IF;

    v_status := 'Completed';

  ELSE
    v_status          := 'Pending';
    v_exchange_inv_id := NULL;
    v_exchange_inv_no := NULL;
    v_settlement_type := NULL;
    v_exchange_diff   := NULL;
  END IF;

  INSERT INTO sandbox.sales_returns (
    return_number, original_invoice_id, exchange_invoice_id, exchange_invoice_no,
    return_type, reason, status, settlement_type, exchange_difference,
    refund_amount, returned_by, workflow_snapshot
  )
  VALUES (
    COALESCE(p_payload->>'return_number','RET-' || to_char(now(),'YYYYMMDDHH24MISS')),
    v_invoice.id,
    v_exchange_inv_id,
    v_exchange_inv_no,
    v_return_type,
    COALESCE(p_payload->>'reason',''),
    v_status,
    v_settlement_type,
    v_exchange_diff,
    v_refund_amount,
    COALESCE(p_payload->>'returned_by_name',''),
    jsonb_build_object(
      'original_invoice', row_to_json(v_invoice),
      'exchange_invoice_id', v_exchange_inv_id,
      'returned_items', COALESCE(p_payload->'returned_items','[]'::jsonb),
      'replacement_items', COALESCE(p_payload->'replacement_items','[]'::jsonb),
      'snapshot_at', now()
    )
  )
  RETURNING id INTO v_return_id;

  FOR v_ret_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'returned_items','[]'::jsonb))
  LOOP
    SELECT GREATEST(pieces_per_carton,1) INTO v_ppc
    FROM sandbox.products WHERE id = (v_ret_item->>'product_id')::UUID;
    v_item_total := COALESCE((v_ret_item->>'unit_price')::NUMERIC,0)
                  * (COALESCE((v_ret_item->>'return_cartons')::INT,0) * v_ppc
                     + COALESCE((v_ret_item->>'return_pieces')::INT,0));

    INSERT INTO sandbox.sales_return_items (
      return_id, invoice_item_id, product_id, product_name,
      return_cartons, return_pieces, unit_price, total
    )
    VALUES (
      v_return_id,
      CASE WHEN (v_ret_item->>'invoice_item_id') IS NOT NULL
           THEN (v_ret_item->>'invoice_item_id')::UUID
           ELSE NULL END,
      (v_ret_item->>'product_id')::UUID,
      COALESCE(v_ret_item->>'product_name',''),
      COALESCE((v_ret_item->>'return_cartons')::INT,0),
      COALESCE((v_ret_item->>'return_pieces')::INT,0),
      COALESCE((v_ret_item->>'unit_price')::NUMERIC,0),
      v_item_total
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'return_id', v_return_id,
    'return_number', (SELECT return_number FROM sandbox.sales_returns WHERE id = v_return_id),
    'status', v_status,
    'exchange_invoice_no', v_exchange_inv_no
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok',false,'step','exception','message',SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = sandbox;

CREATE OR REPLACE FUNCTION sandbox.complete_sales_return(
  p_return_id       UUID,
  p_resolution_type TEXT,
  p_completed_by    TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_return RECORD;
  v_item   RECORD;
  v_ppc    INT;
  v_units  INT;
BEGIN
  SELECT * INTO v_return FROM sandbox.sales_returns WHERE id = p_return_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'message','Return not found');
  END IF;
  IF v_return.status != 'Pending' THEN
    RETURN jsonb_build_object('ok',false,'message','Return is not Pending');
  END IF;
  IF p_resolution_type NOT IN ('Repaired','Replaced') THEN
    RETURN jsonb_build_object('ok',false,'message','Invalid resolution type');
  END IF;

  FOR v_item IN
    SELECT sri.product_id, sri.return_cartons, sri.return_pieces,
           GREATEST(p.pieces_per_carton,1) AS ppc
    FROM   sandbox.sales_return_items sri
    JOIN   sandbox.products p ON p.id = sri.product_id
    WHERE  sri.return_id = p_return_id
  LOOP
    v_units := v_item.return_cartons * v_item.ppc + v_item.return_pieces;
    IF v_units > 0 THEN
      IF p_resolution_type = 'Repaired' THEN
        PERFORM sandbox.restore_stock_pieces(
          v_item.product_id, v_item.return_cartons, v_item.return_pieces,
          'Repaired return ' || v_return.return_number
        );
      ELSE
        PERFORM sandbox.deduct_stock_fifo(v_item.product_id, v_units);
      END IF;
    END IF;
  END LOOP;

  UPDATE sandbox.sales_returns
  SET status          = 'Completed',
      resolution_type = p_resolution_type,
      updated_at      = now()
  WHERE id = p_return_id;

  RETURN jsonb_build_object('ok',true,'return_number',v_return.return_number,'resolution',p_resolution_type);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok',false,'message',SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = sandbox;

CREATE OR REPLACE FUNCTION sandbox.undo_sales_return_atomic(
  p_return_id   UUID,
  p_undo_reason TEXT,
  p_undone_by   TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_return   RECORD;
  v_snapshot JSONB;
  v_item     JSONB;
  v_ppc      INT;
  v_units    INT;
BEGIN
  SELECT * INTO v_return FROM sandbox.sales_returns WHERE id = p_return_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'step','validation','message','Return not found');
  END IF;
  IF v_return.status = 'Cancelled' THEN
    RETURN jsonb_build_object('ok',false,'step','already_cancelled','message','Already cancelled');
  END IF;

  v_snapshot := v_return.workflow_snapshot;

  IF v_return.status = 'Pending' THEN
    UPDATE sandbox.sales_returns
    SET status='Cancelled', cancelled_at=now(), cancelled_by=p_undone_by,
        cancel_reason=p_undo_reason, updated_at=now()
    WHERE id = p_return_id;
    RETURN jsonb_build_object('ok',true,'step','completed','action','cancelled_pending');
  END IF;

  IF v_return.return_type = 'Exchange' AND v_return.exchange_invoice_id IS NOT NULL THEN
    DELETE FROM sandbox.invoices WHERE id = v_return.exchange_invoice_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_snapshot->'returned_items','[]'::jsonb))
    LOOP
      SELECT GREATEST(pieces_per_carton,1) INTO v_ppc
      FROM sandbox.products WHERE id = (v_item->>'product_id')::UUID;
      v_units := COALESCE((v_item->>'return_cartons')::INT,0) * v_ppc
               + COALESCE((v_item->>'return_pieces')::INT,0);
      IF v_units > 0 THEN
        PERFORM sandbox.deduct_stock_fifo((v_item->>'product_id')::UUID, v_units);
      END IF;
    END LOOP;

    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_snapshot->'replacement_items','[]'::jsonb))
    LOOP
      PERFORM sandbox.restore_stock_pieces(
        (v_item->>'product_id')::UUID,
        COALESCE((v_item->>'cartons')::INT,0),
        COALESCE((v_item->>'pieces')::INT,0),
        'Undo exchange ' || v_return.return_number
      );
    END LOOP;
  END IF;

  IF v_return.return_type = 'Return' AND v_return.resolution_type = 'Replaced' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_snapshot->'returned_items','[]'::jsonb))
    LOOP
      SELECT GREATEST(pieces_per_carton,1) INTO v_ppc
      FROM sandbox.products WHERE id = (v_item->>'product_id')::UUID;
      PERFORM sandbox.restore_stock_pieces(
        (v_item->>'product_id')::UUID,
        COALESCE((v_item->>'return_cartons')::INT,0),
        COALESCE((v_item->>'return_pieces')::INT,0),
        'Undo replaced return ' || v_return.return_number
      );
    END LOOP;
  END IF;

  IF v_return.return_type = 'Return' AND v_return.resolution_type = 'Repaired' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_snapshot->'returned_items','[]'::jsonb))
    LOOP
      SELECT GREATEST(pieces_per_carton,1) INTO v_ppc
      FROM sandbox.products WHERE id = (v_item->>'product_id')::UUID;
      v_units := COALESCE((v_item->>'return_cartons')::INT,0) * v_ppc
               + COALESCE((v_item->>'return_pieces')::INT,0);
      IF v_units > 0 THEN
        PERFORM sandbox.deduct_stock_fifo((v_item->>'product_id')::UUID, v_units);
      END IF;
    END LOOP;
  END IF;

  UPDATE sandbox.sales_returns
  SET status='Cancelled', cancelled_at=now(), cancelled_by=p_undone_by,
      cancel_reason=p_undo_reason, updated_at=now()
  WHERE id = p_return_id;

  RETURN jsonb_build_object('ok',true,'step','completed','action','undone');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok',false,'step','exception','message',SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = sandbox;

-- ────────────────────────────────────────────────────────────────
-- PART 10 — Grants for new tables and functions
-- ────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON sandbox.loyalty_transactions  TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON sandbox.sales_returns         TO anon, authenticated;
GRANT SELECT, INSERT         ON sandbox.sales_return_items    TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sandbox.salespeople   TO anon, authenticated;

GRANT EXECUTE ON FUNCTION sandbox.get_available_stock_pieces(UUID)           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sandbox.restore_stock_pieces(UUID,INT,INT,TEXT)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sandbox.create_sales_return_atomic(JSONB)          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sandbox.complete_sales_return(UUID,TEXT,TEXT)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sandbox.undo_sales_return_atomic(UUID,TEXT,TEXT)   TO anon, authenticated;

-- ================================================================
-- DONE. Sandbox is now in sync with production.
-- ================================================================
