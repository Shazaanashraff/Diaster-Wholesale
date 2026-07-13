import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Proves the Sandbox feature's core safety guarantee: resetting/reseeding the
// `sandbox` schema never touches a single row of `public`. Requires a direct
// Postgres connection (SANDBOX_DB_URL / SUPABASE_DB_URL) with the sandbox
// migration (supabase/migrations/20260626000000_sandbox_schema_and_meta.sql)
// already applied — skips with a printed reason when creds aren't available,
// same as it would in CI without a linked database.

const dbUrl = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;
const seedPath = path.join(process.cwd(), 'supabase', 'seed', 'sandbox-seed.sql');

const suite = dbUrl ? describe : describe.skip;
if (!dbUrl) {
  console.log('sandbox-isolation.test.ts: skipped — set SANDBOX_DB_URL or SUPABASE_DB_URL to run against a real database');
}

suite('sandbox isolation', () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: dbUrl });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it('reset_all() + reseed never changes public row counts', async () => {
    const tables = ['products', 'customers', 'invoices'] as const;

    const before: Record<string, number> = {};
    for (const t of tables) {
      const { rows } = await client.query(`select count(*)::int as n from public.${t}`);
      before[t] = rows[0].n;
    }

    await client.query('select sandbox.reset_all()');
    await client.query('set search_path = sandbox');
    await client.query(readFileSync(seedPath, 'utf8'));
    await client.query('set search_path = public');

    for (const t of tables) {
      const { rows } = await client.query(`select count(*)::int as n from public.${t}`);
      expect(rows[0].n).toBe(before[t]);
    }
  });

  it('leaves the sandbox schema marked and seeded', async () => {
    const marker = await client.query('select schema_marker from sandbox.app_meta limit 1');
    expect(marker.rows[0]?.schema_marker).toBe('sandbox');

    const product = await client.query(
      "select id from sandbox.products where id = 'b1000000-0000-0000-0000-000000000001'"
    );
    expect(product.rows).toHaveLength(1);
  });
});
