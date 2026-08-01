import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import pg from 'pg';

// Integration coverage for the Customers & Credit group (todo-013).
//
// IMPORTANT SCOPE NOTE: record_payment_atomic() and update_cheque_status()
// (supabase/migrations/20260625000000_cheque_management.sql,
// 20260726120000_cheque_reversals_and_credit_balance.sql) both reference
// payments.cheque_status and customers.cheque_float, but neither column was
// ever added to sandbox.payments / sandbox.customers in
// 20260626000000_sandbox_schema_and_meta.sql — so calling either RPC against
// `sandbox` fails with "column ... does not exist" (confirmed by reading the
// sandbox table DDL; there is no SANDBOX_DB_URL reachable from this sandbox
// runner to execute it live). That gap blocks a real payments-cheques
// integration test entirely (see the sibling *.cheque.test.ts unit tests,
// which cover that group at the wrapper-function level instead) and it
// blocks record_payment_atomic() here too. This file therefore exercises
// balance mechanics through adjust_customer_outstanding() instead — the
// same atomic delta-applier ReturnsPage.tsx uses for credit settlements —
// which only touches customers.outstanding_balance and has no such gap.
//
// Requires a real Postgres connection (SANDBOX_DB_URL / SUPABASE_DB_URL).
// Skips with a printed reason when no DB creds are configured, same as
// sandbox-isolation.test.ts. Every test runs inside its own transaction that
// is rolled back afterwards.

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;

async function insertCustomer(
  client: pg.Client,
  creditLimit: number,
  outstandingBalance: number,
): Promise<string> {
  const suffix = Math.random().toString(36).slice(2, 10);
  const { rows } = await client.query(
    `insert into customers (name, credit_limit, outstanding_balance)
     values ($1, $2, $3) returning id`,
    [`Test Customer ${suffix}`, creditLimit, outstandingBalance],
  );
  return rows[0].id;
}

async function outstandingBalance(client: pg.Client, customerId: string): Promise<number> {
  const { rows } = await client.query(`select outstanding_balance from customers where id = $1`, [customerId]);
  return Number(rows[0].outstanding_balance);
}

describe('customers & credit (sandbox integration)', () => {
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

  it.skipIf(!url)('an unpaid sale followed by a full payment nets outstanding_balance back to 0', async () => {
    const customerId = await insertCustomer(client, 100000, 0);

    // Sale on credit: a positive delta is what posService.checkout() applies
    // after checkout_sale() for the unpaid portion.
    await client.query('select adjust_customer_outstanding($1, $2)', [customerId, 20000]);
    expect(await outstandingBalance(client, customerId)).toBe(20000);

    // Partial payment.
    await client.query('select adjust_customer_outstanding($1, $2)', [customerId, -12000]);
    expect(await outstandingBalance(client, customerId)).toBe(8000);

    // Settling payment.
    await client.query('select adjust_customer_outstanding($1, $2)', [customerId, -8000]);
    expect(await outstandingBalance(client, customerId)).toBe(0);
  });

  it.skipIf(!url)('an overpayment clamps outstanding_balance at 0, never negative', async () => {
    const customerId = await insertCustomer(client, 100000, 5000);

    await client.query('select adjust_customer_outstanding($1, $2)', [customerId, -9000]);

    expect(await outstandingBalance(client, customerId)).toBe(0);
  });

  it.skipIf(!url)('adjust_customer_outstanding on an unknown customer raises "Customer ... not found"', async () => {
    await client.query('savepoint sp');
    await expect(
      client.query('select adjust_customer_outstanding($1, $2)', ['00000000-0000-0000-0000-000000000000', 100]),
    ).rejects.toThrow(/Customer .* not found/);
    await client.query('rollback to savepoint sp');
  });

  it.skipIf(!url)('the credit-limit rule is NOT enforced at the database layer — outstanding_balance can exceed credit_limit', async () => {
    // Documents the real invariant: checkCreditLimit() (posService.ts, covered
    // under sales-pos) is the only place this rule is enforced. checkout_sale()
    // and adjust_customer_outstanding() both apply deltas unconditionally.
    const customerId = await insertCustomer(client, 5000, 4500); // only 500 headroom

    await client.query('select adjust_customer_outstanding($1, $2)', [customerId, 6000]); // would need 6000, only 500 available

    expect(await outstandingBalance(client, customerId)).toBe(10500); // succeeded anyway — no DB-side guard
  });

  // ── adjust_customer_outstanding_manual: validation paths (all raise BEFORE
  //    the function's own broken INSERT — see the happy-path test below) ────

  it.skipIf(!url)('adjust_customer_outstanding_manual rejects an empty reason', async () => {
    const customerId = await insertCustomer(client, 10000, 1000);
    await client.query('savepoint sp');
    await expect(
      client.query('select adjust_customer_outstanding_manual($1, $2, $3, $4)', [customerId, -500, '', 'admin']),
    ).rejects.toThrow(/A reason is required for a manual balance adjustment/);
    await client.query('rollback to savepoint sp');
    expect(await outstandingBalance(client, customerId)).toBe(1000); // untouched
  });

  it.skipIf(!url)('adjust_customer_outstanding_manual rejects a zero delta', async () => {
    const customerId = await insertCustomer(client, 10000, 1000);
    await client.query('savepoint sp');
    await expect(
      client.query('select adjust_customer_outstanding_manual($1, $2, $3, $4)', [customerId, 0, 'Goodwill', 'admin']),
    ).rejects.toThrow(/Adjustment amount cannot be zero/);
    await client.query('rollback to savepoint sp');
  });

  it.skipIf(!url)('adjust_customer_outstanding_manual on an unknown customer raises "Customer ... not found"', async () => {
    await client.query('savepoint sp');
    await expect(
      client.query('select adjust_customer_outstanding_manual($1, $2, $3, $4)', [
        '00000000-0000-0000-0000-000000000000', -500, 'Goodwill', 'admin',
      ]),
    ).rejects.toThrow(/Customer .* not found/);
    await client.query('rollback to savepoint sp');
  });

  it.skipIf(!url)(
    'BUG: adjust_customer_outstanding_manual with valid input always fails — it inserts a NULL invoice_id ' +
    'into payments.invoice_id, which is NOT NULL, so the whole call (including its own balance update) rolls back',
    async () => {
      const customerId = await insertCustomer(client, 10000, 1000);
      await client.query('savepoint sp');
      await expect(
        client.query('select adjust_customer_outstanding_manual($1, $2, $3, $4)', [customerId, -500, 'Goodwill write-off', 'admin']),
      ).rejects.toThrow(/null value in column "invoice_id"/);
      await client.query('rollback to savepoint sp');

      // The customers.outstanding_balance UPDATE inside the function is rolled
      // back along with the failed payments insert — nothing persists.
      expect(await outstandingBalance(client, customerId)).toBe(1000);
    },
  );

  it.skipIf(url)('skipped: no SANDBOX_DB_URL / SUPABASE_DB_URL set in the environment', () => {});
});
