import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processInvoiceReturn } from '../returnsService';

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import { supabase } from '../../lib/supabase';

// Proxy helper: any chained method returns the same resolved promise.
function sb(data: unknown = null, error: unknown = null) {
  const resolved = Promise.resolve({ data, error });
  const handler: ProxyHandler<typeof resolved> = {
    get(target, prop: string | symbol) {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        return (target as any)[prop].bind(target);
      }
      return (..._args: unknown[]) => new Proxy(resolved, handler);
    },
  };
  return new Proxy(resolved, handler) as any;
}

const INVOICE_ITEM = {
  id: 'item-1',
  product_id: 'prod-1',
  cartons: 2,
  pieces: 0,
  unit_price: 600.00,
  total: 1200.00,
  products: { name: 'Biscuit Pack', item_code: 'B001', pieces_per_carton: 12 },
};

const PAID_INVOICE = {
  id: 'inv-1',
  invoice_no: 'INV-100001',
  customer_id: 'cust-1',
  total: 1200.00,
  payment_status: 'paid',
  notes: '',
  created_at: '2026-06-01T00:00:00Z',
  customers: { name: 'ABC Traders' },
  invoice_items: [INVOICE_ITEM],
};

const UNPAID_INVOICE = { ...PAID_INVOICE, id: 'inv-2', invoice_no: 'INV-100002', payment_status: 'unpaid' };

describe('returnsService › processInvoiceReturn()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws "already been returned" when invoice notes contain [RETURNED]', async () => {
    const alreadyReturned = {
      ...PAID_INVOICE,
      notes: '[RETURNED] 2026-06-10T00:00:00.000Z\nCustomer changed mind',
    };
    vi.mocked(supabase.from).mockReturnValue(sb(alreadyReturned));

    await expect(
      processInvoiceReturn('inv-1', 'defective', 'admin')
    ).rejects.toThrow('already been returned');
  });

  it('throws "no items to return" when invoice has no line items', async () => {
    vi.mocked(supabase.from).mockReturnValue(sb({ ...PAID_INVOICE, invoice_items: [] }));

    await expect(
      processInvoiceReturn('inv-1', 'customer return', 'admin')
    ).rejects.toThrow('no items to return');
  });

  it('creates stock adjustments for every line item on a full return', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'invoices') return sb(PAID_INVOICE);
      return sb(); // stock_adjustments, payments, invoices update
    });

    await processInvoiceReturn('inv-1', 'defective batch', 'manager');

    const touchedTables = vi.mocked(supabase.from).mock.calls.map(([t]) => t);
    expect(touchedTables).toContain('stock_adjustments');
  });

  it('inserts a negative payment record for a paid invoice (cash refund)', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'invoices') return sb(PAID_INVOICE);
      return sb();
    });

    await processInvoiceReturn('inv-1', 'customer return', 'admin', 'cash');

    const touchedTables = vi.mocked(supabase.from).mock.calls.map(([t]) => t);
    expect(touchedTables).toContain('payments');
  });

  it('does NOT insert a payment when refundMethod is no_refund', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'invoices') return sb(PAID_INVOICE);
      return sb();
    });

    await processInvoiceReturn('inv-1', 'exchange only', 'admin', 'no_refund');

    const touchedTables = vi.mocked(supabase.from).mock.calls.map(([t]) => t);
    expect(touchedTables).not.toContain('payments');
  });

  it('skips the negative payment for an unpaid invoice regardless of refundMethod', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'invoices') return sb(UNPAID_INVOICE);
      return sb();
    });

    await processInvoiceReturn('inv-2', 'wrong item shipped', 'admin', 'cash');

    const touchedTables = vi.mocked(supabase.from).mock.calls.map(([t]) => t);
    expect(touchedTables).not.toContain('payments');
  });

  it('credit_note return reduces customer outstanding balance', async () => {
    const customer = { outstanding_balance: 1200.00 };
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'invoices') return sb(PAID_INVOICE);
      if (table === 'customers') return sb(customer);
      return sb();
    });

    await processInvoiceReturn('inv-1', 'credit back', 'admin', 'credit_note');

    // Expect customers.update to have been called (outstanding balance reduced)
    const touchedTables = vi.mocked(supabase.from).mock.calls.map(([t]) => t);
    const customerCalls = touchedTables.filter((t) => t === 'customers');
    expect(customerCalls.length).toBeGreaterThanOrEqual(2); // select + update
  });
});
