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

// Registered in the Sandbox catalog (todo-013) under `payments-cheques` as type:"unit".
//
// These functions are thin wrappers around the `update_cheque_status` RPC, which owns the
// real state machine (received -> pending -> processing -> completed / returned, plus the
// reverse transitions) server-side. `update_cheque_status` exists only in `public` (not in
// `sandbox` — confirmed schema drift, see this todo's Completion Notes), so it cannot be
// exercised as a `sandbox`-schema integration test today. These unit tests instead lock
// down the one thing that's this app's responsibility: every lifecycle action sends the
// exact `payment_id` + `p_new_status` the state machine expects, and any rejection from
// the RPC (e.g. an invalid transition) propagates to the caller instead of being swallowed.

describe('cheque lifecycle actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('depositCheque moves a cheque to "processing"', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });
    await depositCheque('pay-1');
    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'processing',
    });
  });

  it('completeCheque moves a cheque to "completed"', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });
    await completeCheque('pay-1');
    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'completed',
    });
  });

  it('returnCheque moves a cheque to "returned" (bounced before clearing)', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });
    await returnCheque('pay-1');
    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'returned',
    });
  });

  it('reverseChequeToReturned moves a completed cheque back to "returned" (bounced after clearing)', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });
    await reverseChequeToReturned('pay-1');
    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'returned',
    });
  });

  it('undoChequeDeposit moves a cheque back to "pending"', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });
    await undoChequeDeposit('pay-1');
    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'pending',
    });
  });

  it('representCheque moves a returned cheque back to "processing" (re-presented at the bank)', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });
    await representCheque('pay-1');
    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'processing',
    });
  });

  it('propagates an invalid-transition rejection from the RPC instead of swallowing it', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: null,
      error: { message: 'Invalid cheque transition: pending → completed' },
    });

    await expect(completeCheque('pay-1')).rejects.toMatchObject({
      message: 'Invalid cheque transition: pending → completed',
    });
  });
});
