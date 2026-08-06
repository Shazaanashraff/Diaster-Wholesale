import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';

// Products & Inventory integration coverage (todo-013), registered in the
// Sandbox catalog (todo-010) under `products-inventory` as type:"integration".
//
// Exercises the real DB primitives a GRN/receiving flow relies on, entirely
// inside the `sandbox` schema:
//   1. Receiving a purchase (marking it 'received') fires
//      sandbox.trg_purchase_receive_stock(), which turns sellable
//      (received - damaged) units into a sandbox.stock_batches row.
//   2. sandbox.deduct_stock_fifo() — the same function POS checkout uses to
//      remove sold units — deducts from that batch, oldest-first, so the
//      remaining stock (as sandbox.product_stock reports it) drops by
//      exactly the units sold.
//
// Requires a real Postgres connection (SANDBOX_DB_URL / SUPABASE_DB_URL)
// pointed at a database with the sandbox schema already applied
// (supabase/migrations/20260626000000_sandbox_schema_and_meta.sql).
// Skips with a printed reason when no DB creds are configured.

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;

describe('sandbox products & inventory', () => {
  let client: pg.Client;

  beforeAll(async () => {
    if (!url) return;
    client = new pg.Client({ connectionString: url });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
  });

  it.skipIf(!url)(
    'GRN receipt adds sellable units to stock via the purchase-received trigger',
    async () => {
      const product = await client.query(
        `insert into sandbox.products (item_code, name, pieces_per_carton)
         values ('TODO013-PI-' || substr(gen_random_uuid()::text, 1, 8), 'Todo-013 Test Widget', 10)
         returning id`
      );
      const productId = product.rows[0].id;

      try {
        const purchase = await client.query(
          `insert into sandbox.purchases (reference, status, exchange_rate)
           values ('TODO013-PO-' || substr(gen_random_uuid()::text, 1, 8), 'ordered', 1)
           returning id`
        );
        const purchaseId = purchase.rows[0].id;

        // 130 received, 10 damaged -> 120 sellable units = 12 cartons @ ppc=10.
        await client.query(
          `insert into sandbox.purchase_receive (purchase_id, product_id, ordered_units, received_units, damaged_units)
           values ($1, $2, 130, 130, 10)`,
          [purchaseId, productId]
        );

        // Flips draft/ordered -> received, which fires trg_purchase_receive_stock.
        await client.query(`update sandbox.purchases set status = 'received' where id = $1`, [purchaseId]);

        const stock = await client.query(
          `select cartons_in, pieces_in from sandbox.product_stock where product_id = $1`,
          [productId]
        );
        expect(stock.rows[0]).toEqual({ cartons_in: 12, pieces_in: 0 });

        await client.query(`delete from sandbox.purchase_receive where purchase_id = $1`, [purchaseId]);
        await client.query(`delete from sandbox.purchases where id = $1`, [purchaseId]);
      } finally {
        await client.query(`delete from sandbox.stock_batches where product_id = $1`, [productId]);
        await client.query(`delete from sandbox.products where id = $1`, [productId]);
      }
    }
  );

  it.skipIf(!url)(
    'deduct_stock_fifo removes exactly the sold units from remaining stock',
    async () => {
      const product = await client.query(
        `insert into sandbox.products (item_code, name, pieces_per_carton)
         values ('TODO013-PI-' || substr(gen_random_uuid()::text, 1, 8), 'Todo-013 Test Widget 2', 10)
         returning id`
      );
      const productId = product.rows[0].id;

      try {
        // One batch: 12 cartons, 0 loose = 120 units on hand.
        await client.query(
          `insert into sandbox.stock_batches (product_id, cartons, loose_pieces)
           values ($1, 12, 0)`,
          [productId]
        );

        const before = await client.query(
          `select cartons_in, pieces_in from sandbox.product_stock where product_id = $1`,
          [productId]
        );
        expect(before.rows[0]).toEqual({ cartons_in: 12, pieces_in: 0 });

        // Sell 35 units -> 120 - 35 = 85 remaining = 8 cartons + 5 loose.
        await client.query(`select sandbox.deduct_stock_fifo($1, 35)`, [productId]);

        const after = await client.query(
          `select cartons_in, pieces_in from sandbox.product_stock where product_id = $1`,
          [productId]
        );
        expect(after.rows[0]).toEqual({ cartons_in: 8, pieces_in: 5 });
      } finally {
        await client.query(`delete from sandbox.stock_batches where product_id = $1`, [productId]);
        await client.query(`delete from sandbox.products where id = $1`, [productId]);
      }
    }
  );

  it.skipIf(url)('skipped: no SANDBOX_DB_URL / SUPABASE_DB_URL set in the environment', () => {});
});
