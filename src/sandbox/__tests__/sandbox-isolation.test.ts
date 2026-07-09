import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Proves the Sandbox reset path (sandbox.reset_all() + seed replay, the
// same primitives npm run sandbox:reset uses) never touches `public`.
// Requires a real Postgres connection — skips gracefully without one so
// `npm test` stays green in environments with no DB creds.

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;
const seedPath = path.join(process.cwd(), 'supabase', 'seed', 'sandbox-seed.sql');

describe.skipIf(!url)('sandbox isolation', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let client: any;

  beforeAll(async () => {
    const pg = await import('pg');
    client = new pg.default.Client({ connectionString: url });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
  });

  it('never changes public row counts when sandbox is reset', async () => {
    const countOf = async (table: string) => {
      const r = await client.query(`select count(*)::int as n from public.${table}`);
      return r.rows[0].n;
    };

    const before = {
      products: await countOf('products'),
      customers: await countOf('customers'),
      invoices: await countOf('invoices'),
    };

    await client.query('begin');
    try {
      const marker = await client.query('select schema_marker from sandbox.app_meta limit 1');
      expect(marker.rows[0]?.schema_marker).toBe('sandbox');

      await client.query('select sandbox.reset_all()');
      await client.query('set search_path = sandbox');
      await client.query(readFileSync(seedPath, 'utf8'));
      await client.query('commit');
    } catch (e) {
      await client.query('rollback');
      throw e;
    }

    const after = {
      products: await countOf('products'),
      customers: await countOf('customers'),
      invoices: await countOf('invoices'),
    };
    expect(after).toEqual(before);

    const sandboxMarker = await client.query('select schema_marker from sandbox.app_meta limit 1');
    expect(sandboxMarker.rows[0]?.schema_marker).toBe('sandbox');

    const seededProduct = await client.query(
      "select id from sandbox.products where id = 'b1000000-0000-0000-0000-000000000001'"
    );
    expect(seededProduct.rows).toHaveLength(1);
  });
});

if (!url) {
  console.log('sandbox-isolation.test.ts: skipped — SANDBOX_DB_URL/SUPABASE_DB_URL not set');
}
