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
    unitDesc: 'No automated tests yet — covered manually for now.',
    e2eDesc: null,
  },
  {
    id: 'sales-pos',
    label: 'Sales & POS',
    vitestFiles: ['src/services/posService.test.ts'],
    e2e: 'pos-checkout',
    unitDesc:
      '29 unit tests covering checkout flow, stock validation, payment splits, loyalty points, and credit-limit enforcement.',
    e2eDesc:
      'End-to-end checkout through the POS screen against the live sandbox schema.',
  },
  {
    id: 'refunds-returns',
    label: 'Refunds & Returns',
    vitestFiles: [],
    e2e: null,
    unitDesc: 'No automated tests yet — covered manually for now.',
    e2eDesc: null,
  },
  {
    id: 'payments-cheques',
    label: 'Payments & Cheques',
    vitestFiles: [],
    e2e: null,
    unitDesc: 'No automated tests yet — covered manually for now.',
    e2eDesc: null,
  },
  {
    id: 'customers-credit',
    label: 'Customers & Credit',
    vitestFiles: [],
    e2e: null,
    unitDesc: 'No automated tests yet — covered manually for now.',
    e2eDesc: null,
  },
  {
    id: 'suppliers-purchasing',
    label: 'Suppliers & Purchasing',
    vitestFiles: [],
    e2e: null,
    unitDesc: 'No automated tests yet — covered manually for now.',
    e2eDesc: null,
  },
  {
    id: 'stock-transfers',
    label: 'Stock Transfers',
    vitestFiles: [],
    e2e: null,
    unitDesc: 'No automated tests yet — covered manually for now.',
    e2eDesc: null,
  },
  {
    id: 'salespeople',
    label: 'Salespeople',
    vitestFiles: [],
    e2e: null,
    unitDesc: 'No automated tests yet — covered manually for now.',
    e2eDesc: null,
  },
  {
    id: 'reports',
    label: 'Reports',
    vitestFiles: [],
    e2e: null,
    unitDesc: 'No automated tests yet — covered manually for now.',
    e2eDesc: null,
  },
  {
    id: 'offline-sync',
    label: 'Offline Sync',
    vitestFiles: [],
    e2e: null,
    unitDesc: 'No automated tests yet — covered manually for now.',
    e2eDesc: null,
  },
  {
    id: 'core-infra',
    label: 'Core Infrastructure',
    vitestFiles: [],
    e2e: null,
    unitDesc: 'No automated tests yet — covered manually for now.',
    e2eDesc: null,
  },
  {
    id: 'sandbox',
    label: 'Sandbox',
    vitestFiles: [
      'src/sandbox/__tests__/sandbox-isolation.test.ts',
      'src/sandbox/__tests__/test-groups.test.ts',
    ],
    e2e: null,
    unitDesc:
      'Verifies sandbox schema isolation from public, reset_all() non-destructiveness, and test catalog completeness.',
    e2eDesc: null,
  },
];
