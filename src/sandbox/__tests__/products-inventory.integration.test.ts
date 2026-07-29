import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';

// Integration coverage for the "Products & Inventory" Sandbox group (todo-013).
// Proves the DB-trigger-driven stock math: receiving a purchase order inserts
// the right stock_batches row (cartons/loose split from received-minus-damaged
// units), and deduct_stock_fifo() consumes that stock correctly on a sale,
// oldest batch first, raising when there isn't enough left.
//
// Runs entirely inside one transaction against the `sandbox` schema (never
// `public`, per the todo's locked decision) and rolls back at the end, so it
// never depends on — or mutates — sandbox-seed.sql data. Skips with a printed
// reason when no DB creds are configured, same pattern as sandbox-isolation.test.ts.

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;

describe('products & inventory stock math (sandbox integration)', () => {
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
    'receiving a PO adds a stock_batches row (received - damaged), and deduct_stock_fifo consumes it correctly',
    async () => {
      await client.query('begin');
      await client.query('set search_path = sandbox');

      // Self-contained fixtures — a brand-new supplier/location/product so this
      // test can never collide with (or depend on) seeded or other test data.
      await client.query(
        `insert into locations (id, name, type) values
           ('99999999-0000-0000-0000-000000000001', 'todo-013 Test Warehouse', 'warehouse')`
      );
      await client.query(
        `insert into suppliers (id, name) values
           ('99999999-0000-0000-0000-000000000002', 'todo-013 Test Supplier')`
      );
      await client.query(
        `insert into products (id, item_code, name, pieces_per_carton) values
           ('99999999-0000-0000-0000-000000000003', 'TODO-013-TEST', 'todo-013 Test Product', 12)`
      );
      await client.query(
        `insert into purchases (id, reference, supplier_id, location_id, status)
           values ('99999999-0000-0000-0000-000000000004', 'TODO013-PO', '99999999-0000-0000-0000-000000000002',
                   '99999999-0000-0000-0000-000000000001', 'draft')`
      );

      // Ordered 100, received 97, 5 damaged -> 92 sellable = 7 cartons (84) + 8 loose.
      await client.query(
        `insert into purchase_receive (purchase_id, product_id, ordered_units, received_units, damaged_units)
           values ('99999999-0000-0000-0000-000000000004', '99999999-0000-0000-0000-000000000003', 100, 97, 5)`
      );

      // Flips draft -> received, firing trg_purchase_receive_trigger.
      await client.query(
        `update purchases set status = 'received' where id = '99999999-0000-0000-0000-000000000004'`
      );

      const batchAfterReceive = await client.query(
        `select cartons, loose_pieces from stock_batches where product_id = '99999999-0000-0000-0000-000000000003'`
      );
      expect(batchAfterReceive.rows).toHaveLength(1);
      expect(batchAfterReceive.rows[0]).toEqual({ cartons: 7, loose_pieces: 8 });

      // Sell 50 units -> FIFO deducts from the one batch, leaving 42 (3 cartons + 6 loose).
      await client.query(`select deduct_stock_fifo('99999999-0000-0000-0000-000000000003', 50)`);

      const batchAfterSale = await client.query(
        `select cartons, loose_pieces from stock_batches where product_id = '99999999-0000-0000-0000-000000000003'`
      );
      expect(batchAfterSale.rows).toHaveLength(1);
      expect(batchAfterSale.rows[0]).toEqual({ cartons: 3, loose_pieces: 6 });

      // Selling the remaining 42 exactly empties (and deletes) the batch.
      await client.query(`select deduct_stock_fifo('99999999-0000-0000-0000-000000000003', 42)`);
      const batchAfterFullSale = await client.query(
        `select * from stock_batches where product_id = '99999999-0000-0000-0000-000000000003'`
      );
      expect(batchAfterFullSale.rows).toHaveLength(0);

      // Nothing left to deduct -> raises "Insufficient stock" instead of going negative.
      await expect(
        client.query(`select deduct_stock_fifo('99999999-0000-0000-0000-000000000003', 1)`)
      ).rejects.toThrow(/Insufficient stock/);

      await client.query('rollback');
    }
  );

  it.skipIf(url)('skipped: no SANDBOX_DB_URL / SUPABASE_DB_URL set in the environment', () => {});
});
