import { describe, it, expect, vi, beforeEach } from 'vitest';
import pg from 'pg';
import {
  recordPayment,
  depositCheque,
  completeCheque,
  returnCheque,
} from '../customerService';

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));
vi.mock('../captureFetch', () => ({
  captureFetch: vi.fn((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init)),
}));

import { supabase } from '../../lib/supabase';

const DB_URL = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;

// ── Unit tests ────────────────────────────────────────────────────────────────

describe('payments & cheques › recordPayment()', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('cash payment: p_bank_name, p_cheque_number, p_due_date all default to empty string', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);
    await recordPayment('cust-1', 'inv-1', 2500, 'cash');
    const args = vi.mocked(supabase.rpc).mock.calls[0][1] as Record<string, unknown>;
    expect(args.p_method).toBe('cash');
    expect(args.p_bank_name).toBe('');
    expect(args.p_cheque_number).toBe('');
    expect(args.p_due_date).toBe('');
  });

  it('cheque payment: passes bank_name, cheque_number, due_date to RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);
    await recordPayment('cust-1', 'inv-1', 50000, 'cheque', 'Sampath Bank', 'CHQ-0042', '2026-08-15');
    expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('record_payment_atomic', {
      p_customer_id: 'cust-1',
      p_invoice_id: 'inv-1',
      p_amount: 50000,
      p_method: 'cheque',
      p_bank_name: 'Sampath Bank',
      p_cheque_number: 'CHQ-0042',
      p_due_date: '2026-08-15',
    });
  });

  it('invoice_id may be null for unallocated payments', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);
    await recordPayment('cust-1', null, 1000, 'bank_transfer');
    const args = vi.mocked(supabase.rpc).mock.calls[0][1] as Record<string, unknown>;
    expect(args.p_invoice_id).toBeNull();
  });

  it('throws when RPC returns an error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'record failed' } } as any);
    await expect(recordPayment('cust-1', 'inv-1', 100)).rejects.toMatchObject({ message: 'record failed' });
  });
});

describe('payments & cheques › cheque status transitions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("depositCheque() moves cheque to 'processing' state", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);
    await depositCheque('pay-42');
    expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-42',
      p_new_status: 'processing',
    });
  });

  it("completeCheque() moves cheque to 'completed' state", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);
    await completeCheque('pay-42');
    expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-42',
      p_new_status: 'completed',
    });
  });

  it("returnCheque() moves cheque to 'returned' state (bounced / dishonoured)", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);
    await returnCheque('pay-42');
    expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-42',
      p_new_status: 'returned',
    });
  });

  it('throws when an invalid cheque transition is rejected by the RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'invalid status transition' },
    } as any);
    await expect(completeCheque('pay-99')).rejects.toMatchObject({ message: 'invalid status transition' });
  });
});

// ── Sandbox integration ───────────────────────────────────────────────────────

describe('payments & cheques › sandbox schema (integration)', () => {
  if (!DB_URL) {
    it.skip('SANDBOX_DB_URL not set — skipping sandbox integration tests', () => {});
    return;
  }

  async function withClient<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
    const c = new pg.Client({ connectionString: DB_URL });
    await c.connect();
    try {
      return await fn(c);
    } finally {
      await c.end();
    }
  }

  it('seeded invoice INV-S001 has exactly one payment with method = cash', async () => {
    await withClient(async (c) => {
      const r = await c.query(`
        SELECT p.method, p.amount
        FROM sandbox.payments p
        JOIN sandbox.invoices i ON i.id = p.invoice_id
        WHERE i.invoice_no = 'INV-S001'
      `);
      expect(r.rows).toHaveLength(1);
      expect(r.rows[0].method).toBe('cash');
      expect(Number(r.rows[0].amount)).toBeGreaterThan(0);
    });
  }, 30_000);
});
