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
      'Receiving a purchase: rejects receiving/damaging more units than were ordered/received ' +
      'before touching the database, and records one purchase_receive row per item. Against a ' +
      'real sandbox database, confirms the receive-confirmation trigger creates a stock batch ' +
      'net of damaged units, and that FIFO stock deduction (the same routine POS checkout uses) ' +
      'reduces it by exactly the right number of pieces.',
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
    vitestFiles: ['src/services/cheques.test.ts'],
    e2e: null,
    unitDesc:
      'Each cheque-lifecycle action (deposit, complete, return, undo-deposit, re-present, ' +
      'reverse-to-returned) requests exactly the right new status from the update_cheque_status ' +
      'RPC, and the database\'s own errors (invalid transition, not a cheque payment, payment ' +
      'not found) propagate to the caller untouched, against a mocked Supabase client. The ' +
      'transition rules themselves live server-side and are not yet reachable as a real ' +
      'sandbox-database integration test — see TODO/completed/todo-013.md for why.',
    e2eDesc: null,
  },
  {
    id: 'customers-credit',
    label: 'Customers & Credit',
    vitestFiles: [
      'src/services/customerService.test.ts',
      'src/sandbox/__tests__/customers-credit.integration.test.ts',
    ],
    e2e: null,
    unitDesc:
      'Admin-only manual outstanding-balance adjustment: the signed delta, reason, and admin ' +
      'identity are passed through to the adjust_customer_outstanding_manual RPC untouched, and ' +
      'RPC errors (e.g. a missing reason) propagate as thrown errors. Recording a payment passes ' +
      'the customer, invoice, amount, and (for cheques) bank/cheque/due-date details through to ' +
      'record_payment_atomic untouched, all against a mocked Supabase client. Against a real ' +
      'sandbox database, confirms the credit-limit rule (available = limit − outstanding balance) ' +
      'matches the real numbers on a seeded customer, allowing headroom sales and rejecting ' +
      'over-limit ones.',
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
