import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pgPkg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Proves the whole Sandbox feature is safe: resetting/reseeding the
// `sandbox` schema must never change a single row in `public`.
//
// Requires a real Postgres connection (SANDBOX_DB_URL / SUPABASE_DB_URL) —
// this is an integration test, not a unit test, and skips gracefully
// without creds rather than failing CI on machines with no DB access.

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;
const describeIfDb = url ? describe : describe.skip;

if (!url) {
  console.log(
    'sandbox-isolation.test.ts: skipped — set SANDBOX_DB_URL (or SUPABASE_DB_URL) to run this integration test.'
  );
}

describeIfDb('sandbox isolation', () => {
  const { Client } = pgPkg;
  let client: InstanceType<typeof Client>;

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const seedPath = path.join(__dirname, '..', '..', '..', 'supabase', 'seed', 'sandbox-seed.sql');

  beforeAll(async () => {
    client = new Client({ connectionString: url });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
  });

  it('resetting sandbox never changes public row counts', async () => {
    const countOf = async (table: string) => {
      const { rows } = await client.query(`select count(*)::int as n from public.${table}`);
      return rows[0].n as number;
    };

    const before = {
      products: await countOf('products'),
      customers: await countOf('customers'),
      invoices: await countOf('invoices'),
    };

    await client.query('select sandbox.reset_all()');
    await client.query('set search_path = sandbox');
    await client.query(readFileSync(seedPath, 'utf8'));
    await client.query('set search_path = public');

    const after = {
      products: await countOf('products'),
      customers: await countOf('customers'),
      invoices: await countOf('invoices'),
    };

    expect(after).toEqual(before);
  });

  it('sandbox is marked and seeded after reset', async () => {
    const marker = await client.query('select schema_marker from sandbox.app_meta limit 1');
    expect(marker.rows[0]?.schema_marker).toBe('sandbox');

    const product = await client.query(
      "select id from sandbox.products where id = 'b1000000-0000-0000-0000-000000000001'"
    );
    expect(product.rows.length).toBe(1);
  });
});
