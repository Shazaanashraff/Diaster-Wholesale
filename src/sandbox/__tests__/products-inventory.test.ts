import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';

// Products & Inventory (todo-013): proves a container/GRN receipt turns into
// real stock (carton + loose-piece math via the purchase_receive ->
// 'received' trigger), and that a sale-style deduction (deduct_stock_fifo,
// the same function the app's POS checkout calls) takes it back down by the
// exact number of units sold — never more, never less.
//
// Runs entirely inside one transaction that is rolled back at the end, so it
// never leaves rows behind in `sandbox` regardless of pass/fail. Requires a
// real Postgres connection (SANDBOX_DB_URL / SUPABASE_DB_URL); skips with a
// printed reason when no DB creds are configured (same convention as
// sandbox-isolation.test.ts).

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;

describe('products & inventory: GRN receipt and stock deduction', () => {
  let client: pg.Client;

  beforeAll(async () => {
    if (!url) return;
    client = new pg.Client({ connectionString: url });
    await client.connect();
    await client.query('begin');
  });

  afterAll(async () => {
    if (!url) return;
    await client.query('rollback');
    await client.end();
  });

  it.skipIf(!url)(
    'receiving a container/GRN creates a stock batch sized from received minus damaged units',
    async () => {
      const ppc = 10; // pieces per carton

      const { rows: [product] } = await client.query(
        `insert into sandbox.products (name, pieces_per_carton) values ($1, $2) returning id`,
        ['Test GRN Product', ppc]
      );

      const { rows: [purchase] } = await client.query(
        `insert into sandbox.purchases (reference, status) values ($1, 'draft') returning id`,
        ['TEST-GRN-0001']
      );

      // Container arrives: 104 units ordered/received, 4 damaged on inspection
      // -> 100 sellable units = 10 cartons of 10, 0 loose.
      await client.query(
        `insert into sandbox.purchase_receive
           (purchase_id, product_id, ordered_units, received_units, damaged_units)
         values ($1, $2, 104, 104, 4)`,
        [purchase.id, product.id]
      );

      // Flips draft -> received, firing trg_purchase_receive_stock.
      await client.query(`update sandbox.purchases set status = 'received' where id = $1`, [purchase.id]);

      const { rows: batches } = await client.query(
        `select cartons, loose_pieces from sandbox.stock_batches where product_id = $1`,
        [product.id]
      );

      expect(batches).toHaveLength(1);
      expect(batches[0]).toMatchObject({ cartons: 10, loose_pieces: 0 });
    }
  );

  it.skipIf(!url)(
    'a sale-style deduction (deduct_stock_fifo) reduces remaining stock by exactly the units sold',
    async () => {
      const ppc = 10;

      const { rows: [product] } = await client.query(
        `insert into sandbox.products (name, pieces_per_carton) values ($1, $2) returning id`,
        ['Test FIFO Deduction Product', ppc]
      );

      const { rows: [purchase] } = await client.query(
        `insert into sandbox.purchases (reference, status) values ($1, 'draft') returning id`,
        ['TEST-GRN-0002']
      );

      await client.query(
        `insert into sandbox.purchase_receive
           (purchase_id, product_id, ordered_units, received_units, damaged_units)
         values ($1, $2, 104, 104, 4)`,
        [purchase.id, product.id]
      );
      await client.query(`update sandbox.purchases set status = 'received' where id = $1`, [purchase.id]);
      // 100 sellable units in stock (10 cartons, 0 loose) before any sale.

      await client.query('select sandbox.deduct_stock_fifo($1, $2)', [product.id, 35]);

      const { rows: [remaining] } = await client.query(
        `select cartons, loose_pieces from sandbox.stock_batches where product_id = $1`,
        [product.id]
      );
      // 100 - 35 = 65 units left = 6 cartons of 10 + 5 loose.
      expect(remaining).toMatchObject({ cartons: 6, loose_pieces: 5 });

      // Edge case: selling more than what's left must fail loudly, not
      // silently deduct past zero or leave stock negative.
      await expect(
        client.query('select sandbox.deduct_stock_fifo($1, $2)', [product.id, 66])
      ).rejects.toThrow(/Insufficient stock/);
    }
  );

  it.skipIf(url)('skipped: no SANDBOX_DB_URL / SUPABASE_DB_URL set in the environment', () => {});
});
