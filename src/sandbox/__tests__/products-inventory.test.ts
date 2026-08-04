import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

// Products & Inventory integration test (todo-013). Records a GRN (goods
// received note) against a purchase order and confirms:
//   1. the `trg_purchase_receive_trigger` creates a stock_batches row sized
//      correctly from received_units - damaged_units and the product's
//      pieces_per_carton, and
//   2. deducting sold units via deduct_stock_from_batch reduces that batch's
//      remaining stock by exactly the right amount (with carton/loose
//      rebalancing when loose_pieces would go negative).
//
// Requires a real Postgres connection (SANDBOX_DB_URL / SUPABASE_DB_URL)
// pointed at a database with the sandbox schema already applied. Skips with
// a printed reason when no DB creds are configured — same pattern as
// sandbox-isolation.test.ts.

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;
const seedPath = path.join(__dirname, '..', '..', '..', 'supabase', 'seed', 'sandbox-seed.sql');

// Seeded fixtures from supabase/seed/sandbox-seed.sql
const SUPPLIER_ID = 'a1000000-0000-0000-0000-000000000001';
const LOCATION_ID = '9a000000-0000-0000-0000-000000000001';
const PRODUCT_ID = 'b1000000-0000-0000-0000-000000000001'; // Bluetooth Headphones, pieces_per_carton = 12

describe('products & inventory', () => {
  let client: pg.Client;

  beforeAll(async () => {
    if (!url) return;
    client = new pg.Client({ connectionString: url });
    await client.connect();

    await client.query('begin');
    await client.query('select sandbox.reset_all()');
    await client.query('set search_path = sandbox');
    await client.query(readFileSync(seedPath, 'utf8'));
    await client.query('commit');
  });

  afterAll(async () => {
    await client?.end();
  });

  it.skipIf(!url)('receiving a GRN creates a correctly sized stock batch', async () => {
    const purchase = await client.query(
      `insert into purchases (reference, supplier_id, location_id, status, exchange_rate)
       values ('PO-TEST-GRN', $1, $2, 'ordered', 36.50)
       returning id`,
      [SUPPLIER_ID, LOCATION_ID]
    );
    const purchaseId = purchase.rows[0].id;

    // 2 cartons @ 12/carton ordered, 1 unit damaged in transit → 23 sellable units.
    await client.query(
      `insert into purchase_receive (purchase_id, product_id, ordered_units, received_units, damaged_units)
       values ($1, $2, 24, 24, 1)`,
      [purchaseId, PRODUCT_ID]
    );

    // Firing the trigger: draft/ordered -> received.
    await client.query(`update purchases set status = 'received' where id = $1`, [purchaseId]);

    const batch = await client.query(
      `select cartons, loose_pieces from stock_batches
       where product_id = $1 and notes = $2
       order by received_at desc limit 1`,
      [PRODUCT_ID, `Received from PO: PO-TEST-GRN`]
    );

    // 23 sellable units / 12 per carton = 1 carton + 11 loose.
    expect(batch.rows.length).toBe(1);
    expect(batch.rows[0].cartons).toBe(1);
    expect(batch.rows[0].loose_pieces).toBe(11);
  });

  it.skipIf(!url)('deducting sold units reduces the batch and rebalances cartons/loose', async () => {
    const purchase = await client.query(
      `insert into purchases (reference, supplier_id, location_id, status, exchange_rate)
       values ('PO-TEST-DEDUCT', $1, $2, 'ordered', 36.50)
       returning id`,
      [SUPPLIER_ID, LOCATION_ID]
    );
    const purchaseId = purchase.rows[0].id;

    // 2 cartons @ 12/carton, none damaged -> a clean 2-carton, 0-loose batch.
    await client.query(
      `insert into purchase_receive (purchase_id, product_id, ordered_units, received_units, damaged_units)
       values ($1, $2, 24, 24, 0)`,
      [purchaseId, PRODUCT_ID]
    );
    await client.query(`update purchases set status = 'received' where id = $1`, [purchaseId]);

    const created = await client.query(
      `select id from stock_batches where product_id = $1 and notes = $2 order by received_at desc limit 1`,
      [PRODUCT_ID, `Received from PO: PO-TEST-DEDUCT`]
    );
    const batchId = created.rows[0].id;

    // Sell 5 units. 5 / 12 = 0 cartons + 5 loose needed; batch goes to
    // 2 cartons, -5 loose, which rebalances to 1 carton, 7 loose (19 left).
    await client.query('select deduct_stock_from_batch($1, $2)', [batchId, 5]);

    let stock = await client.query('select cartons, loose_pieces from stock_batches where id = $1', [batchId]);
    expect(stock.rows[0].cartons).toBe(1);
    expect(stock.rows[0].loose_pieces).toBe(7);

    // Sell the remaining 19 units — batch should be fully drained to 0/0.
    await client.query('select deduct_stock_from_batch($1, $2)', [batchId, 19]);

    stock = await client.query('select cartons, loose_pieces from stock_batches where id = $1', [batchId]);
    expect(stock.rows[0].cartons).toBe(0);
    expect(stock.rows[0].loose_pieces).toBe(0);
  });

  it.skipIf(url)('skipped: no SANDBOX_DB_URL / SUPABASE_DB_URL set in the environment', () => {});
});
