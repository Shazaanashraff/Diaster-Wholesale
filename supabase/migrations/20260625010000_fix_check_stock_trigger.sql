-- ============================================================
-- FIX: check_stock_before_sale trigger double-counts deductions
--
-- Root cause:
--   The trigger computed available stock as:
--     sum(stock_batches) + adjustments - invoice_items_sold
--
--   But deduct_stock_fifo() directly reduces stock_batches rows
--   after every sale, so invoice_items_sold quantities are already
--   reflected in the batch totals. Subtracting them again produced
--   false-negative stock values (e.g. "Available: -4" when 8 units
--   were physically in stock).
--
-- Fix:
--   Available stock = sum(stock_batches) only.
--   Do NOT subtract invoice_items — that would double-count.
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_stock_before_sale()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    avail_pcs INT;
    req_pcs   INT;
    ppc       INT;
BEGIN
    SELECT pieces_per_carton INTO ppc FROM products WHERE id = NEW.product_id;
    req_pcs := (NEW.cartons * ppc) + NEW.pieces;

    -- stock_batches already reflect all prior FIFO deductions (deduct_stock_fifo
    -- updates/deletes batch rows directly). Summing them gives the true
    -- available quantity — no need to subtract invoice_items separately.
    SELECT COALESCE(SUM(sb.cartons * ppc + sb.loose_pieces), 0)
    INTO avail_pcs
    FROM stock_batches sb
    WHERE sb.product_id = NEW.product_id;

    IF req_pcs > avail_pcs THEN
        RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', avail_pcs, req_pcs;
    END IF;

    RETURN NEW;
END;
$$;
