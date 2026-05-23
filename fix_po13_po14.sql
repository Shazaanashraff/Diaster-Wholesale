-- ================================================================
-- RESTORE: PO0013 and PO0014 — Recreate products, items & stock
-- 
-- Products accidentally deleted by fix_and_cleanup_purchases.sql:
--   PO0013 → ONLY CUP 6PCS 220CC | 150 CTN × 20 PCS = 3000 units
--   PO0014 → ONLY CUP 6PCS 160CC | 125 CTN × 24 PCS = 3000 units
--
-- RUN IN ORDER — each block is safe to re-run (uses ON CONFLICT)
-- ================================================================

DO $$
DECLARE
  v_prod_220cc UUID;
  v_prod_160cc UUID;
  v_po13_id    UUID;
  v_po14_id    UUID;
BEGIN

  -- ── STEP 1: Get PO IDs ───────────────────────────────────────
  SELECT id INTO v_po13_id FROM public.purchases WHERE reference = 'PO0013';
  SELECT id INTO v_po14_id FROM public.purchases WHERE reference = 'PO0014';

  IF v_po13_id IS NULL THEN RAISE EXCEPTION 'PO0013 not found'; END IF;
  IF v_po14_id IS NULL THEN RAISE EXCEPTION 'PO0014 not found'; END IF;

  -- ── STEP 2: Recreate product — ONLY CUP 6PCS 220CC ──────────
  -- Check if it already exists by item_code or name
  SELECT id INTO v_prod_220cc
  FROM public.products
  WHERE item_code = '181465' OR name = 'ONLY CUP 6PCS 220CC'
  LIMIT 1;

  IF v_prod_220cc IS NULL THEN
    INSERT INTO public.products (
      item_code,
      name,
      model,
      category,
      pieces_per_carton,
      wholesale_price,   -- ⚠ Update this to the correct selling price
      retail_price,      -- ⚠ Update this to the correct retail price
      cost_price,        -- Computed: 133920000 LKR / 3000 units
      reorder_level,
      description
    ) VALUES (
      '181465',
      'ONLY CUP 6PCS 220CC',
      '220CC',
      'general',
      20,                -- 20 pieces per carton
      44640.00,          -- placeholder: cost price (update if different)
      44640.00,          -- placeholder: retail price (update if different)
      44640.00,          -- 133920000 / 3000 = LKR 44,640 per unit
      50,
      '220cc cups, 6-piece set, 20pcs per carton'
    )
    RETURNING id INTO v_prod_220cc;
    RAISE NOTICE 'Created product ONLY CUP 6PCS 220CC with id: %', v_prod_220cc;
  ELSE
    -- Update pieces_per_carton and cost_price to be sure
    UPDATE public.products
    SET
      pieces_per_carton = 20,
      cost_price        = 44640.00,
      item_code         = '181465'
    WHERE id = v_prod_220cc;
    RAISE NOTICE 'Product ONLY CUP 6PCS 220CC already exists: %', v_prod_220cc;
  END IF;

  -- ── STEP 3: Recreate product — ONLY CUP 6PCS 160CC ──────────
  SELECT id INTO v_prod_160cc
  FROM public.products
  WHERE item_code = '913184' OR name = 'ONLY CUP 6PCS 160CC'
  LIMIT 1;

  IF v_prod_160cc IS NULL THEN
    INSERT INTO public.products (
      item_code,
      name,
      model,
      category,
      pieces_per_carton,
      wholesale_price,
      retail_price,
      cost_price,
      reorder_level,
      description
    ) VALUES (
      '913184',
      'ONLY CUP 6PCS 160CC',
      '160CC',
      'general',
      24,                -- 24 pieces per carton
      32640.00,          -- placeholder: cost price (update if different)
      32640.00,          -- placeholder: retail price (update if different)
      32640.00,          -- 97920000 / 3000 = LKR 32,640 per unit
      50,
      '160cc cups, 6-piece set, 24pcs per carton'
    )
    RETURNING id INTO v_prod_160cc;
    RAISE NOTICE 'Created product ONLY CUP 6PCS 160CC with id: %', v_prod_160cc;
  ELSE
    UPDATE public.products
    SET
      pieces_per_carton = 24,
      cost_price        = 32640.00,
      item_code         = '913184'
    WHERE id = v_prod_160cc;
    RAISE NOTICE 'Product ONLY CUP 6PCS 160CC already exists: %', v_prod_160cc;
  END IF;

  -- ── STEP 4: Restore purchase_items for PO0013 ────────────────
  -- Delete any stale items first (safety)
  DELETE FROM public.purchase_items WHERE purchase_id = v_po13_id;

  INSERT INTO public.purchase_items (
    purchase_id,
    product_id,
    quantity_units,    -- total pieces: 3000
    quantity_cartons,  -- 150 cartons
    unit_price_rmb,    -- 2790000 / 3000 = RMB 930 per unit
    discount_percent
  ) VALUES (
    v_po13_id,
    v_prod_220cc,
    3000,
    150,
    930.00,
    0
  );
  RAISE NOTICE 'Restored purchase_items for PO0013';

  -- ── STEP 5: Restore purchase_items for PO0014 ────────────────
  DELETE FROM public.purchase_items WHERE purchase_id = v_po14_id;

  INSERT INTO public.purchase_items (
    purchase_id,
    product_id,
    quantity_units,    -- total pieces: 3000
    quantity_cartons,  -- 125 cartons
    unit_price_rmb,    -- 2040000 / 3000 = RMB 680 per unit
    discount_percent
  ) VALUES (
    v_po14_id,
    v_prod_160cc,
    3000,
    125,
    680.00,
    0
  );
  RAISE NOTICE 'Restored purchase_items for PO0014';

  -- ── STEP 6: Restore purchase_receive for PO0013 ──────────────
  -- Only insert if no receive record exists yet
  IF NOT EXISTS (SELECT 1 FROM public.purchase_receive WHERE purchase_id = v_po13_id) THEN
    INSERT INTO public.purchase_receive (
      purchase_id,
      product_id,
      ordered_units,
      received_units,
      damaged_units,
      notes
    ) VALUES (
      v_po13_id,
      v_prod_220cc,
      3000,  -- ordered
      3000,  -- received (adjust if actual received qty differs)
      0,     -- damaged (adjust if any were damaged)
      'Restored: 150 CTN x 20 PCS = 3000 units'
    );
    RAISE NOTICE 'Restored purchase_receive for PO0013';
  ELSE
    RAISE NOTICE 'purchase_receive for PO0013 already exists — skipped';
  END IF;

  -- ── STEP 7: Restore purchase_receive for PO0014 ──────────────
  IF NOT EXISTS (SELECT 1 FROM public.purchase_receive WHERE purchase_id = v_po14_id) THEN
    INSERT INTO public.purchase_receive (
      purchase_id,
      product_id,
      ordered_units,
      received_units,
      damaged_units,
      notes
    ) VALUES (
      v_po14_id,
      v_prod_160cc,
      3000,
      3000,  -- received (adjust if actual received qty differs)
      0,
      'Restored: 125 CTN x 24 PCS = 3000 units'
    );
    RAISE NOTICE 'Restored purchase_receive for PO0014';
  ELSE
    RAISE NOTICE 'purchase_receive for PO0014 already exists — skipped';
  END IF;

  -- ── STEP 8: Restore stock_batches (what shows in inventory/POS)
  -- ⚠ If units have already been sold from physical stock since the
  --   POs were received, adjust the cartons/loose_pieces below.
  --   Currently restores FULL received quantity.

  -- PO0013: 3000 units = 150 cartons × 20 pcs (no loose)
  IF NOT EXISTS (
    SELECT 1 FROM public.stock_batches
    WHERE product_id = v_prod_220cc AND notes LIKE '%PO0013%'
  ) THEN
    INSERT INTO public.stock_batches (product_id, cartons, loose_pieces, cost_per_piece, notes, received_at, location_id)
    VALUES (
      v_prod_220cc,
      150,
      0,
      44640.00,
      'Received from PO: PO0013',
      now(),
      (SELECT id FROM public.locations WHERE type = 'shop' ORDER BY created_at LIMIT 1)
    );
    RAISE NOTICE 'Restored stock_batches for PO0013 (220CC cups)';
  ELSE
    RAISE NOTICE 'stock_batches for PO0013 already exists — skipped';
  END IF;

  -- PO0014: 3000 units = 125 cartons × 24 pcs (no loose)
  IF NOT EXISTS (
    SELECT 1 FROM public.stock_batches
    WHERE product_id = v_prod_160cc AND notes LIKE '%PO0014%'
  ) THEN
    INSERT INTO public.stock_batches (product_id, cartons, loose_pieces, cost_per_piece, notes, received_at, location_id)
    VALUES (
      v_prod_160cc,
      125,
      0,
      32640.00,
      'Received from PO: PO0014',
      now(),
      (SELECT id FROM public.locations WHERE type = 'shop' ORDER BY created_at LIMIT 1)
    );
    RAISE NOTICE 'Restored stock_batches for PO0014 (160CC cups)';
  ELSE
    RAISE NOTICE 'stock_batches for PO0014 already exists — skipped';
  END IF;

  RAISE NOTICE '✅ Restore complete for PO0013 and PO0014';
END $$;

-- ================================================================
-- VERIFY: Run these after the block above to confirm everything
-- ================================================================

-- 1. Purchase items restored?
SELECT pu.reference, prod.name, pi.quantity_units, pi.quantity_cartons, pi.unit_price_rmb
FROM public.purchase_items pi
JOIN public.purchases pu ON pu.id = pi.purchase_id
JOIN public.products prod ON prod.id = pi.product_id
WHERE pu.reference IN ('PO0013', 'PO0014')
ORDER BY pu.reference;

-- 2. Stock visible in product_stock view (what inventory page reads)?
SELECT
  ps.name,
  ps.item_code,
  ps.pieces_per_carton,
  ps.cartons_in,
  ps.pieces_in,
  ps.cartons_sold,
  ps.pieces_sold,
  (ps.cartons_in - ps.cartons_sold + ps.carton_adj) * ps.pieces_per_carton
    + (ps.pieces_in - ps.pieces_sold + ps.piece_adj) AS available_units,
  ps.wholesale_price,
  ps.retail_price
FROM public.product_stock ps
WHERE ps.name IN ('ONLY CUP 6PCS 220CC', 'ONLY CUP 6PCS 160CC')
ORDER BY ps.name;
