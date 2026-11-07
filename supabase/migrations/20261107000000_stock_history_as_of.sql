-- Stock "as of a date" for the Current Stock Report and Stock Valuation report.
--
-- Today's stock is a pile of mutable batches (FIFO sales shrink or DELETE them), so it cannot say
-- what was on hand on a past day. This adds a permanent, append-only movement history and a
-- function that rewinds today's stock by every movement made after the chosen date.
--
--   stock_movements    one signed row per stock change (product, location, +/- pieces, when).
--     source='trigger'   written by triggers on stock_batches + stock_adjustments for EVERY change
--                        from go-live onward (purchase receipts, FIFO sales, returns, cancels,
--                        transfers, manual adjustments, supplier returns...).
--     source='backfill'  rebuilt from existing records (purchase receipts, transfers, invoices,
--                        returns, adjustments) for everything BEFORE go-live.
--   stock_cost_history unit cost per product over time (so valuation can use the cost that applied
--                      on the date, even after the batch itself has been used up and deleted).
--   get_stock_as_of    current stock - SUM(movements after the date), per product + location.
--
-- Run once on the live project. backfill_stock_movements() is idempotent and can be re-run.

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id  UUID NOT NULL,
  location_id UUID,
  units       INT  NOT NULL,                       -- signed pieces
  source      TEXT NOT NULL DEFAULT 'trigger' CHECK (source IN ('trigger', 'backfill')),
  movement    TEXT,
  ref_table   TEXT,
  ref_id      UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- No foreign keys on purpose: products/locations get deleted and history must never block that.
CREATE INDEX IF NOT EXISTS idx_stock_movements_when ON public.stock_movements (occurred_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_key  ON public.stock_movements (product_id, location_id, occurred_at);

CREATE TABLE IF NOT EXISTS public.stock_cost_history (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id   UUID NOT NULL,
  unit_cost    NUMERIC(14,4) NOT NULL CHECK (unit_cost > 0),
  effective_at TIMESTAMPTZ NOT NULL,
  source       TEXT NOT NULL DEFAULT 'trigger' CHECK (source IN ('trigger', 'backfill'))
);
CREATE INDEX IF NOT EXISTS idx_stock_cost_history_key ON public.stock_cost_history (product_id, effective_at);

CREATE TABLE IF NOT EXISTS public.stock_movements_meta (
  key   TEXT PRIMARY KEY,
  value TIMESTAMPTZ NOT NULL
);
INSERT INTO public.stock_movements_meta (key, value) VALUES ('go_live', now()) ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.stock_movements      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_cost_history   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements_meta DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.default_warehouse_id()
RETURNS UUID LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT id FROM public.locations WHERE type = 'warehouse' ORDER BY created_at LIMIT 1;
$$;

-- ── Trigger: stock_batches (receipts, FIFO sales, restocks, transfers-in) ────
CREATE OR REPLACE FUNCTION public.trg_stock_batches_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_ppc     INT;
  v_old     INT := 0;
  v_new     INT := 0;
  v_old_loc UUID;
  v_new_loc UUID;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT GREATEST(COALESCE(pieces_per_carton, 1), 1) INTO v_ppc FROM public.products WHERE id = OLD.product_id;
    v_ppc := COALESCE(v_ppc, 1);
    v_old := COALESCE(OLD.cartons, 0) * v_ppc + COALESCE(OLD.loose_pieces, 0);
    v_old_loc := COALESCE(OLD.location_id, public.default_warehouse_id());
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT GREATEST(COALESCE(pieces_per_carton, 1), 1) INTO v_ppc FROM public.products WHERE id = NEW.product_id;
    v_ppc := COALESCE(v_ppc, 1);
    v_new := COALESCE(NEW.cartons, 0) * v_ppc + COALESCE(NEW.loose_pieces, 0);
    v_new_loc := COALESCE(NEW.location_id, public.default_warehouse_id());
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.product_id = OLD.product_id AND v_new_loc IS NOT DISTINCT FROM v_old_loc THEN
    IF v_new <> v_old THEN
      INSERT INTO public.stock_movements (product_id, location_id, units, source, movement, ref_table, ref_id)
      VALUES (NEW.product_id, v_new_loc, v_new - v_old, 'trigger', 'batch_change', 'stock_batches', NEW.id);
    END IF;
  ELSE
    IF TG_OP IN ('UPDATE', 'DELETE') AND v_old <> 0 THEN
      INSERT INTO public.stock_movements (product_id, location_id, units, source, movement, ref_table, ref_id)
      VALUES (OLD.product_id, v_old_loc, -v_old, 'trigger', 'batch_out', 'stock_batches', OLD.id);
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') AND v_new <> 0 THEN
      INSERT INTO public.stock_movements (product_id, location_id, units, source, movement, ref_table, ref_id)
      VALUES (NEW.product_id, v_new_loc, v_new, 'trigger', 'batch_in', 'stock_batches', NEW.id);
    END IF;
  END IF;

  -- Remember what each received batch cost (batches are deleted when used up).
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.cost_per_piece, 0) > 0 THEN
      INSERT INTO public.stock_cost_history (product_id, unit_cost, effective_at, source)
      VALUES (NEW.product_id, NEW.cost_per_piece, COALESCE(NEW.received_at, now()), 'trigger');
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_stock_batches_movement ON public.stock_batches;
CREATE TRIGGER trg_stock_batches_movement
AFTER INSERT OR UPDATE OR DELETE ON public.stock_batches
FOR EACH ROW EXECUTE FUNCTION public.trg_stock_batches_movement();

-- ── Trigger: stock_adjustments (manual +/-, transfer-out, supplier returns, damage) ──
CREATE OR REPLACE FUNCTION public.trg_stock_adjustments_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_old_loc UUID;
  v_new_loc UUID;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN v_old_loc := COALESCE(OLD.location_id, public.default_warehouse_id()); END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN v_new_loc := COALESCE(NEW.location_id, public.default_warehouse_id()); END IF;

  IF TG_OP = 'UPDATE' AND NEW.product_id = OLD.product_id AND v_new_loc IS NOT DISTINCT FROM v_old_loc THEN
    IF COALESCE(NEW.adjustment_pieces, 0) <> COALESCE(OLD.adjustment_pieces, 0) THEN
      INSERT INTO public.stock_movements (product_id, location_id, units, source, movement, ref_table, ref_id)
      VALUES (NEW.product_id, v_new_loc, COALESCE(NEW.adjustment_pieces, 0) - COALESCE(OLD.adjustment_pieces, 0), 'trigger', 'adjustment', 'stock_adjustments', NEW.id);
    END IF;
  ELSE
    IF TG_OP IN ('UPDATE', 'DELETE') AND COALESCE(OLD.adjustment_pieces, 0) <> 0 THEN
      INSERT INTO public.stock_movements (product_id, location_id, units, source, movement, ref_table, ref_id)
      VALUES (OLD.product_id, v_old_loc, -COALESCE(OLD.adjustment_pieces, 0), 'trigger', 'adjustment', 'stock_adjustments', OLD.id);
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') AND COALESCE(NEW.adjustment_pieces, 0) <> 0 THEN
      INSERT INTO public.stock_movements (product_id, location_id, units, source, movement, ref_table, ref_id)
      VALUES (NEW.product_id, v_new_loc, COALESCE(NEW.adjustment_pieces, 0), 'trigger', 'adjustment', 'stock_adjustments', NEW.id);
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_stock_adjustments_movement ON public.stock_adjustments;
CREATE TRIGGER trg_stock_adjustments_movement
AFTER INSERT OR UPDATE OR DELETE ON public.stock_adjustments
FOR EACH ROW EXECUTE FUNCTION public.trg_stock_adjustments_movement();

-- ── Backfill: rebuild pre-go-live movements from the records that exist ──────
-- Sources (each dated by its own timestamp, only rows BEFORE go-live):
--   purchase receipts   + (received - damaged)           into the purchase's location
--   completed transfers + qty                            into the destination (the OUT side is a
--                                                        stock_adjustments row, covered below)
--   customer returns    + pieces                         back into the default warehouse
--   invoice sales       - pieces (positive lines only)   from the shop (batch's location if known)
--   adjustments         +/- pieces
-- Cancelled invoices are skipped (sale and restock cancel out). Exchange credit lines (negative
-- unit_price) are skipped: the matching restock is the customer-return row above.
CREATE OR REPLACE FUNCTION public.backfill_stock_movements()
RETURNS INT AS $$
DECLARE
  v_go_live TIMESTAMPTZ;
  v_shop    UUID;
  v_rows    INT := 0;
  v_n       INT;
BEGIN
  SELECT value INTO v_go_live FROM public.stock_movements_meta WHERE key = 'go_live';
  SELECT id INTO v_shop FROM public.locations WHERE type = 'shop' ORDER BY created_at LIMIT 1;

  DELETE FROM public.stock_movements  WHERE source = 'backfill';
  DELETE FROM public.stock_cost_history WHERE source = 'backfill';

  -- Purchase receipts
  INSERT INTO public.stock_movements (product_id, location_id, units, source, movement, ref_table, ref_id, occurred_at)
  SELECT pr.product_id,
         COALESCE(pu.location_id, public.default_warehouse_id()),
         GREATEST(0, COALESCE(pr.received_units, 0) - COALESCE(pr.damaged_units, 0)),
         'backfill', 'purchase_receipt', 'purchase_receive', pr.id,
         COALESCE(pr.received_at, pu.updated_at, pu.created_at)
  FROM public.purchase_receive pr
  JOIN public.purchases pu ON pu.id = pr.purchase_id
  WHERE pu.status IN ('received', 'completed')
    AND COALESCE(pr.received_at, pu.updated_at, pu.created_at) < v_go_live
    AND GREATEST(0, COALESCE(pr.received_units, 0) - COALESCE(pr.damaged_units, 0)) > 0;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rows := v_rows + v_n;

  -- Completed transfers (destination side)
  INSERT INTO public.stock_movements (product_id, location_id, units, source, movement, ref_table, ref_id, occurred_at)
  SELECT ti.product_id, t.to_location_id, ti.quantity,
         'backfill', 'transfer_in', 'stock_transfer_items', ti.id,
         COALESCE(t.completed_at, t.created_at)
  FROM public.stock_transfer_items ti
  JOIN public.stock_transfers t ON t.id = ti.transfer_id
  WHERE t.status = 'completed'
    AND COALESCE(t.completed_at, t.created_at) < v_go_live
    AND ti.quantity > 0;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rows := v_rows + v_n;

  -- Customer returns / exchange returns (restocked)
  INSERT INTO public.stock_movements (product_id, location_id, units, source, movement, ref_table, ref_id, occurred_at)
  SELECT ri.product_id,
         public.default_warehouse_id(),
         COALESCE(ri.return_cartons, 0) * GREATEST(COALESCE(p.pieces_per_carton, 1), 1) + COALESCE(ri.return_pieces, 0),
         'backfill', 'customer_return', 'sales_return_items', ri.id, r.created_at
  FROM public.sales_return_items ri
  JOIN public.sales_returns r ON r.id = ri.return_id
  JOIN public.products p ON p.id = ri.product_id
  WHERE r.status <> 'Cancelled'
    AND r.created_at < v_go_live
    AND COALESCE(ri.return_cartons, 0) * GREATEST(COALESCE(p.pieces_per_carton, 1), 1) + COALESCE(ri.return_pieces, 0) > 0;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rows := v_rows + v_n;

  -- Invoice sales (stock leaves the shop)
  INSERT INTO public.stock_movements (product_id, location_id, units, source, movement, ref_table, ref_id, occurred_at)
  SELECT ii.product_id,
         COALESCE(sb.location_id, v_shop, public.default_warehouse_id()),
         -(COALESCE(ii.cartons, 0) * GREATEST(COALESCE(p.pieces_per_carton, 1), 1) + COALESCE(ii.pieces, 0)),
         'backfill', 'sale', 'invoice_items', ii.id, inv.created_at
  FROM public.invoice_items ii
  JOIN public.invoices inv ON inv.id = ii.invoice_id
  JOIN public.products p ON p.id = ii.product_id
  LEFT JOIN public.stock_batches sb ON sb.id = ii.batch_id
  WHERE inv.payment_status <> 'cancelled'
    AND ii.unit_price >= 0
    AND inv.created_at < v_go_live
    AND COALESCE(ii.cartons, 0) * GREATEST(COALESCE(p.pieces_per_carton, 1), 1) + COALESCE(ii.pieces, 0) > 0;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rows := v_rows + v_n;

  -- Adjustments (manual, transfer-out, supplier returns, damage)
  INSERT INTO public.stock_movements (product_id, location_id, units, source, movement, ref_table, ref_id, occurred_at)
  SELECT sa.product_id, COALESCE(sa.location_id, public.default_warehouse_id()), sa.adjustment_pieces,
         'backfill', 'adjustment', 'stock_adjustments', sa.id, sa.created_at
  FROM public.stock_adjustments sa
  WHERE sa.created_at < v_go_live
    AND COALESCE(sa.adjustment_pieces, 0) <> 0;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rows := v_rows + v_n;

  -- Costs we can still see: every surviving batch with a real cost.
  INSERT INTO public.stock_cost_history (product_id, unit_cost, effective_at, source)
  SELECT sb.product_id, sb.cost_per_piece, COALESCE(sb.received_at, sb.created_at), 'backfill'
  FROM public.stock_batches sb
  WHERE COALESCE(sb.cost_per_piece, 0) > 0
    AND COALESCE(sb.received_at, sb.created_at) < v_go_live;

  RETURN v_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

SELECT public.backfill_stock_movements();

-- ── Stock + valuation as of the END of a given moment ────────────────────────
-- Flat rows, one per product + location. p_as_of: end of the chosen day.
CREATE OR REPLACE FUNCTION public.get_stock_as_of(p_as_of TIMESTAMPTZ)
RETURNS TABLE (
  product_id        UUID,
  name              TEXT,
  item_code         TEXT,
  pieces_per_carton INT,
  location_id       UUID,
  location_name     TEXT,
  location_type     TEXT,
  units             BIGINT,
  unit_cost         NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH later AS (
    SELECT sm.product_id, sm.location_id, SUM(sm.units)::BIGINT AS delta
    FROM public.stock_movements sm
    WHERE sm.occurred_at > p_as_of AND sm.location_id IS NOT NULL
    GROUP BY sm.product_id, sm.location_id
  ),
  merged AS (
    SELECT COALESCE(n.product_id, l.product_id)   AS product_id,
           COALESCE(n.location_id, l.location_id) AS location_id,
           COALESCE(n.total_units, 0)::BIGINT - COALESCE(l.delta, 0) AS units
    FROM public.product_stock_by_location n
    FULL JOIN later l ON l.product_id = n.product_id AND l.location_id = n.location_id
  )
  SELECT
    p.id, p.name, p.item_code, p.pieces_per_carton,
    m.location_id, loc.name, loc.type,
    GREATEST(m.units, 0)::BIGINT,
    -- Cost that applied on the date: last recorded batch cost on/before it, else the earliest one
    -- after it, else the product's own cost.
    COALESCE(
      (SELECT ch.unit_cost FROM public.stock_cost_history ch
        WHERE ch.product_id = p.id AND ch.effective_at <= p_as_of
        ORDER BY ch.effective_at DESC LIMIT 1),
      (SELECT ch.unit_cost FROM public.stock_cost_history ch
        WHERE ch.product_id = p.id AND ch.effective_at > p_as_of
        ORDER BY ch.effective_at ASC LIMIT 1),
      NULLIF(p.cost_price, 0),
      0
    )::NUMERIC
  FROM merged m
  JOIN public.products p ON p.id = m.product_id AND p.is_active = true
  JOIN public.locations loc ON loc.id = m.location_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_stock_as_of(TIMESTAMPTZ) TO anon, authenticated;

-- ── Coverage check (run manually) ────────────────────────────────────────────
-- Where recorded movements do not add up to today's stock (opening stock from before any record,
-- or a stock change no record captured):
--
--   SELECT n.product_id, n.location_id, n.total_units AS stock_now,
--          COALESCE(m.recorded, 0) AS recorded_movements,
--          n.total_units - COALESCE(m.recorded, 0) AS unexplained
--   FROM public.product_stock_by_location n
--   LEFT JOIN (SELECT product_id, location_id, SUM(units) AS recorded FROM public.stock_movements GROUP BY 1, 2) m
--     ON m.product_id = n.product_id AND m.location_id = n.location_id
--   WHERE n.total_units <> COALESCE(m.recorded, 0)
--   ORDER BY abs(n.total_units - COALESCE(m.recorded, 0)) DESC;
