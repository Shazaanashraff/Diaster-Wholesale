export type Role = 'admin' | 'accountant' | 'officer' | 'pos_operator' | 'warehouse';

export type Permission =
  | 'manage_products'
  | 'manage_procurement'
  | 'manage_suppliers'
  | 'manage_costs'
  | 'manage_payments'
  | 'view_reports'
  | 'pos'
  | 'bulk_import'
  | 'override_pricing'
  | 'approve_discounts'
  | 'view_customers'
  | 'manage_customers'
  | 'view_inventory'
  | 'manage_inventory'
  | 'manage_returns';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'manage_products', 'manage_procurement', 'manage_suppliers',
    'manage_costs', 'manage_payments', 'view_reports', 'pos',
    'bulk_import', 'override_pricing', 'approve_discounts',
    'view_customers', 'manage_customers', 'view_inventory',
    'manage_inventory', 'manage_returns',
  ],
  accountant: [
    'manage_costs', 'manage_payments', 'view_reports',
    'view_customers', 'view_inventory', 'manage_returns',
  ],
  officer: [
    'manage_products', 'manage_procurement', 'manage_suppliers',
    'view_reports', 'view_inventory', 'manage_inventory', 'bulk_import', 'manage_returns',
  ],
  pos_operator: [
    'pos', 'view_customers', 'manage_returns',
  ],
  warehouse: [
    'view_inventory', 'manage_inventory', 'manage_procurement',
  ],
};

export const ROLE_LABELS: Record<Role, string> = {
  admin:        'Admin',
  accountant:   'Accountant',
  officer:      'Officer',
  pos_operator: 'POS Operator',
  warehouse:    'Warehouse',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin:        'Full system access & overrides',
  accountant:   'Costing, payments & reports',
  officer:      'Procurement & product management',
  pos_operator: 'Sales & customer service',
  warehouse:    'Inventory & stock management',
};

// Default PINs stored per role in localStorage
export const ROLE_PIN_KEYS: Record<Role, string> = {
  admin:        'pin_admin',
  accountant:   'pin_accountant',
  officer:      'pin_officer',
  pos_operator: 'pin_pos_operator',
  warehouse:    'pin_warehouse',
};

export const DEFAULT_PINS: Record<Role, string> = {
  admin:        '1234',
  accountant:   '2222',
  officer:      '3333',
  pos_operator: '4444',
  warehouse:    '5555',
};

export function getRolePin(role: Role): string {
  return localStorage.getItem(ROLE_PIN_KEYS[role]) || DEFAULT_PINS[role];
}

export function getCurrentRole(): Role {
  return (sessionStorage.getItem('user_role') as Role) || 'admin';
}

export function can(permission: Permission, role?: Role): boolean {
  const r = role ?? getCurrentRole();
  return ROLE_PERMISSIONS[r]?.includes(permission) ?? false;
}

export function canAny(permissions: Permission[], role?: Role): boolean {
  const r = role ?? getCurrentRole();
  return permissions.some(p => ROLE_PERMISSIONS[r]?.includes(p));
}

export function usePermissions() {
  const role = getCurrentRole();
  return {
    role,
    roleLabel: ROLE_LABELS[role],
    can: (permission: Permission) => can(permission, role),
    canAny: (permissions: Permission[]) => canAny(permissions, role),
  };
}
