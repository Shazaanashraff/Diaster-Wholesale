import { describe, it, expect, vi, beforeEach } from 'vitest';
import pg from 'pg';
import {
  getInventory,
  getAverageCostPerPiece,
  insertStockAdjustment,
  getBatchesForProducts,
} from '../inventoryService';

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn() },
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

// ── Unit tests ────────────────────────────────────────────────────────────────

describe('inventoryService › getInventory()', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns empty array when no rows exist', async () => {
    vi.mocked(supabase.from).mockReturnValue(sb([]));
    expect(await getInventory()).toEqual([]);
  });

  it('throws the supabase error message on failure', async () => {
    vi.mocked(supabase.from).mockReturnValue(sb(null, { message: 'connection refused' }));
    await expect(getInventory()).rejects.toThrow('connection refused');
  });
});

describe('inventoryService › getAverageCostPerPiece()', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns {} immediately when productIds is empty — zero DB calls', async () => {
    expect(await getAverageCostPerPiece([])).toEqual({});
    expect(vi.mocked(supabase.from)).not.toHaveBeenCalled();
  });

  it('computes weighted average cost across two batches of the same product', async () => {
    // Batch A: 5 cartons × 10 pcs + 10 loose = 60 pcs @ LKR 100
    // Batch B: 3 cartons × 10 pcs + 10 loose = 40 pcs @ LKR 200
    // Weighted avg = (60×100 + 40×200) / 100 = 14000/100 = 140
    vi.mocked(supabase.from).mockReturnValue(sb([
      { product_id: 'p1', cartons: 5, loose_pieces: 10, cost_per_piece: 100, products: { pieces_per_carton: 10 } },
      { product_id: 'p1', cartons: 3, loose_pieces: 10, cost_per_piece: 200, products: { pieces_per_carton: 10 } },
    ]));
    expect((await getAverageCostPerPiece(['p1']))['p1']).toBe(140);
  });

  it('returns 0 for a product whose batch has 0 cartons and 0 loose_pieces', async () => {
    vi.mocked(supabase.from).mockReturnValue(sb([
      { product_id: 'p2', cartons: 0, loose_pieces: 0, cost_per_piece: 2800, products: { pieces_per_carton: 12 } },
    ]));
    expect((await getAverageCostPerPiece(['p2']))['p2']).toBe(0);
  });

  it('coerces NUMERIC(12,2) cost_per_piece string to a JS number', async () => {
    vi.mocked(supabase.from).mockReturnValue(sb([
      { product_id: 'p3', cartons: 1, loose_pieces: 0, cost_per_piece: '2800.50', products: { pieces_per_carton: 10 } },
    ]));
    const result = await getAverageCostPerPiece(['p3']);
    expect(typeof result['p3']).toBe('number');
    expect(result['p3']).toBeCloseTo(2800.5);
  });

  it('handles products relation returned as an array (Supabase join style)', async () => {
    vi.mocked(supabase.from).mockReturnValue(sb([
      { product_id: 'p4', cartons: 2, loose_pieces: 0, cost_per_piece: 500, products: [{ pieces_per_carton: 5 }] },
    ]));
    // 2 cartons × 5 pcs = 10 pcs @ 500 → avg = 500
    expect((await getAverageCostPerPiece(['p4']))['p4']).toBe(500);
  });
});

describe('inventoryService › insertStockAdjustment()', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('throws the supabase error message on failure', async () => {
    vi.mocked(supabase.from).mockReturnValue(sb(null, { message: 'constraint violation' }));
    await expect(
      insertStockAdjustment({
        product_id: 'p1',
        adjustment_pieces: 10,
        reason: 'damaged',
        adjusted_by: 'admin',
        created_at: '',
      }),
    ).rejects.toThrow('constraint violation');
  });

  it('returns the inserted row on success', async () => {
    const row = { id: 'adj-1', product_id: 'p1', adjustment_pieces: 10, reason: 'damaged', adjusted_by: 'admin', created_at: '' };
    vi.mocked(supabase.from).mockReturnValue(sb(row));
    const result = await insertStockAdjustment({
      product_id: 'p1',
      adjustment_pieces: 10,
      reason: 'damaged',
      adjusted_by: 'admin',
      created_at: '',
    });
    expect(result).toMatchObject({ id: 'adj-1', adjustment_pieces: 10 });
  });
});

describe('inventoryService › getBatchesForProducts()', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('short-circuits to [] when productIds is empty — zero DB calls', async () => {
    expect(await getBatchesForProducts([])).toEqual([]);
    expect(vi.mocked(supabase.from)).not.toHaveBeenCalled();
  });

  it('throws on supabase error', async () => {
    vi.mocked(supabase.from).mockReturnValue(sb(null, { message: 'batch query failed' }));
    await expect(getBatchesForProducts(['p1'])).rejects.toThrow('batch query failed');
  });
});

// ── Sandbox integration ───────────────────────────────────────────────────────

describe('inventoryService › sandbox schema (integration)', () => {
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

  it('sandbox seed contains 4 stock batches at Main Warehouse', async () => {
    await withClient(async (c) => {
      const r = await c.query(
        "SELECT COUNT(*) AS n FROM sandbox.stock_batches WHERE location_id = '00000000-0000-0000-0000-000000000002'"
      );
      expect(Number(r.rows[0].n)).toBe(4);
    });
  }, 30_000);

  it('Bluetooth Headphones batch has 5 cartons; cost_per_piece is NUMERIC = 2800.00', async () => {
    await withClient(async (c) => {
      const r = await c.query(
        "SELECT cartons, cost_per_piece FROM sandbox.stock_batches WHERE id = 'e1000000-0000-0000-0000-000000000001'"
      );
      expect(r.rows).toHaveLength(1);
      expect(Number(r.rows[0].cartons)).toBe(5);
      expect(Number(r.rows[0].cost_per_piece)).toBe(2800);
    });
  }, 30_000);
});
