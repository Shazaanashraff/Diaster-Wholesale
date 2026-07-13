// Wipes + reseeds the `sandbox` schema only. Never touches `public`.
//
// Guards, in order:
//   1. Refuses to run without SANDBOX_DB_URL / SUPABASE_DB_URL.
//   2. Refuses unless sandbox.app_meta.schema_marker = 'sandbox' (belt-and-braces
//      on top of the schema-lock inside sandbox.reset_all() itself).
//   3. Everything runs in a single transaction — a failed reseed rolls back.
//
// Usage: npm run sandbox:reset

import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, '..', 'supabase', 'seed', 'sandbox-seed.sql');

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('✗ Set SANDBOX_DB_URL (or SUPABASE_DB_URL) to a Postgres connection string before running sandbox:reset.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  await client.query('begin');

  const marker = await client.query('select schema_marker from sandbox.app_meta limit 1');
  if (marker.rows[0]?.schema_marker !== 'sandbox') {
    throw new Error('Refusing: sandbox.app_meta.schema_marker is not \'sandbox\' — is the sandbox schema migration applied?');
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
