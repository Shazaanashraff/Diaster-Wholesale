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
    vitestFiles: ['src/sandbox/__tests__/products-inventory.test.ts'],
    e2e: null,
    unitDesc:
      '3 integration tests against the sandbox schema: records a GRN container with ' +
      'carton + loose-piece measurements; asserts total_units = cartons × pieces_per_carton ' +
      '+ loose_pieces; verifies FIFO deduction reduces remaining batch stock after an invoice ' +
      'is recorded. Money in LKR as NUMERIC(12,2). Skips without SANDBOX_DB_URL.',
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
    vitestFiles: ['src/services/__tests__/returnsService.test.ts'],
    e2e: null,
    unitDesc:
      '6 unit tests for processInvoiceReturn: guards against double-return and empty-item ' +
      'invoices; asserts stock_adjustments are created for every line item; verifies a ' +
      'negative payment is inserted for paid invoices (cash/bank_transfer/credit_note) but ' +
      'skipped for no_refund and unpaid invoices; confirms credit_note updates the customer ' +
      "outstanding balance (NUMERIC(12,2), clamped to 0). All via mocked Supabase client.",
    e2eDesc: null,
  },
  {
    id: 'payments-cheques',
    label: 'Payments & Cheques',
    vitestFiles: ['src/services/__tests__/chequeService.test.ts'],
    e2e: null,
    unitDesc:
      '6 unit tests for cheque lifecycle: depositCheque → processing, completeCheque → ' +
      'completed, returnCheque → returned; full lifecycle chain (received → processing → ' +
      'completed) verified in call order; RPC errors propagate to the caller; invalid ' +
      'transitions (e.g. completing a returned cheque) propagate the DB rejection message.',
    e2eDesc: null,
  },
  {
    id: 'customers-credit',
    label: 'Customers & Credit',
    vitestFiles: ['src/services/__tests__/customerCredit.test.ts'],
    e2e: null,
    unitDesc:
      '5 unit tests: createCustomer always sets outstanding_balance to zero regardless of ' +
      'caller input; updateCustomer forwards credit_limit changes to the DB; recordPayment ' +
      'calls the record_payment_atomic RPC with all required fields including cheque metadata ' +
      '(bank, cheque number, due date); RPC errors propagate to the caller. Money in LKR ' +
      'as NUMERIC(12,2).',
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
