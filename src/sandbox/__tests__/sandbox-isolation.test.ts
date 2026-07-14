import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

// Proof that `npm run sandbox:reset` (scripts/sandbox-reset.mjs) never touches
// `public`. Registered in the Sandbox catalog (todo-010) as type:"integration"
// under the `sandbox` group.
//
// Requires a real Postgres connection (SANDBOX_DB_URL / SUPABASE_DB_URL)
// pointed at a database that already has the sandbox schema + app_meta
// marker (supabase/migrations/20260626000000_sandbox_schema_and_meta.sql).
// Skips with a printed reason when no DB creds are configured.

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;
const seedPath = path.join(__dirname, '..', '..', '..', 'supabase', 'seed', 'sandbox-seed.sql');

describe('sandbox isolation', () => {
  let client: pg.Client;

  beforeAll(async () => {
    if (!url) return;
    client = new pg.Client({ connectionString: url });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
  });

  it.skipIf(!url)('reset_all() + reseed never changes public row counts', async () => {
    const countPublic = async () => {
      const r = await client.query(`
        select
          (select count(*) from public.products)  as products,
          (select count(*) from public.customers) as customers,
          (select count(*) from public.invoices)  as invoices
      `);
      return r.rows[0];
    };

    const before = await countPublic();

    await client.query('begin');
    await client.query('select sandbox.reset_all()');
    await client.query('set search_path = sandbox');
    await client.query(readFileSync(seedPath, 'utf8'));
    await client.query('commit');

    const after = await countPublic();
    expect(after).toEqual(before);
  });

  it.skipIf(!url)('sandbox marker is set and a seeded sandbox product exists', async () => {
    const marker = await client.query('select schema_marker from sandbox.app_meta limit 1');
    expect(marker.rows[0]?.schema_marker).toBe('sandbox');

    const product = await client.query(
      "select id from sandbox.products where id = 'b1000000-0000-0000-0000-000000000001'"
    );
    expect(product.rows.length).toBe(1);
  });

  it.skipIf(url)('skipped: no SANDBOX_DB_URL / SUPABASE_DB_URL set in the environment', () => {});
});
