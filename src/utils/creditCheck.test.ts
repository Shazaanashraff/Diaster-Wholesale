import { describe, it, expect } from 'vitest';
import { isOverCreditLimit, getRemainingCredit } from './creditCheck';
import type { Customer } from '../types';

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-1',
    name: 'Test Customer',
    phone: '',
    email: '',
    address: '',
    type: 'wholesale',
    credit_limit: 50000,
    outstanding_balance: 0,
    cheque_float: 0,
    created_at: '',
    updated_at: '',
    ...overrides,
  } as Customer;
}

describe('isOverCreditLimit', () => {
  it('is false when the sale keeps outstanding + sale within the limit', () => {
    expect(isOverCreditLimit(customer({ credit_limit: 50000, outstanding_balance: 20000 }), 10000)).toBe(false);
  });

  it('is true when the sale would push outstanding + sale over the limit', () => {
    expect(isOverCreditLimit(customer({ credit_limit: 50000, outstanding_balance: 45000 }), 10000)).toBe(true);
  });

  it('is false when the sale lands exactly on the limit (boundary, not over)', () => {
    expect(isOverCreditLimit(customer({ credit_limit: 50000, outstanding_balance: 40000 }), 10000)).toBe(false);
  });

  it('treats a credit_limit of 0 as "no limit" regardless of balance', () => {
    expect(isOverCreditLimit(customer({ credit_limit: 0, outstanding_balance: 1_000_000 }), 500000)).toBe(false);
  });

  it('treats a missing outstanding_balance as 0', () => {
    expect(isOverCreditLimit(customer({ credit_limit: 5000, outstanding_balance: undefined as any }), 4000)).toBe(false);
  });
});

describe('getRemainingCredit', () => {
  it('returns credit_limit minus outstanding_balance', () => {
    expect(getRemainingCredit(customer({ credit_limit: 50000, outstanding_balance: 32000 }))).toBe(18000);
  });

  it('clamps at 0 when outstanding_balance already exceeds the limit', () => {
    expect(getRemainingCredit(customer({ credit_limit: 50000, outstanding_balance: 60000 }))).toBe(0);
  });

  it('returns Infinity when credit_limit is 0 ("no limit")', () => {
    expect(getRemainingCredit(customer({ credit_limit: 0, outstanding_balance: 999999 }))).toBe(Infinity);
  });
});
