export interface TestGroup {
  id: string;
  label: string;
  vitestFiles: string[];
  e2e: string | null;
  unitDesc: string;
  e2eDesc: string | null;
}

export const TEST_GROUPS: TestGroup[] = [
  {
    id: 'products-inventory',
    label: 'Products & Inventory',
    vitestFiles: [],
    e2e: null,
    unitDesc: 'No automated tests yet — covered manually for now',
    e2eDesc: null,
  },
  {
    id: 'sales-pos',
    label: 'Sales & POS',
    vitestFiles: ['src/services/posService.test.ts'],
    e2e: 'pos-checkout',
    unitDesc:
      '29 unit tests covering checkout logic: loyalty point computation, payment status ' +
      'derivation (paid/partial/unpaid), stock validation before DB write, credit limit ' +
      'enforcement, walk-in customer bypass, FIFO vs batch-specific stock deduction, ' +
      'and payment split filtering. All money in LKR as NUMERIC(12,2).',
    e2eDesc: 'End-to-end checkout flow through the POS screen.',
  },
  {
    id: 'refunds-returns',
    label: 'Refunds & Returns',
    vitestFiles: [],
    e2e: null,
    unitDesc: 'No automated tests yet — covered manually for now',
    e2eDesc: null,
  },
  {
    id: 'payments-cheques',
    label: 'Payments & Cheques',
    vitestFiles: [],
    e2e: null,
    unitDesc: 'No automated tests yet — covered manually for now',
    e2eDesc: null,
  },
  {
    id: 'customers-credit',
    label: 'Customers & Credit',
    vitestFiles: [],
    e2e: null,
    unitDesc: 'No automated tests yet — covered manually for now',
    e2eDesc: null,
  },
  {
    id: 'suppliers-purchasing',
    label: 'Suppliers & Purchasing',
    vitestFiles: [],
    e2e: null,
    unitDesc: 'No automated tests yet — covered manually for now',
    e2eDesc: null,
  },
  {
    id: 'stock-transfers',
    label: 'Stock Transfers',
    vitestFiles: [],
    e2e: null,
    unitDesc: 'No automated tests yet — covered manually for now',
    e2eDesc: null,
  },
  {
    id: 'salespeople',
    label: 'Salespeople',
    vitestFiles: [],
    e2e: null,
    unitDesc: 'No automated tests yet — covered manually for now',
    e2eDesc: null,
  },
  {
    id: 'reports',
    label: 'Reports',
    vitestFiles: [],
    e2e: null,
    unitDesc: 'No automated tests yet — covered manually for now',
    e2eDesc: null,
  },
  {
    id: 'offline-sync',
    label: 'Offline Sync',
    vitestFiles: [],
    e2e: null,
    unitDesc: 'No automated tests yet — covered manually for now',
    e2eDesc: null,
  },
  {
    id: 'core-infra',
    label: 'Core Infrastructure',
    vitestFiles: [],
    e2e: null,
    unitDesc: 'No automated tests yet — covered manually for now',
    e2eDesc: null,
  },
  {
    id: 'sandbox',
    label: 'Sandbox & Test Catalog',
    vitestFiles: [
      'src/sandbox/__tests__/sandbox-isolation.test.ts',
      'src/sandbox/__tests__/test-groups.test.ts',
    ],
    e2e: null,
    unitDesc:
      'Sandbox schema isolation: resets the sandbox schema and verifies public row counts ' +
      'are unchanged (skips without SANDBOX_DB_URL). Catalog precision contract: every ' +
      'src/**/*.test.ts file must be registered in exactly one group.',
    e2eDesc: null,
  },
];
