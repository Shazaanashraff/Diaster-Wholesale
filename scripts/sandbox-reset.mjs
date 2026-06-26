#!/usr/bin/env node
// Guarded sandbox reset + reseed script.
// Calls sandbox.reset_all() (schema-locked in the DB) then replays seed data.
// NEVER touches the public schema — the DB function is the schema-lock guarantee.

import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('Error: SANDBOX_DB_URL (or SUPABASE_DB_URL) must be set.');
  console.error('Copy .env.sandbox.example to .env.sandbox and fill in SANDBOX_DB_URL.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

async function run() {
  await client.connect();
  await client.query('begin');
  try {
    // Belt-and-suspenders guard: DB-side schema_marker must confirm sandbox
    const { rows } = await client.query(
      'select schema_marker from sandbox.app_meta limit 1'
    );
    if (rows[0]?.schema_marker !== 'sandbox') {
      throw new Error(
        'Refusing to reset: sandbox.app_meta.schema_marker is not "sandbox". ' +
        'Run migration 20260626000000_sandbox_schema_and_meta.sql first.'
      );
    }

    // Truncate all sandbox tables (except app_meta) via the schema-locked function
    await client.query('select sandbox.reset_all()');
    console.log('  ✓ sandbox.reset_all() complete');

    // Replay seed under sandbox search_path
    await client.query('set local search_path = sandbox');
    const seed = readFileSync(
      join(projectRoot, 'supabase', 'seed', 'sandbox-seed.sql'),
      'utf8'
    );
    await client.query(seed);
    console.log('  ✓ seed data replayed');

    await client.query('commit');

    // Summary
    const counts = await client.query(`
      select
        (select count(*) from sandbox.products)   as products,
        (select count(*) from sandbox.customers)  as customers,
        (select count(*) from sandbox.suppliers)  as suppliers,
        (select count(*) from sandbox.invoices)   as invoices,
        (select count(*) from sandbox.stock_batches) as stock_batches
    `);
    const r = counts.rows[0];
    console.log('');
    console.log('✓ sandbox reset + reseed complete');
    console.log(`  products=${r.products}  customers=${r.customers}  suppliers=${r.suppliers}  invoices=${r.invoices}  stock_batches=${r.stock_batches}`);
  } catch (e) {
    await client.query('rollback');
    console.error('✗ sandbox reset failed:', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
