-- Egress optimization: active-product views + server-side dashboard/report aggregates

-- ── Views: only active products (drops extra client filter queries) ──────────

DROP VIEW IF EXISTS public.product_stock CASCADE;

CREATE VIEW public.product_stock AS
SELECT
  p.id AS product_id,
  p.item_code,
  p.name,
  p.model,
  p.category,
  p.wholesale_price,
  p.retail_price,
  p.pieces_per_carton,
  p.reorder_level,
  COALESCE(batch_totals.cartons_in, 0) AS cartons_in,
  COALESCE(batch_totals.pieces_in, 0) AS pieces_in,
  COALESCE(sold_totals.cartons_sold, 0) AS cartons_sold,
  COALESCE(sold_totals.pieces_sold, 0) AS pieces_sold,
  COALESCE(adj_totals.carton_adj, 0::bigint) AS carton_adj,
  COALESCE(adj_totals.piece_adj, 0) AS piece_adj
FROM public.products p
LEFT JOIN (
  SELECT product_id, SUM(cartons) AS cartons_in, SUM(loose_pieces) AS pieces_in
  FROM public.stock_batches
  GROUP BY product_id
) batch_totals ON batch_totals.product_id = p.id
LEFT JOIN (
  SELECT ii.product_id, SUM(ii.cartons) AS cartons_sold, SUM(ii.pieces) AS pieces_sold
  FROM public.invoice_items ii
  JOIN public.invoices inv ON inv.id = ii.invoice_id
  WHERE inv.payment_status IN ('partial', 'paid')
  GROUP BY ii.product_id
) sold_totals ON sold_totals.product_id = p.id
LEFT JOIN (
  SELECT product_id, 0::bigint AS carton_adj, SUM(adjustment_pieces) AS piece_adj
  FROM public.stock_adjustments
  GROUP BY product_id
) adj_totals ON adj_totals.product_id = p.id
WHERE p.is_active = true;

DROP VIEW IF EXISTS public.product_stock_by_location CASCADE;

CREATE VIEW public.product_stock_by_location AS
WITH batch_totals AS (
  SELECT
    sb.product_id,
    sb.location_id,
    SUM(sb.cartons * COALESCE(p.pieces_per_carton, 1) + sb.loose_pieces) AS units_in
  FROM public.stock_batches sb
  JOIN public.products p ON p.id = sb.product_id AND p.is_active = true
  GROUP BY sb.product_id, sb.location_id
),
adj_totals AS (
  SELECT
    sa.product_id,
    COALESCE(sa.location_id, (
      SELECT id FROM public.locations WHERE type = 'warehouse' ORDER BY created_at LIMIT 1
    )) AS location_id,
    SUM(sa.adjustment_pieces) AS units_adj
  FROM public.stock_adjustments sa
  JOIN public.products p ON p.id = sa.product_id AND p.is_active = true
  GROUP BY sa.product_id, COALESCE(sa.location_id, (
    SELECT id FROM public.locations WHERE type = 'warehouse' ORDER BY created_at LIMIT 1
  ))
),
combined AS (
  SELECT product_id, location_id, units_in AS net FROM batch_totals
  UNION ALL
  SELECT product_id, location_id, units_adj AS net FROM adj_totals
)
SELECT
  p.id AS product_id,
  p.name,
  p.item_code,
  p.pieces_per_carton,
  c.location_id,
  l.name AS location_name,
  l.type AS location_type,
  SUM(c.net) AS total_units
FROM combined c
JOIN public.products p ON p.id = c.product_id AND p.is_active = true
LEFT JOIN public.locations l ON l.id = c.location_id
GROUP BY p.id, p.name, p.item_code, p.pieces_per_carton, c.location_id, l.name, l.type;

-- Latest batch cost per product (matches client cost-map overwrite order by received_at)
CREATE OR REPLACE FUNCTION public.latest_batch_costs()
RETURNS TABLE (product_id UUID, cost_per_piece NUMERIC)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT ON (sb.product_id)
    sb.product_id,
    sb.cost_per_piece
  FROM public.stock_batches sb
  WHERE sb.cost_per_piece IS NOT NULL
  ORDER BY sb.product_id, sb.received_at DESC NULLS LAST;
$$;

-- ── Dashboard metrics (single small JSON payload) ───────────────────────────

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(
  p_low_stock_threshold INT DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_revenue NUMERIC := 0;
  v_expenses NUMERIC := 0;
  v_cogs NUMERIC := 0;
  v_customers BIGINT := 0;
  v_low_stock BIGINT := 0;
BEGIN
  SELECT COALESCE(SUM(total), 0) INTO v_revenue
  FROM public.invoices
  WHERE payment_status IN ('paid', 'partial');

  SELECT COALESCE(SUM(amount), 0) INTO v_expenses
  FROM public.expenses;

  SELECT COUNT(*) INTO v_customers FROM public.customers;

  SELECT COALESCE(SUM(
    (ii.cartons * COALESCE(p.pieces_per_carton, 1) + ii.pieces)
    * COALESCE(lbc.cost_per_piece, 0)
  ), 0) INTO v_cogs
  FROM public.invoice_items ii
  JOIN public.products p ON p.id = ii.product_id
  JOIN public.invoices inv ON inv.id = ii.invoice_id
  LEFT JOIN public.latest_batch_costs() lbc ON lbc.product_id = ii.product_id
  WHERE inv.payment_status IN ('paid', 'partial');

  SELECT COUNT(*) INTO v_low_stock
  FROM public.product_stock ps
  WHERE (
    (ps.cartons_in + ps.carton_adj - ps.cartons_sold) * ps.pieces_per_carton
    + (ps.pieces_in + ps.piece_adj - ps.pieces_sold)
  ) <= p_low_stock_threshold;

  RETURN jsonb_build_object(
    'revenue', v_revenue,
    'expenses', v_expenses,
    'customers', v_customers,
    'lowStockCount', v_low_stock,
    'cogs', v_cogs,
    'netProfit', v_revenue - v_cogs - v_expenses
  );
END;
$$;

-- ── Dashboard stats (orders / success rate) ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'totalRevenue', COALESCE((
      SELECT SUM(total) FROM public.invoices WHERE payment_status IN ('paid', 'partial')
    ), 0),
    'totalOrders', (SELECT COUNT(*) FROM public.invoices),
    'newCustomers', (SELECT COUNT(*) FROM public.customers),
    'successRate', COALESCE((
      SELECT CASE WHEN COUNT(*) = 0 THEN 100
        ELSE (COUNT(*) FILTER (WHERE payment_status = 'paid')::numeric / COUNT(*) * 100)
      END
      FROM public.invoices
    ), 100)
  );
$$;

-- ── Top performers ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_top_performers(p_period TEXT DEFAULT 'month')
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT
      ii.product_id,
      p.name,
      p.pieces_per_carton,
      ii.total,
      ii.cartons,
      ii.pieces
    FROM public.invoice_items ii
    JOIN public.products p ON p.id = ii.product_id
    WHERE p_period = 'all'
      OR (p_period = 'day' AND ii.created_at >= date_trunc('day', now()))
      OR (p_period = 'month' AND ii.created_at >= date_trunc('month', now()))
  ),
  agg AS (
    SELECT
      product_id,
      name,
      SUM(total)::numeric AS revenue,
      SUM(cartons * COALESCE(pieces_per_carton, 1) + pieces)::numeric AS units_sold
    FROM filtered
    GROUP BY product_id, name
    ORDER BY revenue DESC
    LIMIT 5
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_id', product_id,
        'name', name,
        'revenue', revenue,
        'unitsSold', units_sold,
        'rank', rn
      )
      ORDER BY rn
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT *, ROW_NUMBER() OVER (ORDER BY revenue DESC) AS rn FROM agg
  ) ranked;
$$;

-- ── Profit & expenses timeline (last 6 months) ──────────────────────────────

CREATE OR REPLACE FUNCTION public.get_profit_expenses_timeline()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', now()) - interval '5 months',
      date_trunc('month', now()),
      interval '1 month'
    )::timestamptz AS month_start
  ),
  rev AS (
    SELECT date_trunc('month', created_at) AS m, SUM(total) AS revenue
    FROM public.invoices
    WHERE payment_status IN ('paid', 'partial')
      AND created_at >= (SELECT MIN(month_start) FROM months)
    GROUP BY 1
  ),
  exp AS (
    SELECT date_trunc('month', created_at) AS m, SUM(amount) AS expenses
    FROM public.expenses
    WHERE created_at >= (SELECT MIN(month_start) FROM months)
    GROUP BY 1
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'month', to_char(mo.month_start, 'Mon'),
        'revenue', COALESCE(r.revenue, 0),
        'expenses', COALESCE(e.expenses, 0),
        'profit', COALESCE(r.revenue, 0) - COALESCE(e.expenses, 0)
      )
      ORDER BY mo.month_start
    ),
    '[]'::jsonb
  )
  FROM months mo
  LEFT JOIN rev r ON r.m = mo.month_start
  LEFT JOIN exp e ON e.m = mo.month_start;
$$;

-- ── Category distribution ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_category_distribution()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', category,
        'value', cnt
      )
      ORDER BY category
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT COALESCE(NULLIF(TRIM(category), ''), 'Other') AS category, COUNT(*)::int AS cnt
    FROM public.products
    WHERE is_active = true
    GROUP BY 1
  ) c;
$$;

-- ── Stock valuation by location ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_stock_valuation_report()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH unit_costs AS (
    SELECT
      p.id AS product_id,
      COALESCE(lbc.cost_per_piece, p.cost_price, 0)::numeric AS unit_cost
    FROM public.products p
    LEFT JOIN public.latest_batch_costs() lbc ON lbc.product_id = p.id
    WHERE p.is_active = true
  ),
  line_items AS (
    SELECT
      psbl.location_id,
      psbl.location_name,
      psbl.location_type,
      psbl.product_id,
      psbl.name,
      psbl.item_code,
      COALESCE(psbl.total_units, 0)::numeric AS available,
      uc.unit_cost,
      COALESCE(psbl.total_units, 0) * uc.unit_cost AS valuation
    FROM public.product_stock_by_location psbl
    JOIN unit_costs uc ON uc.product_id = psbl.product_id
  ),
  grouped AS (
    SELECT
      location_id,
      location_name,
      location_type,
      SUM(valuation) AS total_valuation,
      jsonb_agg(
        jsonb_build_object(
          'product_id', product_id,
          'name', name,
          'item_code', item_code,
          'available', available,
          'unitCost', unit_cost,
          'valuation', valuation
        )
        ORDER BY valuation DESC
      ) AS products
    FROM line_items
    GROUP BY location_id, location_name, location_type
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'location_id', location_id,
        'location_name', COALESCE(location_name, 'Unassigned'),
        'location_type', location_type,
        'totalValuation', total_valuation,
        'products', products
      )
      ORDER BY
        CASE location_type WHEN 'shop' THEN 0 WHEN 'warehouse' THEN 1 ELSE 2 END,
        COALESCE(location_name, 'Unassigned')
    ),
    '[]'::jsonb
  )
  FROM grouped;
$$;

GRANT EXECUTE ON FUNCTION public.latest_batch_costs() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics(INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_performers(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profit_expenses_timeline() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_category_distribution() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_stock_valuation_report() TO anon, authenticated;

GRANT SELECT ON public.product_stock TO anon, authenticated;
GRANT SELECT ON public.product_stock_by_location TO anon, authenticated;
