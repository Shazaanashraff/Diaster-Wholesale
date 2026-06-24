import { describe, it, expect, vi, beforeEach } from 'vitest';
import { depositCheque, completeCheque, returnCheque } from '../customerService';

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import { supabase } from '../../lib/supabase';

describe('customerService › cheque lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('depositCheque transitions status to "processing"', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);

    await depositCheque('pay-1');

    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'processing',
    });
  });

  it('completeCheque transitions status to "completed"', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);

    await completeCheque('pay-2');

    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-2',
      p_new_status: 'completed',
    });
  });

  it('returnCheque transitions status to "returned"', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);

    await returnCheque('pay-3');

    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-3',
      p_new_status: 'returned',
    });
  });

  it('full lifecycle: received → deposited (processing) → cleared (completed)', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);

    await depositCheque('pay-4');
    await completeCheque('pay-4');

    const calls = vi.mocked(supabase.rpc).mock.calls;
    expect(calls[0]).toEqual(['update_cheque_status', { p_payment_id: 'pay-4', p_new_status: 'processing' }]);
    expect(calls[1]).toEqual(['update_cheque_status', { p_payment_id: 'pay-4', p_new_status: 'completed' }]);
  });

  it('depositCheque propagates RPC error to caller', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null, error: { message: 'cheque already deposited', code: '23514' },
    } as any);

    await expect(depositCheque('pay-5')).rejects.toMatchObject({
      message: 'cheque already deposited',
    });
  });

  it('invalid transition: completing a returned cheque propagates DB rejection', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null, error: { message: 'invalid cheque status transition', code: '23514' },
    } as any);

    await expect(completeCheque('pay-6')).rejects.toMatchObject({
      message: 'invalid cheque status transition',
    });
  });
});
