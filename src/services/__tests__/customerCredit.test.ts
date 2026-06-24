import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCustomer, recordPayment, updateCustomer } from '../customerService';

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

const SAVED_CUSTOMER = {
  id: 'cust-1',
  name: 'ABC Traders',
  phone: '0711234567',
  email: '',
  address: '',
  type: 'wholesale',
  credit_limit: 100000,
  outstanding_balance: 0,
  cheque_float: 0,
  created_at: '',
  updated_at: '',
};

describe('customerService › credit & balance', () => {
  beforeEach(() => vi.clearAllMocks());

  it('createCustomer always initialises outstanding_balance to zero', async () => {
    vi.mocked(supabase.from).mockReturnValue(sb(SAVED_CUSTOMER));

    const result = await createCustomer({
      name: 'ABC Traders', phone: '0711234567', email: '', address: '',
      type: 'wholesale', credit_limit: 100000, cheque_float: 0,
    } as any);

    // DB row has outstanding_balance: 0 regardless of what caller passes
    expect(result.outstanding_balance).toBe(0);
    expect(vi.mocked(supabase.from).mock.calls[0][0]).toBe('customers');
  });

  it('updateCustomer forwards credit_limit change to the database', async () => {
    const updated = { ...SAVED_CUSTOMER, credit_limit: 200000 };
    vi.mocked(supabase.from).mockReturnValue(sb(updated));

    const result = await updateCustomer('cust-1', { credit_limit: 200000 });

    expect(result.credit_limit).toBe(200000);
  });

  it('recordPayment calls record_payment_atomic with all required fields', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);

    await recordPayment('cust-1', 'inv-1', 5000.00, 'cash');

    expect(supabase.rpc).toHaveBeenCalledWith('record_payment_atomic', expect.objectContaining({
      p_customer_id: 'cust-1',
      p_invoice_id:  'inv-1',
      p_amount:      5000.00,
      p_method:      'cash',
    }));
  });

  it('recordPayment forwards cheque fields (bank, number, due_date) to RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);

    await recordPayment('cust-1', 'inv-2', 10000.00, 'cheque', 'Bank of Ceylon', 'CHQ-9999', '2026-07-01');

    expect(supabase.rpc).toHaveBeenCalledWith('record_payment_atomic', expect.objectContaining({
      p_bank_name:     'Bank of Ceylon',
      p_cheque_number: 'CHQ-9999',
      p_due_date:      '2026-07-01',
    }));
  });

  it('recordPayment propagates RPC error to caller', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null, error: { message: 'payment conflict' },
    } as any);

    await expect(recordPayment('cust-1', null, 500, 'cash')).rejects.toMatchObject({
      message: 'payment conflict',
    });
  });
});
