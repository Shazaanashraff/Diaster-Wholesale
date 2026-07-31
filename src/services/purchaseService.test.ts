import { describe, it, expect, vi, beforeEach } from 'vitest';
import { receivePurchase } from './purchaseService';
import type { ReceiveItemInput } from './purchaseService';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from '../lib/supabase';

// Proxy-over-Promise mock builder — mirrors the one in posService.test.ts so
// `.from('x').insert(...)`, `.from('x').update(...).eq(...)` etc. all resolve
// to `{ data, error }` regardless of chain shape.
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

const baseItem: ReceiveItemInput = {
  product_id: 'prod-1',
  ordered_units: 20,
  received_units: 18,
  damaged_units: 2,
  pieces_per_carton: 10,
};

describe('receivePurchase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws before touching the DB when received_units exceeds ordered_units', async () => {
    (supabase.from as any).mockReturnValue(sb());

    await expect(
      receivePurchase('purch-1', [{ ...baseItem, ordered_units: 10, received_units: 12 }])
    ).rejects.toThrow('Cannot receive more than ordered. Product ordered: 10, attempting to receive: 12.');

    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('throws before touching the DB when damaged_units exceeds received_units', async () => {
    (supabase.from as any).mockReturnValue(sb());

    await expect(
      receivePurchase('purch-1', [{ ...baseItem, received_units: 5, damaged_units: 6 }])
    ).rejects.toThrow('Damaged units (6) cannot exceed received units (5).');

    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('inserts one purchase_receive row per item and marks the purchase received', async () => {
    (supabase.from as any).mockReturnValue(sb());

    await receivePurchase('purch-1', [baseItem]);

    expect(supabase.from).toHaveBeenCalledWith('purchase_receive');
    expect(supabase.from).toHaveBeenCalledWith('purchases');
  });

  it('rejects when the purchase_receive insert itself fails', async () => {
    (supabase.from as any).mockImplementation((table: string) =>
      table === 'purchase_receive' ? sb(null, { message: 'insert failed' }) : sb()
    );

    await expect(receivePurchase('purch-1', [baseItem])).rejects.toThrow('insert failed');
  });
});
