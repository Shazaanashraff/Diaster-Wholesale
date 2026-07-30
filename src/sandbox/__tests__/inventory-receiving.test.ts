import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import pg from 'pg';

// Products & Inventory (todo-013): proves that receiving a purchase (a GRN —
// goods received note, one "container" of stock arriving from a supplier)
// creates correctly-sized stock, and that selling deducts it back down,
// against a real Postgres instance running the **sandbox** schema only
// (never public — see the 🔒 locked decision in todo-013).
//
// Exercises the real ported sandbox functions/triggers from
// supabase/migrations/20260626000000_sandbox_schema_and_meta.sql:
// `sandbox.trg_purchase_receive_stock()` (fires when a purchase flips to
// 'received', turns each purchase_receive line into a stock_batches row sized
// to received-minus-damaged units) and `sandbox.deduct_stock_fifo()` (deducts
// sold units oldest-batch-first). Registered in the Sandbox catalog
// (todo-010) as type:"integration" under the `products-inventory` group.
//
// Requires a real Postgres connection (SANDBOX_DB_URL / SUPABASE_DB_URL)
// pointed at a database with the sandbox schema applied. Skips with a
// printed reason when no DB creds are configured.

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;

async function makeProduct(client: pg.Client, itemCode: string, piecesPerCarton: number): Promise<string> {
  const r = await client.query(
    `insert into sandbox.products (item_code, name, pieces_per_carton)
     values ($1, $2, $3) returning id`,
    [itemCode, `Test Product ${itemCode}`, piecesPerCarton]
  );
  return r.rows[0].id;
}

async function makePurchase(client: pg.Client, reference: string): Promise<string> {
  const r = await client.query(
    `insert into sandbox.purchases (reference, status) values ($1, 'draft') returning id`,
    [reference]
  );
  return r.rows[0].id;
}

async function receive(
  client: pg.Client,
  purchaseId: string,
  productId: string,
  receivedUnits: number,
  damagedUnits: number
): Promise<void> {
  await client.query(
    `insert into sandbox.purchase_receive (purchase_id, product_id, ordered_units, received_units, damaged_units)
     values ($1, $2, $3, $4, $5)`,
    [purchaseId, productId, receivedUnits, receivedUnits, damagedUnits]
  );
  // Flips draft -> received, firing trg_purchase_receive_stock.
  await client.query(`update sandbox.purchases set status = 'received' where id = $1`, [purchaseId]);
}

async function stockBatchRows(client: pg.Client, productId: string) {
  const r = await client.query(
    `select cartons, loose_pieces from sandbox.stock_batches where product_id = $1 order by received_at asc, created_at asc`,
    [productId]
  );
  return r.rows as Array<{ cartons: number; loose_pieces: number }>;
}

async function remainingUnits(client: pg.Client, productId: string, ppc: number): Promise<number> {
  const rows = await stockBatchRows(client, productId);
  return rows.reduce((sum, r) => sum + r.cartons * ppc + r.loose_pieces, 0);
}

describe('products & inventory: GRN receiving + FIFO stock deduction (sandbox)', () => {
  let client: pg.Client;

  beforeAll(async () => {
    if (!url) return;
    client = new pg.Client({ connectionString: url });
    await client.connect();
    const marker = await client.query('select schema_marker from sandbox.app_meta limit 1');
    if (marker.rows[0]?.schema_marker !== 'sandbox') {
      throw new Error('Refusing: connected database is not marked as sandbox');
    }
  });

  afterAll(async () => {
    await client?.end();
  });

  beforeEach(async () => {
    if (!url) return;
    await client.query('select sandbox.reset_all()');
  });

  it.skipIf(!url)('receiving a GRN creates a stock batch sized to received-minus-damaged units', async () => {
    const productId = await makeProduct(client, 'GRN-001', 12);
    const purchaseId = await makePurchase(client, 'PO-GRN-001');

    // 120 units received, 12 damaged -> 108 sellable -> exactly 9 cartons, 0 loose.
    await receive(client, purchaseId, productId, 120, 12);

    const rows = await stockBatchRows(client, productId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ cartons: 9, loose_pieces: 0 });
  });

  it.skipIf(!url)('a fully-damaged GRN line adds zero stock (sellable floors at 0, never negative)', async () => {
    const productId = await makeProduct(client, 'GRN-002', 10);
    const purchaseId = await makePurchase(client, 'PO-GRN-002');

    // Damaged >= received -> GREATEST(0, received - damaged) = 0 -> no batch row at all.
    await receive(client, purchaseId, productId, 10, 10);

    const rows = await stockBatchRows(client, productId);
    expect(rows).toHaveLength(0);
  });

  it.skipIf(!url)('selling deducts stock FIFO, oldest batch first, across multiple GRNs', async () => {
    const ppc = 12;
    const productId = await makeProduct(client, 'GRN-003', ppc);

    // Batch A: 60 units, received first.
    const purchaseA = await makePurchase(client, 'PO-GRN-003-A');
    await receive(client, purchaseA, productId, 60, 0);

    // Batch B: 60 units, received after A (received_at defaults to now() at
    // insert time, so a short delay guarantees strict ordering).
    await new Promise((resolve) => setTimeout(resolve, 20));
    const purchaseB = await makePurchase(client, 'PO-GRN-003-B');
    await receive(client, purchaseB, productId, 60, 0);

    expect(await remainingUnits(client, productId, ppc)).toBe(120);

    // Sell 70 units: fully consumes batch A (60) then takes 10 from batch B.
    await client.query('select sandbox.deduct_stock_fifo($1, $2)', [productId, 70]);

    const rows = await stockBatchRows(client, productId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ cartons: 4, loose_pieces: 2 }); // 50 units = 4*12 + 2
    expect(await remainingUnits(client, productId, ppc)).toBe(50);
  });

  it.skipIf(!url)('selling more than available raises a specific "Insufficient stock" error', async () => {
    const productId = await makeProduct(client, 'GRN-004', 10);
    const purchaseId = await makePurchase(client, 'PO-GRN-004');
    await receive(client, purchaseId, productId, 5, 0);

    await expect(
      client.query('select sandbox.deduct_stock_fifo($1, $2)', [productId, 100])
    ).rejects.toMatchObject({
      message: expect.stringContaining('Insufficient stock: 95 units undeducted'),
    });

    // The failed deduction must not have touched the existing batch.
    expect(await remainingUnits(client, productId, 10)).toBe(5);
  });

  it.skipIf(url)('skipped: no SANDBOX_DB_URL / SUPABASE_DB_URL set in the environment', () => {});
});
