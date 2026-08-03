import { describe, it, expect } from 'vitest';
import type { Customer } from '../types';
import { isOverCreditLimit, getRemainingCredit } from './creditCheck';

// Registered in the Sandbox catalog (todo-013) under `customers-credit` as type:"unit".

const customer = (overrides: Partial<Customer> = {}): Customer => ({
  id: 'cust-1',
  name: 'Test Customer',
  phone: '',
  email: '',
  address: '',
  type: 'wholesale',
  credit_limit: 500000,
  outstanding_balance: 125000,
  cheque_float: 0,
  created_at: '',
  updated_at: '',
  ...overrides,
});

describe('isOverCreditLimit', () => {
  it('allows a sale that keeps outstanding + total within the limit', () => {
    expect(isOverCreditLimit(customer(), 100000)).toBe(false);
  });

  it('blocks a sale that would push outstanding + total over the limit', () => {
    expect(isOverCreditLimit(customer(), 400000)).toBe(true);
  });

  it('allows a sale that lands exactly on the limit (boundary is inclusive of the limit itself)', () => {
    expect(isOverCreditLimit(customer({ credit_limit: 200000, outstanding_balance: 125000 }), 75000)).toBe(false);
  });

  it('blocks a sale that is one unit over the limit', () => {
    expect(isOverCreditLimit(customer({ credit_limit: 200000, outstanding_balance: 125000 }), 75000.01)).toBe(true);
  });

  it('treats credit_limit of 0 as unlimited — never blocks', () => {
    expect(isOverCreditLimit(customer({ credit_limit: 0, outstanding_balance: 999999 }), 999999)).toBe(false);
  });

  it('treats a negative credit_limit as unlimited — never blocks', () => {
    expect(isOverCreditLimit(customer({ credit_limit: -1 }), 999999)).toBe(false);
  });

  it('treats missing/undefined credit_limit and outstanding_balance as 0 (falls back to unlimited)', () => {
    const c = customer({ credit_limit: undefined as unknown as number, outstanding_balance: undefined as unknown as number });
    expect(isOverCreditLimit(c, 1000)).toBe(false);
  });
});

describe('getRemainingCredit', () => {
  it('returns the exact headroom left under the limit', () => {
    expect(getRemainingCredit(customer())).toBe(375000);
  });

  it('returns Infinity when credit_limit is 0 (unlimited)', () => {
    expect(getRemainingCredit(customer({ credit_limit: 0 }))).toBe(Infinity);
  });

  it('never goes negative — floors at 0 when outstanding already exceeds the limit', () => {
    expect(getRemainingCredit(customer({ credit_limit: 100000, outstanding_balance: 150000 }))).toBe(0);
  });
});
