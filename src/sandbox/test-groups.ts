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
    vitestFiles: ['src/sandbox/__tests__/products-inventory.test.ts'],
    e2e: null,
    unitDesc:
      'Integration tests against the sandbox schema: receiving a container/GRN turns received-minus-' +
      'damaged units into a correctly sized stock batch (cartons + loose pieces), and a sale-style ' +
      'stock deduction reduces remaining stock by exactly the units sold — selling more than what is ' +
      'left fails loudly instead of going negative.',
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
    vitestFiles: ['src/services/chequeService.test.ts'],
    e2e: null,
    unitDesc:
      'Cheque lifecycle passthrough to the update_cheque_status RPC: deposit (pending → processing), ' +
      'clear (processing → completed), bounce (processing → returned), plus the reverse corrections ' +
      '(completed → returned, returned → processing, processing → pending) — and that an invalid ' +
      'transition or a non-cheque payment is rejected with the RPC’s specific error message, all ' +
      'against a mocked Supabase client.',
    e2eDesc: null,
  },
  {
    id: 'customers-credit',
    label: 'Customers & Credit',
    vitestFiles: ['src/services/customerService.test.ts', 'src/utils/creditCheck.test.ts'],
    e2e: null,
    unitDesc:
      'Credit-limit rule (a sale is only blocked once outstanding + sale total exceeds the customer’s ' +
      'limit, and a limit of 0 means unlimited); admin-only manual outstanding-balance adjustment and ' +
      'recording a payment both pass their exact amounts/method through to their RPCs untouched, with ' +
      'RPC errors (e.g. a missing reason, a bad invoice_id) propagating as thrown errors — all against ' +
      'a mocked Supabase client.',
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
