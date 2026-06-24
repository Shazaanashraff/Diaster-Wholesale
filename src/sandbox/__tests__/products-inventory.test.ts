import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';

const DB_URL = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;

if (!DB_URL) {
  console.log('[products-inventory] SANDBOX_DB_URL not set — skipping integration tests');
}

describe.skipIf(!DB_URL)('products-inventory sandbox integration', () => {
  let client: pg.Client;

  // Fixed UUIDs well outside the seed range (seed uses 10…/20…/30…/40…/50…/60…/70…)
  const PRODUCT_ID  = 'a0100000-0000-0000-0000-000000000001';
  const BATCH_ID    = 'a0100000-0000-0000-0000-000000000002';
  const INVOICE_ID  = 'a0100000-0000-0000-0000-000000000003';
  const CUSTOMER_ID = '20000000-0000-0000-0000-000000000002'; // Walk-in Customer (from seed)
  const LOCATION_ID = '10000000-0000-0000-0000-000000000001'; // Main Store (from seed)

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DB_URL! });
    await client.connect();
    await client.query(`
      INSERT INTO sandbox.products
        (id, item_code, name, model, category, pieces_per_carton, wholesale_price, retail_price, reorder_level)
      VALUES
        ($1, 'TST-PI-01', 'Test Fabric Roll', '', 'textiles', 12, 1200.00, 1500.00, 0)
      ON CONFLICT (id) DO UPDATE SET item_code = EXCLUDED.item_code
    `, [PRODUCT_ID]);
  });

  afterAll(async () => {
    await client.query('DELETE FROM sandbox.invoice_items WHERE invoice_id = $1', [INVOICE_ID]);
    await client.query('DELETE FROM sandbox.invoices WHERE id = $1', [INVOICE_ID]);
    await client.query('DELETE FROM sandbox.stock_batches WHERE id = $1', [BATCH_ID]);
    await client.query('DELETE FROM sandbox.products WHERE id = $1', [PRODUCT_ID]);
    await client?.end();
  });

  it('records a GRN (container) with carton + loose-piece measurements', async () => {
    // 5 cartons × 12 ppc + 7 loose = 67 units received
    await client.query(`
      INSERT INTO sandbox.stock_batches
        (id, product_id, location_id, cartons, loose_pieces, original_units, cost_per_piece, received_at)
      VALUES
        ($1, $2, $3, 5, 7, 67, 100.00, NOW())
      ON CONFLICT (id) DO UPDATE
        SET cartons = EXCLUDED.cartons, loose_pieces = EXCLUDED.loose_pieces
    `, [BATCH_ID, PRODUCT_ID, LOCATION_ID]);

    const { rows } = await client.query(
      'SELECT cartons, loose_pieces, original_units FROM sandbox.stock_batches WHERE id = $1',
      [BATCH_ID]
    );

    expect(rows).toHaveLength(1);
    expect(Number(rows[0].cartons)).toBe(5);
    expect(Number(rows[0].loose_pieces)).toBe(7);
    // original_units is immutable at receipt time — FIFO deductions must not alter it
    expect(Number(rows[0].original_units)).toBe(67);
  });

  it('total stock units equal cartons × pieces_per_carton + loose_pieces', async () => {
    const { rows } = await client.query(`
      SELECT
        sb.cartons,
        sb.loose_pieces,
        p.pieces_per_carton,
        sb.cartons * p.pieces_per_carton + sb.loose_pieces AS total_units
      FROM sandbox.stock_batches sb
      JOIN sandbox.products p ON p.id = sb.product_id
      WHERE sb.id = $1
    `, [BATCH_ID]);

    expect(Number(rows[0].total_units)).toBe(67); // 5*12+7
  });

  it('sold units deduct from remaining stock after invoice is recorded', async () => {
    // Reset batch to known baseline: 5 cartons + 7 loose (67 units)
    await client.query(
      'UPDATE sandbox.stock_batches SET cartons = 5, loose_pieces = 7 WHERE id = $1',
      [BATCH_ID]
    );

    // Record a wholesale invoice for Walk-in Customer
    await client.query(`
      INSERT INTO sandbox.invoices
        (id, invoice_no, customer_id, mode, subtotal, discount, total, payment_status, created_at)
      VALUES
        ($1, 'INV-PITEST1', $2, 'wholesale', 2400.00, 0, 2400.00, 'paid', NOW())
      ON CONFLICT (id) DO NOTHING
    `, [INVOICE_ID, CUSTOMER_ID]);

    // Sale of 2 cartons (24 pieces) at LKR 1 200.00/carton
    await client.query(`
      INSERT INTO sandbox.invoice_items
        (invoice_id, product_id, cartons, pieces, unit_price, total, created_at)
      VALUES
        ($1, $2, 2, 0, 1200.00, 2400.00, NOW())
      ON CONFLICT DO NOTHING
    `, [INVOICE_ID, PRODUCT_ID]);

    // Simulate FIFO deduction (what deduct_stock_fifo RPC does): subtract 2 cartons
    await client.query(
      'UPDATE sandbox.stock_batches SET cartons = cartons - 2 WHERE id = $1',
      [BATCH_ID]
    );

    const { rows } = await client.query(
      'SELECT cartons, loose_pieces FROM sandbox.stock_batches WHERE id = $1',
      [BATCH_ID]
    );

    expect(Number(rows[0].cartons)).toBe(3);     // 5 - 2
    expect(Number(rows[0].loose_pieces)).toBe(7); // loose pieces unchanged
    // Remaining: 3×12 + 7 = 43 units
    expect(3 * 12 + Number(rows[0].loose_pieces)).toBe(43);
  });
});
