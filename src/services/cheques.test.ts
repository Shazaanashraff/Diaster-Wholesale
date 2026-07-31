import { describe, it, expect, vi, beforeEach } from 'vitest';

// Payments & Cheques unit tests (todo-013). The cheque lifecycle transitions
// live entirely server-side in the `update_cheque_status` RPC (see
// supabase/migrations/20260726120000_cheque_reversals_and_credit_balance.sql)
// — these client functions in customerService.ts are thin wrappers with no
// transition logic of their own, so what's testable client-side is: each
// wrapper requests the right `p_new_status`, and an RPC-rejected transition
// propagates as a thrown error with the DB's exact message.
//
// A true lifecycle integration test against the `sandbox` schema is not
// currently possible: `update_cheque_status`, and the `cheque_status` /
// `payment_type` columns on `payments` / `cheque_float` on `customers` it
// depends on, exist only in `public` (see the later migrations
// 20260703010000 and 20260726120000) — they were never ported into
// `supabase/migrations/20260626000000_sandbox_schema_and_meta.sql`, the only
// migration that actually built the `sandbox` schema. See todo-013's
// Completion Notes for the follow-up this requires.

vi.mock('../lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
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

describe('cheque lifecycle transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const cases: Array<[label: string, fn: (id: string) => Promise<void>, expected: string]> = [
    ['depositCheque: pending → processing', depositCheque, 'processing'],
    ['completeCheque: processing → completed', completeCheque, 'completed'],
    ['returnCheque: processing → returned', returnCheque, 'returned'],
    ['reverseChequeToReturned: completed → returned', reverseChequeToReturned, 'returned'],
    ['undoChequeDeposit: processing → pending', undoChequeDeposit, 'pending'],
    ['representCheque: returned → processing', representCheque, 'processing'],
  ];

  it.each(cases)('%s requests exactly that new status via update_cheque_status', async (_label, fn, expected) => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

    await fn('payment-1');

    expect(supabase.rpc).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'payment-1',
      p_new_status: expected,
    });
  });

  it('propagates the DB\'s exact "invalid transition" error instead of swallowing it', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: null,
      error: { message: 'Invalid cheque transition: pending → completed' },
    });

    await expect(completeCheque('payment-1')).rejects.toMatchObject({
      message: 'Invalid cheque transition: pending → completed',
    });
  });

  it('propagates the DB\'s "not a cheque payment" error for a non-cheque payment id', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: null,
      error: { message: 'Payment payment-2 is not a cheque payment' },
    });

    await expect(depositCheque('payment-2')).rejects.toMatchObject({
      message: 'Payment payment-2 is not a cheque payment',
    });
  });

  it('propagates the DB\'s "not found" error for an unknown payment id', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: null,
      error: { message: 'Payment missing-id not found' },
    });

    await expect(returnCheque('missing-id')).rejects.toMatchObject({
      message: 'Payment missing-id not found',
    });
  });
});
