import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import { supabase } from '../lib/supabase';
import { adjustCustomerOutstandingManual, recordPayment, getCustomerLedger } from './customerService';

// Proxy over a resolved Promise so any chained call (.select/.eq/.order/…)
// returns the same proxy, and awaiting it resolves to `result` — mirrors the
// `sb()` helper in posService.test.ts.
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
  return new Proxy(resolved, handler);
}

describe('recordPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls record_payment_atomic with the customer, invoice, amount, and method', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

    await recordPayment('cust-1', 'inv-1', 5000, 'cash');

    expect(supabase.rpc).toHaveBeenCalledWith('record_payment_atomic', {
      p_customer_id: 'cust-1',
      p_invoice_id: 'inv-1',
      p_amount: 5000,
      p_method: 'cash',
      p_bank_name: '',
      p_cheque_number: '',
      p_due_date: '',
    });
  });

  it('passes bank_name, cheque_number, and due_date through for a cheque payment', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

    await recordPayment('cust-1', 'inv-1', 12000, 'cheque', 'Commercial Bank', 'CHQ-9001', '2026-08-15');

    expect(supabase.rpc).toHaveBeenCalledWith('record_payment_atomic', expect.objectContaining({
      p_method: 'cheque',
      p_bank_name: 'Commercial Bank',
      p_cheque_number: 'CHQ-9001',
      p_due_date: '2026-08-15',
    }));
  });

  it('records a walk-in payment with no invoice as p_invoice_id: null', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

    await recordPayment('cust-1', null, 1000);

    expect(supabase.rpc).toHaveBeenCalledWith('record_payment_atomic', expect.objectContaining({
      p_invoice_id: null,
      p_method: 'cash',
    }));
  });

  it('throws when the RPC returns an error', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: null,
      error: { message: 'Payment amount must be positive' },
    });

    await expect(recordPayment('cust-1', 'inv-1', -500)).rejects.toMatchObject({
      message: 'Payment amount must be positive',
    });
  });
});

describe('getCustomerLedger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('combines invoices and payments for the customer', async () => {
    (supabase.from as any).mockImplementation((table: string) =>
      table === 'invoices' ? sb([{ id: 'inv-1' }]) : sb([{ id: 'pay-1' }])
    );

    const result = await getCustomerLedger('cust-1');

    expect(result.invoices).toEqual([{ id: 'inv-1' }]);
    expect(result.payments).toEqual([{ id: 'pay-1' }]);
  });

  it('throws when the invoices query fails, without touching payments', async () => {
    (supabase.from as any).mockImplementation((table: string) =>
      table === 'invoices' ? sb(null, { message: 'invoices query failed' }) : sb([])
    );

    await expect(getCustomerLedger('cust-1')).rejects.toMatchObject({ message: 'invoices query failed' });
  });

  it('throws when the payments query fails even if invoices succeeded', async () => {
    (supabase.from as any).mockImplementation((table: string) =>
      table === 'invoices' ? sb([{ id: 'inv-1' }]) : sb(null, { message: 'payments query failed' })
    );

    await expect(getCustomerLedger('cust-1')).rejects.toMatchObject({ message: 'payments query failed' });
  });
});

describe('adjustCustomerOutstandingManual', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the RPC with the exact signed delta, reason, and adjuster', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: 42500, error: null });

    const result = await adjustCustomerOutstandingManual('cust-1', -1500, 'Goodwill write-off', 'admin');

    expect(supabase.rpc).toHaveBeenCalledWith('adjust_customer_outstanding_manual', {
      p_customer_id: 'cust-1',
      p_delta: -1500,
      p_reason: 'Goodwill write-off',
      p_adjusted_by: 'admin',
    });
    expect(result).toBe(42500);
  });

  it('passes a positive delta through unchanged for an increase', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: 10000, error: null });

    await adjustCustomerOutstandingManual('cust-2', 2000, 'Correcting under-charge', 'admin');

    expect(supabase.rpc).toHaveBeenCalledWith('adjust_customer_outstanding_manual', expect.objectContaining({
      p_delta: 2000,
    }));
  });

  it('throws when the RPC returns an error', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: null,
      error: { message: 'A reason is required for a manual balance adjustment' },
    });

    await expect(
      adjustCustomerOutstandingManual('cust-1', -500, '', 'admin')
    ).rejects.toMatchObject({ message: 'A reason is required for a manual balance adjustment' });
  });
});
