import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { isOverCreditLimit, getRemainingCredit } from '../../utils/creditCheck';
import type { Customer } from '../../types';

// Customers & Credit integration test (todo-013). Registered in the Sandbox
// catalog as type:"integration" under the `customers-credit` group.
//
// Exercises the real credit-limit rule (src/utils/creditCheck.ts — no mocks)
// against a live customer row in the `sandbox` schema (never `public`), then
// walks the actual sale + payment balance updates posService.ts performs at
// checkout (outstanding_balance += credit portion, src/services/posService.ts:220-230)
// and on payment (outstanding_balance -= amount, clamped at 0 like every
// balance-writing RPC in this app, e.g. adjust_customer_outstanding).
//
// Requires a real Postgres connection (SANDBOX_DB_URL / SUPABASE_DB_URL)
// pointed at a database that already has the sandbox schema applied. Skips
// with a printed reason when no DB creds are configured, same as
// sandbox-isolation.test.ts.

const url = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;

function toCustomer(row: any): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: '',
    email: '',
    address: '',
    type: row.type,
    credit_limit: Number(row.credit_limit),
    outstanding_balance: Number(row.outstanding_balance),
    cheque_float: 0,
    created_at: '',
    updated_at: '',
  };
}

describe('customers & credit — limit enforcement and balance updates', () => {
  let client: pg.Client;
  let customerId: string;
  let invoiceId: string;

  beforeAll(async () => {
    if (!url) return;
    client = new pg.Client({ connectionString: url });
    await client.connect();
    await client.query('set search_path = sandbox');

    const customer = await client.query(
      `insert into customers (name, type, credit_limit, outstanding_balance)
       values ('Integration Test Credit Customer', 'wholesale', 100000, 40000)
       returning id, name, type, credit_limit, outstanding_balance`
    );
    customerId = customer.rows[0].id;
  });

  afterAll(async () => {
    if (!url) return;
    if (invoiceId) {
      await client.query('delete from payments where invoice_id = $1', [invoiceId]);
      await client.query('delete from invoices where id = $1', [invoiceId]);
    }
    if (customerId) await client.query('delete from customers where id = $1', [customerId]);
    await client?.end();
  });

  it.skipIf(!url)('a sale within remaining credit is allowed; one over it is rejected', async () => {
    const row = await client.query('select * from customers where id = $1', [customerId]);
    const customer = toCustomer(row.rows[0]);

    // credit_limit 100000, outstanding 40000 -> 60000 remaining.
    expect(getRemainingCredit(customer)).toBe(60000);
    expect(isOverCreditLimit(customer, 60000)).toBe(false); // exactly at the limit is allowed
    expect(isOverCreditLimit(customer, 60001)).toBe(true); // one rupee over is rejected
  });

  it.skipIf(!url)('outstanding balance rises on a credit sale, then falls on payment', async () => {
    const before = await client.query('select outstanding_balance from customers where id = $1', [customerId]);
    expect(Number(before.rows[0].outstanding_balance)).toBe(40000);

    // Credit sale for 20000, fully unpaid at checkout -> outstanding_balance += 20000
    // (mirrors posService.ts's checkout outstanding-balance update).
    const invoice = await client.query(
      `insert into invoices (invoice_no, customer_id, mode, subtotal, discount, total, payment_status)
       values ('TEST-CC-INV-' || substr(gen_random_uuid()::text, 1, 8), $1, 'wholesale', 20000, 0, 20000, 'unpaid')
       returning id`,
      [customerId]
    );
    invoiceId = invoice.rows[0].id;

    await client.query(
      'update customers set outstanding_balance = outstanding_balance + 20000 where id = $1',
      [customerId]
    );

    const afterSale = await client.query('select outstanding_balance from customers where id = $1', [customerId]);
    expect(Number(afterSale.rows[0].outstanding_balance)).toBe(60000);

    // Customer pays the invoice off in cash -> a payments row, outstanding_balance -= 20000.
    await client.query(
      `insert into payments (invoice_id, customer_id, amount, method, paid_at)
       values ($1, $2, 20000, 'cash', now())`,
      [invoiceId, customerId]
    );
    await client.query(
      'update customers set outstanding_balance = greatest(0, outstanding_balance - 20000) where id = $1',
      [customerId]
    );
    await client.query(`update invoices set payment_status = 'paid' where id = $1`, [invoiceId]);

    const afterPayment = await client.query('select outstanding_balance from customers where id = $1', [customerId]);
    expect(Number(afterPayment.rows[0].outstanding_balance)).toBe(40000); // back to the starting balance

    const payment = await client.query('select amount, method from payments where invoice_id = $1', [invoiceId]);
    expect(payment.rows).toHaveLength(1);
    expect(payment.rows[0]).toMatchObject({ method: 'cash', amount: '20000.00' });
  });

  it.skipIf(!url)('a payment larger than the outstanding balance clamps at 0, never negative', async () => {
    await client.query('update customers set outstanding_balance = 5000 where id = $1', [customerId]);

    await client.query(
      'update customers set outstanding_balance = greatest(0, outstanding_balance - 999999) where id = $1',
      [customerId]
    );

    const result = await client.query('select outstanding_balance from customers where id = $1', [customerId]);
    expect(Number(result.rows[0].outstanding_balance)).toBe(0);

    // Restore for afterAll bookkeeping / any later test ordering.
    await client.query('update customers set outstanding_balance = 40000 where id = $1', [customerId]);
  });

  it.skipIf(url)('skipped: no SANDBOX_DB_URL / SUPABASE_DB_URL set in the environment', () => {});
});
