import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const SANDBOX_DB_URL = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;
const seedPath = path.join(__dirname, '..', '..', '..', 'supabase', 'seed', 'sandbox-seed.sql');

describe('sandbox isolation', () => {
  let client: pg.Client;

  beforeAll(async () => {
    if (!SANDBOX_DB_URL) return;
    client = new pg.Client({ connectionString: SANDBOX_DB_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
  });

  it.skipIf(!SANDBOX_DB_URL)(
    SANDBOX_DB_URL
      ? 'resets and reseeds the sandbox schema without touching public'
      : 'skipped: SANDBOX_DB_URL (or SUPABASE_DB_URL) is not set',
    async () => {
      const before = await client.query(
        `select
           (select count(*) from public.products)  as products,
           (select count(*) from public.customers) as customers,
           (select count(*) from public.invoices)  as invoices`
      );

      await client.query('select sandbox.reset_all()');
      await client.query('set search_path = sandbox');
      await client.query(readFileSync(seedPath, 'utf8'));
      await client.query('set search_path = public');

      const after = await client.query(
        `select
           (select count(*) from public.products)  as products,
           (select count(*) from public.customers) as customers,
           (select count(*) from public.invoices)  as invoices`
      );
      expect(after.rows[0]).toEqual(before.rows[0]);

      const marker = await client.query('select schema_marker from sandbox.app_meta limit 1');
      expect(marker.rows[0]?.schema_marker).toBe('sandbox');

      const seededProduct = await client.query(
        `select 1 from sandbox.products where id = 'b1000000-0000-0000-0000-000000000001'`
      );
      expect(seededProduct.rowCount).toBe(1);
    }
  );
});
