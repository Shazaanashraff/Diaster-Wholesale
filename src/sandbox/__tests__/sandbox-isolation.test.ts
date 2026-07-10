import { describe, it, expect } from 'vitest';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Proves the guarded reset path (todo-009) can never touch `public`:
// `sandbox.reset_all()` + the seed replay must leave every `public` row
// count unchanged, no matter how many times it runs.
//
// Requires a direct Postgres connection (SANDBOX_DB_URL / SUPABASE_DB_URL).
// Skips with a printed reason when no DB credentials are available, since
// this repo's default `npm test` run has no live database.

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;
const seedPath = path.join(process.cwd(), 'supabase', 'seed', 'sandbox-seed.sql');

const PUBLIC_TABLES = ['products', 'customers', 'invoices'] as const;

async function countPublicRows(client: pg.Client) {
  const counts: Record<string, number> = {};
  for (const table of PUBLIC_TABLES) {
    const { rows } = await client.query(`select count(*)::int as n from public.${table}`);
    counts[table] = rows[0].n;
  }
  return counts;
}

describe('sandbox isolation', () => {
  it('sandbox.reset_all() + seed replay never changes public row counts', async (ctx) => {
    if (!url) {
      console.log('sandbox-isolation.test.ts: skipped — set SANDBOX_DB_URL to run against a live DB');
      ctx.skip();
      return;
    }

    const client = new pg.Client({ connectionString: url });
    await client.connect();

    try {
      const before = await countPublicRows(client);

      await client.query('select sandbox.reset_all()');
      await client.query('set search_path = sandbox');
      await client.query(readFileSync(seedPath, 'utf8'));

      const after = await countPublicRows(client);
      expect(after).toEqual(before);

      const marker = await client.query("select schema_marker from sandbox.app_meta limit 1");
      expect(marker.rows[0]?.schema_marker).toBe('sandbox');

      const product = await client.query("select 1 from sandbox.products where item_code = 'SBX-100001'");
      expect(product.rowCount).toBeGreaterThan(0);
    } finally {
      await client.end();
    }
  });
});
