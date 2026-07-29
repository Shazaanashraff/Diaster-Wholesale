/**
 * Sandbox catalog — Layer 1 (todo-010).
 *
 * Single source of truth for the Sandbox screen's grid (todo-012). Each group
 * lists the real Vitest files and (optional) Playwright E2E spec that cover it
 * today. `src/sandbox/__tests__/test-groups.test.ts` is the precision contract:
 * it fails the build if any `src/**\/*.test.{ts,tsx}` file is missing from a
 * group, or if a listed path doesn't exist, so this file can never silently
 * drift out of date.
 *
 * NO "Money & Ledger" group — this app has no ledger and uses NUMERIC(12,2)
 * decimal money, not a bigint minor-units ledger (owner-approved deviation,
 * see TODO/sandbox-code-review.md).
 */

export interface TestGroup {
  id: string;
  label: string;
  vitestFiles: string[];
  e2e: string | null;
  unitDesc: string;
  e2eDesc: string | null;
}

const NO_TESTS_YET = 'No automated tests yet — covered manually for now.';

export const TEST_GROUPS: TestGroup[] = [
  {
    id: 'products-inventory',
    label: 'Products & Inventory',
    vitestFiles: [
      'src/services/purchaseService.test.ts',
      'src/sandbox/__tests__/products-inventory.integration.test.ts',
    ],
    e2e: null,
    unitDesc:
      'Receiving a purchase order: rejects receiving more units than were ordered or more damaged ' +
      'units than were received (before anything is written), and reports the real database error ' +
      'if the receive itself fails to save, all against a mocked Supabase client. Plus a live-database ' +
      'check (against the sandbox schema) that a received PO creates the right stock (received minus ' +
      'damaged, split into cartons and loose pieces), that a sale correctly eats into that stock oldest-' +
      'batch-first, and that trying to sell more than remains is rejected instead of going negative.',
    e2eDesc: null,
  },
  {
    id: 'sales-pos',
    label: 'Sales / POS',
    vitestFiles: ['src/services/posService.test.ts'],
    e2e: 'pos-checkout',
    unitDesc:
      'Checkout math and guardrails: loyalty points, redemption, payment-status derivation, ' +
      'stock validation, credit-limit checks, and stock-deduction routing (FIFO vs batch), all ' +
      'against a mocked Supabase client.',
    e2eDesc:
      'Drives the real POS screen end-to-end in a launched Electron window — add a product to ' +
      'the cart, complete a sale, and confirm the success modal, error states, and cart reset.',
  },
  {
    id: 'refunds-returns',
    label: 'Refunds & Returns',
    vitestFiles: [],
    e2e: null,
    unitDesc: NO_TESTS_YET,
    e2eDesc: null,
  },
  {
    id: 'payments-cheques',
    label: 'Payments & Cheques',
    vitestFiles: ['src/services/chequeLifecycle.test.ts'],
    e2e: null,
    unitDesc:
      'Every cheque lifecycle action (deposit, complete, return, reverse-after-clearing, undo-deposit, ' +
      're-present) calls the update_cheque_status RPC with the exact payment and target status the ' +
      'state machine expects, and a rejection from the database (an invalid transition, or a payment ' +
      'that isn\'t a cheque at all) propagates to the caller with its original message intact, all ' +
      'against a mocked Supabase client. The transition rules and float/balance math themselves live ' +
      'in Postgres and are not yet covered by a live-database test — that RPC has not been ported to ' +
      'the sandbox schema (see this file\'s completion notes for todo-013).',
    e2eDesc: null,
  },
  {
    id: 'customers-credit',
    label: 'Customers & Credit',
    vitestFiles: ['src/services/customerService.test.ts'],
    e2e: null,
    unitDesc:
      'Recording a payment: the customer, invoice (or null for a general payment), amount, method, ' +
      'and cheque/bank details are passed through to the record_payment_atomic RPC untouched, and a ' +
      'rejected payment (e.g. a zero amount) throws instead of silently doing nothing. Plus the admin-' +
      'only manual outstanding-balance adjustment: the signed delta, reason, and admin identity are ' +
      'passed through to the adjust_customer_outstanding_manual RPC untouched, and RPC errors (e.g. a ' +
      'missing reason) propagate as thrown errors, all against a mocked Supabase client. Credit-limit ' +
      'enforcement itself is covered under Sales / POS (checkCreditLimit runs during checkout).',
    e2eDesc: null,
  },
  {
    id: 'suppliers-purchasing',
    label: 'Suppliers & Purchasing',
    vitestFiles: [],
    e2e: null,
    unitDesc: NO_TESTS_YET,
    e2eDesc: null,
  },
  {
    id: 'stock-transfers',
    label: 'Stock Transfers',
    vitestFiles: [],
    e2e: null,
    unitDesc: NO_TESTS_YET,
    e2eDesc: null,
  },
  {
    id: 'salespeople',
    label: 'Salespeople',
    vitestFiles: [],
    e2e: null,
    unitDesc: NO_TESTS_YET,
    e2eDesc: null,
  },
  {
    id: 'reports',
    label: 'Reports',
    vitestFiles: [],
    e2e: null,
    unitDesc: NO_TESTS_YET,
    e2eDesc: null,
  },
  {
    id: 'offline-sync',
    label: 'Offline & Sync',
    vitestFiles: [],
    e2e: null,
    unitDesc: NO_TESTS_YET,
    e2eDesc: null,
  },
  {
    id: 'core-infra',
    label: 'Core Infrastructure',
    vitestFiles: ['src/utils/permissions.test.ts'],
    e2e: null,
    unitDesc:
      'Role/permission gating: confirms the admin-only "adjust_balance" permission is granted ' +
      'exclusively to the admin role and denied to every other role.',
    e2eDesc: null,
  },
  {
    id: 'sandbox',
    label: 'Sandbox Tooling',
    vitestFiles: [
      'src/sandbox/__tests__/sandbox-isolation.test.ts',
      'src/sandbox/__tests__/test-groups.test.ts',
    ],
    e2e: null,
    unitDesc:
      'Proves the sandbox schema stays isolated from public (reset + reseed never changes ' +
      'public row counts, the schema_marker + a seeded product exist), and that this very ' +
      'catalog cannot drift out of date (every test file is registered in exactly one group).',
    e2eDesc: null,
  },
];
