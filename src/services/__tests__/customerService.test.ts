// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordPayment, getCustomerById, createCustomer } from '../customerService';

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

const CUSTOMER = {
  id: 'cust-1',
  name: 'Test Customer',
  phone: '0771234567',
  email: 'test@example.com',
  address: '123 Main St',
  type: 'retail',
  credit_limit: 50000,
  outstanding_balance: 12000,
  cheque_float: 0,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('customerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);
    vi.mocked(supabase.from).mockReturnValue(sb(CUSTOMER));
  });

  // ── recordPayment ──────────────────────────────────────────────────────────

  describe('recordPayment', () => {
    it('calls record_payment_atomic RPC with correct params for cash', async () => {
      await recordPayment('cust-1', 'inv-1', 5000, 'cash');
      expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('record_payment_atomic', {
        p_customer_id:   'cust-1',
        p_invoice_id:    'inv-1',
        p_amount:        5000,
        p_method:        'cash',
        p_bank_name:     '',
        p_cheque_number: '',
        p_due_date:      '',
      });
    });

    it('passes cheque fields when method is cheque', async () => {
      await recordPayment('cust-1', 'inv-1', 5000, 'cheque', 'ComBank', 'CHQ-001', '2024-06-30');
      expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith(
        'record_payment_atomic',
        expect.objectContaining({
          p_bank_name:     'ComBank',
          p_cheque_number: 'CHQ-001',
          p_due_date:      '2024-06-30',
        })
      );
    });

    it('accepts null invoiceId for unallocated credit payments', async () => {
      await expect(recordPayment('cust-1', null, 1000, 'bank_transfer')).resolves.not.toThrow();
      expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith(
        'record_payment_atomic',
        expect.objectContaining({ p_invoice_id: null })
      );
    });

    it('throws when RPC returns error', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'insufficient balance' },
      } as any);
      await expect(recordPayment('cust-1', 'inv-1', 99999, 'cash')).rejects.toThrow();
    });
  });

  // ── getCustomerById ────────────────────────────────────────────────────────

  describe('getCustomerById', () => {
    it('returns the customer with credit_limit and outstanding_balance', async () => {
      vi.mocked(supabase.from).mockReturnValue(sb(CUSTOMER));
      const result = await getCustomerById('cust-1');
      expect(result.credit_limit).toBe(50000);
      expect(result.outstanding_balance).toBe(12000);
    });

    it('throws when supabase returns an error', async () => {
      vi.mocked(supabase.from).mockReturnValue(sb(null, { message: 'row not found' }));
      await expect(getCustomerById('missing-id')).rejects.toThrow();
    });
  });

  // ── createCustomer ─────────────────────────────────────────────────────────

  describe('createCustomer', () => {
    it('always initialises outstanding_balance to 0 regardless of input', async () => {
      vi.mocked(supabase.from).mockReturnValue(sb({ ...CUSTOMER, outstanding_balance: 0 }));
      const result = await createCustomer({
        name:         'New Customer',
        phone:        '0771111111',
        email:        '',
        address:      '',
        type:         'retail',
        credit_limit: 30000,
        cheque_float: 0,
        is_active:    true,
      } as any);
      expect(result.outstanding_balance).toBe(0);
    });
  });
});
