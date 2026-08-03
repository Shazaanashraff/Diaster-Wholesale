import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import pg from 'pg';

// Integration tests for the goods-receiving → stock deduction flow, run against the
// `sandbox` schema only (never `public`). Registered in the Sandbox catalog (todo-013)
// under `products-inventory` as type:"integration".
//
// Covers: receiving a purchase (via `purchase_receive` rows + flipping `purchases.status`
// to 'received', which fires `sandbox.trg_purchase_receive_stock()`) creates a sellable
// stock batch, and `sandbox.deduct_stock_fifo()` deducts sold units oldest-batch-first.
//
// Requires a real Postgres connection (SANDBOX_DB_URL / SUPABASE_DB_URL) pointed at a
// database with the sandbox schema (supabase/migrations/20260626000000_sandbox_schema_and_meta.sql).
// Skips with a printed reason when no DB creds are configured. Every test runs inside a
// transaction that is rolled back afterwards, so nothing here touches seeded/persisted data.

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;

const SUPPLIER_ID = 'a1000000-0000-0000-0000-000000000001';
const LOCATION_ID = '9a000000-0000-0000-0000-000000000001';
const CABLE_PRODUCT_ID = 'b1000000-0000-0000-0000-000000000002'; // pieces_per_carton = 50

describe('sandbox products & inventory', () => {
  let client: pg.Client;

  beforeAll(async () => {
    if (!url) return;
    client = new pg.Client({ connectionString: url });
    await client.connect();
    await client.query('set search_path = sandbox');
  });

  afterAll(async () => {
    await client?.end();
  });

  beforeEach(async () => {
    if (!url) return;
    await client.query('begin');
  });

  afterEach(async () => {
    if (!url) return;
    await client.query('rollback');
  });

  it.skipIf(!url)('receiving a purchase creates a stock batch with received-minus-damaged sellable units', async () => {
    const purchase = await client.query(
      `insert into purchases (reference, supplier_id, location_id, status, exchange_rate)
       values ('PO-TEST-GRN-1', $1, $2, 'draft', 36.5) returning id`,
      [SUPPLIER_ID, LOCATION_ID]
    );
    const purchaseId = purchase.rows[0].id;

    // Ordered 500 units of a product with pieces_per_carton = 50; 20 arrived damaged.
    await client.query(
      `insert into purchase_receive (purchase_id, product_id, ordered_units, received_units, damaged_units)
       values ($1, $2, 500, 500, 20)`,
      [purchaseId, CABLE_PRODUCT_ID]
    );

    await client.query(`update purchases set status = 'received' where id = $1`, [purchaseId]);

    const batch = await client.query(
      `select cartons, loose_pieces from stock_batches
       where product_id = $1 and notes = 'Received from PO: PO-TEST-GRN-1'`,
      [CABLE_PRODUCT_ID]
    );

    expect(batch.rows).toHaveLength(1);
    // sellable = 500 - 20 = 480; ppc = 50 -> 9 cartons + 30 loose.
    expect(batch.rows[0]).toEqual({ cartons: 9, loose_pieces: 30 });
  });

  it.skipIf(!url)('a fully damaged receipt (0 sellable) creates no stock batch', async () => {
    const purchase = await client.query(
      `insert into purchases (reference, supplier_id, location_id, status, exchange_rate)
       values ('PO-TEST-GRN-2', $1, $2, 'draft', 36.5) returning id`,
      [SUPPLIER_ID, LOCATION_ID]
    );
    const purchaseId = purchase.rows[0].id;

    await client.query(
      `insert into purchase_receive (purchase_id, product_id, ordered_units, received_units, damaged_units)
       values ($1, $2, 50, 50, 50)`,
      [purchaseId, CABLE_PRODUCT_ID]
    );

    await client.query(`update purchases set status = 'received' where id = $1`, [purchaseId]);

    const batch = await client.query(
      `select 1 from stock_batches where notes = 'Received from PO: PO-TEST-GRN-2'`
    );
    expect(batch.rows).toHaveLength(0);
  });

  it.skipIf(!url)('deduct_stock_fifo consumes the oldest batch first, deleting it once emptied', async () => {
    const productId = '99000000-0000-0000-0000-0000000000f1';
    await client.query(
      `insert into products (id, item_code, name, category, wholesale_price, retail_price, pieces_per_carton)
       values ($1, 'TESTFIFO', 'FIFO Test Product', 'accessories', 100, 150, 10)`,
      [productId]
    );

    const oldBatch = await client.query(
      `insert into stock_batches (product_id, location_id, cartons, loose_pieces, cost_per_piece, received_at)
       values ($1, $2, 1, 0, 50, now() - interval '2 days') returning id`,
      [productId, LOCATION_ID]
    ); // 10 pieces, oldest
    const newBatch = await client.query(
      `insert into stock_batches (product_id, location_id, cartons, loose_pieces, cost_per_piece, received_at)
       values ($1, $2, 2, 0, 55, now() - interval '1 day') returning id`,
      [productId, LOCATION_ID]
    ); // 20 pieces, newer

    await client.query('select sandbox.deduct_stock_fifo($1, $2)', [productId, 15]);

    const oldRemaining = await client.query('select 1 from stock_batches where id = $1', [oldBatch.rows[0].id]);
    expect(oldRemaining.rows).toHaveLength(0); // fully consumed and deleted

    const newRemaining = await client.query(
      'select cartons, loose_pieces from stock_batches where id = $1',
      [newBatch.rows[0].id]
    );
    // 20 - 5 = 15 pieces left at ppc=10 -> 1 carton + 5 loose.
    expect(newRemaining.rows[0]).toEqual({ cartons: 1, loose_pieces: 5 });
  });

  it.skipIf(!url)('deduct_stock_fifo raises "Insufficient stock" and leaves batches unchanged when demand exceeds supply', async () => {
    const productId = '99000000-0000-0000-0000-0000000000f2';
    await client.query(
      `insert into products (id, item_code, name, category, wholesale_price, retail_price, pieces_per_carton)
       values ($1, 'TESTSHORT', 'Short Stock Test Product', 'accessories', 100, 150, 10)`,
      [productId]
    );
    const batch = await client.query(
      `insert into stock_batches (product_id, location_id, cartons, loose_pieces, cost_per_piece, received_at)
       values ($1, $2, 1, 0, 50, now()) returning id`,
      [productId, LOCATION_ID]
    ); // 10 pieces available

    await client.query('savepoint before_deduct');
    await expect(
      client.query('select sandbox.deduct_stock_fifo($1, $2)', [productId, 15])
    ).rejects.toThrow(/Insufficient stock/);
    await client.query('rollback to savepoint before_deduct');

    const unchanged = await client.query(
      'select cartons, loose_pieces from stock_batches where id = $1',
      [batch.rows[0].id]
    );
    expect(unchanged.rows[0]).toEqual({ cartons: 1, loose_pieces: 0 });
  });

  it.skipIf(url)('skipped: no SANDBOX_DB_URL / SUPABASE_DB_URL set in the environment', () => {});
});
