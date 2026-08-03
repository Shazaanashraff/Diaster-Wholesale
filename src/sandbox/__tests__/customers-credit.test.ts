import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import pg from 'pg';

// Integration tests for the `customers.outstanding_balance` data-layer contract, run
// against the `sandbox` schema only (never `public`). Registered in the Sandbox catalog
// (todo-013) under `customers-credit` as type:"integration". The credit-limit *rule* itself
// (`isOverCreditLimit`) is pure application logic with no DB dependency — see the unit
// tests in src/utils/creditCheck.test.ts.
//
// NOTE (schema drift, confirmed while writing this file): `checkout_sale` and
// `record_payment_atomic` — the RPCs the app actually calls for a sale/payment — exist
// only in `public`, not in `sandbox` (they were added after the one-time sandbox schema
// snapshot in 20260626000000_sandbox_schema_and_meta.sql and never backported). So this
// file cannot call those RPCs; instead it exercises the exact SQL semantics they rely on
// directly against `sandbox.customers.outstanding_balance`:
//   - a sale's credit portion: `outstanding_balance = outstanding_balance + amount`
//     (src/services/posService.ts's read-then-write, lines ~219-232)
//   - a cash/bank payment: `outstanding_balance = GREATEST(0, outstanding_balance - amount)`
//     (the cash/bank-transfer branch of `record_payment_atomic`).
// Backporting `checkout_sale`/`record_payment_atomic` to `sandbox` so this can call the
// real RPCs is a follow-up (flagged in this todo's Completion Notes).
//
// Requires a real Postgres connection (SANDBOX_DB_URL / SUPABASE_DB_URL). Skips with a
// printed reason when no DB creds are configured. Every test runs inside a transaction
// that is rolled back afterwards.

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;

const NIMAL_CUSTOMER_ID = 'c1000000-0000-0000-0000-000000000002'; // seeded: credit_limit 500000, outstanding 125000

describe('sandbox customers & credit', () => {
  let client: pg.Client;

  beforeAll(async () => {
    if (!url) return;
    client = new pg.Client({ connectionString: url });
    await client.connect();
    await client.query('set search_path = sandbox');
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

  it.skipIf(!url)('a credit sale increases outstanding_balance by exactly the credit portion', async () => {
    const before = await client.query('select outstanding_balance from customers where id = $1', [NIMAL_CUSTOMER_ID]);
    const beforeBalance = Number(before.rows[0].outstanding_balance);

    await client.query(
      'update customers set outstanding_balance = outstanding_balance + $2 where id = $1',
      [NIMAL_CUSTOMER_ID, 30000]
    );

    const after = await client.query('select outstanding_balance from customers where id = $1', [NIMAL_CUSTOMER_ID]);
    expect(Number(after.rows[0].outstanding_balance)).toBe(beforeBalance + 30000);
  });

  it.skipIf(!url)('a cash payment decreases outstanding_balance by the paid amount', async () => {
    const before = await client.query('select outstanding_balance from customers where id = $1', [NIMAL_CUSTOMER_ID]);
    const beforeBalance = Number(before.rows[0].outstanding_balance);

    await client.query(
      'update customers set outstanding_balance = greatest(0, outstanding_balance - $2) where id = $1',
      [NIMAL_CUSTOMER_ID, 50000]
    );

    const after = await client.query('select outstanding_balance from customers where id = $1', [NIMAL_CUSTOMER_ID]);
    expect(Number(after.rows[0].outstanding_balance)).toBe(beforeBalance - 50000);
  });

  it.skipIf(!url)('a payment larger than the outstanding balance clamps outstanding_balance at 0, never negative', async () => {
    const before = await client.query('select outstanding_balance from customers where id = $1', [NIMAL_CUSTOMER_ID]);
    const beforeBalance = Number(before.rows[0].outstanding_balance);

    await client.query(
      'update customers set outstanding_balance = greatest(0, outstanding_balance - $2) where id = $1',
      [NIMAL_CUSTOMER_ID, beforeBalance + 1000000]
    );

    const after = await client.query('select outstanding_balance from customers where id = $1', [NIMAL_CUSTOMER_ID]);
    expect(Number(after.rows[0].outstanding_balance)).toBe(0);
  });

  it.skipIf(!url)('a sale followed by a full payment nets the balance back to its starting point', async () => {
    const before = await client.query('select outstanding_balance from customers where id = $1', [NIMAL_CUSTOMER_ID]);
    const beforeBalance = Number(before.rows[0].outstanding_balance);

    await client.query(
      'update customers set outstanding_balance = outstanding_balance + $2 where id = $1',
      [NIMAL_CUSTOMER_ID, 42000]
    );
    await client.query(
      'update customers set outstanding_balance = greatest(0, outstanding_balance - $2) where id = $1',
      [NIMAL_CUSTOMER_ID, 42000]
    );

    const after = await client.query('select outstanding_balance from customers where id = $1', [NIMAL_CUSTOMER_ID]);
    expect(Number(after.rows[0].outstanding_balance)).toBe(beforeBalance);
  });

  it.skipIf(url)('skipped: no SANDBOX_DB_URL / SUPABASE_DB_URL set in the environment', () => {});
});
