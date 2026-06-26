// Single source of truth for the Sandbox screen's group catalog.
// The precision-contract test (test-groups.test.ts) keeps this in sync with
// the actual test files on disk — every *.test.ts must be listed here.

export interface TestGroup {
  id: string;
  label: string;
  /** Relative paths (from project root) to vitest test files owned by this group. */
  vitestFiles: string[];
  /** Basename of the e2e spec (resolves to e2e/<e2e>.spec.ts), or null. */
  e2e: string | null;
  /** One-liner describing what the unit tests guarantee (shown in the grid). */
  unitDesc: string;
  /** One-liner describing what the e2e test covers, or null. */
  e2eDesc: string | null;
}

export const TEST_GROUPS: TestGroup[] = [
  {
    id: 'products-inventory',
    label: 'Products & Inventory',
    vitestFiles: ['src/sandbox/__tests__/products-inventory.test.ts'],
    e2e: null,
    unitDesc:
      'Sandbox integration: seeded products and stock batches exist after reset; ' +
      'stock adjustments (positive and negative) correctly update aggregate piece counts.',
    e2eDesc: null,
  },
  {
    id: 'sales-pos',
    label: 'Sales & POS',
    vitestFiles: ['src/services/posService.test.ts'],
    e2e: 'pos-checkout',
    unitDesc:
      'Checkout logic: stock validation, payment-status derivation, loyalty earn/redeem, ' +
      'credit-limit enforcement, FIFO vs batch deduction routing, RPC error propagation.',
    e2eDesc:
      'End-to-end POS checkout flow — scan items, collect payment, confirm invoice saved.',
  },
  {
    id: 'refunds-returns',
    label: 'Refunds & Returns',
    vitestFiles: ['src/services/__tests__/returnsService.test.ts'],
    e2e: null,
    unitDesc:
      'processInvoiceReturn guard clauses (already-returned, no-items, fetch-error), ' +
      'stock adjustment insertion per line item, negative payment creation for paid/partial invoices, ' +
      'credit-note balance deduction, no_refund bypass, and invoice note tagging.',
    e2eDesc: null,
  },
  {
    id: 'payments-cheques',
    label: 'Payments & Cheques',
    vitestFiles: ['src/services/__tests__/chequeLifecycle.test.ts'],
    e2e: null,
    unitDesc:
      'Cheque lifecycle via update_cheque_status RPC: depositCheque → "processing", ' +
      'completeCheque → "completed", returnCheque → "returned"; each throws on RPC error; ' +
      'all three send distinct target statuses.',
    e2eDesc: null,
  },
  {
    id: 'customers-credit',
    label: 'Customers & Credit',
    vitestFiles: ['src/services/__tests__/customerService.test.ts'],
    e2e: null,
    unitDesc:
      'recordPayment calls record_payment_atomic RPC with correct params (cash, cheque, null invoiceId); ' +
      'throws on RPC error; getCustomerById returns credit_limit and outstanding_balance; ' +
      'createCustomer always initialises outstanding_balance to 0.',
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
    label: 'Offline & Sync',
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
    label: 'Sandbox & Test Infrastructure',
    vitestFiles: [
      'src/sandbox/__tests__/sandbox-isolation.test.ts',
      'src/sandbox/__tests__/test-groups.test.ts',
    ],
    e2e: null,
    unitDesc:
      'Sandbox schema isolation (reset_all never touches public), ' +
      'and catalog precision contract (every test file is registered in exactly one group).',
    e2eDesc: null,
  },
];
