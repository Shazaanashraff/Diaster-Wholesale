-- ================================================================
-- Sandbox schema + app_meta marker + guarded reset function
--
-- Brings the `sandbox` schema (previously an ad-hoc root file,
-- sandbox-setup.sql, run by hand from the Supabase SQL editor) into
-- version control. Combines sandbox-setup.sql + sandbox-patch.sql,
-- cross-checked column-by-column against the live `public` schema so
-- every sandbox table's shape (names, NUMERIC(12,2) money columns,
-- CHECK constraints) matches its `public` counterpart exactly.
--
-- GOING-FORWARD CONVENTION: any future migration that alters `public`
-- must apply the identical DDL to `sandbox` in the same migration file,
-- so the two schemas never drift apart again.
--
-- Does NOT touch `public` in any way — this file only CREATEs/ALTERs
-- objects inside the `sandbox` schema (plus the new `public.app_meta`
-- marker table, which is additive and untouched elsewhere).
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- 0. Create schema + grant access to PostgREST roles
-- ────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS sandbox;

GRANT USAGE ON SCHEMA sandbox TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA sandbox
  GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA sandbox
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA sandbox
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- ────────────────────────────────────────────────────────────────
-- 1. PRODUCTS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code         TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  model             TEXT NOT NULL DEFAULT '',
  description       TEXT NOT NULL DEFAULT '',
  category          TEXT NOT NULL DEFAULT 'general',
  wholesale_price   NUMERIC(12,2) NOT NULL DEFAULT 0,
  retail_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
  pieces_per_carton INT NOT NULL DEFAULT 1,
  reorder_level     INT NOT NULL DEFAULT 0,
  is_active         BOOLEAN DEFAULT TRUE,
  sku               TEXT UNIQUE,
  margin_pct        NUMERIC(5,2) DEFAULT 20,
  cost_price        NUMERIC(12,2) DEFAULT 0,
  msp               NUMERIC(12,2) DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE sandbox.products DISABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- 2. CUSTOMERS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.customers (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  phone                   TEXT NOT NULL DEFAULT '',
  email                   TEXT NOT NULL DEFAULT '',
  address                 TEXT NOT NULL DEFAULT '',
  type                    TEXT NOT NULL DEFAULT 'retail' CHECK (type IN ('wholesale', 'retail')),
  credit_limit            NUMERIC(12,2) NOT NULL DEFAULT 0,
  outstanding_balance     NUMERIC(12,2) NOT NULL DEFAULT 0,
  credit_balance          NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active               BOOLEAN DEFAULT TRUE,
  loyalty_points          INT NOT NULL DEFAULT 0,
  total_loyalty_earned    INT NOT NULL DEFAULT 0,
  total_loyalty_redeemed  INT NOT NULL DEFAULT 0,
  cheque_float            NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE sandbox.customers DISABLE ROW LEVEL SECURITY;

-- Delta for a customers table that already existed pre-migration (e.g. via
-- sandbox-setup.sql + sandbox-patch.sql applied by hand) without cheque_float.
ALTER TABLE sandbox.customers
  ADD COLUMN IF NOT EXISTS cheque_float NUMERIC(12,2) NOT NULL DEFAULT 0;

-- ────────────────────────────────────────────────────────────────
-- 3. SHIPMENTS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.shipments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference   TEXT NOT NULL DEFAULT '',
  supplier    TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  arrived_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE sandbox.shipments DISABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- 4. SUPPLIERS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.suppliers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  contact_person   TEXT,
  phone            TEXT,
  email            TEXT,
  country          TEXT DEFAULT 'China',
  notes            TEXT,
  is_active        BOOLEAN DEFAULT TRUE,
  credit_limit     NUMERIC(16,2) DEFAULT 0,
  credit_days      INTEGER DEFAULT 0,
  current_payable  NUMERIC(16,2) DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sandbox.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access suppliers" ON sandbox.suppliers;
CREATE POLICY "All access suppliers" ON sandbox.suppliers FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 5. AUDIT LOG
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  TEXT NOT NULL,
  record_id   TEXT,
  action      TEXT NOT NULL,
  old_values  JSONB,
  new_values  JSONB,
  user_label  TEXT DEFAULT 'System',
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sandbox.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access audit_log" ON sandbox.audit_log;
CREATE POLICY "All access audit_log" ON sandbox.audit_log FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 6. LOCATIONS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.locations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  type       TEXT NOT NULL CHECK (type IN ('warehouse', 'shop')),
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sandbox.locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access locations" ON sandbox.locations;
CREATE POLICY "All access locations" ON sandbox.locations FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 7. EXPENSES
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category    TEXT NOT NULL DEFAULT 'general',
  description TEXT NOT NULL DEFAULT '',
  amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  reference   TEXT NOT NULL DEFAULT '',
  method      TEXT NOT NULL DEFAULT 'cash',
  notes       TEXT NOT NULL DEFAULT '',
  created_by  TEXT DEFAULT 'System',
  location_id UUID REFERENCES sandbox.locations(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE sandbox.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access expenses" ON sandbox.expenses;
CREATE POLICY "All access expenses" ON sandbox.expenses FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 8. STOCK BATCHES
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.stock_batches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID NOT NULL REFERENCES sandbox.products(id) ON DELETE CASCADE,
  shipment_id    UUID REFERENCES sandbox.shipments(id) ON DELETE SET NULL,
  location_id    UUID REFERENCES sandbox.locations(id),
  cartons        INT NOT NULL DEFAULT 0,
  loose_pieces   INT NOT NULL DEFAULT 0,
  cost_per_piece NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes          TEXT NOT NULL DEFAULT '',
  received_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  original_units INT
);
ALTER TABLE sandbox.stock_batches DISABLE ROW LEVEL SECURITY;

-- Delta for a pre-existing stock_batches table without original_units.
ALTER TABLE sandbox.stock_batches
  ADD COLUMN IF NOT EXISTS original_units INT;

-- ────────────────────────────────────────────────────────────────
-- 9. STOCK ADJUSTMENTS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.stock_adjustments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          UUID NOT NULL REFERENCES sandbox.products(id) ON DELETE CASCADE,
  location_id         UUID REFERENCES sandbox.locations(id),
  adjustment_pieces   INT NOT NULL DEFAULT 0,
  adjustment_cartons  INT NOT NULL DEFAULT 0,
  reason              TEXT NOT NULL DEFAULT '',
  adjusted_by         TEXT NOT NULL DEFAULT 'System',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE sandbox.stock_adjustments DISABLE ROW LEVEL SECURITY;

-- Delta for a pre-existing stock_adjustments table without adjustment_cartons
-- (posService.ts writes this column on every stock adjustment insert).
ALTER TABLE sandbox.stock_adjustments
  ADD COLUMN IF NOT EXISTS adjustment_cartons INT NOT NULL DEFAULT 0;

-- ────────────────────────────────────────────────────────────────
-- 10. SALESPEOPLE
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.salespeople (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE sandbox.salespeople DISABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- 11. INVOICES
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no        TEXT NOT NULL UNIQUE,
  customer_id       UUID NOT NULL REFERENCES sandbox.customers(id) ON DELETE RESTRICT,
  mode              TEXT NOT NULL DEFAULT 'retail' CHECK (mode IN ('wholesale', 'retail')),
  subtotal          NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  total             NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status    TEXT NOT NULL DEFAULT 'unpaid'
                    CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'cancelled')),
  notes             TEXT NOT NULL DEFAULT '',
  salesperson_name  TEXT,
  salesperson_id    UUID REFERENCES sandbox.salespeople(id) ON DELETE SET NULL,
  idempotency_key   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE sandbox.invoices DISABLE ROW LEVEL SECURITY;

-- Deltas for a pre-existing invoices table missing later columns/constraints.
ALTER TABLE sandbox.invoices
  ADD COLUMN IF NOT EXISTS salesperson_id UUID REFERENCES sandbox.salespeople(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoices_payment_status_check' AND conrelid = 'sandbox.invoices'::regclass
      AND pg_get_constraintdef(oid) LIKE '%cancelled%'
  ) THEN
    ALTER TABLE sandbox.invoices DROP CONSTRAINT IF EXISTS invoices_payment_status_check;
    ALTER TABLE sandbox.invoices
      ADD CONSTRAINT invoices_payment_status_check
      CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'cancelled'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS sandbox_invoices_idempotency_key_idx
  ON sandbox.invoices (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS sandbox_idx_invoices_salesperson_id
  ON sandbox.invoices (salesperson_id);

-- ────────────────────────────────────────────────────────────────
-- 12. INVOICE ITEMS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.invoice_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES sandbox.invoices(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES sandbox.products(id) ON DELETE RESTRICT,
  batch_id    UUID REFERENCES sandbox.stock_batches(id) ON DELETE SET NULL,
  cartons     INT NOT NULL DEFAULT 0,
  pieces      INT NOT NULL DEFAULT 0,
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE sandbox.invoice_items DISABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- 13. PAYMENTS (customer payments)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     UUID NOT NULL REFERENCES sandbox.invoices(id) ON DELETE CASCADE,
  customer_id    UUID NOT NULL REFERENCES sandbox.customers(id) ON DELETE RESTRICT,
  amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  method         TEXT NOT NULL DEFAULT 'cash'
                 CHECK (method IN ('cash', 'card', 'cheque', 'credit', 'online', 'bank_transfer', 'mixed')),
  reference      TEXT NOT NULL DEFAULT '',
  cheque_number  TEXT,
  bank_name      TEXT,
  due_date       DATE,
  paid_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE sandbox.payments DISABLE ROW LEVEL SECURITY;

-- Delta for a pre-existing payments table without cheque_status.
ALTER TABLE sandbox.payments
  ADD COLUMN IF NOT EXISTS cheque_status TEXT
    CHECK (cheque_status IN ('pending', 'processing', 'completed', 'returned'));

-- ────────────────────────────────────────────────────────────────
-- 14. RETURNS (legacy — superseded by sales_returns, kept for parity
--     with public: still read by SalesReturnReport.tsx and
--     delete_product_cascade()'s cleanup list)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.returns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID REFERENCES sandbox.invoices(id) ON DELETE SET NULL,
  product_id    UUID NOT NULL REFERENCES sandbox.products(id) ON DELETE CASCADE,
  cartons       INT NOT NULL DEFAULT 0,
  pieces        INT NOT NULL DEFAULT 0,
  reason        TEXT NOT NULL DEFAULT '',
  refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE sandbox.returns DISABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- 15. PURCHASES
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.purchases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       TEXT UNIQUE NOT NULL,
  supplier_id     UUID REFERENCES sandbox.suppliers(id),
  location_id     UUID REFERENCES sandbox.locations(id),
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'ordered', 'received', 'completed', 'cancelled')),
  exchange_rate   NUMERIC(10,4) NOT NULL DEFAULT 0,
  total_rmb       NUMERIC(16,2) DEFAULT 0,
  total_lkr       NUMERIC(16,2) DEFAULT 0,
  cost_finalized  BOOLEAN DEFAULT FALSE,
  rep_name        TEXT,
  discount_amount NUMERIC(16,2) DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sandbox.purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access purchases" ON sandbox.purchases;
CREATE POLICY "All access purchases" ON sandbox.purchases FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 16. PURCHASE ITEMS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.purchase_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id      UUID NOT NULL REFERENCES sandbox.purchases(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES sandbox.products(id),
  quantity_units   INTEGER NOT NULL DEFAULT 0,
  quantity_cartons INTEGER DEFAULT 0,
  unit_price_rmb   NUMERIC(12,4) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sandbox.purchase_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access purchase_items" ON sandbox.purchase_items;
CREATE POLICY "All access purchase_items" ON sandbox.purchase_items FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 17. PURCHASE COSTS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.purchase_costs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES sandbox.purchases(id) ON DELETE CASCADE,
  cost_type   TEXT NOT NULL DEFAULT 'other'
              CHECK (cost_type IN ('shipping', 'clearing', 'tax', 'other')),
  amount_lkr  NUMERIC(16,2) NOT NULL DEFAULT 0,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sandbox.purchase_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access purchase_costs" ON sandbox.purchase_costs;
CREATE POLICY "All access purchase_costs" ON sandbox.purchase_costs FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 18. PURCHASE RECEIVE
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.purchase_receive (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id    UUID NOT NULL REFERENCES sandbox.purchases(id),
  product_id     UUID NOT NULL REFERENCES sandbox.products(id),
  ordered_units  INTEGER NOT NULL DEFAULT 0,
  received_units INTEGER NOT NULL DEFAULT 0,
  damaged_units  INTEGER NOT NULL DEFAULT 0,
  notes          TEXT,
  received_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sandbox.purchase_receive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access purchase_receive" ON sandbox.purchase_receive;
CREATE POLICY "All access purchase_receive" ON sandbox.purchase_receive FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 19. SUPPLIER PAYMENTS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.supplier_payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id    UUID NOT NULL REFERENCES sandbox.suppliers(id),
  purchase_id    UUID REFERENCES sandbox.purchases(id),
  amount         NUMERIC(16,2) NOT NULL DEFAULT 0,
  method         TEXT NOT NULL DEFAULT 'cash'
                 CHECK (method IN ('cash', 'card', 'cheque', 'credit', 'online', 'bank_transfer', 'mixed')),
  cheque_number  TEXT,
  bank_name      TEXT,
  due_date       TIMESTAMPTZ,
  notes          TEXT,
  paid_at        TIMESTAMPTZ DEFAULT now(),
  created_at     TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sandbox.supplier_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access supplier_payments" ON sandbox.supplier_payments;
CREATE POLICY "All access supplier_payments" ON sandbox.supplier_payments FOR ALL USING (true) WITH CHECK (true);

-- public.supplier_payments.due_date was narrowed to DATE (untracked drift);
-- match it exactly for byte-identical column shapes.
ALTER TABLE sandbox.supplier_payments ALTER COLUMN due_date TYPE DATE;

-- ────────────────────────────────────────────────────────────────
-- 20. SUPPLIER PAYMENT LINES
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.supplier_payment_lines (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id     UUID NOT NULL REFERENCES sandbox.supplier_payments(id) ON DELETE CASCADE,
  amount         NUMERIC(16,2) NOT NULL DEFAULT 0,
  method         TEXT NOT NULL
                 CHECK (method IN ('cash', 'card', 'cheque', 'credit', 'online', 'bank_transfer')),
  cheque_number  TEXT,
  bank_name      TEXT,
  due_date       TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sandbox.supplier_payment_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access supplier_payment_lines" ON sandbox.supplier_payment_lines;
CREATE POLICY "All access supplier_payment_lines" ON sandbox.supplier_payment_lines FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 21. CARTONS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.cartons (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id  UUID NOT NULL REFERENCES sandbox.purchases(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES sandbox.products(id) ON DELETE CASCADE,
  carton_index INT NOT NULL,
  carton_code  TEXT NOT NULL UNIQUE,
  status       TEXT NOT NULL DEFAULT 'in_stock'
               CHECK (status IN ('in_stock', 'sold', 'damaged')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE sandbox.cartons DISABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- 22. SUPPLIER RETURNS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.supplier_returns (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference              TEXT UNIQUE NOT NULL,
  supplier_id            UUID NOT NULL REFERENCES sandbox.suppliers(id),
  purchase_id            UUID REFERENCES sandbox.purchases(id),
  return_type            TEXT NOT NULL DEFAULT 'return'
                         CHECK (return_type IN ('return', 'exchange')),
  status                 TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'completed', 'cancelled')),
  return_value_lkr       NUMERIC(16,2) NOT NULL DEFAULT 0,
  replacement_value_lkr  NUMERIC(16,2) DEFAULT 0,
  difference_lkr         NUMERIC(16,2) DEFAULT 0,
  settlement_type        TEXT CHECK (settlement_type IN ('payable', 'refund', 'credit_note', 'even')),
  settlement_notes       TEXT,
  notes                  TEXT,
  created_at             TIMESTAMPTZ DEFAULT now(),
  completed_at           TIMESTAMPTZ
);
ALTER TABLE sandbox.supplier_returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access supplier_returns" ON sandbox.supplier_returns;
CREATE POLICY "All access supplier_returns" ON sandbox.supplier_returns FOR ALL USING (true) WITH CHECK (true);

-- public.supplier_returns also carries these two untracked-but-live columns
-- (legacy `return_value` predates `return_value_lkr`; `updated_at` is real).
ALTER TABLE sandbox.supplier_returns
  ADD COLUMN IF NOT EXISTS return_value NUMERIC(16,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT now();

-- ────────────────────────────────────────────────────────────────
-- 23. SUPPLIER RETURN ITEMS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.supplier_return_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id      UUID NOT NULL REFERENCES sandbox.supplier_returns(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES sandbox.products(id),
  item_type      TEXT NOT NULL DEFAULT 'return'
                 CHECK (item_type IN ('return', 'replacement')),
  quantity       INTEGER NOT NULL DEFAULT 0,
  unit_value_lkr NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sandbox.supplier_return_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access supplier_return_items" ON sandbox.supplier_return_items;
CREATE POLICY "All access supplier_return_items" ON sandbox.supplier_return_items FOR ALL USING (true) WITH CHECK (true);

-- public.supplier_return_items also carries these legacy columns from the
-- original (pre-richer-schema) version of this table; live, untracked.
ALTER TABLE sandbox.supplier_return_items
  ADD COLUMN IF NOT EXISTS quantity_units   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_cartons INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_price       NUMERIC(12,4) NOT NULL DEFAULT 0;

-- ────────────────────────────────────────────────────────────────
-- 24. PURCHASE DISCOUNT APPROVALS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.purchase_discount_approvals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id      UUID NOT NULL REFERENCES sandbox.purchases(id) ON DELETE CASCADE,
  discount_type    TEXT NOT NULL CHECK (discount_type IN ('item', 'bill')),
  discount_percent NUMERIC(5,2),
  discount_amount  NUMERIC(16,2),
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by     TEXT NOT NULL DEFAULT 'System',
  approved_by      TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  resolved_at      TIMESTAMPTZ
);
ALTER TABLE sandbox.purchase_discount_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access purchase_discount_approvals" ON sandbox.purchase_discount_approvals;
CREATE POLICY "All access purchase_discount_approvals" ON sandbox.purchase_discount_approvals FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 25. OTHER INCOME
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.other_income (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL DEFAULT 'other'
              CHECK (source_type IN ('supplier_refund', 'credit_note', 'discount_received', 'other')),
  amount      NUMERIC(16,2) NOT NULL DEFAULT 0,
  method      TEXT NOT NULL DEFAULT 'cash',
  supplier_id UUID REFERENCES sandbox.suppliers(id),
  notes       TEXT NOT NULL DEFAULT '',
  created_by  TEXT DEFAULT 'System',
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sandbox.other_income ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access other_income" ON sandbox.other_income;
CREATE POLICY "All access other_income" ON sandbox.other_income FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 26. STOCK TRANSFERS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.stock_transfers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference        TEXT UNIQUE NOT NULL,
  from_location_id UUID NOT NULL REFERENCES sandbox.locations(id),
  to_location_id   UUID NOT NULL REFERENCES sandbox.locations(id),
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'completed', 'cancelled')),
  notes            TEXT NOT NULL DEFAULT '',
  requested_by     TEXT NOT NULL DEFAULT 'System',
  approved_by      TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  completed_at     TIMESTAMPTZ,
  CONSTRAINT sandbox_different_locations CHECK (from_location_id <> to_location_id)
);
ALTER TABLE sandbox.stock_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access stock_transfers" ON sandbox.stock_transfers;
CREATE POLICY "All access stock_transfers" ON sandbox.stock_transfers FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 27. STOCK TRANSFER ITEMS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.stock_transfer_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES sandbox.stock_transfers(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES sandbox.products(id),
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sandbox.stock_transfer_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access stock_transfer_items" ON sandbox.stock_transfer_items;
CREATE POLICY "All access stock_transfer_items" ON sandbox.stock_transfer_items FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 28. SALES RETURNS (v2 returns module — supersedes `returns`)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.sales_returns (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number         TEXT NOT NULL UNIQUE,
  original_invoice_id   UUID NOT NULL REFERENCES sandbox.invoices(id) ON DELETE RESTRICT,
  exchange_invoice_id   UUID REFERENCES sandbox.invoices(id) ON DELETE SET NULL,
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
ALTER TABLE sandbox.sales_returns DISABLE ROW LEVEL SECURITY;

-- Delta for a pre-existing sales_returns table without salesperson_id.
ALTER TABLE sandbox.sales_returns
  ADD COLUMN IF NOT EXISTS salesperson_id UUID REFERENCES sandbox.salespeople(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────────
-- 29. SALES RETURN ITEMS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.sales_return_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id       UUID NOT NULL REFERENCES sandbox.sales_returns(id) ON DELETE CASCADE,
  invoice_item_id UUID REFERENCES sandbox.invoice_items(id) ON DELETE SET NULL,
  product_id      UUID NOT NULL REFERENCES sandbox.products(id) ON DELETE RESTRICT,
  product_name    TEXT NOT NULL DEFAULT '',
  return_cartons  INT NOT NULL DEFAULT 0,
  return_pieces   INT NOT NULL DEFAULT 0,
  unit_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE sandbox.sales_return_items DISABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- 30. LOYALTY TRANSACTIONS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sandbox.loyalty_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID NOT NULL REFERENCES sandbox.customers(id) ON DELETE RESTRICT,
  invoice_id       UUID REFERENCES sandbox.invoices(id) ON DELETE SET NULL,
  return_id        UUID REFERENCES sandbox.sales_returns(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('EARN','REDEEM','RETURN_REVERSAL','RETURN_UNDO')),
  points           INT NOT NULL DEFAULT 0,
  notes            TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE sandbox.loyalty_transactions DISABLE ROW LEVEL SECURITY;

-- ================================================================
-- FUNCTIONS (all use SET search_path = sandbox)
-- ================================================================

CREATE OR REPLACE FUNCTION sandbox.generate_product_item_code()
RETURNS TEXT AS $$
DECLARE candidate TEXT;
BEGIN
  LOOP
    candidate := LPAD((FLOOR(random() * 1000000))::INT::TEXT, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM sandbox.products WHERE item_code = candidate);
  END LOOP;
  RETURN candidate;
END;
$$ LANGUAGE plpgsql SET search_path = sandbox;

CREATE OR REPLACE FUNCTION sandbox.set_product_item_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.item_code IS NULL OR BTRIM(NEW.item_code) = '' THEN
    NEW.item_code := sandbox.generate_product_item_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = sandbox;

DROP TRIGGER IF EXISTS products_set_item_code ON sandbox.products;
CREATE TRIGGER products_set_item_code
  BEFORE INSERT ON sandbox.products
  FOR EACH ROW EXECUTE FUNCTION sandbox.set_product_item_code();

CREATE OR REPLACE FUNCTION sandbox.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = sandbox;

DROP TRIGGER IF EXISTS purchases_updated_at ON sandbox.purchases;
CREATE TRIGGER purchases_updated_at
  BEFORE UPDATE ON sandbox.purchases
  FOR EACH ROW EXECUTE FUNCTION sandbox.update_updated_at_column();

CREATE OR REPLACE FUNCTION sandbox.generate_purchase_reference()
RETURNS TEXT AS $$
DECLARE next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(reference FROM 3) AS INTEGER)), 0) + 1
  INTO next_num FROM sandbox.purchases WHERE reference ~ '^PO[0-9]+$';
  RETURN 'PO' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = sandbox;

CREATE OR REPLACE FUNCTION sandbox.generate_return_reference()
RETURNS TEXT AS $$
DECLARE next_num INTEGER;
BEGIN
  next_num := (
    SELECT COALESCE(MAX(CAST(SUBSTRING(reference FROM 3) AS INTEGER)), 0) + 1
    FROM sandbox.supplier_returns WHERE reference ~ '^SR[0-9]+$'
  );
  RETURN 'SR' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = sandbox;

CREATE OR REPLACE FUNCTION sandbox.generate_transfer_reference()
RETURNS TEXT AS $$
DECLARE next_num INTEGER;
BEGIN
  next_num := (
    SELECT COALESCE(MAX(CAST(SUBSTRING(reference FROM 3) AS INTEGER)), 0) + 1
    FROM sandbox.stock_transfers WHERE reference ~ '^ST[0-9]+$'
  );
  RETURN 'ST' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = sandbox;

CREATE OR REPLACE FUNCTION sandbox.deduct_stock_from_batch(p_batch_id UUID, p_units INT)
RETURNS VOID AS $$
DECLARE
  v_ppc INT; v_needed_cartons INT; v_needed_loose INT;
BEGIN
  SELECT p.pieces_per_carton INTO v_ppc
  FROM sandbox.stock_batches b JOIN sandbox.products p ON p.id = b.product_id
  WHERE b.id = p_batch_id;
  v_needed_cartons := p_units / v_ppc;
  v_needed_loose   := p_units % v_ppc;
  UPDATE sandbox.stock_batches
    SET cartons = cartons - v_needed_cartons, loose_pieces = loose_pieces - v_needed_loose
    WHERE id = p_batch_id;
  UPDATE sandbox.stock_batches
    SET cartons = cartons - 1, loose_pieces = loose_pieces + v_ppc
    WHERE id = p_batch_id AND loose_pieces < 0;
END;
$$ LANGUAGE plpgsql SET search_path = sandbox;

CREATE OR REPLACE FUNCTION sandbox.deduct_stock_fifo(p_product_id UUID, p_units INTEGER)
RETURNS VOID AS $$
DECLARE
  batch RECORD; remaining INTEGER := p_units;
  ppc INTEGER; batch_pieces INTEGER; new_total INTEGER; new_cartons INTEGER; new_loose INTEGER;
BEGIN
  FOR batch IN
    SELECT b.id, b.cartons, b.loose_pieces, p.pieces_per_carton
    FROM sandbox.stock_batches b JOIN sandbox.products p ON p.id = b.product_id
    WHERE b.product_id = p_product_id
    ORDER BY b.received_at ASC NULLS LAST, b.created_at ASC
  LOOP
    EXIT WHEN remaining <= 0;
    ppc          := GREATEST(batch.pieces_per_carton, 1);
    batch_pieces := batch.cartons * ppc + batch.loose_pieces;
    IF remaining >= batch_pieces THEN
      DELETE FROM sandbox.stock_batches WHERE id = batch.id;
      remaining := remaining - batch_pieces;
    ELSE
      new_total   := batch_pieces - remaining;
      new_cartons := new_total / ppc;
      new_loose   := new_total % ppc;
      UPDATE sandbox.stock_batches SET cartons = new_cartons, loose_pieces = new_loose WHERE id = batch.id;
      remaining := 0;
    END IF;
  END LOOP;
  IF remaining > 0 THEN
    RAISE EXCEPTION 'Insufficient stock: % units undeducted for product %', remaining, p_product_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = sandbox;

CREATE OR REPLACE FUNCTION sandbox.trg_purchase_receive_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_recv RECORD; v_ppc INT; v_sellable INT; v_cartons INT; v_loose INT;
BEGIN
  IF OLD.status IS DISTINCT FROM 'received' AND NEW.status = 'received' THEN
    FOR v_recv IN
      SELECT product_id, received_units, damaged_units
      FROM sandbox.purchase_receive WHERE purchase_id = NEW.id
    LOOP
      v_sellable := GREATEST(0, v_recv.received_units - COALESCE(v_recv.damaged_units, 0));
      IF v_sellable > 0 THEN
        SELECT COALESCE(pieces_per_carton, 1) INTO v_ppc FROM sandbox.products WHERE id = v_recv.product_id;
        v_ppc     := COALESCE(v_ppc, 1);
        v_cartons := v_sellable / v_ppc;
        v_loose   := v_sellable % v_ppc;
        INSERT INTO sandbox.stock_batches (product_id, cartons, loose_pieces, notes, received_at)
        VALUES (v_recv.product_id, v_cartons, v_loose, 'Received from PO: ' || NEW.reference, now());
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = sandbox;

DROP TRIGGER IF EXISTS trg_purchase_receive_trigger ON sandbox.purchases;
CREATE TRIGGER trg_purchase_receive_trigger
  AFTER UPDATE ON sandbox.purchases
  FOR EACH ROW EXECUTE FUNCTION sandbox.trg_purchase_receive_stock();

CREATE OR REPLACE FUNCTION sandbox.handle_supplier_return_complete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status <> 'completed' AND NEW.status = 'completed' THEN
    INSERT INTO sandbox.stock_adjustments (product_id, adjustment_pieces, reason, adjusted_by)
    SELECT sri.product_id, -(sri.quantity), 'Supplier Return: ' || NEW.reference, 'System'
    FROM sandbox.supplier_return_items sri
    WHERE sri.return_id = NEW.id AND sri.item_type = 'return';

    INSERT INTO sandbox.stock_batches (product_id, cartons, loose_pieces, cost_per_piece, notes)
    SELECT sri.product_id, 0, sri.quantity, sri.unit_value_lkr,
           'Supplier Exchange Replacement: ' || NEW.reference
    FROM sandbox.supplier_return_items sri
    WHERE sri.return_id = NEW.id AND sri.item_type = 'replacement';

    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = sandbox;

DROP TRIGGER IF EXISTS trg_supplier_return_complete ON sandbox.supplier_returns;
CREATE TRIGGER trg_supplier_return_complete
  BEFORE UPDATE ON sandbox.supplier_returns
  FOR EACH ROW EXECUTE FUNCTION sandbox.handle_supplier_return_complete();

CREATE OR REPLACE FUNCTION sandbox.trg_supplier_payable_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.method = 'credit' THEN
    UPDATE sandbox.suppliers SET current_payable = current_payable + NEW.amount WHERE id = NEW.supplier_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = sandbox;

DROP TRIGGER IF EXISTS trg_supplier_payments_credit ON sandbox.supplier_payments;
CREATE TRIGGER trg_supplier_payments_credit
  AFTER INSERT ON sandbox.supplier_payments
  FOR EACH ROW EXECUTE FUNCTION sandbox.trg_supplier_payable_update();

CREATE OR REPLACE FUNCTION sandbox.handle_stock_transfer_complete()
RETURNS TRIGGER AS $$
DECLARE v_item RECORD;
BEGIN
  IF OLD.status <> 'completed' AND NEW.status = 'completed' THEN
    NEW.completed_at := now();
    FOR v_item IN
      SELECT sti.product_id, sti.quantity
      FROM sandbox.stock_transfer_items sti WHERE sti.transfer_id = NEW.id
    LOOP
      INSERT INTO sandbox.stock_adjustments (product_id, adjustment_pieces, reason, adjusted_by, location_id)
      VALUES (
        v_item.product_id, -(v_item.quantity),
        'Transfer out: ' || NEW.reference,
        COALESCE(NEW.approved_by, NEW.requested_by),
        NEW.from_location_id
      );
      INSERT INTO sandbox.stock_batches (product_id, cartons, loose_pieces, notes, received_at, location_id)
      VALUES (
        v_item.product_id, 0, v_item.quantity,
        'Transfer in: ' || NEW.reference,
        now(), NEW.to_location_id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = sandbox;

DROP TRIGGER IF EXISTS trg_stock_transfer_complete ON sandbox.stock_transfers;
CREATE TRIGGER trg_stock_transfer_complete
  BEFORE UPDATE ON sandbox.stock_transfers
  FOR EACH ROW EXECUTE FUNCTION sandbox.handle_stock_transfer_complete();

-- Stamps stock_batches.original_units at insert time (mirrors public's
-- 20260623000000_stock_original_units_and_return_salesperson.sql).
CREATE OR REPLACE FUNCTION sandbox.set_stock_batch_original_units()
RETURNS TRIGGER AS $$
DECLARE
  v_ppc INT;
BEGIN
  SELECT GREATEST(COALESCE(pieces_per_carton, 1), 1)
    INTO v_ppc
    FROM sandbox.products
   WHERE id = NEW.product_id;

  NEW.original_units := COALESCE(NEW.cartons, 0) * v_ppc + COALESCE(NEW.loose_pieces, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = sandbox;

DROP TRIGGER IF EXISTS trg_set_batch_original_units ON sandbox.stock_batches;
CREATE TRIGGER trg_set_batch_original_units
  BEFORE INSERT ON sandbox.stock_batches
  FOR EACH ROW EXECUTE FUNCTION sandbox.set_stock_batch_original_units();

-- Loyalty/returns helper functions (mirrors public's sandbox-patch.sql PART 9).
CREATE OR REPLACE FUNCTION sandbox.get_available_stock_pieces(p_product_id UUID)
RETURNS INT AS $$
DECLARE
  v_ppc    INT;
  v_result INT;
BEGIN
  SELECT GREATEST(pieces_per_carton, 1) INTO v_ppc
  FROM sandbox.products WHERE id = p_product_id;

  SELECT COALESCE(SUM(b.cartons * v_ppc + b.loose_pieces), 0)
  INTO v_result
  FROM sandbox.stock_batches b
  WHERE b.product_id = p_product_id;

  RETURN GREATEST(v_result, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = sandbox;

CREATE OR REPLACE FUNCTION sandbox.restore_stock_pieces(
  p_product_id  UUID,
  p_cartons     INT,
  p_pieces      INT,
  p_notes       TEXT DEFAULT 'Customer return'
)
RETURNS VOID AS $$
DECLARE
  v_total_pieces INT;
  v_ppc          INT;
  v_new_cartons  INT;
  v_new_pieces   INT;
BEGIN
  IF p_cartons = 0 AND p_pieces = 0 THEN RETURN; END IF;

  SELECT GREATEST(pieces_per_carton, 1) INTO v_ppc
  FROM sandbox.products WHERE id = p_product_id;

  v_total_pieces := p_cartons * v_ppc + p_pieces;
  v_new_cartons  := v_total_pieces / v_ppc;
  v_new_pieces   := v_total_pieces % v_ppc;

  INSERT INTO sandbox.stock_batches (product_id, cartons, loose_pieces, notes, received_at)
  VALUES (p_product_id, v_new_cartons, v_new_pieces, p_notes, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = sandbox;

CREATE OR REPLACE FUNCTION sandbox.create_sales_return_atomic(p_payload JSONB)
RETURNS JSONB AS $$
DECLARE
  v_invoice           RECORD;
  v_inv_item          RECORD;
  v_return_id         UUID;
  v_exchange_inv_id   UUID;
  v_exchange_inv_no   TEXT;
  v_return_type       TEXT;
  v_status            TEXT;
  v_settlement_type   TEXT;
  v_refund_amount     NUMERIC := 0;
  v_exchange_diff     NUMERIC := 0;
  v_ret_item          JSONB;
  v_repl_item         JSONB;
  v_ppc               INT;
  v_need              INT;
  v_avail             INT;
  v_item_total        NUMERIC;
BEGIN
  IF (p_payload->>'original_invoice_id') IS NULL THEN
    RETURN jsonb_build_object('ok',false,'step','validation','message','original_invoice_id required');
  END IF;

  SELECT * INTO v_invoice
  FROM sandbox.invoices
  WHERE id = (p_payload->>'original_invoice_id')::UUID
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'step','load_invoice','message','Invoice not found');
  END IF;

  v_return_type := COALESCE(p_payload->>'return_type','Return');

  FOR v_ret_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'returned_items','[]'::jsonb))
  LOOP
    IF (v_ret_item->>'invoice_item_id') IS NOT NULL THEN
      SELECT id INTO v_inv_item
      FROM sandbox.invoice_items
      WHERE id = (v_ret_item->>'invoice_item_id')::UUID
        AND invoice_id = v_invoice.id;

      IF NOT FOUND THEN
        RETURN jsonb_build_object('ok',false,'step','validate_return_items',
          'message','Item ' || (v_ret_item->>'invoice_item_id') || ' not on this invoice');
      END IF;
    END IF;
  END LOOP;

  FOR v_ret_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'returned_items','[]'::jsonb))
  LOOP
    SELECT GREATEST(pieces_per_carton,1) INTO v_ppc
    FROM sandbox.products WHERE id = (v_ret_item->>'product_id')::UUID;
    v_refund_amount := v_refund_amount
      + COALESCE((v_ret_item->>'unit_price')::NUMERIC,0)
        * (COALESCE((v_ret_item->>'return_cartons')::INT,0) * v_ppc
           + COALESCE((v_ret_item->>'return_pieces')::INT,0));
  END LOOP;

  IF v_return_type = 'Exchange' THEN
    v_exchange_diff   := COALESCE((p_payload->>'exchange_difference')::NUMERIC, 0);
    v_settlement_type := COALESCE(p_payload->>'settlement_type','EvenExchange');

    FOR v_repl_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'replacement_items','[]'::jsonb))
    LOOP
      SELECT GREATEST(pieces_per_carton,1) INTO v_ppc
      FROM sandbox.products WHERE id = (v_repl_item->>'product_id')::UUID;
      v_need  := COALESCE((v_repl_item->>'cartons')::INT,0) * v_ppc
               + COALESCE((v_repl_item->>'pieces')::INT,0);
      v_avail := sandbox.get_available_stock_pieces((v_repl_item->>'product_id')::UUID);

      IF v_avail < v_need THEN
        RETURN jsonb_build_object('ok',false,'step','validate_replacement_stock',
          'message','Insufficient stock for ' || COALESCE(v_repl_item->>'product_name','product'));
      END IF;
    END LOOP;

    FOR v_ret_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'returned_items','[]'::jsonb))
    LOOP
      PERFORM sandbox.restore_stock_pieces(
        (v_ret_item->>'product_id')::UUID,
        COALESCE((v_ret_item->>'return_cartons')::INT,0),
        COALESCE((v_ret_item->>'return_pieces')::INT,0),
        'Exchange return for ' || v_invoice.invoice_no
      );
    END LOOP;

    v_exchange_inv_no := 'EXC-' || to_char(now(), 'YYYYMMDDHH24MISS');

    INSERT INTO sandbox.invoices (invoice_no, customer_id, mode, subtotal, discount, total, payment_status, notes)
    VALUES (
      v_exchange_inv_no,
      v_invoice.customer_id,
      v_invoice.mode,
      ABS(v_exchange_diff),
      0,
      ABS(v_exchange_diff),
      CASE
        WHEN ABS(v_exchange_diff) <= 0.01 THEN 'paid'
        WHEN (p_payload->>'settlement_method') IS NOT NULL THEN 'paid'
        ELSE 'unpaid'
      END,
      'Exchange for ' || v_invoice.invoice_no
    )
    RETURNING id INTO v_exchange_inv_id;

    FOR v_repl_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'replacement_items','[]'::jsonb))
    LOOP
      SELECT GREATEST(pieces_per_carton,1) INTO v_ppc
      FROM sandbox.products WHERE id = (v_repl_item->>'product_id')::UUID;
      v_item_total := COALESCE((v_repl_item->>'unit_price')::NUMERIC,0)
                    * (COALESCE((v_repl_item->>'cartons')::INT,0) * v_ppc
                       + COALESCE((v_repl_item->>'pieces')::INT,0));

      INSERT INTO sandbox.invoice_items (invoice_id, product_id, cartons, pieces, unit_price, total)
      VALUES (
        v_exchange_inv_id,
        (v_repl_item->>'product_id')::UUID,
        COALESCE((v_repl_item->>'cartons')::INT,0),
        COALESCE((v_repl_item->>'pieces')::INT,0),
        COALESCE((v_repl_item->>'unit_price')::NUMERIC,0),
        v_item_total
      );

      PERFORM sandbox.deduct_stock_fifo(
        (v_repl_item->>'product_id')::UUID,
        COALESCE((v_repl_item->>'cartons')::INT,0) * v_ppc
          + COALESCE((v_repl_item->>'pieces')::INT,0)
      );
    END LOOP;

    IF ABS(v_exchange_diff) > 0.01 AND (p_payload->>'settlement_method') IS NOT NULL THEN
      INSERT INTO sandbox.payments (invoice_id, customer_id, amount, method, reference, paid_at)
      VALUES (
        v_exchange_inv_id,
        v_invoice.customer_id,
        v_exchange_diff,
        p_payload->>'settlement_method',
        v_exchange_inv_no,
        now()
      );
    END IF;

    v_status := 'Completed';

  ELSE
    v_status          := 'Pending';
    v_exchange_inv_id := NULL;
    v_exchange_inv_no := NULL;
    v_settlement_type := NULL;
    v_exchange_diff   := NULL;
  END IF;

  INSERT INTO sandbox.sales_returns (
    return_number, original_invoice_id, exchange_invoice_id, exchange_invoice_no,
    return_type, reason, status, settlement_type, exchange_difference,
    refund_amount, returned_by, workflow_snapshot
  )
  VALUES (
    COALESCE(p_payload->>'return_number','RET-' || to_char(now(),'YYYYMMDDHH24MISS')),
    v_invoice.id,
    v_exchange_inv_id,
    v_exchange_inv_no,
    v_return_type,
    COALESCE(p_payload->>'reason',''),
    v_status,
    v_settlement_type,
    v_exchange_diff,
    v_refund_amount,
    COALESCE(p_payload->>'returned_by_name',''),
    jsonb_build_object(
      'original_invoice', row_to_json(v_invoice),
      'exchange_invoice_id', v_exchange_inv_id,
      'returned_items', COALESCE(p_payload->'returned_items','[]'::jsonb),
      'replacement_items', COALESCE(p_payload->'replacement_items','[]'::jsonb),
      'snapshot_at', now()
    )
  )
  RETURNING id INTO v_return_id;

  FOR v_ret_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'returned_items','[]'::jsonb))
  LOOP
    SELECT GREATEST(pieces_per_carton,1) INTO v_ppc
    FROM sandbox.products WHERE id = (v_ret_item->>'product_id')::UUID;
    v_item_total := COALESCE((v_ret_item->>'unit_price')::NUMERIC,0)
                  * (COALESCE((v_ret_item->>'return_cartons')::INT,0) * v_ppc
                     + COALESCE((v_ret_item->>'return_pieces')::INT,0));

    INSERT INTO sandbox.sales_return_items (
      return_id, invoice_item_id, product_id, product_name,
      return_cartons, return_pieces, unit_price, total
    )
    VALUES (
      v_return_id,
      CASE WHEN (v_ret_item->>'invoice_item_id') IS NOT NULL
           THEN (v_ret_item->>'invoice_item_id')::UUID
           ELSE NULL END,
      (v_ret_item->>'product_id')::UUID,
      COALESCE(v_ret_item->>'product_name',''),
      COALESCE((v_ret_item->>'return_cartons')::INT,0),
      COALESCE((v_ret_item->>'return_pieces')::INT,0),
      COALESCE((v_ret_item->>'unit_price')::NUMERIC,0),
      v_item_total
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'return_id', v_return_id,
    'return_number', (SELECT return_number FROM sandbox.sales_returns WHERE id = v_return_id),
    'status', v_status,
    'exchange_invoice_no', v_exchange_inv_no
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok',false,'step','exception','message',SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = sandbox;

CREATE OR REPLACE FUNCTION sandbox.complete_sales_return(
  p_return_id       UUID,
  p_resolution_type TEXT,
  p_completed_by    TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_return RECORD;
  v_item   RECORD;
  v_ppc    INT;
  v_units  INT;
BEGIN
  SELECT * INTO v_return FROM sandbox.sales_returns WHERE id = p_return_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'message','Return not found');
  END IF;
  IF v_return.status != 'Pending' THEN
    RETURN jsonb_build_object('ok',false,'message','Return is not Pending');
  END IF;
  IF p_resolution_type NOT IN ('Repaired','Replaced') THEN
    RETURN jsonb_build_object('ok',false,'message','Invalid resolution type');
  END IF;

  FOR v_item IN
    SELECT sri.product_id, sri.return_cartons, sri.return_pieces,
           GREATEST(p.pieces_per_carton,1) AS ppc
    FROM   sandbox.sales_return_items sri
    JOIN   sandbox.products p ON p.id = sri.product_id
    WHERE  sri.return_id = p_return_id
  LOOP
    v_units := v_item.return_cartons * v_item.ppc + v_item.return_pieces;
    IF v_units > 0 THEN
      IF p_resolution_type = 'Repaired' THEN
        PERFORM sandbox.restore_stock_pieces(
          v_item.product_id, v_item.return_cartons, v_item.return_pieces,
          'Repaired return ' || v_return.return_number
        );
      ELSE
        PERFORM sandbox.deduct_stock_fifo(v_item.product_id, v_units);
      END IF;
    END IF;
  END LOOP;

  UPDATE sandbox.sales_returns
  SET status          = 'Completed',
      resolution_type = p_resolution_type,
      updated_at      = now()
  WHERE id = p_return_id;

  RETURN jsonb_build_object('ok',true,'return_number',v_return.return_number,'resolution',p_resolution_type);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok',false,'message',SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = sandbox;

CREATE OR REPLACE FUNCTION sandbox.undo_sales_return_atomic(
  p_return_id   UUID,
  p_undo_reason TEXT,
  p_undone_by   TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_return   RECORD;
  v_snapshot JSONB;
  v_item     JSONB;
  v_ppc      INT;
  v_units    INT;
BEGIN
  SELECT * INTO v_return FROM sandbox.sales_returns WHERE id = p_return_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'step','validation','message','Return not found');
  END IF;
  IF v_return.status = 'Cancelled' THEN
    RETURN jsonb_build_object('ok',false,'step','already_cancelled','message','Already cancelled');
  END IF;

  v_snapshot := v_return.workflow_snapshot;

  IF v_return.status = 'Pending' THEN
    UPDATE sandbox.sales_returns
    SET status='Cancelled', cancelled_at=now(), cancelled_by=p_undone_by,
        cancel_reason=p_undo_reason, updated_at=now()
    WHERE id = p_return_id;
    RETURN jsonb_build_object('ok',true,'step','completed','action','cancelled_pending');
  END IF;

  IF v_return.return_type = 'Exchange' AND v_return.exchange_invoice_id IS NOT NULL THEN
    DELETE FROM sandbox.invoices WHERE id = v_return.exchange_invoice_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_snapshot->'returned_items','[]'::jsonb))
    LOOP
      SELECT GREATEST(pieces_per_carton,1) INTO v_ppc
      FROM sandbox.products WHERE id = (v_item->>'product_id')::UUID;
      v_units := COALESCE((v_item->>'return_cartons')::INT,0) * v_ppc
               + COALESCE((v_item->>'return_pieces')::INT,0);
      IF v_units > 0 THEN
        PERFORM sandbox.deduct_stock_fifo((v_item->>'product_id')::UUID, v_units);
      END IF;
    END LOOP;

    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_snapshot->'replacement_items','[]'::jsonb))
    LOOP
      PERFORM sandbox.restore_stock_pieces(
        (v_item->>'product_id')::UUID,
        COALESCE((v_item->>'cartons')::INT,0),
        COALESCE((v_item->>'pieces')::INT,0),
        'Undo exchange ' || v_return.return_number
      );
    END LOOP;
  END IF;

  IF v_return.return_type = 'Return' AND v_return.resolution_type = 'Replaced' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_snapshot->'returned_items','[]'::jsonb))
    LOOP
      SELECT GREATEST(pieces_per_carton,1) INTO v_ppc
      FROM sandbox.products WHERE id = (v_item->>'product_id')::UUID;
      PERFORM sandbox.restore_stock_pieces(
        (v_item->>'product_id')::UUID,
        COALESCE((v_item->>'return_cartons')::INT,0),
        COALESCE((v_item->>'return_pieces')::INT,0),
        'Undo replaced return ' || v_return.return_number
      );
    END LOOP;
  END IF;

  IF v_return.return_type = 'Return' AND v_return.resolution_type = 'Repaired' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_snapshot->'returned_items','[]'::jsonb))
    LOOP
      SELECT GREATEST(pieces_per_carton,1) INTO v_ppc
      FROM sandbox.products WHERE id = (v_item->>'product_id')::UUID;
      v_units := COALESCE((v_item->>'return_cartons')::INT,0) * v_ppc
               + COALESCE((v_item->>'return_pieces')::INT,0);
      IF v_units > 0 THEN
        PERFORM sandbox.deduct_stock_fifo((v_item->>'product_id')::UUID, v_units);
      END IF;
    END LOOP;
  END IF;

  UPDATE sandbox.sales_returns
  SET status='Cancelled', cancelled_at=now(), cancelled_by=p_undone_by,
      cancel_reason=p_undo_reason, updated_at=now()
  WHERE id = p_return_id;

  RETURN jsonb_build_object('ok',true,'step','completed','action','undone');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok',false,'step','exception','message',SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = sandbox;

-- ================================================================
-- VIEWS
-- ================================================================

CREATE OR REPLACE VIEW sandbox.product_stock AS
SELECT
  p.id               AS product_id,
  p.item_code, p.name, p.model, p.category,
  p.wholesale_price, p.retail_price, p.pieces_per_carton, p.reorder_level,
  COALESCE(bt.cartons_in, 0)         AS cartons_in,
  COALESCE(bt.pieces_in, 0)          AS pieces_in,
  COALESCE(st.cartons_sold, 0)       AS cartons_sold,
  COALESCE(st.pieces_sold, 0)        AS pieces_sold,
  COALESCE(at.carton_adj, 0::bigint) AS carton_adj,
  COALESCE(at.piece_adj, 0)          AS piece_adj
FROM sandbox.products p
LEFT JOIN (
  SELECT product_id, SUM(cartons) AS cartons_in, SUM(loose_pieces) AS pieces_in
  FROM sandbox.stock_batches GROUP BY product_id
) bt ON bt.product_id = p.id
LEFT JOIN (
  SELECT ii.product_id, SUM(ii.cartons) AS cartons_sold, SUM(ii.pieces) AS pieces_sold
  FROM sandbox.invoice_items ii
  JOIN sandbox.invoices inv ON inv.id = ii.invoice_id
  WHERE inv.payment_status IN ('partial', 'paid')
  GROUP BY ii.product_id
) st ON st.product_id = p.id
LEFT JOIN (
  SELECT product_id, 0::bigint AS carton_adj, SUM(adjustment_pieces) AS piece_adj
  FROM sandbox.stock_adjustments GROUP BY product_id
) at ON at.product_id = p.id;

CREATE OR REPLACE VIEW sandbox.product_stock_by_location AS
WITH batch_totals AS (
  SELECT sb.product_id, sb.location_id,
    SUM(sb.cartons * COALESCE(p.pieces_per_carton, 1) + sb.loose_pieces) AS units_in
  FROM sandbox.stock_batches sb JOIN sandbox.products p ON p.id = sb.product_id
  GROUP BY sb.product_id, sb.location_id
),
adj_totals AS (
  SELECT product_id, location_id, SUM(adjustment_pieces) AS units_adj
  FROM sandbox.stock_adjustments GROUP BY product_id, location_id
),
combined AS (
  SELECT product_id, location_id, units_in AS net FROM batch_totals
  UNION ALL
  SELECT product_id, location_id, units_adj AS net FROM adj_totals
)
SELECT
  p.id AS product_id, p.name, p.item_code, p.pieces_per_carton,
  c.location_id, l.name AS location_name, l.type AS location_type,
  SUM(c.net) AS total_units
FROM combined c
JOIN sandbox.products p ON p.id = c.product_id
LEFT JOIN sandbox.locations l ON l.id = c.location_id
GROUP BY p.id, p.name, p.item_code, p.pieces_per_carton, c.location_id, l.name, l.type;

CREATE OR REPLACE VIEW sandbox.product_movement_30d AS
SELECT
  ii.product_id,
  COALESCE(SUM(ii.pieces + ii.cartons * p.pieces_per_carton), 0)::INTEGER AS units_sold_30d,
  ROUND(COALESCE(SUM(ii.pieces + ii.cartons * p.pieces_per_carton), 0)::NUMERIC / 30, 2) AS units_per_day
FROM sandbox.invoice_items ii
JOIN sandbox.invoices inv ON inv.id = ii.invoice_id
JOIN sandbox.products p   ON p.id  = ii.product_id
WHERE inv.created_at >= now() - INTERVAL '30 days'
GROUP BY ii.product_id;

GRANT SELECT ON sandbox.product_stock             TO anon, authenticated;
GRANT SELECT ON sandbox.product_stock_by_location TO anon, authenticated;
GRANT SELECT ON sandbox.product_movement_30d      TO anon, authenticated;

-- ────────────────────────────────────────────────────────────────
-- Re-grant across everything created above (belt-and-braces on top
-- of the default-privileges grant in step 0).
-- ────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sandbox TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sandbox TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA sandbox TO anon, authenticated, service_role;

-- ================================================================
-- SEED DATA
-- ================================================================

INSERT INTO sandbox.customers (name, phone) VALUES ('Walk-in Customer', '-')
ON CONFLICT DO NOTHING;

INSERT INTO sandbox.locations (name, type) VALUES ('Main Warehouse', 'warehouse')
ON CONFLICT DO NOTHING;

-- Rename a pre-existing 'Main Shop' seed row to 'Shop' to match public
-- (mirrors public's 20260623000001_rename_main_shop_to_shop.sql). Must run
-- before the 'Shop' insert below so a fresh environment doesn't collide.
UPDATE sandbox.locations SET name = 'Shop' WHERE name = 'Main Shop' AND type = 'shop';

INSERT INTO sandbox.locations (name, type) VALUES ('Shop', 'shop')
ON CONFLICT DO NOTHING;

-- ================================================================
-- APP_META — identical structure in both `public` and `sandbox`,
-- each seeded with its own schema_marker so the app (and tests) can
-- verify at runtime which schema it is actually talking to.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.app_meta (
  id             INT PRIMARY KEY DEFAULT 1,
  schema_marker  TEXT NOT NULL,
  app_version    TEXT NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT app_meta_singleton CHECK (id = 1)
);
GRANT SELECT ON public.app_meta TO authenticated, service_role;

INSERT INTO public.app_meta (id, schema_marker, app_version, updated_at)
VALUES (1, 'public', '0.1.59', now())
ON CONFLICT (id) DO UPDATE SET
  schema_marker = EXCLUDED.schema_marker,
  app_version   = EXCLUDED.app_version,
  updated_at    = now();

CREATE TABLE IF NOT EXISTS sandbox.app_meta (
  id             INT PRIMARY KEY DEFAULT 1,
  schema_marker  TEXT NOT NULL,
  app_version    TEXT NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT app_meta_singleton CHECK (id = 1)
);
GRANT SELECT ON sandbox.app_meta TO authenticated, service_role;

INSERT INTO sandbox.app_meta (id, schema_marker, app_version, updated_at)
VALUES (1, 'sandbox', '0.1.59', now())
ON CONFLICT (id) DO UPDATE SET
  schema_marker = EXCLUDED.schema_marker,
  app_version   = EXCLUDED.app_version,
  updated_at    = now();

-- ================================================================
-- sandbox.reset_all() — the ONLY data-clearing primitive in the
-- sandbox feature. Structurally locked to schemaname = 'sandbox' so
-- it is impossible for it to touch `public`.
-- ================================================================

CREATE OR REPLACE FUNCTION sandbox.reset_all()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = sandbox, pg_temp AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables
           WHERE schemaname = 'sandbox' AND tablename <> 'app_meta'
  LOOP
    EXECUTE format('TRUNCATE TABLE sandbox.%I RESTART IDENTITY CASCADE', r.tablename);
  END LOOP;

  INSERT INTO sandbox.customers (name, phone) VALUES ('Walk-in Customer', '-')
  ON CONFLICT DO NOTHING;
  INSERT INTO sandbox.locations (name, type) VALUES ('Main Warehouse', 'warehouse')
  ON CONFLICT DO NOTHING;
  INSERT INTO sandbox.locations (name, type) VALUES ('Shop', 'shop')
  ON CONFLICT DO NOTHING;
END $$;

-- REVOKE from PUBLIC plus the specific roles that the blanket
-- "ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS" at the top of this
-- file would otherwise have granted EXECUTE to at CREATE FUNCTION time.
REVOKE ALL ON FUNCTION sandbox.reset_all() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION sandbox.reset_all() TO service_role;

-- ================================================================
-- DONE.
-- ================================================================
