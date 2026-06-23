-- ================================================================
-- 1. original_units on stock_batches
--    Preserves the quantity a batch was created with so the stock
--    history always shows the original received/transferred amount
--    even after FIFO deductions modify cartons/loose_pieces.
-- ================================================================

ALTER TABLE public.stock_batches
  ADD COLUMN IF NOT EXISTS original_units INT;

-- Trigger: stamp original_units = cartons * ppc + loose_pieces at INSERT time.
-- Never touched on UPDATE — preserves the historical value forever.
CREATE OR REPLACE FUNCTION public.set_stock_batch_original_units()
RETURNS TRIGGER AS $$
DECLARE
  v_ppc INT;
BEGIN
  SELECT GREATEST(COALESCE(pieces_per_carton, 1), 1)
    INTO v_ppc
    FROM public.products
   WHERE id = NEW.product_id;

  NEW.original_units := COALESCE(NEW.cartons, 0) * v_ppc + COALESCE(NEW.loose_pieces, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_batch_original_units ON public.stock_batches;
CREATE TRIGGER trg_set_batch_original_units
  BEFORE INSERT ON public.stock_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_stock_batch_original_units();

-- ── Backfill Step 1: PO-received batches — most accurate source ──────────────
-- Join via the "Received from PO: <reference>" note pattern.
UPDATE public.stock_batches sb
SET original_units = (
  SELECT GREATEST(0, pr.received_units - COALESCE(pr.damaged_units, 0))
  FROM   public.purchases pu
  JOIN   public.purchase_receive pr
         ON  pr.purchase_id = pu.id
         AND pr.product_id  = sb.product_id
  WHERE  sb.notes = 'Received from PO: ' || pu.reference
  LIMIT  1
)
WHERE sb.original_units IS NULL
  AND sb.notes LIKE 'Received from PO: %';

-- ── Backfill Step 2: all remaining batches — use current cartons/pieces ───────
-- For transfer-in batches that have NOT yet been deducted this is exact.
-- For already-depleted batches the backfill will be conservative (≥ reality),
-- which is still better than showing a post-sale remainder as the received qty.
UPDATE public.stock_batches sb
SET original_units = sb.cartons * GREATEST(COALESCE(p.pieces_per_carton, 1), 1)
                   + sb.loose_pieces
FROM   public.products p
WHERE  p.id = sb.product_id
  AND  sb.original_units IS NULL;

-- ================================================================
-- 2. salesperson_id on sales_returns
--    Lets staff record which salesperson processed a return or
--    exchange (mirrors the invoices.salesperson_id pattern).
-- ================================================================

ALTER TABLE public.sales_returns
  ADD COLUMN IF NOT EXISTS salesperson_id UUID
    REFERENCES public.salespeople(id) ON DELETE SET NULL;
