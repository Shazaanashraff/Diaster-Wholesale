// @vitest-environment node
// Integration test for Products & Inventory — runs against the live sandbox schema.
// Skips automatically when SANDBOX_DB_URL / SUPABASE_DB_URL is not set.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';

const DB_URL = process.env.SANDBOX_DB_URL ?? process.env.SUPABASE_DB_URL;
const SKIP_REASON = 'SANDBOX_DB_URL not set — skipping live products-inventory test';

// Fixed product UUID seeded by scripts/sandbox-reset.mjs / supabase/seed/sandbox-seed.sql
const HEADPHONES_ID = 'b1000000-0000-0000-0000-000000000001';

describe('products & inventory — sandbox integration', () => {
  if (!DB_URL) {
    it.skip(SKIP_REASON, () => {});
    return;
  }

  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DB_URL });
    await client.connect();
    // Delete any leftover test adjustments from a prior aborted run
    await client.query(
      `DELETE FROM sandbox.stock_adjustments WHERE reason = 'vitest-products-inventory-test'`
    );
  });

  afterAll(async () => {
    // Clean up any adjustments this test inserted
    await client.query(
      `DELETE FROM sandbox.stock_adjustments WHERE reason = 'vitest-products-inventory-test'`
    );
    await client.end();
  });

  it('seed contains 12 products in sandbox schema', async () => {
    const { rows } = await client.query(
      `SELECT COUNT(*) AS n FROM sandbox.products WHERE id LIKE 'b1000000-%'`
    );
    expect(Number(rows[0].n)).toBe(12);
  });

  it('seed contains 12 stock batches (one per product)', async () => {
    const { rows } = await client.query(
      `SELECT COUNT(*) AS n FROM sandbox.stock_batches WHERE id LIKE 'e1000000-%'`
    );
    expect(Number(rows[0].n)).toBe(12);
  });

  it('Bluetooth Headphones batch has expected carton + loose_pieces count', async () => {
    const { rows } = await client.query(
      `SELECT cartons, loose_pieces FROM sandbox.stock_batches
       WHERE id = 'e1000000-0000-0000-0000-000000000001'`
    );
    expect(rows[0]).toBeDefined();
    expect(Number(rows[0].cartons)).toBe(2);
    expect(Number(rows[0].loose_pieces)).toBe(4);
  });

  it('stock adjustment insert increases aggregate adjustment_pieces', async () => {
    const before = await client.query(
      `SELECT COALESCE(SUM(adjustment_pieces), 0) AS total
       FROM sandbox.stock_adjustments WHERE product_id = $1`,
      [HEADPHONES_ID]
    );
    const priorTotal = Number(before.rows[0].total);

    await client.query(
      `INSERT INTO sandbox.stock_adjustments (product_id, adjustment_pieces, reason, adjusted_by)
       VALUES ($1, 50, 'vitest-products-inventory-test', 'vitest')`,
      [HEADPHONES_ID]
    );

    const after = await client.query(
      `SELECT COALESCE(SUM(adjustment_pieces), 0) AS total
       FROM sandbox.stock_adjustments WHERE product_id = $1`,
      [HEADPHONES_ID]
    );
    expect(Number(after.rows[0].total)).toBe(priorTotal + 50);
  });

  it('negative stock adjustment represents sold / deducted units', async () => {
    await client.query(
      `INSERT INTO sandbox.stock_adjustments (product_id, adjustment_pieces, reason, adjusted_by)
       VALUES ($1, -10, 'vitest-products-inventory-test', 'vitest')`,
      [HEADPHONES_ID]
    );

    const { rows } = await client.query(
      `SELECT SUM(adjustment_pieces) AS net
       FROM sandbox.stock_adjustments
       WHERE product_id = $1 AND reason = 'vitest-products-inventory-test'`,
      [HEADPHONES_ID]
    );
    // +50 from previous test, -10 from this one = net 40
    expect(Number(rows[0].net)).toBe(40);
  });
});
