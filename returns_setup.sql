-- ================================================================
-- Diastar Wholesale — Returns Module Setup
-- Paste this into the Supabase SQL Editor and run it once.
-- ================================================================

CREATE TABLE IF NOT EXISTS sales_returns (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number         TEXT NOT NULL UNIQUE,
  original_invoice_id   UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  exchange_invoice_id   UUID REFERENCES invoices(id) ON DELETE SET NULL,
  exchange_invoice_no   TEXT,
  return_type           TEXT NOT NULL DEFAULT 'Return'
                          CHECK (return_type IN ('Return','Exchange')),
  reason                TEXT NOT NULL DEFAULT '',
  status                TEXT NOT NULL DEFAULT 'Pending'
                          CHECK (status IN ('Pending','Completed','Cancelled')),
  resolution_type       TEXT CHECK (resolution_type IN ('Repaired','Replaced')),
  settlement_type       TEXT CHECK (settlement_type IN ('UpgradePayment','CashRefund','EvenExchange')),
  exchange_difference   NUMERIC(12,2),
  refund_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  returned_by           TEXT NOT NULL DEFAULT '',
  workflow_snapshot     JSONB,
  cancelled_at          TIMESTAMPTZ,
  cancelled_by          TEXT,
  cancel_reason         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sales_returns DISABLE ROW LEVEL SECURITY;

-- Belt-and-suspenders: explicit allow-all policies in case RLS gets re-enabled
ALTER TABLE sales_returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_sales_returns" ON sales_returns;
CREATE POLICY "allow_all_sales_returns" ON sales_returns
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
-- Now disable so the policy is never evaluated at all
ALTER TABLE sales_returns DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS sales_return_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id        UUID NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
  invoice_item_id  UUID REFERENCES invoice_items(id) ON DELETE SET NULL,
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name     TEXT NOT NULL DEFAULT '',
  return_cartons   INT NOT NULL DEFAULT 0,
  return_pieces    INT NOT NULL DEFAULT 0,
  unit_price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total            NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sales_return_items DISABLE ROW LEVEL SECURITY;

ALTER TABLE sales_return_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_sales_return_items" ON sales_return_items;
CREATE POLICY "allow_all_sales_return_items" ON sales_return_items
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
ALTER TABLE sales_return_items DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON sales_returns TO anon, authenticated;
GRANT SELECT, INSERT ON sales_return_items TO anon, authenticated;
