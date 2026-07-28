import { describe, it, expect } from 'vitest';
import { can, type Role } from './permissions';

describe('adjust_balance permission', () => {
  it('is granted to admin', () => {
    expect(can('adjust_balance', 'admin')).toBe(true);
  });

  const otherRoles: Role[] = ['accountant', 'officer', 'pos_operator', 'warehouse', 'developer'];

  it.each(otherRoles)('is denied to %s', (role) => {
    expect(can('adjust_balance', role)).toBe(false);
  });
});
