-- Migration: Add delete_product_cascade function and audit table
-- Creates a function that previews affected row counts and optionally performs a transactional cascade delete

-- Audit table for deletions
CREATE TABLE IF NOT EXISTS product_deletion_audit (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL,
  deleted_by uuid NULL,
  deleted_at timestamptz DEFAULT now(),
  counts jsonb
);

-- Function: preview or perform cascaded delete of a product and its linked rows
CREATE OR REPLACE FUNCTION public.delete_product_cascade(
  product_id uuid,
  dry_run boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  tbl text;
  v_count bigint;
  result jsonb := '{}'::jsonb;
  tables text[] := ARRAY[
    'invoice_items',
    'sales_return_items',
    'returns',
    'supplier_return_items',
    'purchase_items',
    'purchase_receive',
    'stock_transfer_items',
    'cartons',
    'stock_batches',
    'stock_adjustments'
  ];
BEGIN
  -- Compute counts for each linked table
  FOREACH tbl IN ARRAY tables LOOP
    -- Skip tables that do not exist in this database to make the function safe across variants
    IF to_regclass(tbl) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM %I WHERE product_id = $1', tbl) INTO v_count USING product_id;
      result := result || jsonb_build_object(tbl, v_count);
    ELSE
      result := result || jsonb_build_object(tbl, NULL);
    END IF;
  END LOOP;

  -- If dry_run just return counts
  IF dry_run THEN
    result := result || jsonb_build_object('deleted', false);
    RETURN result;
  END IF;

  -- Execute deletion inside transaction (function runs within transaction)
  -- Acquire advisory lock to avoid concurrent deletes for same product
  PERFORM pg_advisory_xact_lock(hashtext(product_id::text));

  -- Delete dependent rows in a safe order
  FOREACH tbl IN ARRAY tables LOOP
    IF to_regclass(tbl) IS NOT NULL THEN
      EXECUTE format('DELETE FROM %I WHERE product_id = $1', tbl) USING product_id;
    END IF;
  END LOOP;

  -- Delete the product record
  EXECUTE 'DELETE FROM products WHERE id = $1' USING product_id;

  -- Insert audit record (deleted_by may be null depending on caller context)
  INSERT INTO product_deletion_audit(product_id, deleted_by, counts)
    VALUES (product_id, NULL, result || jsonb_build_object('deleted', true));

  result := result || jsonb_build_object('deleted', true);
  RETURN result;
END;
$$;
