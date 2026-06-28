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
    vitestFiles: ['src/services/__tests__/inventory.test.ts'],
    e2e: null,
    unitDesc:
      '11 unit tests covering getInventory, weighted-average cost (NUMERIC), insertStockAdjustment, and getBatchesForProducts; plus 2 sandbox integration tests verifying the seeded stock batches.',
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
    vitestFiles: ['src/services/__tests__/returns.test.ts'],
    e2e: null,
    unitDesc:
      '6 unit tests covering processInvoiceReturn: already-returned guard, no-items guard, fetch-error propagation, unpaid invoice skips payment row, no_refund mode skips payment and customer update, credit_note mode reads and updates customer balance.',
    e2eDesc: null,
  },
  {
    id: 'payments-cheques',
    label: 'Payments & Cheques',
    vitestFiles: ['src/services/__tests__/payments.test.ts'],
    e2e: null,
    unitDesc:
      '8 unit tests covering recordPayment (cash defaults, cheque fields, null invoice_id, RPC error) and cheque lifecycle transitions (depositCheque → processing, completeCheque → completed, returnCheque → returned, invalid-transition error); plus 1 sandbox integration test verifying INV-S001 has a cash payment.',
    e2eDesc: null,
  },
  {
    id: 'customers-credit',
    label: 'Customers & Credit',
    vitestFiles: ['src/services/__tests__/customers.test.ts'],
    e2e: null,
    unitDesc:
      '11 unit tests covering createCustomer (success, error), recordPayment RPC args and defaults, cheque lifecycle (depositCheque, completeCheque, returnCheque, error on invalid transition), and archiveCustomer (success, error); plus 2 sandbox integration tests verifying walk-in customer credit_limit=0 and Nimal Electronics credit_limit=500000.',
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
