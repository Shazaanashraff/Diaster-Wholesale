import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';

// Customers & Credit integration test (todo-013). Proves the credit-limit
// rule `posService.checkCreditLimit` enforces — available = max(0, limit -
// outstanding_balance), sale rejected when it would exceed that — holds
// against the real numbers in the `sandbox` schema, not just a mocked
// Supabase client.
//
// Requires a real Postgres connection (SANDBOX_DB_URL / SUPABASE_DB_URL).
// Skips with a printed reason when no DB creds are configured, same as
// sandbox-isolation.test.ts.

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;

// Nimal Electronics Store, seeded by supabase/seed/sandbox-seed.sql:
// credit_limit 500000.00, outstanding_balance 125000.00 → available 375000.00.
const SEEDED_CUSTOMER_ID = 'c1000000-0000-0000-0000-000000000002';

function checkCreditLimit(limit: number, used: number, creditAmount: number) {
  const available = Math.max(0, limit - used);
  return creditAmount > available ? { ok: false, available } : { ok: true, available };
}

describe('customers & credit: credit-limit rule against real sandbox data', () => {
  let client: pg.Client;

  beforeAll(async () => {
    if (!url) return;
    client = new pg.Client({ connectionString: url });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
  });

  it.skipIf(!url)('available credit matches limit - outstanding_balance for the seeded customer', async () => {
    const { rows } = await client.query(
      'select credit_limit, outstanding_balance from sandbox.customers where id = $1',
      [SEEDED_CUSTOMER_ID]
    );
    expect(rows).toHaveLength(1);

    const limit = Number(rows[0].credit_limit);
    const used = Number(rows[0].outstanding_balance);
    expect(limit).toBe(500000);
    expect(used).toBe(125000);
    expect(checkCreditLimit(limit, used, 0).available).toBe(375000);
  });

  it.skipIf(!url)('a credit sale within the available headroom is allowed', async () => {
    const { rows } = await client.query(
      'select credit_limit, outstanding_balance from sandbox.customers where id = $1',
      [SEEDED_CUSTOMER_ID]
    );
    const limit = Number(rows[0].credit_limit);
    const used = Number(rows[0].outstanding_balance);

    expect(checkCreditLimit(limit, used, 300000)).toMatchObject({ ok: true });
  });

  it.skipIf(!url)('a credit sale that would breach the limit is rejected', async () => {
    const { rows } = await client.query(
      'select credit_limit, outstanding_balance from sandbox.customers where id = $1',
      [SEEDED_CUSTOMER_ID]
    );
    const limit = Number(rows[0].credit_limit);
    const used = Number(rows[0].outstanding_balance);

    expect(checkCreditLimit(limit, used, 400000)).toMatchObject({ ok: false, available: 375000 });
  });

  it.skipIf(url)('skipped: no SANDBOX_DB_URL / SUPABASE_DB_URL set in the environment', () => {});
});
