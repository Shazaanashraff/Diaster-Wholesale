import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkout, checkCreditLimit, computeLoyaltyEarned, computeRedemptionValue } from './posService';
import type { CartItem, PaymentSplit } from './posService';

// ─── Mock modules ─────────────────────────────────────────────────────────────

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

// offlineService uses Dexie/IndexedDB — not available in jsdom
vi.mock('./offlineService', () => ({
  saveOfflineSale: vi.fn(),
  syncPendingSales: vi.fn(),
  getPendingCount: vi.fn().mockResolvedValue(0),
}));

// captureFetch → auditDb uses Dexie as well
vi.mock('./captureFetch', () => ({
  captureFetch: vi.fn((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init)),
}));

import { supabase } from '../lib/supabase';

// ─── Mock builder factory ─────────────────────────────────────────────────────
//
// Creates a Proxy over a resolved Promise so that:
//   - any method call (.select, .eq, .in, .single, .insert, .update, …) returns
//     the same proxy (enabling arbitrary chaining)
//   - awaiting the proxy (or the result of any chained call) resolves to `result`

function sb(data: unknown = null, error: unknown = null) {
  const resolved = Promise.resolve({ data, error });
  const handler: ProxyHandler<typeof resolved> = {
    get(target, prop: string | symbol) {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        return (target as any)[prop].bind(target);
      }
      return (..._args: unknown[]) => new Proxy(resolved, handler);
    },
  };
  return new Proxy(resolved, handler) as any;
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

const PRODUCT = {
  id: 'prod-1',
  name: 'Test Biscuit',
  pieces_per_carton: 12,
  wholesale_price: 100,
  retail_price: 120,
  category: 'Biscuits',
  model: '',
  item_code: 'B001',
  is_active: true,
  reorder_level: 0,
  cost_price: 80,
};

const CART_ITEM: CartItem = {
  product: PRODUCT as any,
  quantityCartons: 1,
  quantityPieces: 0,
};

const CART_ITEM_WITH_BATCH: CartItem = {
  product: PRODUCT as any,
  quantityCartons: 1,
  quantityPieces: 0,
  batchId: 'batch-abc',
};

const STOCK_ROW = {
  product_id: 'prod-1',
  pieces_per_carton: 12,
  cartons_in: 10,
  pieces_in: 0,
  cartons_sold: 0,
  pieces_sold: 0,
  carton_adj: 0,
  piece_adj: 0,
};

const CUSTOMER = {
  id: 'cust-1',
  credit_limit: 50000,
  outstanding_balance: 0,
  loyalty_points: 100,
  total_loyalty_earned: 500,
  total_loyalty_redeemed: 400,
};

const CASH_SPLIT: PaymentSplit = { method: 'cash', amount: 1200 };

const INVOICE_ID = 'inv-uuid-001';
const INVOICE_NO_REGEX = /^INV-\d{6}$/;

// ─── Default mock wiring ──────────────────────────────────────────────────────

function wireHappyPath({ outstandingAmount = 0, customerId = 'cust-1' } = {}) {
  vi.mocked(supabase.rpc).mockImplementation(async (name: string) => {
    if (name === 'checkout_sale') return { data: INVOICE_ID, error: null };
    if (name === 'deduct_stock_fifo') return { data: null, error: null };
    if (name === 'deduct_stock_from_batch') return { data: null, error: null };
    return { data: null, error: null };
  });

  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'shop_stock') return sb([STOCK_ROW]);
    if (table === 'customers') {
      return sb({
        ...CUSTOMER,
        outstanding_balance: outstandingAmount > 0 ? CUSTOMER.outstanding_balance : 0,
      });
    }
    // loyalty_transactions.insert — fire-and-forget, no error check in service
    return sb();
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('posService › checkout()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Pure utility functions ─────────────────────────────────────────────────

  describe('computeLoyaltyEarned', () => {
    it('floors netTotal / 100', () => {
      expect(computeLoyaltyEarned(1099)).toBe(10);
      expect(computeLoyaltyEarned(1100)).toBe(11);
      expect(computeLoyaltyEarned(0)).toBe(0);
    });
  });

  describe('computeRedemptionValue', () => {
    it('1 point = LKR 1', () => {
      expect(computeRedemptionValue(250)).toBe(250);
      expect(computeRedemptionValue(0)).toBe(0);
    });
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('returns invoiceId, invoiceNo, and earnedPoints on success', async () => {
    wireHappyPath();

    const result = await checkout(
      [CART_ITEM],
      'cust-1',
      true,
      1200,
      0,
      1200,
      [CASH_SPLIT],
    );

    expect(result.invoiceId).toBe(INVOICE_ID);
    expect(result.invoiceNo).toMatch(INVOICE_NO_REGEX);
    expect(result.earnedPoints).toBe(12); // floor(1200 / 100)
  });

  it('passes wholesale mode to checkout_sale RPC', async () => {
    wireHappyPath();

    await checkout([CART_ITEM], 'cust-1', true, 1200, 0, 1200, [CASH_SPLIT]);

    const rpcCall = vi.mocked(supabase.rpc).mock.calls.find(([name]) => name === 'checkout_sale');
    expect(rpcCall?.[1]).toMatchObject({ p_mode: 'wholesale' });
  });

  it('passes retail mode when isWholesale=false', async () => {
    wireHappyPath();

    await checkout([CART_ITEM], 'cust-1', false, 1440, 0, 1440, [{ method: 'cash', amount: 1440 }]);

    const rpcCall = vi.mocked(supabase.rpc).mock.calls.find(([name]) => name === 'checkout_sale');
    expect(rpcCall?.[1]).toMatchObject({ p_mode: 'retail' });
  });

  it('invoice number matches INV-XXXXXX format', async () => {
    wireHappyPath();

    const { invoiceNo } = await checkout([CART_ITEM], null, true, 1200, 0, 1200, [CASH_SPLIT]);

    expect(invoiceNo).toMatch(INVOICE_NO_REGEX);
  });

  // ── Payment status derivation ──────────────────────────────────────────────

  it('sets payment_status "paid" when splits cover the total', async () => {
    wireHappyPath();

    await checkout([CART_ITEM], 'cust-1', true, 1200, 0, 1200, [{ method: 'cash', amount: 1200 }]);

    const rpcCall = vi.mocked(supabase.rpc).mock.calls.find(([name]) => name === 'checkout_sale');
    expect(rpcCall?.[1]).toMatchObject({ p_payment_status: 'paid' });
  });

  it('sets payment_status "partial" when splits partially cover total', async () => {
    wireHappyPath({ outstandingAmount: 600 });

    await checkout([CART_ITEM], 'cust-1', true, 1200, 0, 1200, [{ method: 'cash', amount: 600 }]);

    const rpcCall = vi.mocked(supabase.rpc).mock.calls.find(([name]) => name === 'checkout_sale');
    expect(rpcCall?.[1]).toMatchObject({ p_payment_status: 'partial' });
  });

  it('sets payment_status "unpaid" when no payment splits', async () => {
    wireHappyPath({ outstandingAmount: 1200 });

    await checkout([CART_ITEM], 'cust-1', true, 1200, 0, 1200, []);

    const rpcCall = vi.mocked(supabase.rpc).mock.calls.find(([name]) => name === 'checkout_sale');
    expect(rpcCall?.[1]).toMatchObject({ p_payment_status: 'unpaid' });
  });

  // ── Walk-in customer (null customerId) ────────────────────────────────────

  it('walk-in customer: skips credit check and returns earnedPoints=0', async () => {
    wireHappyPath();

    const result = await checkout([CART_ITEM], null, true, 1200, 0, 1200, [CASH_SPLIT]);

    expect(result.earnedPoints).toBe(0);
    // credit check reads from 'customers' — should NOT be called with null customerId
    const customerCalls = vi.mocked(supabase.from).mock.calls.filter(([t]) => t === 'customers');
    // Only loyalty step references customers; credit check requires customerId
    // The outstanding amount is 0 so no balance update either — 0 customer calls total
    expect(customerCalls.length).toBe(0);
  });

  // ── Loyalty ────────────────────────────────────────────────────────────────

  it('deducts redemption value from netTotal before computing earnedPoints', async () => {
    wireHappyPath();

    // total=1200, redeem 200 pts (LKR 200), netTotal=1000, earnedPoints=10
    const result = await checkout(
      [CART_ITEM], 'cust-1', true, 1200, 0, 1200, [CASH_SPLIT],
      { redeemPoints: 200 },
    );

    expect(result.earnedPoints).toBe(10); // floor(1000/100)

    // p_total passed to RPC should be the net total (after redemption)
    const rpcCall = vi.mocked(supabase.rpc).mock.calls.find(([name]) => name === 'checkout_sale');
    expect(rpcCall?.[1]).toMatchObject({ p_total: 1000 });
  });

  it('clamps netTotal to 0 if redemption value exceeds total', async () => {
    wireHappyPath();

    const result = await checkout(
      [CART_ITEM], 'cust-1', true, 1200, 0, 1200, [CASH_SPLIT],
      { redeemPoints: 9999 },
    );

    const rpcCall = vi.mocked(supabase.rpc).mock.calls.find(([name]) => name === 'checkout_sale');
    expect(rpcCall?.[1]).toMatchObject({ p_total: 0 });
    expect(result.earnedPoints).toBe(0);
  });

  // ── Stock validation ───────────────────────────────────────────────────────

  it('throws "Insufficient stock" before calling the RPC when stock is low', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'shop_stock') {
        // Only 5 pieces available, cart wants 12
        return sb([{ ...STOCK_ROW, cartons_in: 0, pieces_in: 5 }]);
      }
      return sb();
    });

    await expect(
      checkout([CART_ITEM], null, true, 1200, 0, 1200, [CASH_SPLIT]),
    ).rejects.toThrow(/Insufficient stock for Test Biscuit/);

    // RPC must NOT be called
    expect(vi.mocked(supabase.rpc)).not.toHaveBeenCalled();
  });

  it('throws when shop_stock query itself fails', async () => {
    vi.mocked(supabase.from).mockImplementation(() =>
      sb(null, { message: 'db error' }),
    );

    await expect(
      checkout([CART_ITEM], null, true, 1200, 0, 1200, [CASH_SPLIT]),
    ).rejects.toThrow(/Failed to validate stock/);
  });

  it('treats missing stock row as 0 available', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'shop_stock') return sb([]); // no rows → product not in shop stock
      return sb();
    });

    // Cart wants 12 pieces, 0 available → should throw
    await expect(
      checkout([CART_ITEM], null, true, 1200, 0, 1200, [CASH_SPLIT]),
    ).rejects.toThrow(/Insufficient stock/);
  });

  it('skips a cart item with 0 total pieces in stock deduction loop', async () => {
    wireHappyPath();

    const zeroQtyItem: CartItem = { product: PRODUCT as any, quantityCartons: 0, quantityPieces: 0 };
    await checkout([zeroQtyItem, CART_ITEM], null, true, 1200, 0, 1200, [CASH_SPLIT]);

    // deduct_stock_fifo called once (for the non-zero item only)
    const fifoCalls = vi.mocked(supabase.rpc).mock.calls.filter(([name]) => name === 'deduct_stock_fifo');
    expect(fifoCalls).toHaveLength(1);
  });

  // ── Credit limit ───────────────────────────────────────────────────────────

  it('throws "Credit limit exceeded" when outstanding would breach limit', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'shop_stock') return sb([STOCK_ROW]);
      if (table === 'customers') {
        return sb({ credit_limit: 500, outstanding_balance: 400 }); // only LKR 100 available
      }
      return sb();
    });
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);

    // Trying to put LKR 1200 on credit (no payment splits)
    await expect(
      checkout([CART_ITEM], 'cust-1', true, 1200, 0, 1200, []),
    ).rejects.toThrow(/Credit limit exceeded/);
  });

  it('skips credit check for walk-in customer even with outstanding', async () => {
    wireHappyPath();

    // customerId is null → credit check should be bypassed
    await expect(
      checkout([CART_ITEM], null, true, 1200, 0, 1200, []),
    ).resolves.toMatchObject({ invoiceId: INVOICE_ID });
  });

  // ── RPC failure ────────────────────────────────────────────────────────────

  it('throws "Checkout failed" when checkout_sale RPC returns an error', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'shop_stock') return sb([STOCK_ROW]);
      return sb();
    });
    vi.mocked(supabase.rpc).mockImplementation(async (name: string) => {
      if (name === 'checkout_sale') return { data: null, error: { message: 'unique constraint' } };
      return { data: null, error: null };
    });

    await expect(
      checkout([CART_ITEM], null, true, 1200, 0, 1200, [CASH_SPLIT]),
    ).rejects.toThrow(/Checkout failed: unique constraint/);
  });

  // ── Stock deduction routing ────────────────────────────────────────────────

  it('calls deduct_stock_from_batch when item has a batchId', async () => {
    wireHappyPath();

    await checkout([CART_ITEM_WITH_BATCH], null, true, 1200, 0, 1200, [CASH_SPLIT]);

    const batchCall = vi.mocked(supabase.rpc).mock.calls.find(([name]) => name === 'deduct_stock_from_batch');
    expect(batchCall).toBeTruthy();
    expect(batchCall?.[1]).toMatchObject({ p_batch_id: 'batch-abc', p_units: 12 });

    const fifoCall = vi.mocked(supabase.rpc).mock.calls.find(([name]) => name === 'deduct_stock_fifo');
    expect(fifoCall).toBeUndefined();
  });

  it('calls deduct_stock_fifo when item has no batchId', async () => {
    wireHappyPath();

    await checkout([CART_ITEM], null, true, 1200, 0, 1200, [CASH_SPLIT]);

    const fifoCall = vi.mocked(supabase.rpc).mock.calls.find(([name]) => name === 'deduct_stock_fifo');
    expect(fifoCall).toBeTruthy();
    expect(fifoCall?.[1]).toMatchObject({ p_product_id: 'prod-1', p_units: 12 });
  });

  it('throws when deduct_stock_fifo returns an error (no longer silently swallowed)', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'shop_stock') return sb([STOCK_ROW]);
      return sb();
    });
    vi.mocked(supabase.rpc).mockImplementation(async (name: string) => {
      if (name === 'checkout_sale') return { data: INVOICE_ID, error: null };
      if (name === 'deduct_stock_fifo') return { data: null, error: { message: 'batch not found' } };
      return { data: null, error: null };
    });

    await expect(
      checkout([CART_ITEM], null, true, 1200, 0, 1200, [CASH_SPLIT]),
    ).rejects.toThrow(/Stock deduction failed for Test Biscuit/);
  });

  it('throws when deduct_stock_from_batch returns an error', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'shop_stock') return sb([STOCK_ROW]);
      return sb();
    });
    vi.mocked(supabase.rpc).mockImplementation(async (name: string) => {
      if (name === 'checkout_sale') return { data: INVOICE_ID, error: null };
      if (name === 'deduct_stock_from_batch') return { data: null, error: { message: 'batch locked' } };
      return { data: null, error: null };
    });

    await expect(
      checkout([CART_ITEM_WITH_BATCH], null, true, 1200, 0, 1200, [CASH_SPLIT]),
    ).rejects.toThrow(/Stock deduction failed for Test Biscuit: batch locked/);
  });

  // ── Multi-item cart ────────────────────────────────────────────────────────

  it('calls deduct_stock_fifo once per unique item in cart', async () => {
    wireHappyPath();

    const secondProduct = { ...PRODUCT, id: 'prod-2', name: 'Other Snack' };
    const cart: CartItem[] = [
      { product: PRODUCT as any, quantityCartons: 1, quantityPieces: 0 },
      { product: secondProduct as any, quantityCartons: 2, quantityPieces: 0 },
    ];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'shop_stock') {
        return sb([
          STOCK_ROW,
          { ...STOCK_ROW, product_id: 'prod-2', cartons_in: 20 },
        ]);
      }
      return sb();
    });

    await checkout(cart, null, true, 3600, 0, 3600, [{ method: 'cash', amount: 3600 }]);

    const fifoCalls = vi.mocked(supabase.rpc).mock.calls.filter(([name]) => name === 'deduct_stock_fifo');
    expect(fifoCalls).toHaveLength(2);
    expect(fifoCalls[0][1]).toMatchObject({ p_product_id: 'prod-1', p_units: 12 });
    expect(fifoCalls[1][1]).toMatchObject({ p_product_id: 'prod-2', p_units: 24 });
  });

  // ── Payment splits passed to RPC ───────────────────────────────────────────

  it('filters out zero-amount splits before passing to RPC', async () => {
    wireHappyPath();

    await checkout(
      [CART_ITEM], null, true, 1200, 0, 1200,
      [{ method: 'cash', amount: 1200 }, { method: 'card', amount: 0 }],
    );

    const rpcCall = vi.mocked(supabase.rpc).mock.calls.find(([name]) => name === 'checkout_sale');
    const payments: any[] = rpcCall?.[1]?.p_payments ?? [];
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ method: 'cash', amount: 1200 });
  });

  it('passes all payment splits correctly including cheque fields', async () => {
    wireHappyPath();

    const splits: PaymentSplit[] = [
      { method: 'cheque', amount: 500, cheque_number: 'CHQ-001', bank_name: 'Commercial Bank' },
      { method: 'cash', amount: 700 },
    ];

    await checkout([CART_ITEM], null, true, 1200, 0, 1200, splits);

    const rpcCall = vi.mocked(supabase.rpc).mock.calls.find(([name]) => name === 'checkout_sale');
    const payments: any[] = rpcCall?.[1]?.p_payments ?? [];
    expect(payments).toHaveLength(2);
    expect(payments[0]).toMatchObject({ method: 'cheque', cheque_number: 'CHQ-001', bank_name: 'Commercial Bank' });
  });

  // ── checkCreditLimit standalone ────────────────────────────────────────────

  describe('checkCreditLimit', () => {
    it('returns ok=true when credit is available', async () => {
      vi.mocked(supabase.from).mockImplementation(() =>
        sb({ credit_limit: 10000, outstanding_balance: 2000 }),
      );

      const result = await checkCreditLimit('cust-1', 5000, 3000);

      expect(result.ok).toBe(true);
      expect(result.available).toBe(8000);
    });

    it('returns ok=false with message when limit would be exceeded', async () => {
      vi.mocked(supabase.from).mockImplementation(() =>
        sb({ credit_limit: 5000, outstanding_balance: 4500 }),
      );

      const result = await checkCreditLimit('cust-1', 2000, 2000);

      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/Credit limit exceeded/);
      expect(result.available).toBe(500);
    });

    it('returns ok=true when customer fetch fails (fail open)', async () => {
      vi.mocked(supabase.from).mockImplementation(() =>
        sb(null, { message: 'row not found' }),
      );

      const result = await checkCreditLimit('cust-x', 1000, 1000);

      expect(result.ok).toBe(true);
    });
  });
});
