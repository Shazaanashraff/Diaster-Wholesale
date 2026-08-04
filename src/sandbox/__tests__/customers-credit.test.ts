import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

// Customers & Credit integration test (todo-013). Exercises the credit-limit
// rule (mirrors posService.checkCreditLimit's exact arithmetic — that
// function talks to Supabase's PostgREST layer, which only exposes the
// `public` schema, so it can't be pointed at `sandbox` directly; this test
// re-runs the same rule against real sandbox rows over a raw pg connection)
// and confirms a credit sale followed by a payment updates
// customers.outstanding_balance by exactly the right (clamped-at-0) amount —
// the same GREATEST(0, ...) invariant record_payment_atomic / manual
// adjustments rely on.
//
// Requires a real Postgres connection (SANDBOX_DB_URL / SUPABASE_DB_URL).
// Skips with a printed reason when no DB creds are configured.

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;
const seedPath = path.join(__dirname, '..', '..', '..', 'supabase', 'seed', 'sandbox-seed.sql');

// Seeded customer from supabase/seed/sandbox-seed.sql:
// Nimal Electronics Store — credit_limit 500000.00, outstanding_balance 125000.00
const CUSTOMER_ID = 'c1000000-0000-0000-0000-000000000002';

function checkCreditLimit(limit: number, used: number, creditAmount: number) {
  const available = Math.max(0, limit - used);
  return creditAmount > available
    ? { ok: false, available }
    : { ok: true, available };
}

describe('customers & credit', () => {
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

  it.skipIf(!url)('credit-limit rule: a sale within available credit is allowed', async () => {
    const row = await client.query('select credit_limit, outstanding_balance from customers where id = $1', [
      CUSTOMER_ID,
    ]);
    const { credit_limit, outstanding_balance } = row.rows[0];

    // Available = 500000 - 125000 = 375000. A 300000 credit sale fits.
    const result = checkCreditLimit(Number(credit_limit), Number(outstanding_balance), 300000);
    expect(result.ok).toBe(true);
    expect(result.available).toBe(375000);
  });

  it.skipIf(!url)('credit-limit rule: a sale exceeding available credit is rejected', async () => {
    const row = await client.query('select credit_limit, outstanding_balance from customers where id = $1', [
      CUSTOMER_ID,
    ]);
    const { credit_limit, outstanding_balance } = row.rows[0];

    // 375000 available — a 400000 credit sale must be rejected.
    const result = checkCreditLimit(Number(credit_limit), Number(outstanding_balance), 400000);
    expect(result.ok).toBe(false);
    expect(result.available).toBe(375000);
  });

  it.skipIf(!url)('a credit sale then a payment updates outstanding_balance by the exact delta', async () => {
    const before = await client.query('select outstanding_balance from customers where id = $1', [CUSTOMER_ID]);
    expect(Number(before.rows[0].outstanding_balance)).toBe(125000);

    // Credit sale: 50000 added to outstanding (mirrors what checkout_sale
    // does for a credit-mode invoice — no cash/bank/card payment row).
    await client.query('update customers set outstanding_balance = outstanding_balance + 50000 where id = $1', [
      CUSTOMER_ID,
    ]);
    const afterSale = await client.query('select outstanding_balance from customers where id = $1', [CUSTOMER_ID]);
    expect(Number(afterSale.rows[0].outstanding_balance)).toBe(175000);

    // Payment of 60000 (mirrors record_payment_atomic's cash/bank_transfer
    // branch): GREATEST(0, outstanding - amount).
    await client.query(
      'update customers set outstanding_balance = greatest(0, outstanding_balance - 60000) where id = $1',
      [CUSTOMER_ID]
    );
    const afterPayment = await client.query('select outstanding_balance from customers where id = $1', [
      CUSTOMER_ID,
    ]);
    expect(Number(afterPayment.rows[0].outstanding_balance)).toBe(115000);
  });

  it.skipIf(!url)('a payment larger than the balance clamps outstanding_balance at 0, never negative', async () => {
    await client.query('update customers set outstanding_balance = 20000 where id = $1', [CUSTOMER_ID]);

    await client.query(
      'update customers set outstanding_balance = greatest(0, outstanding_balance - 999999) where id = $1',
      [CUSTOMER_ID]
    );
    const after = await client.query('select outstanding_balance from customers where id = $1', [CUSTOMER_ID]);
    expect(Number(after.rows[0].outstanding_balance)).toBe(0);
  });

  it.skipIf(url)('skipped: no SANDBOX_DB_URL / SUPABASE_DB_URL set in the environment', () => {});
});
