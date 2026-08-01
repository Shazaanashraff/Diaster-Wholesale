import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import pg from 'pg';

// Integration coverage for the Refunds & Returns group (todo-013).
//
// SCOPE NOTE: the live ReturnsPage.tsx flow calls an RPC named
// `restore_stock_to_batch` (src/pages/ReturnsPage.tsx, restoreStock()) that
// has no matching `CREATE FUNCTION` anywhere under supabase/migrations/ —
// grepping the full migrations tree for the name turns up only the two call
// sites in ReturnsPage.tsx. Its real behaviour can't be verified from source
// and there's no reachable SANDBOX_DB_URL from this runner to introspect it
// live, so this file does not exercise it. What IS fully defined in
// migrations and used here instead:
//   - adjust_customer_outstanding()  (20260726120000_cheque_reversals_and_credit_balance.sql)
//     — the exact RPC ReturnsPage.tsx's submitReturn() calls to release the
//     credit portion of a return onto outstanding_balance.
//   - create_sales_return_atomic() / restore_stock_pieces() / get_available_stock_pieces()
//     (20260515000000_loyalty_returns_v2.sql) — a separate, fully self-contained
//     atomic return/exchange path that IS wired up (src/services/productService.ts
//     references sales_return_items; ReturnsPage.tsx and SalesReturnReport.tsx
//     both read from sales_returns). Neither touches payments.cheque_status or
//     customers.cheque_float, so — unlike record_payment_atomic/update_cheque_status
//     — both run cleanly against `sandbox` (verified by reading their full
//     source; see customers-credit.integration.test.ts for the columns that
//     currently block cheque-touching RPCs from working against sandbox).
//
// Requires a real Postgres connection (SANDBOX_DB_URL / SUPABASE_DB_URL).
// Skips with a printed reason when no DB creds are configured, same as
// sandbox-isolation.test.ts. Every test runs inside its own transaction that
// is rolled back afterwards.

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;

async function insertCustomer(client: pg.Client, outstandingBalance: number): Promise<string> {
  const suffix = Math.random().toString(36).slice(2, 10);
  const { rows } = await client.query(
    `insert into customers (name, credit_limit, outstanding_balance)
     values ($1, 500000, $2) returning id`,
    [`Test Customer ${suffix}`, outstandingBalance],
  );
  return rows[0].id;
}

async function insertProduct(client: pg.Client, piecesPerCarton: number, unitPrice: number): Promise<string> {
  const suffix = Math.random().toString(36).slice(2, 10);
  const { rows } = await client.query(
    `insert into products (item_code, name, pieces_per_carton, wholesale_price, sku)
     values ($1, $2, $3, $4, $5) returning id`,
    [`T-${suffix}`, `Test Product ${suffix}`, piecesPerCarton, unitPrice, `SKU-${suffix}`],
  );
  return rows[0].id;
}

async function insertInvoiceWithItem(
  client: pg.Client,
  customerId: string,
  productId: string,
  unitPrice: number,
  cartons: number,
  piecesPerCarton: number,
): Promise<{ invoiceId: string; invoiceItemId: string; total: number }> {
  const suffix = Math.random().toString(36).slice(2, 10);
  // invoice_items.unit_price is a PER-PIECE price throughout this app (confirmed
  // against posService.ts checkout()'s own math: total = unit_price * (cartons*ppc + pieces)),
  // not a per-carton price.
  const total = unitPrice * (cartons * piecesPerCarton);
  const { rows: invRows } = await client.query(
    `insert into invoices (invoice_no, customer_id, mode, subtotal, total, payment_status)
     values ($1, $2, 'wholesale', $3, $3, 'unpaid') returning id`,
    [`INV-TEST-${suffix}`, customerId, total],
  );
  const invoiceId = invRows[0].id;
  const { rows: itemRows } = await client.query(
    `insert into invoice_items (invoice_id, product_id, cartons, pieces, unit_price, total)
     values ($1, $2, $3, 0, $4, $5) returning id`,
    [invoiceId, productId, cartons, unitPrice, total],
  );
  return { invoiceId, invoiceItemId: itemRows[0].id, total };
}

async function outstandingBalance(client: pg.Client, customerId: string): Promise<number> {
  const { rows } = await client.query(`select outstanding_balance from customers where id = $1`, [customerId]);
  return Number(rows[0].outstanding_balance);
}

describe('refunds & returns (sandbox integration)', () => {
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

  it.skipIf(!url)('a full return against an unpaid invoice releases the entire amount from outstanding_balance', async () => {
    const customerId = await insertCustomer(client, 0);
    const productId = await insertProduct(client, 10, 100);
    const { total } = await insertInvoiceWithItem(client, customerId, productId, 100, 5, 10); // 5000

    // Sale went entirely on credit — mirrors posService.checkout()'s outstanding bump.
    await client.query('select adjust_customer_outstanding($1, $2)', [customerId, total]);
    expect(await outstandingBalance(client, customerId)).toBe(5000);

    // Full return: the entire credit portion is released, same mechanism
    // ReturnsPage.tsx's submitReturn() uses for creditPortion.
    await client.query('select adjust_customer_outstanding($1, $2)', [customerId, -total]);
    expect(await outstandingBalance(client, customerId)).toBe(0);
  });

  it.skipIf(!url)('a partial return releases only the returned portion, leaving the rest outstanding', async () => {
    const customerId = await insertCustomer(client, 0);
    const productId = await insertProduct(client, 10, 100);
    const { total } = await insertInvoiceWithItem(client, customerId, productId, 100, 10, 10); // 10000

    await client.query('select adjust_customer_outstanding($1, $2)', [customerId, total]);

    // Customer returns 3 of the 10 cartons (10 pieces/carton) — 30% of the value.
    const returnedValue = 100 * 3 * 10;
    await client.query('select adjust_customer_outstanding($1, $2)', [customerId, -returnedValue]);

    expect(await outstandingBalance(client, customerId)).toBe(total - returnedValue); // 7000
  });

  it.skipIf(!url)('restore_stock_pieces adds a new stock batch sized to the returned cartons/pieces', async () => {
    const productId = await insertProduct(client, 10, 500);

    await client.query('select restore_stock_pieces($1, $2, $3, $4)', [productId, 2, 7, 'Customer return']);

    const { rows } = await client.query(
      `select cartons, loose_pieces, notes from stock_batches where product_id = $1`,
      [productId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].cartons).toBe(2);
    expect(rows[0].loose_pieces).toBe(7);
    expect(rows[0].notes).toBe('Customer return');
  });

  it.skipIf(!url)('restore_stock_pieces with 0/0 is a no-op — no batch row is created', async () => {
    const productId = await insertProduct(client, 10, 500);
    await client.query('select restore_stock_pieces($1, $2, $3, $4)', [productId, 0, 0, 'Nothing returned']);

    const { rows } = await client.query(`select count(*)::int as n from stock_batches where product_id = $1`, [productId]);
    expect(rows[0].n).toBe(0);
  });

  it.skipIf(!url)('create_sales_return_atomic computes the refund_amount as unit_price × returned pieces and leaves the return Pending', async () => {
    const customerId = await insertCustomer(client, 0);
    const productId = await insertProduct(client, 10, 100);
    const { invoiceId, invoiceItemId } = await insertInvoiceWithItem(client, customerId, productId, 100, 5, 10);

    const { rows } = await client.query(
      `select create_sales_return_atomic($1::jsonb) as result`,
      [JSON.stringify({
        original_invoice_id: invoiceId,
        return_type: 'Return',
        reason: 'Customer changed mind',
        returned_by_name: 'Test Cashier',
        returned_items: [
          { invoice_item_id: invoiceItemId, product_id: productId, unit_price: 100, return_cartons: 2, return_pieces: 0 },
        ],
      })],
    );

    const result = rows[0].result;
    expect(result.ok).toBe(true);
    expect(result.status).toBe('Pending');

    const { rows: retRows } = await client.query(
      `select refund_amount, status, return_type from sales_returns where id = $1`,
      [result.return_id],
    );
    expect(Number(retRows[0].refund_amount)).toBe(2000); // unit_price(100) * (2 cartons * 10 ppc) = 2000
    expect(retRows[0].status).toBe('Pending');

    const { rows: itemRows } = await client.query(
      `select return_cartons, return_pieces, total from sales_return_items where return_id = $1`,
      [result.return_id],
    );
    expect(itemRows).toHaveLength(1);
    expect(itemRows[0].return_cartons).toBe(2);
    expect(Number(itemRows[0].total)).toBe(2000);
  });

  it.skipIf(!url)('create_sales_return_atomic rejects a return item that does not belong to the original invoice', async () => {
    const customerId = await insertCustomer(client, 0);
    const productId = await insertProduct(client, 10, 100);
    const { invoiceId } = await insertInvoiceWithItem(client, customerId, productId, 100, 5, 10);

    const { rows } = await client.query(
      `select create_sales_return_atomic($1::jsonb) as result`,
      [JSON.stringify({
        original_invoice_id: invoiceId,
        return_type: 'Return',
        returned_items: [
          { invoice_item_id: '00000000-0000-0000-0000-000000000000', product_id: productId, unit_price: 100, return_cartons: 1, return_pieces: 0 },
        ],
      })],
    );

    const result = rows[0].result;
    expect(result.ok).toBe(false);
    expect(result.step).toBe('validate_return_items');
  });

  it.skipIf(!url)('create_sales_return_atomic rejects a missing original_invoice_id', async () => {
    const { rows } = await client.query(
      `select create_sales_return_atomic($1::jsonb) as result`,
      [JSON.stringify({ return_type: 'Return', returned_items: [] })],
    );

    const result = rows[0].result;
    expect(result.ok).toBe(false);
    expect(result.step).toBe('validation');
  });

  it.skipIf(!url)('create_sales_return_atomic rejects an invoice that does not exist', async () => {
    const { rows } = await client.query(
      `select create_sales_return_atomic($1::jsonb) as result`,
      [JSON.stringify({ original_invoice_id: '00000000-0000-0000-0000-000000000000', return_type: 'Return', returned_items: [] })],
    );

    const result = rows[0].result;
    expect(result.ok).toBe(false);
    expect(result.step).toBe('load_invoice');
  });

  it.skipIf(url)('skipped: no SANDBOX_DB_URL / SUPABASE_DB_URL set in the environment', () => {});
});
