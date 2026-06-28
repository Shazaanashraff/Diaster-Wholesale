import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const DB_URL = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;

const SKIP_REASON = 'SANDBOX_DB_URL not set — skipping sandbox isolation test';

const seedPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../supabase/seed/sandbox-seed.sql',
);

async function withClient<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: DB_URL! });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

describe('sandbox isolation', () => {
  if (!DB_URL) {
    it.skip(SKIP_REASON, () => {});
    return;
  }

  it('reset_all() leaves public tables untouched', async () => {
    await withClient(async (c) => {
      // Snapshot public row counts before any sandbox operation
      const before = await c.query<{ cnt: string }>(
        "SELECT COUNT(*)::text AS cnt FROM public.customers"
      );
      const publicCountBefore = parseInt(before.rows[0].cnt, 10);

      // Run the full reset + reseed
      await c.query('BEGIN');
      await c.query('SELECT sandbox.reset_all()');
      await c.query('SET search_path = sandbox');
      await c.query(readFileSync(seedPath, 'utf8'));
      await c.query('COMMIT');
      await c.query('RESET search_path');

      // Public row counts must be identical
      const after = await c.query<{ cnt: string }>(
        "SELECT COUNT(*)::text AS cnt FROM public.customers"
      );
      const publicCountAfter = parseInt(after.rows[0].cnt, 10);
      expect(publicCountAfter).toBe(publicCountBefore);
    });
  }, 30_000);

  it('sandbox.app_meta.schema_marker is "sandbox"', async () => {
    await withClient(async (c) => {
      const res = await c.query<{ schema_marker: string }>(
        "SELECT schema_marker FROM sandbox.app_meta LIMIT 1"
      );
      expect(res.rows[0]?.schema_marker).toBe('sandbox');
    });
  });

  it('seeded sandbox product exists after reset', async () => {
    await withClient(async (c) => {
      const res = await c.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM sandbox.products WHERE id = 'b1000000-0000-0000-0000-000000000001'"
      );
      expect(parseInt(res.rows[0].count, 10)).toBe(1);
    });
  });
});
