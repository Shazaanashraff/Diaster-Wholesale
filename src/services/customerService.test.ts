import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import { supabase } from '../lib/supabase';
import { adjustCustomerOutstandingManual } from './customerService';

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
