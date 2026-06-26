// @vitest-environment node
// Verifies that sandbox.reset_all() never touches the public schema.
// Skips gracefully when SANDBOX_DB_URL is not configured.

import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..');
const SEED_PATH = join(PROJECT_ROOT, 'supabase', 'seed', 'sandbox-seed.sql');

const DB_URL = process.env.SANDBOX_DB_URL ?? process.env.SUPABASE_DB_URL;
const SKIP_REASON = 'SANDBOX_DB_URL not set — skipping live isolation test';

// Dynamic pg import so the module doesn't crash in environments without native
// bindings (the skip guard above exits before the import is used).
async function getClient() {
  const pg = await import('pg');
  const Client = pg.default?.Client ?? (pg as unknown as { Client: new (opts: { connectionString: string }) => InstanceType<typeof import('pg').Client> }).Client;
  const client = new Client({ connectionString: DB_URL! });
  await client.connect();
  return client;
}

describe('sandbox isolation', () => {
  if (!DB_URL) {
    it.skip(SKIP_REASON, () => {});
    return;
  }

  let client: Awaited<ReturnType<typeof getClient>>;

  afterAll(async () => {
    await client?.end();
  });

  it('reset_all() leaves public schema row counts unchanged', async () => {
    client = await getClient();

    // Snapshot public row counts before reset
    const before = await client.query<{ products: string; customers: string; invoices: string }>(`
      select
        (select count(*)::text from public.products)   as products,
        (select count(*)::text from public.customers)  as customers,
        (select count(*)::text from public.invoices)   as invoices
    `);
    const snap = before.rows[0];

    // Run reset + reseed (mirrors what sandbox-reset.mjs does)
    await client.query('select sandbox.reset_all()');
    await client.query('set local search_path = sandbox');
    const seed = readFileSync(SEED_PATH, 'utf8');
    await client.query(seed);
    // Restore default search_path for subsequent queries
    await client.query('set local search_path = public, pg_catalog');

    // Public counts must be identical
    const after = await client.query<{ products: string; customers: string; invoices: string }>(`
      select
        (select count(*)::text from public.products)   as products,
        (select count(*)::text from public.customers)  as customers,
        (select count(*)::text from public.invoices)   as invoices
    `);
    const snap2 = after.rows[0];
    expect(snap2.products,  'public.products count changed').toBe(snap.products);
    expect(snap2.customers, 'public.customers count changed').toBe(snap.customers);
    expect(snap2.invoices,  'public.invoices count changed').toBe(snap.invoices);
  });

  it('sandbox.app_meta.schema_marker is "sandbox"', async () => {
    if (!client) client = await getClient();
    const { rows } = await client.query<{ schema_marker: string }>(
      'select schema_marker from sandbox.app_meta limit 1'
    );
    expect(rows[0]?.schema_marker).toBe('sandbox');
  });

  it('seeded sandbox product exists after reset', async () => {
    if (!client) client = await getClient();
    const { rows } = await client.query<{ name: string }>(
      `select name from sandbox.products
       where id = 'b1000000-0000-0000-0000-000000000001'
       limit 1`
    );
    expect(rows[0]?.name).toBe('Bluetooth Headphones');
  });

  it('seeded sandbox Walk-in Customer exists after reset', async () => {
    if (!client) client = await getClient();
    const { rows } = await client.query<{ name: string }>(
      `select name from sandbox.customers
       where id = 'c0000000-0000-0000-0000-000000000000'
       limit 1`
    );
    expect(rows[0]?.name).toBe('Walk-in Customer');
  });
});
