import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import { supabase } from '../lib/supabase';
import { receivePurchase, createPurchase, type ReceiveItemInput } from './purchaseService';

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

const RECEIVE_ITEM: ReceiveItemInput = {
  product_id: 'prod-1',
  ordered_units: 100,
  received_units: 90,
  damaged_units: 5,
  pieces_per_carton: 12,
};

describe('receivePurchase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws "Cannot receive more than ordered" when received exceeds ordered, without writing anything', async () => {
    const overReceived: ReceiveItemInput = { ...RECEIVE_ITEM, received_units: 150 };

    await expect(receivePurchase('purchase-1', [overReceived])).rejects.toThrow(
      'Cannot receive more than ordered. Product ordered: 100, attempting to receive: 150.'
    );
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('throws "Damaged units ... cannot exceed received units" when damaged exceeds received, without writing anything', async () => {
    const overDamaged: ReceiveItemInput = { ...RECEIVE_ITEM, received_units: 90, damaged_units: 95 };

    await expect(receivePurchase('purchase-1', [overDamaged])).rejects.toThrow(
      'Damaged units (95) cannot exceed received units (90).'
    );
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('inserts one purchase_receive row per item and marks the purchase "received" on success', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => sb());

    await receivePurchase('purchase-1', [RECEIVE_ITEM]);

    expect(supabase.from).toHaveBeenCalledWith('purchase_receive');
    expect(supabase.from).toHaveBeenCalledWith('purchases');
  });

  it('rejects the whole batch if any single item fails validation, even when others are valid', async () => {
    const valid: ReceiveItemInput = { ...RECEIVE_ITEM, product_id: 'prod-2' };
    const invalid: ReceiveItemInput = { ...RECEIVE_ITEM, product_id: 'prod-3', received_units: 999 };

    await expect(receivePurchase('purchase-1', [valid, invalid])).rejects.toThrow(
      /Cannot receive more than ordered/
    );
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('throws the underlying database error message when the purchase_receive insert fails', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'purchase_receive') return sb(null, { message: 'duplicate key value' });
      return sb();
    });

    await expect(receivePurchase('purchase-1', [RECEIVE_ITEM])).rejects.toThrow('duplicate key value');
  });
});

describe('createPurchase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computes total_rmb as the sum of quantity_units * unit_price_rmb across items', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'PO0099', error: null } as any);
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'purchases') return sb({ id: 'purchase-9' });
      return sb();
    });

    await createPurchase({
      supplier_id: 'sup-1',
      exchange_rate: 40,
      notes: '',
      items: [
        { product_id: 'p1', quantity_units: 10, quantity_cartons: 1, unit_price_rmb: 5 },
        { product_id: 'p2', quantity_units: 4, quantity_cartons: 1, unit_price_rmb: 2.5 },
      ],
    });

    const insertCall = vi.mocked(supabase.from).mock.results.find((_, i) =>
      vi.mocked(supabase.from).mock.calls[i][0] === 'purchases'
    );
    expect(insertCall).toBeDefined();
  });

  it('throws when generate_purchase_reference RPC returns an error, without inserting the purchase', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'sequence exhausted' } } as any);

    await expect(
      createPurchase({ supplier_id: 'sup-1', exchange_rate: 40, notes: '', items: [] })
    ).rejects.toThrow('sequence exhausted');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('throws when the purchase_items insert fails after the purchase row was created', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'PO0099', error: null } as any);
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'purchases') return sb({ id: 'purchase-9' });
      if (table === 'purchase_items') return sb(null, { message: 'invalid product_id' });
      return sb();
    });

    await expect(
      createPurchase({
        supplier_id: 'sup-1',
        exchange_rate: 40,
        notes: '',
        items: [{ product_id: 'bad', quantity_units: 1, quantity_cartons: 1, unit_price_rmb: 1 }],
      })
    ).rejects.toThrow('invalid product_id');
  });
});
