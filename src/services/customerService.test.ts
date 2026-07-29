import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import { supabase } from '../lib/supabase';
import { adjustCustomerOutstandingManual, recordPayment } from './customerService';

describe('recordPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls record_payment_atomic with the customer, invoice, amount, and method', async () => {
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

  it('passes a null invoice_id through unchanged for a general (no-invoice) payment', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

    await recordPayment('cust-1', null, 5000, 'cash');

    expect(supabase.rpc).toHaveBeenCalledWith('record_payment_atomic', expect.objectContaining({
      p_invoice_id: null,
    }));
  });

  it('carries bank_name, cheque_number, and due_date through for a cheque payment', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

    await recordPayment('cust-1', 'inv-1', 25000, 'cheque', 'Commercial Bank', 'CHQ-9001', '2026-08-15');

    expect(supabase.rpc).toHaveBeenCalledWith('record_payment_atomic', expect.objectContaining({
      p_method: 'cheque',
      p_bank_name: 'Commercial Bank',
      p_cheque_number: 'CHQ-9001',
      p_due_date: '2026-08-15',
    }));
  });

  it('throws when the RPC returns an error, leaving the outstanding balance untouched', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: null,
      error: { message: 'Payment amount must be greater than zero' },
    });

    await expect(recordPayment('cust-1', 'inv-1', 0, 'cash')).rejects.toMatchObject({
      message: 'Payment amount must be greater than zero',
    });
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
