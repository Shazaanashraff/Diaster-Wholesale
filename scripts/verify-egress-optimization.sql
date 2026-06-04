-- Egress optimization verification
-- Run: supabase db query --linked -f scripts/verify-egress-optimization.sql

-- 1. RPC functions exist
SELECT '1_functions' AS section, proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN (
    'get_dashboard_metrics',
    'get_dashboard_stats',
    'get_top_performers',
    'get_profit_expenses_timeline',
    'get_category_distribution',
    'get_stock_valuation_report',
    'latest_batch_costs'
  )
ORDER BY proname;

-- 2. product_stock view has is_active filter
SELECT '2_view_filter' AS section,
  CASE
    WHEN pg_get_viewdef('public.product_stock'::regclass, true) ILIKE '%is_active%'
    THEN 'PASS'
    ELSE 'FAIL'
  END AS status;

-- 3. RPC response sizes (bytes returned to client)
SELECT '3_rpc_bytes' AS section, 'get_dashboard_metrics' AS rpc,
  octet_length(public.get_dashboard_metrics(10)::text) AS bytes;
SELECT '3_rpc_bytes' AS section, 'get_top_performers' AS rpc,
  octet_length(public.get_top_performers('month')::text) AS bytes;
SELECT '3_rpc_bytes' AS section, 'get_profit_expenses_timeline' AS rpc,
  octet_length(public.get_profit_expenses_timeline()::text) AS bytes;
SELECT '3_rpc_bytes' AS section, 'get_category_distribution' AS rpc,
  octet_length(public.get_category_distribution()::text) AS bytes;
SELECT '3_rpc_bytes' AS section, 'get_stock_valuation_report' AS rpc,
  octet_length(public.get_stock_valuation_report()::text) AS bytes;

-- 4. Legacy full-table scan vs optimized RPC (approx JSON size)
SELECT '4_compare' AS section, 'legacy_all_invoices' AS path,
  COUNT(*)::bigint AS row_count,
  octet_length(COALESCE(json_agg(row_to_json(t))::text, '[]')) AS approx_bytes
FROM (SELECT total, payment_status FROM public.invoices) t;

SELECT '4_compare' AS section, 'legacy_all_invoice_items' AS path,
  COUNT(*)::bigint AS row_count,
  octet_length(COALESCE(json_agg(row_to_json(t))::text, '[]')) AS approx_bytes
FROM (SELECT product_id, total, cartons, pieces FROM public.invoice_items) t;

SELECT '4_compare' AS section, 'rpc_get_dashboard_metrics' AS path,
  1::bigint AS row_count,
  octet_length(public.get_dashboard_metrics(10)::text) AS approx_bytes;

-- 5. Sample metrics payload
SELECT '5_sample_metrics' AS section, public.get_dashboard_metrics(10) AS payload;
