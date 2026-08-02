import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';

// Products & Inventory integration test (todo-013). Registered in the Sandbox
// catalog as type:"integration" under the `products-inventory` group.
//
// Exercises the real GRN/goods-receipt path against the `sandbox` schema only
// (never `public`): draft a purchase, record a partial-damage receipt,
// confirm the `trg_purchase_receive_trigger` (supabase/migrations/
// 20260626000000_sandbox_schema_and_meta.sql:645-673) turns that receipt into
// a stock_batches row net of damaged units, then confirms a sale-time
// `deduct_stock_fifo()` call (the same RPC posService.ts's checkout path
// calls) deducts the sold units from that remaining stock.
//
// Requires a real Postgres connection (SANDBOX_DB_URL / SUPABASE_DB_URL)
// pointed at a database that already has the sandbox schema
// (supabase/migrations/20260626000000_sandbox_schema_and_meta.sql applied).
// Skips with a printed reason when no DB creds are configured, same as
// sandbox-isolation.test.ts.

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;

describe('products & inventory — GRN receipt and FIFO sale deduction', () => {
  let client: pg.Client;
  let productId: string;
  let customerId: string;
  let purchaseId: string;
  let invoiceId: string;
  const PIECES_PER_CARTON = 10;

  beforeAll(async () => {
    if (!url) return;
    client = new pg.Client({ connectionString: url });
    await client.connect();
    await client.query('set search_path = sandbox');

    const product = await client.query(
      `insert into products (item_code, name, model, pieces_per_carton, wholesale_price, retail_price)
       values ('TEST-PI-' || substr(gen_random_uuid()::text, 1, 8), 'Integration Test Product', 'IT-1', $1, 500, 750)
       returning id`,
      [PIECES_PER_CARTON]
    );
    productId = product.rows[0].id;

    const customer = await client.query(
      `insert into customers (name, type, credit_limit, outstanding_balance)
       values ('Integration Test Customer', 'wholesale', 1000000, 0)
       returning id`
    );
    customerId = customer.rows[0].id;
  });

  afterAll(async () => {
    if (!url) return;
    // FK-safe teardown order: children before parents.
    if (invoiceId) await client.query('delete from invoice_items where invoice_id = $1', [invoiceId]);
    if (invoiceId) await client.query('delete from invoices where id = $1', [invoiceId]);
    if (purchaseId) await client.query('delete from purchase_receive where purchase_id = $1', [purchaseId]);
    if (purchaseId) await client.query('delete from purchase_items where purchase_id = $1', [purchaseId]);
    if (purchaseId) await client.query('delete from purchases where id = $1', [purchaseId]);
    if (productId) await client.query('delete from stock_batches where product_id = $1', [productId]);
    if (customerId) await client.query('delete from customers where id = $1', [customerId]);
    if (productId) await client.query('delete from products where id = $1', [productId]);
    await client?.end();
  });

  it.skipIf(!url)(
    'a GRN receipt with damaged units creates a batch net of the damage',
    async () => {
      const purchase = await client.query(
        `insert into purchases (reference, status, exchange_rate)
         values ('TEST-PI-PO-' || substr(gen_random_uuid()::text, 1, 8), 'draft', 36.5)
         returning id`
      );
      purchaseId = purchase.rows[0].id;

      await client.query(
        `insert into purchase_items (purchase_id, product_id, quantity_units, quantity_cartons, unit_price_rmb)
         values ($1, $2, 100, 10, 12.5)`,
        [purchaseId, productId]
      );

      // 100 units ordered/received, 5 damaged -> 95 sellable, split as 9 cartons + 5 loose at 10/carton.
      await client.query(
        `insert into purchase_receive (purchase_id, product_id, ordered_units, received_units, damaged_units)
         values ($1, $2, 100, 100, 5)`,
        [purchaseId, productId]
      );

      // Flip draft -> received; trg_purchase_receive_trigger fires on this transition.
      await client.query(`update purchases set status = 'received' where id = $1`, [purchaseId]);

      const batches = await client.query(
        'select cartons, loose_pieces from stock_batches where product_id = $1',
        [productId]
      );
      expect(batches.rows.length).toBe(1);
      expect(batches.rows[0].cartons).toBe(9);
      expect(batches.rows[0].loose_pieces).toBe(5);

      const totalUnits = batches.rows.reduce(
        (sum: number, r: any) => sum + r.cartons * PIECES_PER_CARTON + r.loose_pieces,
        0
      );
      expect(totalUnits).toBe(95); // 100 received - 5 damaged, never the full 100

      const stockView = await client.query(
        'select cartons_in, pieces_in, cartons_sold, pieces_sold from product_stock where product_id = $1',
        [productId]
      );
      expect(stockView.rows[0]).toMatchObject({ cartons_in: 9, pieces_in: 5, cartons_sold: 0, pieces_sold: 0 });
    }
  );

  it.skipIf(!url)(
    'a fully-damaged receipt (0 sellable) creates no stock_batches row',
    async () => {
      const purchase = await client.query(
        `insert into purchases (reference, status, exchange_rate)
         values ('TEST-PI-PO0-' || substr(gen_random_uuid()::text, 1, 8), 'draft', 36.5)
         returning id`
      );
      const zeroPurchaseId = purchase.rows[0].id;

      await client.query(
        `insert into purchase_receive (purchase_id, product_id, ordered_units, received_units, damaged_units)
         values ($1, $2, 20, 20, 20)`,
        [zeroPurchaseId, productId]
      );
      await client.query(`update purchases set status = 'received' where id = $1`, [zeroPurchaseId]);

      const batches = await client.query(
        `select count(*)::int as n from stock_batches where product_id = $1 and notes like 'Received from PO: %' and notes like $2`,
        [productId, `%${(await client.query('select reference from purchases where id = $1', [zeroPurchaseId])).rows[0].reference}%`]
      );
      expect(batches.rows[0].n).toBe(0);

      await client.query('delete from purchase_receive where purchase_id = $1', [zeroPurchaseId]);
      await client.query('delete from purchases where id = $1', [zeroPurchaseId]);
    }
  );

  it.skipIf(!url)(
    'a sale deducts the sold units from stock_batches via FIFO',
    async () => {
      const before = await client.query(
        'select coalesce(sum(cartons * $2 + loose_pieces), 0)::int as units from stock_batches where product_id = $1',
        [productId, PIECES_PER_CARTON]
      );
      expect(before.rows[0].units).toBe(95);

      const invoice = await client.query(
        `insert into invoices (invoice_no, customer_id, mode, subtotal, discount, total, payment_status)
         values ('TEST-PI-INV-' || substr(gen_random_uuid()::text, 1, 8), $1, 'wholesale', 15000, 0, 15000, 'paid')
         returning id`,
        [customerId]
      );
      invoiceId = invoice.rows[0].id;

      // 3 cartons = 30 units sold, at the seeded wholesale_price of 500/unit.
      await client.query(
        `insert into invoice_items (invoice_id, product_id, cartons, pieces, unit_price, total)
         values ($1, $2, 3, 0, 500, 15000)`,
        [invoiceId, productId]
      );

      await client.query('select deduct_stock_fifo($1, $2)', [productId, 30]);

      const after = await client.query(
        'select coalesce(sum(cartons * $2 + loose_pieces), 0)::int as units from stock_batches where product_id = $1',
        [productId, PIECES_PER_CARTON]
      );
      expect(after.rows[0].units).toBe(65); // 95 - 30
    }
  );

  it.skipIf(!url)(
    'deduct_stock_fifo rejects a sale that exceeds remaining stock',
    async () => {
      await expect(
        client.query('select deduct_stock_fifo($1, $2)', [productId, 999999])
      ).rejects.toThrow(/Insufficient stock/);
    }
  );

  it.skipIf(url)('skipped: no SANDBOX_DB_URL / SUPABASE_DB_URL set in the environment', () => {});
});
