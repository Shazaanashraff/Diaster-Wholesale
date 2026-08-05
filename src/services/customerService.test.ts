import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import { supabase } from '../lib/supabase';
import { adjustCustomerOutstandingManual, recordPayment } from './customerService';

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

describe('recordPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records a cash payment against outstanding balance with empty optional fields', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

    await recordPayment('cust-1', 'inv-1', 15000, 'cash');

    expect(supabase.rpc).toHaveBeenCalledWith('record_payment_atomic', {
      p_customer_id: 'cust-1',
      p_invoice_id: 'inv-1',
      p_amount: 15000,
      p_method: 'cash',
      p_bank_name: '',
      p_cheque_number: '',
      p_due_date: '',
    });
  });

  it('passes bank name, cheque number, and due date through for a cheque payment', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

    await recordPayment('cust-2', 'inv-2', 8000, 'cheque', 'HNB', 'CHQ-9981', '2026-09-01');

    expect(supabase.rpc).toHaveBeenCalledWith('record_payment_atomic', expect.objectContaining({
      p_bank_name: 'HNB',
      p_cheque_number: 'CHQ-9981',
      p_due_date: '2026-09-01',
    }));
  });

  it('throws when the RPC rejects the payment (e.g. an unknown invoice_id)', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: null,
      error: { message: 'insert or update on table "payments" violates foreign key constraint "payments_invoice_id_fkey"' },
    });

    await expect(
      recordPayment('cust-1', 'bad-invoice-id', 15000, 'cash')
    ).rejects.toMatchObject({ message: expect.stringContaining('payments_invoice_id_fkey') });
  });
});
