// Wipes + reseeds the `sandbox` schema only. See TODO/completed/todo-009.md.
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, '..', 'supabase', 'seed', 'sandbox-seed.sql');

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('Set SANDBOX_DB_URL (or SUPABASE_DB_URL) to a Postgres connection string.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query('begin');
try {
  const marker = await client.query('select schema_marker from sandbox.app_meta limit 1');
  if (marker.rows[0]?.schema_marker !== 'sandbox') {
    throw new Error('Refusing: sandbox.app_meta.schema_marker is not "sandbox"');
  }
  await client.query('select sandbox.reset_all()');
  await client.query('set search_path = sandbox');
  await client.query(readFileSync(seedPath, 'utf8'));
  await client.query('commit');
  console.log('✓ sandbox reset + reseed complete');
} catch (err) {
  await client.query('rollback');
  console.error('✗', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
