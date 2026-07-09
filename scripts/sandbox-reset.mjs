// Wipes and reseeds the `sandbox` schema only. Never touches `public`.
//
// Guards:
//   1. Refuses to run unless sandbox.app_meta.schema_marker = 'sandbox'.
//   2. The only data-clearing call is sandbox.reset_all() (schema-locked,
//      SECURITY DEFINER, truncates schemaname='sandbox' tables only —
//      see supabase/migrations/20260626000000_sandbox_schema_and_meta.sql).
//   3. Everything runs in one transaction so a failed reseed rolls back.
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, '..', 'supabase', 'seed', 'sandbox-seed.sql');

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('✗ Set SANDBOX_DB_URL (or SUPABASE_DB_URL) to the sandbox database connection string.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  await client.query('begin');

  const marker = await client.query('select schema_marker from sandbox.app_meta limit 1');
  if (marker.rows[0]?.schema_marker !== 'sandbox') {
    throw new Error('Refusing: sandbox.app_meta.schema_marker is not \'sandbox\' — wrong database?');
  }

  await client.query('select sandbox.reset_all()');
  await client.query('set search_path = sandbox');
  await client.query(readFileSync(seedPath, 'utf8'));

  await client.query('commit');
  console.log('✓ sandbox reset + reseed complete');
} catch (e) {
  await client.query('rollback');
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
