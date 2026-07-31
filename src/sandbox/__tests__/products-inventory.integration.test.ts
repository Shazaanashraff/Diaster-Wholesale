import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';

// Products & Inventory integration test (todo-013). Proves the
// receive-confirmation flow (`purchaseService.receivePurchase`'s DB half) end
// to end against the real `sandbox` schema: receiving a purchase creates a
// stock batch via the `trg_purchase_receive_trigger` DB trigger, and FIFO
// deduction (`sandbox.deduct_stock_fifo`, the same RPC `posService.checkout`
// calls) reduces it by exactly the right number of pieces.
//
// Requires a real Postgres connection (SANDBOX_DB_URL / SUPABASE_DB_URL)
// pointed at a database with the sandbox schema applied. Skips with a
// printed reason when no DB creds are configured, same as
// sandbox-isolation.test.ts. Runs inside a transaction that is always rolled
// back, so it never leaves residue in the sandbox schema.

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;

// Fixed test-only UUIDs, distinct from anything in supabase/seed/sandbox-seed.sql.
const PRODUCT_ID = '11111111-1111-1111-1111-111111111111';
const PURCHASE_ID = '22222222-2222-2222-2222-222222222222';
const SEEDED_SUPPLIER_ID = 'a1000000-0000-0000-0000-000000000001';

describe('products & inventory: receive → stock batch → FIFO deduction', () => {
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
    'receiving a purchase creates a stock batch net of damaged units, and FIFO deduction reduces it correctly',
    async () => {
      await client.query('begin');
      try {
        await client.query(
          `insert into sandbox.products (id, item_code, name, pieces_per_carton)
           values ($1, 'TEST-PPC10', 'Integration Test Widget', 10)`,
          [PRODUCT_ID]
        );

        await client.query(
          `insert into sandbox.purchases (id, reference, supplier_id, status, exchange_rate)
           values ($1, 'PO-TEST-0001', $2, 'ordered', 1)`,
          [PURCHASE_ID, SEEDED_SUPPLIER_ID]
        );

        await client.query(
          `insert into sandbox.purchase_items (purchase_id, product_id, quantity_units, quantity_cartons, unit_price_rmb)
           values ($1, $2, 20, 2, 10)`,
          [PURCHASE_ID, PRODUCT_ID]
        );

        // Ordered 20, received 18, 2 damaged → 16 sellable units expected.
        await client.query(
          `insert into sandbox.purchase_receive (purchase_id, product_id, ordered_units, received_units, damaged_units)
           values ($1, $2, 20, 18, 2)`,
          [PURCHASE_ID, PRODUCT_ID]
        );

        // Flips draft/ordered → received, firing trg_purchase_receive_trigger.
        await client.query(`update sandbox.purchases set status = 'received' where id = $1`, [PURCHASE_ID]);

        const afterReceive = await client.query(
          `select coalesce(sum(cartons * 10 + loose_pieces), 0) as total
           from sandbox.stock_batches where product_id = $1`,
          [PRODUCT_ID]
        );
        expect(Number(afterReceive.rows[0].total)).toBe(16);

        // Deduct 10 pieces FIFO — same RPC posService.checkout calls for a batch-less cart line.
        await client.query('select sandbox.deduct_stock_fifo($1, $2)', [PRODUCT_ID, 10]);

        const afterDeduct = await client.query(
          `select coalesce(sum(cartons * 10 + loose_pieces), 0) as total
           from sandbox.stock_batches where product_id = $1`,
          [PRODUCT_ID]
        );
        expect(Number(afterDeduct.rows[0].total)).toBe(6);

        // Deducting more than remains raises the same "Insufficient stock" the
        // checkout flow surfaces to the cashier.
        await expect(client.query('select sandbox.deduct_stock_fifo($1, $2)', [PRODUCT_ID, 100])).rejects.toThrow(
          /Insufficient stock/
        );
      } finally {
        await client.query('rollback');
      }
    }
  );

  it.skipIf(url)('skipped: no SANDBOX_DB_URL / SUPABASE_DB_URL set in the environment', () => {});
});
