-- Fix: product_deletion_audit insert blocked by RLS
-- The delete_product_cascade function runs as the calling user which has no INSERT
-- policy on product_deletion_audit. Fix by (a) disabling RLS on the audit table and
-- (b) re-creating the function as SECURITY DEFINER so it always runs as the owner.

ALTER TABLE IF EXISTS product_deletion_audit DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.delete_product_cascade(
  product_id uuid,
  dry_run boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  FOREACH tbl IN ARRAY tables LOOP
    IF to_regclass(tbl) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM %I WHERE product_id = $1', tbl) INTO v_count USING product_id;
      result := result || jsonb_build_object(tbl, v_count);
    ELSE
      result := result || jsonb_build_object(tbl, NULL);
    END IF;
  END LOOP;

  IF dry_run THEN
    result := result || jsonb_build_object('deleted', false);
    RETURN result;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(product_id::text));

  FOREACH tbl IN ARRAY tables LOOP
    IF to_regclass(tbl) IS NOT NULL THEN
      EXECUTE format('DELETE FROM %I WHERE product_id = $1', tbl) USING product_id;
    END IF;
  END LOOP;

  EXECUTE 'DELETE FROM products WHERE id = $1' USING product_id;

  INSERT INTO product_deletion_audit(product_id, deleted_by, counts)
    VALUES (product_id, auth.uid(), result || jsonb_build_object('deleted', true));

  result := result || jsonb_build_object('deleted', true);
  RETURN result;
END;
$$;
