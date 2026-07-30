import { describe, it, expect, vi, beforeEach } from 'vitest';

// Payments & Cheques (todo-013): the cheque lifecycle is
// received (recordPayment) -> deposited (depositCheque) -> cleared
// (completeCheque) / bounced (returnCheque), plus the undo/re-present paths.
// All state transitions are guarded server-side by the update_cheque_status
// RPC (supabase/migrations/20260625000000_cheque_management.sql):
//   pending -> processing : deposited
//   processing -> completed / returned : cleared / bounced
// An invalid transition raises 'Invalid cheque transition: <from> -> <to>'.
// These tests prove the customerService.ts wrappers pass the exact expected
// status to the RPC for every stage, and that a rejected transition's
// specific error message propagates to the caller unchanged.

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import { supabase } from '../lib/supabase';
import {
  recordPayment,
  depositCheque,
  completeCheque,
  returnCheque,
  reverseChequeToReturned,
  undoChequeDeposit,
  representCheque,
} from './customerService';

describe('cheque lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('received: recordPayment with method "cheque" carries the cheque details', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

    await recordPayment('cust-1', 'inv-1', 8000, 'cheque', 'Sampath Bank', 'CHQ-1234', '2026-08-20');

    expect(supabase.rpc).toHaveBeenCalledWith('record_payment_atomic', expect.objectContaining({
      p_method: 'cheque',
      p_bank_name: 'Sampath Bank',
      p_cheque_number: 'CHQ-1234',
      p_due_date: '2026-08-20',
    }));
  });

  it('deposited: depositCheque moves pending -> processing', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

    await depositCheque('pay-1');

    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'processing',
    });
  });

  it('cleared: completeCheque moves processing -> completed', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

    await completeCheque('pay-1');

    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'completed',
    });
  });

  it('bounced: returnCheque moves processing -> returned', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

    await returnCheque('pay-1');

    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'returned',
    });
  });

  it('bounced after clearing: reverseChequeToReturned also requests "returned"', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

    await reverseChequeToReturned('pay-1');

    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'returned',
    });
  });

  it('undo: undoChequeDeposit moves processing back to pending', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

    await undoChequeDeposit('pay-1');

    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'pending',
    });
  });

  it('re-present: representCheque moves returned back to processing', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

    await representCheque('pay-1');

    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'processing',
    });
  });

  it('invalid transition (e.g. completing a cheque still pending) rejects with the DB\'s specific error', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: null,
      error: { message: 'Invalid cheque transition: pending -> completed' },
    });

    await expect(completeCheque('pay-1')).rejects.toMatchObject({
      message: 'Invalid cheque transition: pending -> completed',
    });
  });

  it('invalid transition (depositing a payment that is not a cheque) rejects with a specific error', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: null,
      error: { message: 'Payment pay-2 is not a cheque payment' },
    });

    await expect(depositCheque('pay-2')).rejects.toMatchObject({
      message: 'Payment pay-2 is not a cheque payment',
    });
  });
});
