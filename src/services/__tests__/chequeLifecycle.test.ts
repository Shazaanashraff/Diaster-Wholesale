// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { depositCheque, completeCheque, returnCheque } from '../customerService';

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import { supabase } from '../../lib/supabase';

describe('cheque lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);
  });

  // ── depositCheque: received → processing ──────────────────────────────────

  describe('depositCheque', () => {
    it('calls update_cheque_status RPC with "processing"', async () => {
      await depositCheque('pay-1');
      expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('update_cheque_status', {
        p_payment_id: 'pay-1',
        p_new_status: 'processing',
      });
    });

    it('throws when RPC rejects the transition', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'invalid status transition' },
      } as any);
      await expect(depositCheque('pay-1')).rejects.toThrow();
    });
  });

  // ── completeCheque: processing → completed ────────────────────────────────

  describe('completeCheque', () => {
    it('calls update_cheque_status RPC with "completed"', async () => {
      await completeCheque('pay-1');
      expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('update_cheque_status', {
        p_payment_id: 'pay-1',
        p_new_status: 'completed',
      });
    });

    it('throws when RPC rejects the transition', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'cheque already completed' },
      } as any);
      await expect(completeCheque('pay-1')).rejects.toThrow();
    });
  });

  // ── returnCheque: any → returned (bounce) ────────────────────────────────

  describe('returnCheque', () => {
    it('calls update_cheque_status RPC with "returned"', async () => {
      await returnCheque('pay-1');
      expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('update_cheque_status', {
        p_payment_id: 'pay-1',
        p_new_status: 'returned',
      });
    });

    it('throws when RPC rejects the transition', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'cheque already returned' },
      } as any);
      await expect(returnCheque('pay-1')).rejects.toThrow();
    });
  });

  // ── Status progression contract ───────────────────────────────────────────

  it('three functions send three distinct target statuses', async () => {
    await depositCheque('pay-1');
    await completeCheque('pay-2');
    await returnCheque('pay-3');

    const calls = vi.mocked(supabase.rpc).mock.calls;
    const statuses = calls.map(([, args]) => (args as any).p_new_status);
    expect(new Set(statuses).size).toBe(3);
    expect(statuses).toContain('processing');
    expect(statuses).toContain('completed');
    expect(statuses).toContain('returned');
  });
});
