import pg from 'pg';
import { readFileSync } from 'node:fs';

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('✗ Set SANDBOX_DB_URL (or SUPABASE_DB_URL) to the Postgres connection string');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query('BEGIN');
try {
  const m = await client.query('SELECT schema_marker FROM sandbox.app_meta LIMIT 1');
  if (m.rows[0]?.schema_marker !== 'sandbox') {
    throw new Error('Refusing: sandbox.app_meta.schema_marker is not "sandbox" — wrong DB?');
  }
  await client.query('SELECT sandbox.reset_all()');
  await client.query('SET search_path = sandbox');
  const seedSql = readFileSync(new URL('../supabase/seed/sandbox-seed.sql', import.meta.url), 'utf8');
  await client.query(seedSql);
  await client.query('COMMIT');
  console.log('✓ sandbox reset + reseed complete');
} catch (e) {
  await client.query('ROLLBACK');
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
