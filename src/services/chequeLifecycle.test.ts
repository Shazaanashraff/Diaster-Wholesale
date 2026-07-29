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

// Cheque lifecycle wrappers in customerService.ts are thin 1-line passthroughs
// to the update_cheque_status RPC — the actual state machine (valid
// transitions: pending->processing->{completed,returned,pending},
// completed->returned, returned->processing) and its float/outstanding-balance
// side effects live entirely in Postgres
// (supabase/migrations/20260726120000_cheque_reversals_and_credit_balance.sql).
// That RPC was not ported to the `sandbox` schema, so it cannot be exercised
// by a sandbox integration test today (see todo-013 completion notes). What's
// tested here, against a mocked Supabase client, is the JS-level contract:
// each wrapper calls the RPC with the exact payment_id/new_status pair the
// state machine expects, and a DB-side rejection (using the migration's own
// error message format) propagates to the caller unchanged.

describe('cheque lifecycle RPC wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('depositCheque moves pending -> processing', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });
    await depositCheque('pay-1');
    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'processing',
    });
  });

  it('completeCheque moves processing -> completed', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });
    await completeCheque('pay-1');
    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'completed',
    });
  });

  it('returnCheque moves processing -> returned (bounced before clearing)', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });
    await returnCheque('pay-1');
    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'returned',
    });
  });

  it('reverseChequeToReturned moves completed -> returned (bounced after clearing)', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });
    await reverseChequeToReturned('pay-1');
    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'returned',
    });
  });

  it('undoChequeDeposit moves processing -> pending', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });
    await undoChequeDeposit('pay-1');
    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'pending',
    });
  });

  it('representCheque moves returned -> processing (re-presented at the bank)', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });
    await representCheque('pay-1');
    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'processing',
    });
  });

  it('propagates an invalid-transition rejection from the DB unchanged (e.g. pending -> completed)', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: null,
      error: { message: 'Invalid cheque transition: pending → completed' },
    });

    await expect(completeCheque('pay-1')).rejects.toMatchObject({
      message: 'Invalid cheque transition: pending → completed',
    });
  });

  it('propagates a "not a cheque payment" rejection from the DB unchanged', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: null,
      error: { message: 'Payment pay-2 is not a cheque payment' },
    });

    await expect(depositCheque('pay-2')).rejects.toMatchObject({
      message: 'Payment pay-2 is not a cheque payment',
    });
  });
});
