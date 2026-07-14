import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, '..', 'supabase', 'seed', 'sandbox-seed.sql');

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('Set SANDBOX_DB_URL (or SUPABASE_DB_URL) to the sandbox database connection string.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query('begin');
try {
  const marker = await client.query('select schema_marker from sandbox.app_meta limit 1');
  if (marker.rows[0]?.schema_marker !== 'sandbox') {
    throw new Error('Refusing: sandbox marker missing or incorrect (schema_marker !== \'sandbox\')');
  }

  const before = await client.query(`
    select
      (select count(*) from sandbox.products)  as products,
      (select count(*) from sandbox.customers) as customers,
      (select count(*) from sandbox.invoices)  as invoices
  `);

  await client.query('select sandbox.reset_all()');
  await client.query('set search_path = sandbox');
  await client.query(readFileSync(seedPath, 'utf8'));

  const after = await client.query(`
    select
      (select count(*) from sandbox.products)  as products,
      (select count(*) from sandbox.customers) as customers,
      (select count(*) from sandbox.invoices)  as invoices
  `);

  await client.query('commit');
  console.log('✓ sandbox reset + reseed complete');
  console.log(`  before: ${before.rows[0].products} products, ${before.rows[0].customers} customers, ${before.rows[0].invoices} invoices`);
  console.log(`  after:  ${after.rows[0].products} products, ${after.rows[0].customers} customers, ${after.rows[0].invoices} invoices`);
} catch (e) {
  await client.query('rollback');
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
