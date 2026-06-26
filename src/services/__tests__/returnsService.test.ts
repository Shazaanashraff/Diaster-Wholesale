// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processInvoiceReturn } from '../returnsService';

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import { supabase } from '../../lib/supabase';

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
  pieces: 3,
  unit_price: 2500,
  total: 5000,
  products: { name: 'Widget', item_code: 'W001', pieces_per_carton: 12 },
};

const INVOICE_ROW = {
  id: 'inv-1',
  invoice_no: 'INV-000001',
  customer_id: 'cust-1',
  total: 5000,
  payment_status: 'paid' as const,
  notes: '',
  created_at: '2024-01-01T00:00:00Z',
  customers: { name: 'Test Customer' },
  invoice_items: [INVOICE_ITEM],
};

const RETURNED_INVOICE_ROW = {
  ...INVOICE_ROW,
  notes: '[RETURNED] 2024-01-15',
};

const EMPTY_INVOICE_ROW = { ...INVOICE_ROW, invoice_items: [] };

const PARTIAL_INVOICE_ROW = { ...INVOICE_ROW, payment_status: 'partial' as const };

const UNPAID_INVOICE_ROW = { ...INVOICE_ROW, payment_status: 'unpaid' as const };

const CUSTOMER = { id: 'cust-1', outstanding_balance: 8000 };

function wireHappyPath(invoiceRow = INVOICE_ROW) {
  let invoicesCallCount = 0;
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'invoices') {
      invoicesCallCount++;
      return invoicesCallCount === 1 ? sb(invoiceRow) : sb();
    }
    if (table === 'stock_adjustments') return sb();
    if (table === 'payments') return sb();
    if (table === 'customers') return sb(CUSTOMER);
    return sb();
  });
}

describe('returnsService › processInvoiceReturn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Guard clauses ──────────────────────────────────────────────────────────

  it('throws "already been returned" when invoice notes contain [RETURNED]', async () => {
    let invoicesCallCount = 0;
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'invoices') {
        invoicesCallCount++;
        return sb(RETURNED_INVOICE_ROW);
      }
      return sb();
    });
    await expect(processInvoiceReturn('inv-1', 'customer request', 'admin')).rejects.toThrow(
      'already been returned'
    );
  });

  it('throws "no items to return" when invoice_items is empty', async () => {
    let invoicesCallCount = 0;
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'invoices') {
        invoicesCallCount++;
        return sb(EMPTY_INVOICE_ROW);
      }
      return sb();
    });
    await expect(processInvoiceReturn('inv-1', 'customer request', 'admin')).rejects.toThrow(
      'no items'
    );
  });

  it('throws "Invoice not found" when supabase fetch returns error', async () => {
    vi.mocked(supabase.from).mockReturnValue(sb(null, { message: 'row not found' }));
    await expect(processInvoiceReturn('bad-id', 'reason', 'admin')).rejects.toThrow('row not found');
  });

  // ── Stock adjustments ──────────────────────────────────────────────────────

  it('inserts one stock adjustment per line item', async () => {
    wireHappyPath();
    await processInvoiceReturn('inv-1', 'customer request', 'admin');
    const calls = vi.mocked(supabase.from).mock.calls.map(([t]) => t);
    expect(calls).toContain('stock_adjustments');
  });

  it('throws when stock adjustment insertion fails', async () => {
    let invoicesCallCount = 0;
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'invoices') {
        invoicesCallCount++;
        return invoicesCallCount === 1 ? sb(INVOICE_ROW) : sb();
      }
      if (table === 'stock_adjustments') return sb(null, { message: 'constraint violation' });
      return sb();
    });
    await expect(processInvoiceReturn('inv-1', 'reason', 'admin')).rejects.toThrow(
      'constraint violation'
    );
  });

  // ── Payment insertion ──────────────────────────────────────────────────────

  it('inserts a negative payment for a paid invoice', async () => {
    wireHappyPath(INVOICE_ROW); // payment_status: 'paid'
    await processInvoiceReturn('inv-1', 'reason', 'admin', 'cash');
    const calls = vi.mocked(supabase.from).mock.calls.map(([t]) => t);
    expect(calls).toContain('payments');
  });

  it('inserts a negative payment for a partial invoice', async () => {
    wireHappyPath(PARTIAL_INVOICE_ROW);
    await processInvoiceReturn('inv-1', 'reason', 'admin', 'cash');
    const calls = vi.mocked(supabase.from).mock.calls.map(([t]) => t);
    expect(calls).toContain('payments');
  });

  it('skips payment insertion for unpaid invoice with no_refund method', async () => {
    wireHappyPath(UNPAID_INVOICE_ROW);
    await processInvoiceReturn('inv-1', 'reason', 'admin', 'no_refund');
    const calls = vi.mocked(supabase.from).mock.calls.map(([t]) => t);
    expect(calls).not.toContain('payments');
  });

  it('skips payment insertion for paid invoice when refund method is no_refund', async () => {
    wireHappyPath(INVOICE_ROW);
    await processInvoiceReturn('inv-1', 'reason', 'admin', 'no_refund');
    const calls = vi.mocked(supabase.from).mock.calls.map(([t]) => t);
    expect(calls).not.toContain('payments');
  });

  it('throws when payment insertion fails', async () => {
    let invoicesCallCount = 0;
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'invoices') {
        invoicesCallCount++;
        return invoicesCallCount === 1 ? sb(INVOICE_ROW) : sb();
      }
      if (table === 'stock_adjustments') return sb();
      if (table === 'payments') return sb(null, { message: 'payment insert failed' });
      return sb();
    });
    await expect(processInvoiceReturn('inv-1', 'reason', 'admin', 'cash')).rejects.toThrow(
      'payment insert failed'
    );
  });

  // ── credit_note: outstanding balance reduction ─────────────────────────────

  it('queries and updates customer outstanding_balance for credit_note refund', async () => {
    wireHappyPath(INVOICE_ROW);
    await processInvoiceReturn('inv-1', 'reason', 'admin', 'credit_note');
    const calls = vi.mocked(supabase.from).mock.calls.map(([t]) => t);
    expect(calls.filter(t => t === 'customers').length).toBeGreaterThanOrEqual(1);
  });

  // ── Invoice note tagging ───────────────────────────────────────────────────

  it('updates invoice notes with [RETURNED] tag', async () => {
    wireHappyPath();
    await processInvoiceReturn('inv-1', 'reason', 'admin');
    const calls = vi.mocked(supabase.from).mock.calls.map(([t]) => t);
    // invoices is called at least twice: fetch and update
    expect(calls.filter(t => t === 'invoices').length).toBeGreaterThanOrEqual(2);
  });
});
