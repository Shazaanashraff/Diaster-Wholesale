-- ================================================================
-- FIX: Completing a supplier return failed with
--   column "notes" of relation "stock_adjustments" does not exist
--
-- Root cause: the legacy AFTER UPDATE trigger (trg_supplier_return_trigger →
-- trg_supplier_return_complete) from 20260506100000 inserts into
-- stock_adjustments(notes), a column that table never had. It also reads
-- the old quantity_units/quantity_cartons columns.
--
-- Fix: drop every legacy return-completion trigger/function and install the
-- single current handler (item_type / quantity / unit_value_lkr schema),
-- stamping location_id so per-location stock stays correct.
-- Idempotent.
-- ================================================================

DROP TRIGGER IF EXISTS trg_supplier_return_trigger ON public.supplier_returns;
DROP TRIGGER IF EXISTS trg_supplier_return_complete ON public.supplier_returns;
DROP FUNCTION IF EXISTS public.trg_supplier_return_complete();

CREATE OR REPLACE FUNCTION public.handle_supplier_return_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_loc UUID;
BEGIN
  IF OLD.status <> 'completed' AND NEW.status = 'completed' THEN
    -- Stock leaves from / returns to the purchase's location, else the main warehouse
    SELECT p.location_id INTO v_loc FROM public.purchases p WHERE p.id = NEW.purchase_id;
    IF v_loc IS NULL THEN
      SELECT id INTO v_loc FROM public.locations
      WHERE type = 'warehouse' ORDER BY created_at LIMIT 1;
    END IF;

    -- Returned items leave stock
    INSERT INTO public.stock_adjustments (product_id, adjustment_pieces, reason, adjusted_by, location_id)
    SELECT sri.product_id, -(sri.quantity), 'Supplier Return: ' || NEW.reference, 'System', v_loc
    FROM public.supplier_return_items sri
    WHERE sri.return_id = NEW.id AND sri.item_type = 'return';

    -- Replacement items enter stock
    INSERT INTO public.stock_batches (product_id, cartons, loose_pieces, cost_per_piece, notes, location_id)
    SELECT sri.product_id, 0, sri.quantity, sri.unit_value_lkr,
           'Supplier Exchange Replacement: ' || NEW.reference, v_loc
    FROM public.supplier_return_items sri
    WHERE sri.return_id = NEW.id AND sri.item_type = 'replacement';

    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_supplier_return_complete
  BEFORE UPDATE ON public.supplier_returns
  FOR EACH ROW EXECUTE FUNCTION public.handle_supplier_return_complete();
