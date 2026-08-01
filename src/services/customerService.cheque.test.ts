import { describe, it, expect, vi, beforeEach } from 'vitest';

// Unit coverage for the Payments & Cheques group (todo-013).
//
// SCOPE NOTE: this group is unit-tested (mocked Supabase), not integration,
// because a real integration test can't currently pass against `sandbox`:
// update_cheque_status() and record_payment_atomic()
// (supabase/migrations/20260625000000_cheque_management.sql,
// 20260726120000_cheque_reversals_and_credit_balance.sql) both read/write
// payments.cheque_status and customers.cheque_float, but neither column
// exists on sandbox.payments / sandbox.customers — only public got them
// (confirmed by reading supabase/migrations/20260626000000_sandbox_schema_and_meta.sql's
// full table DDL; grepping it for "cheque_float" / "cheque_status" returns
// nothing). Calling either RPC with search_path=sandbox would fail with
// "column ... does not exist". This file instead verifies the one thing that
// doesn't require a live DB: that each customerService.ts wrapper sends the
// RPC the exact lifecycle transition it claims to, and that a transition the
// database rejects (the "Invalid cheque transition: X → Y" error format from
// update_cheque_status's own validation) propagates to the caller unchanged.

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

describe('cheque lifecycle (customerService wrappers)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordPayment', () => {
    it('records a cheque payment via record_payment_atomic with all cheque fields', async () => {
      (supabase.rpc as any).mockResolvedValue({ error: null });

      await recordPayment('cust-1', 'inv-1', 5000, 'cheque', 'Commercial Bank', 'CHQ-9001', '2026-09-01');

      expect(supabase.rpc).toHaveBeenCalledWith('record_payment_atomic', {
        p_customer_id: 'cust-1',
        p_invoice_id: 'inv-1',
        p_amount: 5000,
        p_method: 'cheque',
        p_bank_name: 'Commercial Bank',
        p_cheque_number: 'CHQ-9001',
        p_due_date: '2026-09-01',
      });
    });

    it('defaults optional cheque fields to empty strings when omitted', async () => {
      (supabase.rpc as any).mockResolvedValue({ error: null });

      await recordPayment('cust-1', null, 1000, 'cash');

      expect(supabase.rpc).toHaveBeenCalledWith('record_payment_atomic', expect.objectContaining({
        p_bank_name: '',
        p_cheque_number: '',
        p_due_date: '',
      }));
    });

    it('throws when the RPC errors', async () => {
      (supabase.rpc as any).mockResolvedValue({ error: { message: 'db error' } });

      await expect(recordPayment('cust-1', 'inv-1', 100, 'cash')).rejects.toMatchObject({ message: 'db error' });
    });
  });

  // ── Lifecycle transitions: each wrapper → the exact status it claims ──────

  it('depositCheque: pending → processing', async () => {
    (supabase.rpc as any).mockResolvedValue({ error: null });
    await depositCheque('pay-1');
    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'processing',
    });
  });

  it('completeCheque: processing → completed', async () => {
    (supabase.rpc as any).mockResolvedValue({ error: null });
    await completeCheque('pay-1');
    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'completed',
    });
  });

  it('returnCheque: processing → returned (bounced)', async () => {
    (supabase.rpc as any).mockResolvedValue({ error: null });
    await returnCheque('pay-1');
    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'returned',
    });
  });

  it('reverseChequeToReturned: completed → returned (bounced after clearing)', async () => {
    (supabase.rpc as any).mockResolvedValue({ error: null });
    await reverseChequeToReturned('pay-1');
    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'returned',
    });
  });

  it('undoChequeDeposit: processing → pending (undo an accidental deposit click)', async () => {
    (supabase.rpc as any).mockResolvedValue({ error: null });
    await undoChequeDeposit('pay-1');
    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'pending',
    });
  });

  it('representCheque: returned → processing (re-presented at the bank)', async () => {
    (supabase.rpc as any).mockResolvedValue({ error: null });
    await representCheque('pay-1');
    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'processing',
    });
  });

  // ── Invalid transitions: the DB's specific error propagates unchanged ────

  it('propagates the DB\'s "Invalid cheque transition" error when the transition is out of order', async () => {
    (supabase.rpc as any).mockResolvedValue({
      error: { message: 'Invalid cheque transition: pending → completed' },
    });

    await expect(completeCheque('pay-1')).rejects.toMatchObject({
      message: 'Invalid cheque transition: pending → completed',
    });
  });

  it('propagates "Payment not found" for an unknown payment id', async () => {
    (supabase.rpc as any).mockResolvedValue({
      error: { message: 'Payment pay-404 not found' },
    });

    await expect(depositCheque('pay-404')).rejects.toMatchObject({ message: 'Payment pay-404 not found' });
  });

  it('propagates "not a cheque payment" when acting on a cash/bank_transfer payment', async () => {
    (supabase.rpc as any).mockResolvedValue({
      error: { message: 'Payment pay-1 is not a cheque payment' },
    });

    await expect(depositCheque('pay-1')).rejects.toMatchObject({ message: 'Payment pay-1 is not a cheque payment' });
  });
});
