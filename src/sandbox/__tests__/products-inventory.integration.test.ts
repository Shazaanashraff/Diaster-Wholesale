import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import pg from 'pg';

// Integration coverage for the Products & Inventory group (todo-013).
// Exercises the real receiving (GRN) → stock-batch → FIFO-deduction path via
// the schema-qualified sandbox.* functions (sandbox.trg_purchase_receive_stock,
// sandbox.deduct_stock_fifo — see supabase/migrations/20260626000000_sandbox_schema_and_meta.sql).
//
// Requires a real Postgres connection (SANDBOX_DB_URL / SUPABASE_DB_URL).
// Skips with a printed reason when no DB creds are configured, same as
// sandbox-isolation.test.ts. Every test runs inside its own transaction that
// is rolled back afterwards, so nothing here ever touches `public` or leaves
// residue in `sandbox`.

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;

async function insertProduct(client: pg.Client, piecesPerCarton: number): Promise<string> {
  const suffix = Math.random().toString(36).slice(2, 10);
  const { rows } = await client.query(
    `insert into products (item_code, name, pieces_per_carton, sku)
     values ($1, $2, $3, $4) returning id`,
    [`T-${suffix}`, `Test Product ${suffix}`, piecesPerCarton, `SKU-${suffix}`],
  );
  return rows[0].id;
}

async function insertPurchase(client: pg.Client): Promise<string> {
  const suffix = Math.random().toString(36).slice(2, 10);
  const { rows } = await client.query(
    `insert into purchases (reference, status) values ($1, 'draft') returning id`,
    [`PO-TEST-${suffix}`],
  );
  return rows[0].id;
}

async function remainingPieces(client: pg.Client, productId: string): Promise<number> {
  const { rows } = await client.query(
    `select coalesce(sum(cartons * greatest(p.pieces_per_carton, 1) + loose_pieces), 0)::int as total
     from stock_batches b join products p on p.id = b.product_id
     where b.product_id = $1`,
    [productId],
  );
  return rows[0].total;
}

describe('products & inventory (sandbox integration)', () => {
  let client: pg.Client;

  beforeAll(async () => {
    if (!url) return;
    client = new pg.Client({ connectionString: url });
    await client.connect();
    await client.query('set search_path = sandbox, public');
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

  it.skipIf(!url)('GRN receiving creates a stock batch sized received-minus-damaged, split into cartons/loose', async () => {
    const productId = await insertProduct(client, 12);
    const purchaseId = await insertPurchase(client);

    await client.query(
      `insert into purchase_receive (purchase_id, product_id, ordered_units, received_units, damaged_units)
       values ($1, $2, 120, 100, 4)`,
      [purchaseId, productId],
    );

    // Firing the receive trigger requires an actual status transition into 'received'.
    await client.query(`update purchases set status = 'received' where id = $1`, [purchaseId]);

    const { rows } = await client.query(
      `select cartons, loose_pieces, notes from stock_batches where product_id = $1`,
      [productId],
    );

    expect(rows).toHaveLength(1);
    // sellable = 100 - 4 = 96; ppc = 12 → 8 cartons, 0 loose
    expect(rows[0].cartons).toBe(8);
    expect(rows[0].loose_pieces).toBe(0);
    expect(rows[0].notes).toMatch(/^Received from PO: PO-TEST-/);
  });

  it.skipIf(!url)('a GRN line fully written off as damaged never creates a stock batch', async () => {
    const productId = await insertProduct(client, 10);
    const purchaseId = await insertPurchase(client);

    await client.query(
      `insert into purchase_receive (purchase_id, product_id, ordered_units, received_units, damaged_units)
       values ($1, $2, 50, 50, 50)`,
      [purchaseId, productId],
    );
    await client.query(`update purchases set status = 'received' where id = $1`, [purchaseId]);

    expect(await remainingPieces(client, productId)).toBe(0);
  });

  it.skipIf(!url)('re-updating an already-received purchase does not create a duplicate batch', async () => {
    const productId = await insertProduct(client, 5);
    const purchaseId = await insertPurchase(client);

    await client.query(
      `insert into purchase_receive (purchase_id, product_id, ordered_units, received_units, damaged_units)
       values ($1, $2, 10, 10, 0)`,
      [purchaseId, productId],
    );
    await client.query(`update purchases set status = 'received' where id = $1`, [purchaseId]);
    // Trigger only fires on a transition INTO 'received' (OLD.status IS DISTINCT FROM 'received').
    await client.query(`update purchases set status = 'received', notes = 'noop touch' where id = $1`, [purchaseId]);

    const { rows } = await client.query(`select count(*)::int as n from stock_batches where product_id = $1`, [productId]);
    expect(rows[0].n).toBe(1);
  });

  it.skipIf(!url)('sold units deduct from remaining stock FIFO across batches, oldest received first', async () => {
    const productId = await insertProduct(client, 10);

    await client.query(
      `insert into stock_batches (product_id, cartons, loose_pieces, received_at)
       values ($1, 1, 0, now() - interval '10 days')`, // older batch: 10 pieces
      [productId],
    );
    await client.query(
      `insert into stock_batches (product_id, cartons, loose_pieces, received_at)
       values ($1, 2, 0, now() - interval '1 day')`, // newer batch: 20 pieces
      [productId],
    );

    expect(await remainingPieces(client, productId)).toBe(30);

    await client.query('select deduct_stock_fifo($1, $2)', [productId, 15]);

    // Older 10-piece batch fully consumed; 5 more taken from the newer 20-piece batch.
    expect(await remainingPieces(client, productId)).toBe(15);

    const { rows } = await client.query(
      `select cartons, loose_pieces from stock_batches where product_id = $1 order by received_at asc`,
      [productId],
    );
    expect(rows).toHaveLength(1); // the fully-consumed older batch row was deleted
    expect(rows[0].cartons).toBe(1);
    expect(rows[0].loose_pieces).toBe(5);
  });

  it.skipIf(!url)('deducting 0 units is a no-op', async () => {
    const productId = await insertProduct(client, 6);
    await client.query(
      `insert into stock_batches (product_id, cartons, loose_pieces) values ($1, 1, 0)`,
      [productId],
    );
    await expect(client.query('select deduct_stock_fifo($1, $2)', [productId, 0])).resolves.toBeDefined();
    expect(await remainingPieces(client, productId)).toBe(6);
  });

  it.skipIf(!url)('deducting more than available raises "Insufficient stock" naming the exact shortfall', async () => {
    const productId = await insertProduct(client, 12);
    await client.query(
      `insert into stock_batches (product_id, cartons, loose_pieces) values ($1, 0, 5)`,
      [productId],
    );

    // A raised exception aborts the enclosing transaction until rolled back to
    // a savepoint — without this, every query after the expected failure would
    // itself fail with "current transaction is aborted".
    await client.query('savepoint before_deduct');
    await expect(client.query('select deduct_stock_fifo($1, $2)', [productId, 12]))
      .rejects.toThrow(/Insufficient stock: 7 units undeducted/);
    await client.query('rollback to savepoint before_deduct');

    // Failed deduction must not have partially applied — the batch is untouched.
    expect(await remainingPieces(client, productId)).toBe(5);
  });

  it.skipIf(url)('skipped: no SANDBOX_DB_URL / SUPABASE_DB_URL set in the environment', () => {});
});
