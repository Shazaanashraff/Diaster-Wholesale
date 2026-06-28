import { describe, it, expect, vi, beforeEach } from 'vitest';
import pg from 'pg';
import {
  createCustomer,
  recordPayment,
  depositCheque,
  completeCheque,
  returnCheque,
  archiveCustomer,
} from '../customerService';

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));
vi.mock('../captureFetch', () => ({
  captureFetch: vi.fn((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init)),
}));

import { supabase } from '../../lib/supabase';

function sb(data: unknown = null, error: unknown = null) {
  const resolved = Promise.resolve({ data, error });
  const handler: ProxyHandler<typeof resolved> = {
    get(target, prop) {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        return (target as any)[prop].bind(target);
      }
      return (..._args: unknown[]) => new Proxy(resolved, handler);
    },
  };
  return new Proxy(resolved, handler) as any;
}

const DB_URL = process.env.SANDBOX_DB_URL || process.env.SUPABASE_DB_URL;

const CUSTOMER_ROW = {
  id: 'cust-1',
  name: 'Nimal Electronics',
  phone: '0711234567',
  email: 'nimal@example.com',
  address: 'Colombo',
  type: 'wholesale' as const,
  credit_limit: 500000,
  outstanding_balance: 0,
  cheque_float: 0,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// ── Unit tests ────────────────────────────────────────────────────────────────

describe('customerService › createCustomer()', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns the created customer row from supabase', async () => {
    vi.mocked(supabase.from).mockReturnValue(sb(CUSTOMER_ROW));
    const result = await createCustomer({
      name: 'Nimal Electronics',
      phone: '0711234567',
      email: 'nimal@example.com',
      address: 'Colombo',
      type: 'wholesale',
      credit_limit: 500000,
      cheque_float: 0,
    });
    expect(result).toMatchObject({ id: 'cust-1', name: 'Nimal Electronics' });
  });

  it('throws on supabase error', async () => {
    vi.mocked(supabase.from).mockReturnValue(sb(null, { message: 'duplicate key' }));
    await expect(
      createCustomer({ name: 'X', phone: '', email: '', address: '', type: 'retail', credit_limit: 0, cheque_float: 0 }),
    ).rejects.toMatchObject({ message: 'duplicate key' });
  });
});

describe('customerService › recordPayment()', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls record_payment_atomic RPC with correct arguments', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);
    await recordPayment('cust-1', 'inv-1', 1000, 'cheque', 'BOC', 'CHQ-001', '2026-07-30');
    expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('record_payment_atomic', {
      p_customer_id: 'cust-1',
      p_invoice_id: 'inv-1',
      p_amount: 1000,
      p_method: 'cheque',
      p_bank_name: 'BOC',
      p_cheque_number: 'CHQ-001',
      p_due_date: '2026-07-30',
    });
  });

  it('defaults optional cheque fields to empty string when omitted', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);
    await recordPayment('cust-1', null, 500, 'cash');
    const args = vi.mocked(supabase.rpc).mock.calls[0][1] as any;
    expect(args.p_bank_name).toBe('');
    expect(args.p_cheque_number).toBe('');
    expect(args.p_due_date).toBe('');
  });

  it('throws the RPC error when recording fails', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'rpc error' } } as any);
    await expect(recordPayment('cust-1', null, 500)).rejects.toMatchObject({ message: 'rpc error' });
  });
});

describe('customerService › cheque lifecycle', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("depositCheque() calls update_cheque_status with status 'processing'", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);
    await depositCheque('pay-1');
    expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'processing',
    });
  });

  it("completeCheque() calls update_cheque_status with status 'completed'", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);
    await completeCheque('pay-1');
    expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'completed',
    });
  });

  it("returnCheque() calls update_cheque_status with status 'returned'", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);
    await returnCheque('pay-1');
    expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('update_cheque_status', {
      p_payment_id: 'pay-1',
      p_new_status: 'returned',
    });
  });

  it('all three cheque transitions throw when the RPC returns an error', async () => {
    const err = { message: 'invalid transition' };
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: err } as any);
    await expect(depositCheque('pay-x')).rejects.toMatchObject(err);
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: err } as any);
    await expect(completeCheque('pay-x')).rejects.toMatchObject(err);
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: err } as any);
    await expect(returnCheque('pay-x')).rejects.toMatchObject(err);
  });
});

describe('customerService › archiveCustomer()', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('resolves without error on success', async () => {
    vi.mocked(supabase.from).mockReturnValue(sb(null));
    await expect(archiveCustomer('cust-1')).resolves.toBeUndefined();
  });

  it('throws on supabase error', async () => {
    vi.mocked(supabase.from).mockReturnValue(sb(null, { message: 'not found' }));
    await expect(archiveCustomer('cust-999')).rejects.toBeTruthy();
  });
});

// ── Sandbox integration ───────────────────────────────────────────────────────

describe('customerService › sandbox schema (integration)', () => {
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

  it('walk-in customer has credit_limit = 0 (no credit)', async () => {
    await withClient(async (c) => {
      const r = await c.query(
        "SELECT credit_limit FROM sandbox.customers WHERE id = 'c0000000-0000-0000-0000-000000000001'"
      );
      expect(r.rows).toHaveLength(1);
      expect(Number(r.rows[0].credit_limit)).toBe(0);
    });
  }, 30_000);

  it('Nimal Electronics wholesale customer has credit_limit = 500000 (NUMERIC)', async () => {
    await withClient(async (c) => {
      const r = await c.query(
        "SELECT credit_limit, outstanding_balance FROM sandbox.customers WHERE id = 'c1000000-0000-0000-0000-000000000001'"
      );
      expect(r.rows).toHaveLength(1);
      expect(Number(r.rows[0].credit_limit)).toBe(500000);
      expect(Number(r.rows[0].outstanding_balance)).toBe(0);
    });
  }, 30_000);
});
