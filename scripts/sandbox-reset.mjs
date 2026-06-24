import pg from 'pg';
import { readFileSync } from 'node:fs';

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('Error: Set SANDBOX_DB_URL (or SUPABASE_DB_URL) before running this script.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query('begin');
try {
  const m = await client.query('select schema_marker from sandbox.app_meta limit 1');
  if (m.rows[0]?.schema_marker !== 'sandbox') {
    throw new Error('Refusing: sandbox.app_meta.schema_marker is not "sandbox" — wrong DB or migration not applied');
  }
  await client.query('select sandbox.reset_all()');
  await client.query('set local search_path = sandbox');
  await client.query(readFileSync('supabase/seed/sandbox-seed.sql', 'utf8'));
  await client.query('commit');
  console.log('✓ sandbox reset + reseed complete');
} catch (e) {
  await client.query('rollback');
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
