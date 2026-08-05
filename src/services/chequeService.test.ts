import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import { supabase } from '../lib/supabase';
import {
  depositCheque,
  completeCheque,
  returnCheque,
  reverseChequeToReturned,
  undoChequeDeposit,
  representCheque,
} from './customerService';

// Cheque lifecycle: pending -> processing -> completed / returned, plus the
// reverse transitions (completed -> returned, returned -> processing,
// processing -> pending). Every step is a thin passthrough to the
// update_cheque_status RPC, which owns the transition table and rejects any
// move not in it with "Invalid cheque transition: <from> → <to>".

describe('cheque lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('depositCheque moves pending -> processing', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: {}, error: null });
    await depositCheque('pay-1');
    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'processing',
    });
  });

  it('completeCheque moves processing -> completed', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: {}, error: null });
    await completeCheque('pay-1');
    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'completed',
    });
  });

  it('returnCheque moves processing -> returned', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: {}, error: null });
    await returnCheque('pay-1');
    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'returned',
    });
  });

  it('reverseChequeToReturned moves completed -> returned (bounced after clearing)', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: {}, error: null });
    await reverseChequeToReturned('pay-1');
    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'returned',
    });
  });

  it('undoChequeDeposit moves processing -> pending (undo an accidental deposit click)', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: {}, error: null });
    await undoChequeDeposit('pay-1');
    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'pending',
    });
  });

  it('representCheque moves returned -> processing (re-presented at the bank)', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: {}, error: null });
    await representCheque('pay-1');
    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'processing',
    });
  });

  it('rejects an invalid transition with the specific error from the RPC', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: null,
      error: { message: 'Invalid cheque transition: pending → completed' },
    });

    await expect(completeCheque('pay-1')).rejects.toMatchObject({
      message: 'Invalid cheque transition: pending → completed',
    });
  });

  it('rejects completing a payment that is not a cheque at all', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: null,
      error: { message: 'Payment pay-2 is not a cheque payment' },
    });

    await expect(completeCheque('pay-2')).rejects.toMatchObject({
      message: 'Payment pay-2 is not a cheque payment',
    });
  });
});
