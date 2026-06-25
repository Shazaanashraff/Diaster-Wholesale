-- ================================================================
-- Diastar ERP — Sandbox Schema Migration
-- 20260626000000_sandbox_schema_and_meta.sql
--
-- Convention: future migrations that change `public` apply the
-- identical DDL to `sandbox` in the same file.
--
-- This migration is idempotent: safe to run on a fresh database or
-- one where sandbox-setup.sql / sandbox-patch.sql were already run
-- by hand.  All table DDL uses CREATE TABLE IF NOT EXISTS; column
-- additions use ADD COLUMN IF NOT EXISTS; functions use
-- CREATE OR REPLACE; triggers use DROP … IF EXISTS before CREATE.
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- 0.  Schema creation + grants
-- ────────────────────────────────────────────────────────────────
create schema if not exists sandbox;
grant usage on schema sandbox to anon, authenticated, service_role;
alter default privileges in schema sandbox
  grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema sandbox
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema sandbox
  grant all on functions to anon, authenticated, service_role;

-- ────────────────────────────────────────────────────────────────
-- 1.  PRODUCTS
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.products (
  id                uuid        primary key default gen_random_uuid(),
  item_code         text        not null unique,
  name              text        not null,
  model             text        not null default '',
  description       text        not null default '',
  category          text        not null default 'general',
  wholesale_price   numeric(12,2) not null default 0,
  retail_price      numeric(12,2) not null default 0,
  pieces_per_carton int         not null default 1,
  reorder_level     int         not null default 0,
  is_active         boolean     default true,
  sku               text        unique,
  margin_pct        numeric(5,2) default 20,
  cost_price        numeric(12,2) not null default 0,
  msp               numeric(12,2) default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table sandbox.products disable row level security;
-- idempotency: ensure cost_price is not null on pre-existing schemas
update sandbox.products set cost_price = 0 where cost_price is null;
alter table sandbox.products alter column cost_price set not null;
alter table sandbox.products alter column cost_price set default 0;

-- ────────────────────────────────────────────────────────────────
-- 2.  CUSTOMERS
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.customers (
  id                     uuid        primary key default gen_random_uuid(),
  name                   text        not null,
  phone                  text        not null default '',
  email                  text        not null default '',
  address                text        not null default '',
  type                   text        not null default 'retail'
                           check (type in ('wholesale', 'retail')),
  credit_limit           numeric(12,2) not null default 0,
  outstanding_balance    numeric(12,2) not null default 0,
  credit_balance         numeric(12,2) not null default 0,
  loyalty_points         int         not null default 0,
  total_loyalty_earned   int         not null default 0,
  total_loyalty_redeemed int         not null default 0,
  cheque_float           numeric(12,2) not null default 0,
  is_active              boolean     default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
alter table sandbox.customers disable row level security;
-- idempotency: patch columns may already exist
alter table sandbox.customers add column if not exists loyalty_points         int           not null default 0;
alter table sandbox.customers add column if not exists total_loyalty_earned   int           not null default 0;
alter table sandbox.customers add column if not exists total_loyalty_redeemed int           not null default 0;
alter table sandbox.customers add column if not exists cheque_float           numeric(12,2) not null default 0;

-- ────────────────────────────────────────────────────────────────
-- 3.  SALESPEOPLE  (created before invoices to allow FK)
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.salespeople (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  active     boolean     not null default true,
  created_at timestamptz not null default now()
);
alter table sandbox.salespeople disable row level security;
grant select, insert, update, delete on sandbox.salespeople to anon, authenticated;

-- ────────────────────────────────────────────────────────────────
-- 4.  SHIPMENTS
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.shipments (
  id         uuid        primary key default gen_random_uuid(),
  reference  text        not null default '',
  supplier   text        not null default '',
  notes      text        not null default '',
  arrived_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table sandbox.shipments disable row level security;

-- ────────────────────────────────────────────────────────────────
-- 5.  SUPPLIERS
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.suppliers (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  contact_person  text,
  phone           text,
  email           text,
  country         text        default 'China',
  notes           text,
  is_active       boolean     default true,
  credit_limit    numeric(16,2) default 0,
  credit_days     integer     default 0,
  current_payable numeric(16,2) default 0,
  created_at      timestamptz default now()
);
alter table sandbox.suppliers enable row level security;
drop policy if exists "All access suppliers" on sandbox.suppliers;
create policy "All access suppliers" on sandbox.suppliers
  for all using (true) with check (true);

-- ────────────────────────────────────────────────────────────────
-- 6.  AUDIT LOG
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.audit_log (
  id         uuid        primary key default gen_random_uuid(),
  table_name text        not null,
  record_id  text,
  action     text        not null,
  old_values jsonb,
  new_values jsonb,
  user_label text        default 'System',
  notes      text,
  created_at timestamptz default now()
);
alter table sandbox.audit_log enable row level security;
drop policy if exists "All access audit_log" on sandbox.audit_log;
create policy "All access audit_log" on sandbox.audit_log
  for all using (true) with check (true);

-- ────────────────────────────────────────────────────────────────
-- 7.  LOCATIONS
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.locations (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null unique,
  type       text        not null check (type in ('warehouse', 'shop')),
  is_active  boolean     default true,
  created_at timestamptz default now()
);
alter table sandbox.locations enable row level security;
drop policy if exists "All access locations" on sandbox.locations;
create policy "All access locations" on sandbox.locations
  for all using (true) with check (true);

-- ────────────────────────────────────────────────────────────────
-- 8.  EXPENSES
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.expenses (
  id          uuid        primary key default gen_random_uuid(),
  category    text        not null default 'general',
  description text        not null default '',
  amount      numeric(12,2) not null default 0,
  reference   text        not null default '',
  method      text        not null default 'cash',
  notes       text        not null default '',
  created_by  text        default 'System',
  location_id uuid        references sandbox.locations(id),
  created_at  timestamptz not null default now()
);
alter table sandbox.expenses enable row level security;
drop policy if exists "All access expenses" on sandbox.expenses;
create policy "All access expenses" on sandbox.expenses
  for all using (true) with check (true);

-- ────────────────────────────────────────────────────────────────
-- 9.  STOCK BATCHES
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.stock_batches (
  id             uuid        primary key default gen_random_uuid(),
  product_id     uuid        not null references sandbox.products(id) on delete cascade,
  shipment_id    uuid        references sandbox.shipments(id) on delete set null,
  location_id    uuid        references sandbox.locations(id),
  cartons        int         not null default 0,
  loose_pieces   int         not null default 0,
  cost_per_piece numeric(12,2) not null default 0,
  original_units int,
  notes          text        not null default '',
  received_at    timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
alter table sandbox.stock_batches disable row level security;
alter table sandbox.stock_batches add column if not exists original_units int;

-- ────────────────────────────────────────────────────────────────
-- 10. STOCK ADJUSTMENTS
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.stock_adjustments (
  id                uuid        primary key default gen_random_uuid(),
  product_id        uuid        not null references sandbox.products(id) on delete cascade,
  location_id       uuid        references sandbox.locations(id),
  adjustment_pieces int         not null default 0,
  reason            text        not null default '',
  adjusted_by       text        not null default 'System',
  created_at        timestamptz not null default now()
);
alter table sandbox.stock_adjustments disable row level security;

-- ────────────────────────────────────────────────────────────────
-- 11. INVOICES
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.invoices (
  id               uuid        primary key default gen_random_uuid(),
  invoice_no       text        not null unique,
  customer_id      uuid        not null references sandbox.customers(id) on delete restrict,
  salesperson_id   uuid        references sandbox.salespeople(id) on delete set null,
  salesperson_name text,
  idempotency_key  text,
  mode             text        not null default 'retail'
                     check (mode in ('wholesale', 'retail')),
  subtotal         numeric(12,2) not null default 0,
  discount         numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,
  payment_status   text        not null default 'unpaid'
                     check (payment_status in ('unpaid', 'partial', 'paid')),
  notes            text        not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table sandbox.invoices disable row level security;
-- idempotency: patch columns may already exist
alter table sandbox.invoices add column if not exists idempotency_key  text;
alter table sandbox.invoices add column if not exists salesperson_name text;
alter table sandbox.invoices add column if not exists salesperson_id   uuid
  references sandbox.salespeople(id) on delete set null;

create unique index if not exists sandbox_invoices_idempotency_key_idx
  on sandbox.invoices (idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_sandbox_invoices_salesperson_id
  on sandbox.invoices (salesperson_id);

-- ────────────────────────────────────────────────────────────────
-- 12. INVOICE ITEMS
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.invoice_items (
  id         uuid        primary key default gen_random_uuid(),
  invoice_id uuid        not null references sandbox.invoices(id) on delete cascade,
  product_id uuid        not null references sandbox.products(id) on delete restrict,
  batch_id   uuid        references sandbox.stock_batches(id) on delete set null,
  cartons    int         not null default 0,
  pieces     int         not null default 0,
  unit_price numeric(12,2) not null default 0,
  total      numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
alter table sandbox.invoice_items disable row level security;

-- ────────────────────────────────────────────────────────────────
-- 13. PAYMENTS
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.payments (
  id            uuid        primary key default gen_random_uuid(),
  invoice_id    uuid        not null references sandbox.invoices(id) on delete cascade,
  customer_id   uuid        not null references sandbox.customers(id) on delete restrict,
  amount        numeric(12,2) not null default 0,
  method        text        not null default 'cash'
                  check (method in ('cash','card','cheque','credit','online','bank_transfer','mixed')),
  reference     text        not null default '',
  cheque_number text,
  bank_name     text,
  due_date      date,
  cheque_status text        check (cheque_status in ('pending','processing','completed','returned')),
  paid_at       timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
alter table sandbox.payments disable row level security;
alter table sandbox.payments add column if not exists cheque_status text
  check (cheque_status in ('pending','processing','completed','returned'));

-- ────────────────────────────────────────────────────────────────
-- 14. RETURNS  (legacy customer-return table)
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.returns (
  id            uuid        primary key default gen_random_uuid(),
  invoice_id    uuid        references sandbox.invoices(id) on delete set null,
  product_id    uuid        not null references sandbox.products(id) on delete cascade,
  cartons       int         not null default 0,
  pieces        int         not null default 0,
  reason        text        not null default '',
  refund_amount numeric(12,2) not null default 0,
  created_at    timestamptz not null default now()
);
alter table sandbox.returns disable row level security;

-- ────────────────────────────────────────────────────────────────
-- 15. PURCHASES
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.purchases (
  id              uuid        primary key default gen_random_uuid(),
  reference       text        unique not null,
  supplier_id     uuid        references sandbox.suppliers(id),
  location_id     uuid        references sandbox.locations(id),
  status          text        not null default 'draft'
                    check (status in ('draft','ordered','received','completed','cancelled')),
  exchange_rate   numeric(10,4) not null default 0,
  total_rmb       numeric(16,2) default 0,
  total_lkr       numeric(16,2) default 0,
  cost_finalized  boolean     default false,
  rep_name        text,
  discount_amount numeric(16,2) default 0,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table sandbox.purchases enable row level security;
drop policy if exists "All access purchases" on sandbox.purchases;
create policy "All access purchases" on sandbox.purchases
  for all using (true) with check (true);

-- ────────────────────────────────────────────────────────────────
-- 16. PURCHASE ITEMS
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.purchase_items (
  id               uuid        primary key default gen_random_uuid(),
  purchase_id      uuid        not null references sandbox.purchases(id) on delete cascade,
  product_id       uuid        not null references sandbox.products(id),
  quantity_units   integer     not null default 0,
  quantity_cartons integer     default 0,
  unit_price_rmb   numeric(12,4) not null default 0,
  discount_percent numeric(5,2) default 0,
  created_at       timestamptz default now()
);
alter table sandbox.purchase_items enable row level security;
drop policy if exists "All access purchase_items" on sandbox.purchase_items;
create policy "All access purchase_items" on sandbox.purchase_items
  for all using (true) with check (true);

-- ────────────────────────────────────────────────────────────────
-- 17. PURCHASE COSTS
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.purchase_costs (
  id          uuid        primary key default gen_random_uuid(),
  purchase_id uuid        not null references sandbox.purchases(id) on delete cascade,
  cost_type   text        not null default 'other'
                check (cost_type in ('shipping','clearing','tax','other')),
  amount_lkr  numeric(16,2) not null default 0,
  notes       text,
  created_at  timestamptz default now()
);
alter table sandbox.purchase_costs enable row level security;
drop policy if exists "All access purchase_costs" on sandbox.purchase_costs;
create policy "All access purchase_costs" on sandbox.purchase_costs
  for all using (true) with check (true);

-- ────────────────────────────────────────────────────────────────
-- 18. PURCHASE RECEIVE
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.purchase_receive (
  id             uuid        primary key default gen_random_uuid(),
  purchase_id    uuid        not null references sandbox.purchases(id),
  product_id     uuid        not null references sandbox.products(id),
  ordered_units  integer     not null default 0,
  received_units integer     not null default 0,
  damaged_units  integer     not null default 0,
  notes          text,
  received_at    timestamptz default now()
);
alter table sandbox.purchase_receive enable row level security;
drop policy if exists "All access purchase_receive" on sandbox.purchase_receive;
create policy "All access purchase_receive" on sandbox.purchase_receive
  for all using (true) with check (true);

-- ────────────────────────────────────────────────────────────────
-- 19. SUPPLIER PAYMENTS
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.supplier_payments (
  id            uuid        primary key default gen_random_uuid(),
  supplier_id   uuid        not null references sandbox.suppliers(id),
  purchase_id   uuid        references sandbox.purchases(id),
  amount        numeric(16,2) not null default 0,
  method        text        not null default 'cash'
                  check (method in ('cash','card','cheque','credit','online','bank_transfer','mixed')),
  cheque_number text,
  bank_name     text,
  due_date      timestamptz,
  notes         text,
  paid_at       timestamptz default now(),
  created_at    timestamptz default now()
);
alter table sandbox.supplier_payments enable row level security;
drop policy if exists "All access supplier_payments" on sandbox.supplier_payments;
create policy "All access supplier_payments" on sandbox.supplier_payments
  for all using (true) with check (true);

-- ────────────────────────────────────────────────────────────────
-- 20. SUPPLIER PAYMENT LINES
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.supplier_payment_lines (
  id            uuid        primary key default gen_random_uuid(),
  payment_id    uuid        not null references sandbox.supplier_payments(id) on delete cascade,
  amount        numeric(16,2) not null default 0,
  method        text        not null
                  check (method in ('cash','card','cheque','credit','online','bank_transfer')),
  cheque_number text,
  bank_name     text,
  due_date      timestamptz,
  notes         text,
  created_at    timestamptz default now()
);
alter table sandbox.supplier_payment_lines enable row level security;
drop policy if exists "All access supplier_payment_lines" on sandbox.supplier_payment_lines;
create policy "All access supplier_payment_lines" on sandbox.supplier_payment_lines
  for all using (true) with check (true);

-- ────────────────────────────────────────────────────────────────
-- 21. CARTONS
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.cartons (
  id           uuid        primary key default gen_random_uuid(),
  purchase_id  uuid        not null references sandbox.purchases(id) on delete cascade,
  product_id   uuid        not null references sandbox.products(id) on delete cascade,
  carton_index int         not null,
  carton_code  text        not null unique,
  status       text        not null default 'in_stock'
                 check (status in ('in_stock','sold','damaged')),
  created_at   timestamptz not null default now()
);
alter table sandbox.cartons disable row level security;

-- ────────────────────────────────────────────────────────────────
-- 22. SUPPLIER RETURNS
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.supplier_returns (
  id                    uuid        primary key default gen_random_uuid(),
  reference             text        unique not null,
  supplier_id           uuid        not null references sandbox.suppliers(id),
  purchase_id           uuid        references sandbox.purchases(id),
  return_type           text        not null default 'return'
                          check (return_type in ('return','exchange')),
  status                text        not null default 'pending'
                          check (status in ('pending','completed','cancelled')),
  return_value_lkr      numeric(16,2) not null default 0,
  replacement_value_lkr numeric(16,2) default 0,
  difference_lkr        numeric(16,2) default 0,
  settlement_type       text        check (settlement_type in ('payable','refund','credit_note','even')),
  settlement_notes      text,
  salesperson_id        uuid        references sandbox.salespeople(id) on delete set null,
  notes                 text,
  created_at            timestamptz default now(),
  completed_at          timestamptz
);
alter table sandbox.supplier_returns enable row level security;
drop policy if exists "All access supplier_returns" on sandbox.supplier_returns;
create policy "All access supplier_returns" on sandbox.supplier_returns
  for all using (true) with check (true);
alter table sandbox.supplier_returns add column if not exists salesperson_id uuid
  references sandbox.salespeople(id) on delete set null;

-- ────────────────────────────────────────────────────────────────
-- 23. SUPPLIER RETURN ITEMS
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.supplier_return_items (
  id             uuid        primary key default gen_random_uuid(),
  return_id      uuid        not null references sandbox.supplier_returns(id) on delete cascade,
  product_id     uuid        not null references sandbox.products(id),
  item_type      text        not null default 'return'
                   check (item_type in ('return','replacement')),
  quantity       integer     not null default 0,
  unit_value_lkr numeric(12,2) not null default 0,
  created_at     timestamptz default now()
);
alter table sandbox.supplier_return_items enable row level security;
drop policy if exists "All access supplier_return_items" on sandbox.supplier_return_items;
create policy "All access supplier_return_items" on sandbox.supplier_return_items
  for all using (true) with check (true);

-- ────────────────────────────────────────────────────────────────
-- 24. PURCHASE DISCOUNT APPROVALS
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.purchase_discount_approvals (
  id               uuid        primary key default gen_random_uuid(),
  purchase_id      uuid        not null references sandbox.purchases(id) on delete cascade,
  discount_type    text        not null check (discount_type in ('item','bill')),
  discount_percent numeric(5,2),
  discount_amount  numeric(16,2),
  status           text        not null default 'pending'
                     check (status in ('pending','approved','rejected')),
  requested_by     text        not null default 'System',
  approved_by      text,
  notes            text,
  created_at       timestamptz default now(),
  resolved_at      timestamptz
);
alter table sandbox.purchase_discount_approvals enable row level security;
drop policy if exists "All access purchase_discount_approvals" on sandbox.purchase_discount_approvals;
create policy "All access purchase_discount_approvals" on sandbox.purchase_discount_approvals
  for all using (true) with check (true);

-- ────────────────────────────────────────────────────────────────
-- 25. OTHER INCOME
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.other_income (
  id          uuid        primary key default gen_random_uuid(),
  source_type text        not null default 'other'
                check (source_type in ('supplier_refund','credit_note','discount_received','other')),
  amount      numeric(16,2) not null default 0,
  method      text        not null default 'cash',
  supplier_id uuid        references sandbox.suppliers(id),
  notes       text        not null default '',
  created_by  text        default 'System',
  created_at  timestamptz default now()
);
alter table sandbox.other_income enable row level security;
drop policy if exists "All access other_income" on sandbox.other_income;
create policy "All access other_income" on sandbox.other_income
  for all using (true) with check (true);

-- ────────────────────────────────────────────────────────────────
-- 26. STOCK TRANSFERS
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.stock_transfers (
  id               uuid        primary key default gen_random_uuid(),
  reference        text        unique not null,
  from_location_id uuid        not null references sandbox.locations(id),
  to_location_id   uuid        not null references sandbox.locations(id),
  status           text        not null default 'pending'
                     check (status in ('pending','completed','cancelled')),
  notes            text        not null default '',
  requested_by     text        not null default 'System',
  approved_by      text,
  created_at       timestamptz default now(),
  completed_at     timestamptz,
  constraint sandbox_different_locations check (from_location_id <> to_location_id)
);
alter table sandbox.stock_transfers enable row level security;
drop policy if exists "All access stock_transfers" on sandbox.stock_transfers;
create policy "All access stock_transfers" on sandbox.stock_transfers
  for all using (true) with check (true);

-- ────────────────────────────────────────────────────────────────
-- 27. STOCK TRANSFER ITEMS
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.stock_transfer_items (
  id          uuid        primary key default gen_random_uuid(),
  transfer_id uuid        not null references sandbox.stock_transfers(id) on delete cascade,
  product_id  uuid        not null references sandbox.products(id),
  quantity    integer     not null check (quantity > 0),
  created_at  timestamptz default now()
);
alter table sandbox.stock_transfer_items enable row level security;
drop policy if exists "All access stock_transfer_items" on sandbox.stock_transfer_items;
create policy "All access stock_transfer_items" on sandbox.stock_transfer_items
  for all using (true) with check (true);

-- ────────────────────────────────────────────────────────────────
-- 28. LOYALTY TRANSACTIONS
--     return_id FK to sales_returns added after that table exists.
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.loyalty_transactions (
  id               uuid        primary key default gen_random_uuid(),
  customer_id      uuid        not null references sandbox.customers(id) on delete restrict,
  invoice_id       uuid        references sandbox.invoices(id) on delete set null,
  return_id        uuid,
  transaction_type text        not null
                     check (transaction_type in ('EARN','REDEEM','RETURN_REVERSAL','RETURN_UNDO')),
  points           int         not null default 0,
  notes            text        not null default '',
  created_at       timestamptz not null default now()
);
alter table sandbox.loyalty_transactions disable row level security;

-- ────────────────────────────────────────────────────────────────
-- 29. SALES RETURNS
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.sales_returns (
  id                  uuid        primary key default gen_random_uuid(),
  return_number       text        not null unique,
  original_invoice_id uuid        not null references sandbox.invoices(id) on delete restrict,
  exchange_invoice_id uuid        references sandbox.invoices(id) on delete set null,
  exchange_invoice_no text,
  return_type         text        not null default 'Return'
                        check (return_type in ('Return','Exchange')),
  reason              text        not null default '',
  status              text        not null default 'Pending'
                        check (status in ('Pending','Completed','Cancelled')),
  resolution_type     text        check (resolution_type in ('Repaired','Replaced')),
  settlement_type     text        check (settlement_type in ('UpgradePayment','CashRefund','EvenExchange')),
  exchange_difference numeric(12,2),
  refund_amount       numeric(12,2) not null default 0,
  returned_by         text        not null default '',
  salesperson_id      uuid        references sandbox.salespeople(id) on delete set null,
  workflow_snapshot   jsonb,
  cancelled_at        timestamptz,
  cancelled_by        text,
  cancel_reason       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table sandbox.sales_returns disable row level security;
alter table sandbox.sales_returns add column if not exists salesperson_id uuid
  references sandbox.salespeople(id) on delete set null;

-- Back-fill FK on loyalty_transactions.return_id now that sales_returns exists
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'sandbox'
      and table_name        = 'loyalty_transactions'
      and constraint_name   = 'fk_sandbox_loyalty_return'
  ) then
    alter table sandbox.loyalty_transactions
      add constraint fk_sandbox_loyalty_return
      foreign key (return_id) references sandbox.sales_returns(id) on delete set null;
  end if;
end;
$$;

-- ────────────────────────────────────────────────────────────────
-- 30. SALES RETURN ITEMS
-- ────────────────────────────────────────────────────────────────
create table if not exists sandbox.sales_return_items (
  id              uuid        primary key default gen_random_uuid(),
  return_id       uuid        not null references sandbox.sales_returns(id) on delete cascade,
  invoice_item_id uuid        references sandbox.invoice_items(id) on delete set null,
  product_id      uuid        not null references sandbox.products(id) on delete restrict,
  product_name    text        not null default '',
  return_cartons  int         not null default 0,
  return_pieces   int         not null default 0,
  unit_price      numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  created_at      timestamptz not null default now()
);
alter table sandbox.sales_return_items disable row level security;

-- ================================================================
-- TABLE GRANTS (explicit grants for all tables)
-- ================================================================
grant select, insert, update, delete on all tables in schema sandbox
  to authenticated, service_role;
grant usage, select on all sequences in schema sandbox
  to authenticated, service_role;
grant select, insert, update on sandbox.loyalty_transactions to anon, authenticated;
grant select, insert, update on sandbox.sales_returns         to anon, authenticated;
grant select, insert         on sandbox.sales_return_items    to anon, authenticated;

-- ================================================================
-- FUNCTIONS
-- ================================================================

create or replace function sandbox.generate_product_item_code()
returns text language plpgsql set search_path = sandbox as $$
declare candidate text;
begin
  loop
    candidate := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from sandbox.products where item_code = candidate);
  end loop;
  return candidate;
end $$;

create or replace function sandbox.set_product_item_code()
returns trigger language plpgsql set search_path = sandbox as $$
begin
  if new.item_code is null or btrim(new.item_code) = '' then
    new.item_code := sandbox.generate_product_item_code();
  end if;
  return new;
end $$;

create or replace function sandbox.update_updated_at_column()
returns trigger language plpgsql set search_path = sandbox as $$
begin new.updated_at = now(); return new; end $$;

create or replace function sandbox.generate_purchase_reference()
returns text language plpgsql security definer set search_path = sandbox as $$
declare next_num integer;
begin
  select coalesce(max(cast(substring(reference from 3) as integer)), 0) + 1
  into next_num from sandbox.purchases where reference ~ '^PO[0-9]+$';
  return 'PO' || lpad(next_num::text, 4, '0');
end $$;

create or replace function sandbox.generate_return_reference()
returns text language plpgsql security definer set search_path = sandbox as $$
declare next_num integer;
begin
  next_num := (
    select coalesce(max(cast(substring(reference from 3) as integer)), 0) + 1
    from sandbox.supplier_returns where reference ~ '^SR[0-9]+$'
  );
  return 'SR' || lpad(next_num::text, 4, '0');
end $$;

create or replace function sandbox.generate_transfer_reference()
returns text language plpgsql security definer set search_path = sandbox as $$
declare next_num integer;
begin
  next_num := (
    select coalesce(max(cast(substring(reference from 3) as integer)), 0) + 1
    from sandbox.stock_transfers where reference ~ '^ST[0-9]+$'
  );
  return 'ST' || lpad(next_num::text, 4, '0');
end $$;

create or replace function sandbox.deduct_stock_from_batch(p_batch_id uuid, p_units int)
returns void language plpgsql set search_path = sandbox as $$
declare
  v_ppc int; v_needed_cartons int; v_needed_loose int;
begin
  select p.pieces_per_carton into v_ppc
  from sandbox.stock_batches b join sandbox.products p on p.id = b.product_id
  where b.id = p_batch_id;
  v_needed_cartons := p_units / v_ppc;
  v_needed_loose   := p_units % v_ppc;
  update sandbox.stock_batches
    set cartons = cartons - v_needed_cartons, loose_pieces = loose_pieces - v_needed_loose
    where id = p_batch_id;
  update sandbox.stock_batches
    set cartons = cartons - 1, loose_pieces = loose_pieces + v_ppc
    where id = p_batch_id and loose_pieces < 0;
end $$;

create or replace function sandbox.deduct_stock_fifo(p_product_id uuid, p_units integer)
returns void language plpgsql security definer set search_path = sandbox as $$
declare
  batch record; remaining integer := p_units;
  ppc integer; batch_pieces integer; new_total integer; new_cartons integer; new_loose integer;
begin
  for batch in
    select b.id, b.cartons, b.loose_pieces, p.pieces_per_carton
    from sandbox.stock_batches b join sandbox.products p on p.id = b.product_id
    where b.product_id = p_product_id
    order by b.received_at asc nulls last, b.created_at asc
  loop
    exit when remaining <= 0;
    ppc          := greatest(batch.pieces_per_carton, 1);
    batch_pieces := batch.cartons * ppc + batch.loose_pieces;
    if remaining >= batch_pieces then
      delete from sandbox.stock_batches where id = batch.id;
      remaining := remaining - batch_pieces;
    else
      new_total   := batch_pieces - remaining;
      new_cartons := new_total / ppc;
      new_loose   := new_total % ppc;
      update sandbox.stock_batches set cartons = new_cartons, loose_pieces = new_loose where id = batch.id;
      remaining := 0;
    end if;
  end loop;
  if remaining > 0 then
    raise exception 'Insufficient stock: % units undeducted for product %', remaining, p_product_id;
  end if;
end $$;

create or replace function sandbox.trg_purchase_receive_stock()
returns trigger language plpgsql set search_path = sandbox as $$
declare
  v_recv record; v_ppc int; v_sellable int; v_cartons int; v_loose int;
begin
  if old.status is distinct from 'received' and new.status = 'received' then
    for v_recv in
      select product_id, received_units, damaged_units
      from sandbox.purchase_receive where purchase_id = new.id
    loop
      v_sellable := greatest(0, v_recv.received_units - coalesce(v_recv.damaged_units, 0));
      if v_sellable > 0 then
        select coalesce(pieces_per_carton, 1) into v_ppc from sandbox.products where id = v_recv.product_id;
        v_ppc     := coalesce(v_ppc, 1);
        v_cartons := v_sellable / v_ppc;
        v_loose   := v_sellable % v_ppc;
        insert into sandbox.stock_batches (product_id, cartons, loose_pieces, notes, received_at)
        values (v_recv.product_id, v_cartons, v_loose, 'Received from PO: ' || new.reference, now());
      end if;
    end loop;
  end if;
  return new;
end $$;

create or replace function sandbox.handle_supplier_return_complete()
returns trigger language plpgsql set search_path = sandbox as $$
begin
  if old.status <> 'completed' and new.status = 'completed' then
    insert into sandbox.stock_adjustments (product_id, adjustment_pieces, reason, adjusted_by)
    select sri.product_id, -(sri.quantity), 'Supplier Return: ' || new.reference, 'System'
    from sandbox.supplier_return_items sri
    where sri.return_id = new.id and sri.item_type = 'return';

    insert into sandbox.stock_batches (product_id, cartons, loose_pieces, cost_per_piece, notes)
    select sri.product_id, 0, sri.quantity, sri.unit_value_lkr,
           'Supplier Exchange Replacement: ' || new.reference
    from sandbox.supplier_return_items sri
    where sri.return_id = new.id and sri.item_type = 'replacement';

    new.completed_at = now();
  end if;
  return new;
end $$;

create or replace function sandbox.trg_supplier_payable_update()
returns trigger language plpgsql set search_path = sandbox as $$
begin
  if new.method = 'credit' then
    update sandbox.suppliers set current_payable = current_payable + new.amount where id = new.supplier_id;
  end if;
  return new;
end $$;

create or replace function sandbox.handle_stock_transfer_complete()
returns trigger language plpgsql set search_path = sandbox as $$
declare v_item record;
begin
  if old.status <> 'completed' and new.status = 'completed' then
    new.completed_at := now();
    for v_item in
      select sti.product_id, sti.quantity
      from sandbox.stock_transfer_items sti where sti.transfer_id = new.id
    loop
      insert into sandbox.stock_adjustments (product_id, adjustment_pieces, reason, adjusted_by, location_id)
      values (
        v_item.product_id, -(v_item.quantity),
        'Transfer out: ' || new.reference,
        coalesce(new.approved_by, new.requested_by),
        new.from_location_id
      );
      insert into sandbox.stock_batches (product_id, cartons, loose_pieces, notes, received_at, location_id)
      values (
        v_item.product_id, 0, v_item.quantity,
        'Transfer in: ' || new.reference,
        now(), new.to_location_id
      );
    end loop;
  end if;
  return new;
end $$;

create or replace function sandbox.set_stock_batch_original_units()
returns trigger language plpgsql as $$
declare v_ppc int;
begin
  select greatest(coalesce(pieces_per_carton, 1), 1)
    into v_ppc
    from sandbox.products
   where id = new.product_id;
  new.original_units := coalesce(new.cartons, 0) * v_ppc + coalesce(new.loose_pieces, 0);
  return new;
end $$;

create or replace function sandbox.get_available_stock_pieces(p_product_id uuid)
returns int language plpgsql security definer set search_path = sandbox as $$
declare v_ppc int; v_result int;
begin
  select greatest(pieces_per_carton, 1) into v_ppc
  from sandbox.products where id = p_product_id;
  select coalesce(sum(b.cartons * v_ppc + b.loose_pieces), 0)
  into v_result
  from sandbox.stock_batches b
  where b.product_id = p_product_id;
  return greatest(v_result, 0);
end $$;

create or replace function sandbox.restore_stock_pieces(
  p_product_id uuid,
  p_cartons    int,
  p_pieces     int,
  p_notes      text default 'Customer return'
)
returns void language plpgsql security definer set search_path = sandbox as $$
declare
  v_total_pieces int; v_ppc int; v_new_cartons int; v_new_pieces int;
begin
  if p_cartons = 0 and p_pieces = 0 then return; end if;
  select greatest(pieces_per_carton, 1) into v_ppc
  from sandbox.products where id = p_product_id;
  v_total_pieces := p_cartons * v_ppc + p_pieces;
  v_new_cartons  := v_total_pieces / v_ppc;
  v_new_pieces   := v_total_pieces % v_ppc;
  insert into sandbox.stock_batches (product_id, cartons, loose_pieces, notes, received_at)
  values (p_product_id, v_new_cartons, v_new_pieces, p_notes, now());
end $$;

create or replace function sandbox.create_sales_return_atomic(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = sandbox as $$
declare
  v_invoice           record;
  v_inv_item          record;
  v_return_id         uuid;
  v_exchange_inv_id   uuid;
  v_exchange_inv_no   text;
  v_return_type       text;
  v_status            text;
  v_settlement_type   text;
  v_refund_amount     numeric := 0;
  v_exchange_diff     numeric := 0;
  v_ret_item          jsonb;
  v_repl_item         jsonb;
  v_ppc               int;
  v_need              int;
  v_avail             int;
  v_item_total        numeric;
begin
  if (p_payload->>'original_invoice_id') is null then
    return jsonb_build_object('ok',false,'step','validation','message','original_invoice_id required');
  end if;
  select * into v_invoice
  from sandbox.invoices
  where id = (p_payload->>'original_invoice_id')::uuid for update;
  if not found then
    return jsonb_build_object('ok',false,'step','load_invoice','message','Invoice not found');
  end if;
  v_return_type := coalesce(p_payload->>'return_type','Return');
  for v_ret_item in select * from jsonb_array_elements(coalesce(p_payload->'returned_items','[]'::jsonb))
  loop
    if (v_ret_item->>'invoice_item_id') is not null then
      select id into v_inv_item
      from sandbox.invoice_items
      where id = (v_ret_item->>'invoice_item_id')::uuid and invoice_id = v_invoice.id;
      if not found then
        return jsonb_build_object('ok',false,'step','validate_return_items',
          'message','Item ' || (v_ret_item->>'invoice_item_id') || ' not on this invoice');
      end if;
    end if;
  end loop;
  for v_ret_item in select * from jsonb_array_elements(coalesce(p_payload->'returned_items','[]'::jsonb))
  loop
    select greatest(pieces_per_carton,1) into v_ppc
    from sandbox.products where id = (v_ret_item->>'product_id')::uuid;
    v_refund_amount := v_refund_amount
      + coalesce((v_ret_item->>'unit_price')::numeric,0)
        * (coalesce((v_ret_item->>'return_cartons')::int,0) * v_ppc
           + coalesce((v_ret_item->>'return_pieces')::int,0));
  end loop;
  if v_return_type = 'Exchange' then
    v_exchange_diff   := coalesce((p_payload->>'exchange_difference')::numeric, 0);
    v_settlement_type := coalesce(p_payload->>'settlement_type','EvenExchange');
    for v_repl_item in select * from jsonb_array_elements(coalesce(p_payload->'replacement_items','[]'::jsonb))
    loop
      select greatest(pieces_per_carton,1) into v_ppc
      from sandbox.products where id = (v_repl_item->>'product_id')::uuid;
      v_need  := coalesce((v_repl_item->>'cartons')::int,0) * v_ppc
               + coalesce((v_repl_item->>'pieces')::int,0);
      v_avail := sandbox.get_available_stock_pieces((v_repl_item->>'product_id')::uuid);
      if v_avail < v_need then
        return jsonb_build_object('ok',false,'step','validate_replacement_stock',
          'message','Insufficient stock for ' || coalesce(v_repl_item->>'product_name','product'));
      end if;
    end loop;
    for v_ret_item in select * from jsonb_array_elements(coalesce(p_payload->'returned_items','[]'::jsonb))
    loop
      perform sandbox.restore_stock_pieces(
        (v_ret_item->>'product_id')::uuid,
        coalesce((v_ret_item->>'return_cartons')::int,0),
        coalesce((v_ret_item->>'return_pieces')::int,0),
        'Exchange return for ' || v_invoice.invoice_no
      );
    end loop;
    v_exchange_inv_no := 'EXC-' || to_char(now(), 'YYYYMMDDHH24MISS');
    insert into sandbox.invoices (invoice_no, customer_id, mode, subtotal, discount, total, payment_status, notes)
    values (
      v_exchange_inv_no, v_invoice.customer_id, v_invoice.mode,
      abs(v_exchange_diff), 0, abs(v_exchange_diff),
      case when abs(v_exchange_diff) <= 0.01 then 'paid'
           when (p_payload->>'settlement_method') is not null then 'paid'
           else 'unpaid' end,
      'Exchange for ' || v_invoice.invoice_no
    ) returning id into v_exchange_inv_id;
    for v_repl_item in select * from jsonb_array_elements(coalesce(p_payload->'replacement_items','[]'::jsonb))
    loop
      select greatest(pieces_per_carton,1) into v_ppc
      from sandbox.products where id = (v_repl_item->>'product_id')::uuid;
      v_item_total := coalesce((v_repl_item->>'unit_price')::numeric,0)
                    * (coalesce((v_repl_item->>'cartons')::int,0) * v_ppc
                       + coalesce((v_repl_item->>'pieces')::int,0));
      insert into sandbox.invoice_items (invoice_id, product_id, cartons, pieces, unit_price, total)
      values (v_exchange_inv_id, (v_repl_item->>'product_id')::uuid,
              coalesce((v_repl_item->>'cartons')::int,0), coalesce((v_repl_item->>'pieces')::int,0),
              coalesce((v_repl_item->>'unit_price')::numeric,0), v_item_total);
      perform sandbox.deduct_stock_fifo(
        (v_repl_item->>'product_id')::uuid,
        coalesce((v_repl_item->>'cartons')::int,0) * v_ppc + coalesce((v_repl_item->>'pieces')::int,0)
      );
    end loop;
    if abs(v_exchange_diff) > 0.01 and (p_payload->>'settlement_method') is not null then
      insert into sandbox.payments (invoice_id, customer_id, amount, method, reference, paid_at)
      values (v_exchange_inv_id, v_invoice.customer_id, v_exchange_diff,
              p_payload->>'settlement_method', v_exchange_inv_no, now());
    end if;
    v_status := 'Completed';
  else
    v_status := 'Pending'; v_exchange_inv_id := null; v_exchange_inv_no := null;
    v_settlement_type := null; v_exchange_diff := null;
  end if;
  insert into sandbox.sales_returns (
    return_number, original_invoice_id, exchange_invoice_id, exchange_invoice_no,
    return_type, reason, status, settlement_type, exchange_difference,
    refund_amount, returned_by, workflow_snapshot
  ) values (
    coalesce(p_payload->>'return_number','RET-' || to_char(now(),'YYYYMMDDHH24MISS')),
    v_invoice.id, v_exchange_inv_id, v_exchange_inv_no,
    v_return_type, coalesce(p_payload->>'reason',''),
    v_status, v_settlement_type, v_exchange_diff, v_refund_amount,
    coalesce(p_payload->>'returned_by_name',''),
    jsonb_build_object(
      'original_invoice', row_to_json(v_invoice),
      'exchange_invoice_id', v_exchange_inv_id,
      'returned_items',  coalesce(p_payload->'returned_items','[]'::jsonb),
      'replacement_items', coalesce(p_payload->'replacement_items','[]'::jsonb),
      'snapshot_at', now()
    )
  ) returning id into v_return_id;
  for v_ret_item in select * from jsonb_array_elements(coalesce(p_payload->'returned_items','[]'::jsonb))
  loop
    select greatest(pieces_per_carton,1) into v_ppc
    from sandbox.products where id = (v_ret_item->>'product_id')::uuid;
    v_item_total := coalesce((v_ret_item->>'unit_price')::numeric,0)
                  * (coalesce((v_ret_item->>'return_cartons')::int,0) * v_ppc
                     + coalesce((v_ret_item->>'return_pieces')::int,0));
    insert into sandbox.sales_return_items (
      return_id, invoice_item_id, product_id, product_name,
      return_cartons, return_pieces, unit_price, total
    ) values (
      v_return_id,
      case when (v_ret_item->>'invoice_item_id') is not null
           then (v_ret_item->>'invoice_item_id')::uuid else null end,
      (v_ret_item->>'product_id')::uuid,
      coalesce(v_ret_item->>'product_name',''),
      coalesce((v_ret_item->>'return_cartons')::int,0),
      coalesce((v_ret_item->>'return_pieces')::int,0),
      coalesce((v_ret_item->>'unit_price')::numeric,0),
      v_item_total
    );
  end loop;
  return jsonb_build_object(
    'ok', true, 'return_id', v_return_id,
    'return_number', (select return_number from sandbox.sales_returns where id = v_return_id),
    'status', v_status, 'exchange_invoice_no', v_exchange_inv_no
  );
exception when others then
  return jsonb_build_object('ok',false,'step','exception','message',sqlerrm);
end $$;

create or replace function sandbox.complete_sales_return(
  p_return_id       uuid,
  p_resolution_type text,
  p_completed_by    text
)
returns jsonb language plpgsql security definer set search_path = sandbox as $$
declare v_return record; v_item record; v_ppc int; v_units int;
begin
  select * into v_return from sandbox.sales_returns where id = p_return_id for update;
  if not found then return jsonb_build_object('ok',false,'message','Return not found'); end if;
  if v_return.status != 'Pending' then return jsonb_build_object('ok',false,'message','Return is not Pending'); end if;
  if p_resolution_type not in ('Repaired','Replaced') then
    return jsonb_build_object('ok',false,'message','Invalid resolution type');
  end if;
  for v_item in
    select sri.product_id, sri.return_cartons, sri.return_pieces,
           greatest(p.pieces_per_carton,1) as ppc
    from sandbox.sales_return_items sri join sandbox.products p on p.id = sri.product_id
    where sri.return_id = p_return_id
  loop
    v_units := v_item.return_cartons * v_item.ppc + v_item.return_pieces;
    if v_units > 0 then
      if p_resolution_type = 'Repaired' then
        perform sandbox.restore_stock_pieces(v_item.product_id, v_item.return_cartons, v_item.return_pieces,
          'Repaired return ' || v_return.return_number);
      else
        perform sandbox.deduct_stock_fifo(v_item.product_id, v_units);
      end if;
    end if;
  end loop;
  update sandbox.sales_returns
  set status = 'Completed', resolution_type = p_resolution_type, updated_at = now()
  where id = p_return_id;
  return jsonb_build_object('ok',true,'return_number',v_return.return_number,'resolution',p_resolution_type);
exception when others then
  return jsonb_build_object('ok',false,'message',sqlerrm);
end $$;

create or replace function sandbox.undo_sales_return_atomic(
  p_return_id   uuid,
  p_undo_reason text,
  p_undone_by   text
)
returns jsonb language plpgsql security definer set search_path = sandbox as $$
declare v_return record; v_snapshot jsonb; v_item jsonb; v_ppc int; v_units int;
begin
  select * into v_return from sandbox.sales_returns where id = p_return_id for update;
  if not found then return jsonb_build_object('ok',false,'step','validation','message','Return not found'); end if;
  if v_return.status = 'Cancelled' then
    return jsonb_build_object('ok',false,'step','already_cancelled','message','Already cancelled');
  end if;
  v_snapshot := v_return.workflow_snapshot;
  if v_return.status = 'Pending' then
    update sandbox.sales_returns
    set status='Cancelled', cancelled_at=now(), cancelled_by=p_undone_by,
        cancel_reason=p_undo_reason, updated_at=now()
    where id = p_return_id;
    return jsonb_build_object('ok',true,'step','completed','action','cancelled_pending');
  end if;
  if v_return.return_type = 'Exchange' and v_return.exchange_invoice_id is not null then
    delete from sandbox.invoices where id = v_return.exchange_invoice_id;
    for v_item in select * from jsonb_array_elements(coalesce(v_snapshot->'returned_items','[]'::jsonb))
    loop
      select greatest(pieces_per_carton,1) into v_ppc
      from sandbox.products where id = (v_item->>'product_id')::uuid;
      v_units := coalesce((v_item->>'return_cartons')::int,0) * v_ppc
               + coalesce((v_item->>'return_pieces')::int,0);
      if v_units > 0 then perform sandbox.deduct_stock_fifo((v_item->>'product_id')::uuid, v_units); end if;
    end loop;
    for v_item in select * from jsonb_array_elements(coalesce(v_snapshot->'replacement_items','[]'::jsonb))
    loop
      perform sandbox.restore_stock_pieces(
        (v_item->>'product_id')::uuid,
        coalesce((v_item->>'cartons')::int,0), coalesce((v_item->>'pieces')::int,0),
        'Undo exchange ' || v_return.return_number
      );
    end loop;
  end if;
  if v_return.return_type = 'Return' and v_return.resolution_type = 'Replaced' then
    for v_item in select * from jsonb_array_elements(coalesce(v_snapshot->'returned_items','[]'::jsonb))
    loop
      select greatest(pieces_per_carton,1) into v_ppc
      from sandbox.products where id = (v_item->>'product_id')::uuid;
      perform sandbox.restore_stock_pieces(
        (v_item->>'product_id')::uuid,
        coalesce((v_item->>'return_cartons')::int,0), coalesce((v_item->>'return_pieces')::int,0),
        'Undo replaced return ' || v_return.return_number
      );
    end loop;
  end if;
  if v_return.return_type = 'Return' and v_return.resolution_type = 'Repaired' then
    for v_item in select * from jsonb_array_elements(coalesce(v_snapshot->'returned_items','[]'::jsonb))
    loop
      select greatest(pieces_per_carton,1) into v_ppc
      from sandbox.products where id = (v_item->>'product_id')::uuid;
      v_units := coalesce((v_item->>'return_cartons')::int,0) * v_ppc
               + coalesce((v_item->>'return_pieces')::int,0);
      if v_units > 0 then perform sandbox.deduct_stock_fifo((v_item->>'product_id')::uuid, v_units); end if;
    end loop;
  end if;
  update sandbox.sales_returns
  set status='Cancelled', cancelled_at=now(), cancelled_by=p_undone_by,
      cancel_reason=p_undo_reason, updated_at=now()
  where id = p_return_id;
  return jsonb_build_object('ok',true,'step','completed','action','undone');
exception when others then
  return jsonb_build_object('ok',false,'step','exception','message',sqlerrm);
end $$;

-- Function grants
grant execute on function sandbox.get_available_stock_pieces(uuid)        to anon, authenticated;
grant execute on function sandbox.restore_stock_pieces(uuid,int,int,text) to anon, authenticated;
grant execute on function sandbox.create_sales_return_atomic(jsonb)       to anon, authenticated;
grant execute on function sandbox.complete_sales_return(uuid,text,text)   to anon, authenticated;
grant execute on function sandbox.undo_sales_return_atomic(uuid,text,text) to anon, authenticated;

-- ================================================================
-- TRIGGERS
-- ================================================================

drop trigger if exists products_set_item_code on sandbox.products;
create trigger products_set_item_code
  before insert on sandbox.products
  for each row execute function sandbox.set_product_item_code();

drop trigger if exists purchases_updated_at on sandbox.purchases;
create trigger purchases_updated_at
  before update on sandbox.purchases
  for each row execute function sandbox.update_updated_at_column();

drop trigger if exists trg_purchase_receive_trigger on sandbox.purchases;
create trigger trg_purchase_receive_trigger
  after update on sandbox.purchases
  for each row execute function sandbox.trg_purchase_receive_stock();

drop trigger if exists trg_supplier_return_complete on sandbox.supplier_returns;
create trigger trg_supplier_return_complete
  before update on sandbox.supplier_returns
  for each row execute function sandbox.handle_supplier_return_complete();

drop trigger if exists trg_supplier_payments_credit on sandbox.supplier_payments;
create trigger trg_supplier_payments_credit
  after insert on sandbox.supplier_payments
  for each row execute function sandbox.trg_supplier_payable_update();

drop trigger if exists trg_stock_transfer_complete on sandbox.stock_transfers;
create trigger trg_stock_transfer_complete
  before update on sandbox.stock_transfers
  for each row execute function sandbox.handle_stock_transfer_complete();

drop trigger if exists trg_set_sandbox_batch_original_units on sandbox.stock_batches;
create trigger trg_set_sandbox_batch_original_units
  before insert on sandbox.stock_batches
  for each row execute function sandbox.set_stock_batch_original_units();

-- ================================================================
-- VIEWS
-- ================================================================

create or replace view sandbox.product_stock as
select
  p.id               as product_id,
  p.item_code, p.name, p.model, p.category,
  p.wholesale_price, p.retail_price, p.pieces_per_carton, p.reorder_level,
  coalesce(bt.cartons_in, 0)         as cartons_in,
  coalesce(bt.pieces_in, 0)          as pieces_in,
  coalesce(st.cartons_sold, 0)       as cartons_sold,
  coalesce(st.pieces_sold, 0)        as pieces_sold,
  coalesce(at.carton_adj, 0::bigint) as carton_adj,
  coalesce(at.piece_adj, 0)          as piece_adj
from sandbox.products p
left join (
  select product_id, sum(cartons) as cartons_in, sum(loose_pieces) as pieces_in
  from sandbox.stock_batches group by product_id
) bt on bt.product_id = p.id
left join (
  select ii.product_id, sum(ii.cartons) as cartons_sold, sum(ii.pieces) as pieces_sold
  from sandbox.invoice_items ii
  join sandbox.invoices inv on inv.id = ii.invoice_id
  where inv.payment_status in ('partial', 'paid')
  group by ii.product_id
) st on st.product_id = p.id
left join (
  select product_id, 0::bigint as carton_adj, sum(adjustment_pieces) as piece_adj
  from sandbox.stock_adjustments group by product_id
) at on at.product_id = p.id;

create or replace view sandbox.product_stock_by_location as
with batch_totals as (
  select sb.product_id, sb.location_id,
    sum(sb.cartons * coalesce(p.pieces_per_carton, 1) + sb.loose_pieces) as units_in
  from sandbox.stock_batches sb join sandbox.products p on p.id = sb.product_id
  group by sb.product_id, sb.location_id
),
adj_totals as (
  select product_id, location_id, sum(adjustment_pieces) as units_adj
  from sandbox.stock_adjustments group by product_id, location_id
),
combined as (
  select product_id, location_id, units_in as net from batch_totals
  union all
  select product_id, location_id, units_adj as net from adj_totals
)
select
  p.id as product_id, p.name, p.item_code, p.pieces_per_carton,
  c.location_id, l.name as location_name, l.type as location_type,
  sum(c.net) as total_units
from combined c
join sandbox.products p on p.id = c.product_id
left join sandbox.locations l on l.id = c.location_id
group by p.id, p.name, p.item_code, p.pieces_per_carton, c.location_id, l.name, l.type;

create or replace view sandbox.product_movement_30d as
select
  ii.product_id,
  coalesce(sum(ii.pieces + ii.cartons * p.pieces_per_carton), 0)::integer as units_sold_30d,
  round(coalesce(sum(ii.pieces + ii.cartons * p.pieces_per_carton), 0)::numeric / 30, 2) as units_per_day
from sandbox.invoice_items ii
join sandbox.invoices inv on inv.id = ii.invoice_id
join sandbox.products p   on p.id  = ii.product_id
where inv.created_at >= now() - interval '30 days'
group by ii.product_id;

grant select on sandbox.product_stock             to anon, authenticated;
grant select on sandbox.product_stock_by_location to anon, authenticated;
grant select on sandbox.product_movement_30d      to anon, authenticated;

-- ================================================================
-- APP_META — marker table in BOTH schemas
-- ================================================================

-- public.app_meta
create table if not exists public.app_meta (
  id             integer     primary key default 1,
  schema_marker  text        not null,
  app_version    text        not null default '0.1.54',
  updated_at     timestamptz not null default now(),
  constraint app_meta_single_row check (id = 1)
);
insert into public.app_meta (id, schema_marker, app_version, updated_at)
values (1, 'public', '0.1.54', now())
on conflict (id) do update
  set schema_marker = 'public',
      app_version   = '0.1.54',
      updated_at    = now();
grant select on public.app_meta to authenticated, service_role;

-- sandbox.app_meta
create table if not exists sandbox.app_meta (
  id             integer     primary key default 1,
  schema_marker  text        not null,
  app_version    text        not null default '0.1.54',
  updated_at     timestamptz not null default now(),
  constraint app_meta_single_row check (id = 1)
);
insert into sandbox.app_meta (id, schema_marker, app_version, updated_at)
values (1, 'sandbox', '0.1.54', now())
on conflict (id) do update
  set schema_marker = 'sandbox',
      app_version   = '0.1.54',
      updated_at    = now();
grant select on sandbox.app_meta to authenticated, service_role;

-- ================================================================
-- RESET FUNCTION  (schema-locked: can only truncate sandbox.*)
-- ================================================================

create or replace function sandbox.reset_all()
returns void language plpgsql security definer
set search_path = sandbox, pg_temp as $$
declare r record;
begin
  for r in select tablename from pg_tables
           where schemaname = 'sandbox' and tablename <> 'app_meta'
  loop
    execute format('truncate table sandbox.%I restart identity cascade', r.tablename);
  end loop;
end $$;
revoke all on function sandbox.reset_all() from public;
grant execute on function sandbox.reset_all() to service_role;

-- ================================================================
-- SEED DATA
-- ================================================================

insert into sandbox.customers (name, phone) values ('Walk-in Customer', '-')
on conflict do nothing;

insert into sandbox.locations (name, type) values ('Main Warehouse', 'warehouse')
on conflict do nothing;

insert into sandbox.locations (name, type) values ('Shop', 'shop')
on conflict do nothing;
