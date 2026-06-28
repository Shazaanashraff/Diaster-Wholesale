import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processInvoiceReturn } from '../returnsService';

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));
vi.mock('../captureFetch', () => ({
  captureFetch: vi.fn((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init)),
}));

import { supabase } from '../../lib/supabase';

function sb(data: unknown = null, error: unknown = null) {
  const resolved = Promise.resolve({ data, error });
  const handler: ProxyHandler<typeof resolved> = {
    get(target, prop) {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        return (target as any)[prop].bind(target);
      }
      return (..._args: unknown[]) => new Proxy(resolved, handler);
    },
  };
  return new Proxy(resolved, handler) as any;
}

const ITEM = {
  id: 'item-1',
  product_id: 'prod-1',
  cartons: 2,
  pieces: 0,
  unit_price: 600,
  total: 1200,
  products: [{ name: 'Headphones', item_code: 'H001', pieces_per_carton: 12 }],
};

const BASE_INVOICE = {
  id: 'inv-1',
  invoice_no: 'INV-001',
  customer_id: 'cust-1',
  total: 1200,
  payment_status: 'unpaid' as const,
  notes: '',
  created_at: '2026-01-01T00:00:00Z',
  customers: [{ name: 'Nimal' }],
  invoice_items: [ITEM],
};

// ── Unit tests ────────────────────────────────────────────────────────────────

describe('returnsService › processInvoiceReturn()', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('throws when the invoice already has a [RETURNED] tag in notes', async () => {
    vi.mocked(supabase.from).mockImplementation(() =>
      sb({ ...BASE_INVOICE, notes: '[RETURNED] 2026-06-01T10:00:00.000Z\nPrevious return' })
    );
    await expect(
      processInvoiceReturn('inv-1', 'reason', 'admin'),
    ).rejects.toThrow('already been returned');
  });

  it('throws when invoice has no line items to return', async () => {
    vi.mocked(supabase.from).mockImplementation(() =>
      sb({ ...BASE_INVOICE, invoice_items: [] })
    );
    await expect(
      processInvoiceReturn('inv-1', 'reason', 'admin'),
    ).rejects.toThrow('no items to return');
  });

  it('throws when the invoice fetch itself fails (not found / network error)', async () => {
    vi.mocked(supabase.from).mockImplementation(() =>
      sb(null, { message: 'row not found' })
    );
    await expect(
      processInvoiceReturn('inv-x', 'reason', 'admin'),
    ).rejects.toThrow('row not found');
  });

  it('unpaid invoice: inserts stock_adjustments but no payments row', async () => {
    let invoiceN = 0;
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'invoices') { invoiceN++; return invoiceN === 1 ? sb(BASE_INVOICE) : sb(null); }
      return sb(null);
    });

    await processInvoiceReturn('inv-1', 'customer return', 'admin', 'cash');

    const stockCalls = vi.mocked(supabase.from).mock.calls.filter(([t]) => t === 'stock_adjustments');
    const paymentCalls = vi.mocked(supabase.from).mock.calls.filter(([t]) => t === 'payments');
    expect(stockCalls).toHaveLength(1);
    expect(paymentCalls).toHaveLength(0);
  });

  it('paid invoice with no_refund: no payments row and no customer update', async () => {
    let invoiceN = 0;
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'invoices') {
        invoiceN++;
        return invoiceN === 1 ? sb({ ...BASE_INVOICE, payment_status: 'paid' }) : sb(null);
      }
      return sb(null);
    });

    await processInvoiceReturn('inv-1', 'no_refund', 'admin', 'no_refund');

    const paymentCalls = vi.mocked(supabase.from).mock.calls.filter(([t]) => t === 'payments');
    const customerCalls = vi.mocked(supabase.from).mock.calls.filter(([t]) => t === 'customers');
    expect(paymentCalls).toHaveLength(0);
    expect(customerCalls).toHaveLength(0);
  });

  it('paid invoice with credit_note: reads and updates the customer outstanding_balance', async () => {
    let invoiceN = 0;
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'invoices') {
        invoiceN++;
        return invoiceN === 1 ? sb({ ...BASE_INVOICE, payment_status: 'paid' }) : sb(null);
      }
      if (table === 'customers') return sb({ outstanding_balance: 5000 });
      return sb(null);
    });

    await processInvoiceReturn('inv-1', 'damaged goods', 'admin', 'credit_note');

    const customerCalls = vi.mocked(supabase.from).mock.calls.filter(([t]) => t === 'customers');
    expect(customerCalls.length).toBeGreaterThanOrEqual(1);
  });
});
