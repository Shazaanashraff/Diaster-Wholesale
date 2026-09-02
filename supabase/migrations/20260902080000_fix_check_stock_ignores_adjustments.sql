-- ============================================================
-- FIX: check_stock_before_sale ignores stock_adjustments, causing
-- false "Insufficient stock" rejections at checkout.
--
-- Root cause:
--   The cashier-facing stock (the `shop_stock` view, which POS uses
--   both to list sellable products and to pre-validate the cart in
--   validateStock()) counts a product's available stock as:
--     stock_batches (shop-type location) + stock_adjustments (shop-type location)
--
--   Stock regularly reaches the shop only via a stock_adjustments row
--   — e.g. the "initial quantity" entered when a product is created,
--   or a manual correction on the Inventory page — with no matching
--   stock_batches row at all.
--
--   check_stock_before_sale (the BEFORE INSERT trigger on
--   invoice_items that actually gates checkout) only summed
--   stock_batches and never looked at stock_adjustments, and it did
--   not restrict to the shop location either. So a product the
--   cashier could see with plenty of stock (via shop_stock) would be
--   rejected at checkout with "Insufficient stock. Available: 0,
--   Requested: N" the moment its stock came from an adjustment.
--
-- Fix:
--   Compute available stock exactly the way shop_stock does: batches
--   plus adjustments, both restricted to locations of type 'shop'.
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
    ppc := COALESCE(ppc, 1);
    req_pcs := (NEW.cartons * ppc) + NEW.pieces;

    SELECT
        COALESCE((
            SELECT SUM(sb.cartons * ppc + sb.loose_pieces)
            FROM stock_batches sb
            JOIN locations l ON l.id = sb.location_id
            WHERE sb.product_id = NEW.product_id
              AND l.type = 'shop'
        ), 0)
        +
        COALESCE((
            SELECT SUM(sa.adjustment_pieces)
            FROM stock_adjustments sa
            JOIN locations l ON l.id = sa.location_id
            WHERE sa.product_id = NEW.product_id
              AND l.type = 'shop'
        ), 0)
    INTO avail_pcs;

    IF req_pcs > avail_pcs THEN
        RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', avail_pcs, req_pcs;
    END IF;

    RETURN NEW;
END;
$$;
