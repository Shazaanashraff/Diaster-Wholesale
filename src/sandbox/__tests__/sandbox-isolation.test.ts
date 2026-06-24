import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DB_URL = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;

if (!DB_URL) {
  console.log('[sandbox-isolation] SANDBOX_DB_URL not set — skipping integration tests');
}

async function publicCounts(client: pg.Client) {
  const [prod, cust, inv] = await Promise.all([
    client.query('select count(*)::int as n from public.products'),
    client.query('select count(*)::int as n from public.customers'),
    client.query('select count(*)::int as n from public.invoices'),
  ]);
  return {
    products: prod.rows[0].n,
    customers: cust.rows[0].n,
    invoices: inv.rows[0].n,
  };
}

describe.skipIf(!DB_URL)('sandbox isolation', () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DB_URL! });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
  });

  it('sandbox.app_meta.schema_marker is "sandbox"', async () => {
    const { rows } = await client.query('select schema_marker from sandbox.app_meta limit 1');
    expect(rows[0]?.schema_marker).toBe('sandbox');
  });

  it('reset_all does not change public row counts', async () => {
    const before = await publicCounts(client);

    const seedSql = readFileSync(resolve('supabase/seed/sandbox-seed.sql'), 'utf8');
    await client.query('begin');
    try {
      await client.query('select sandbox.reset_all()');
      await client.query('set local search_path = sandbox');
      await client.query(seedSql);
      await client.query('commit');
    } catch (e) {
      await client.query('rollback');
      throw e;
    }

    const after = await publicCounts(client);
    expect(after.products).toBe(before.products);
    expect(after.customers).toBe(before.customers);
    expect(after.invoices).toBe(before.invoices);
  });

  it('seeded sandbox product exists after reset', async () => {
    const { rows } = await client.query(
      "select id from sandbox.products where item_code = '100001'"
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it('seeded Walk-in Customer exists in sandbox', async () => {
    const { rows } = await client.query(
      "select id from sandbox.customers where name = 'Walk-in Customer'"
    );
    expect(rows.length).toBeGreaterThan(0);
  });
});
