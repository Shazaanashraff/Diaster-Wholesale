/**
 * POS Checkout — Playwright + Electron E2E tests
 *
 * All Supabase REST API calls are intercepted via page.route() so tests are
 * deterministic and never touch a real database.
 *
 * Pre-requisites:
 *   - playwright.config.ts starts the Vite dev server automatically.
 *   - A valid .env file must exist (renderer initialises env vars from it,
 *     but all outbound Supabase HTTP calls are intercepted before they leave).
 *
 * Run:  npm run test:e2e
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page, Route } from '@playwright/test';
import path from 'path';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const PRODUCT_ID = 'e2e-prod-00000001';
const INVOICE_UUID = 'e2e-invoice-00000001-uuid';

/** A shop_stock row with 10 cartons in stock (12 pcs/carton = 120 pcs available). */
const MOCK_STOCK_ROW = {
  product_id: PRODUCT_ID,
  item_code: 'E2E001',
  name: 'E2E Test Biscuit',
  model: '',
  category: 'Test',
  wholesale_price: 100,
  retail_price: 120,
  pieces_per_carton: 12,
  reorder_level: 5,
  cartons_in: 10,
  pieces_in: 0,
  cartons_sold: 0,
  pieces_sold: 0,
  carton_adj: 0,
  piece_adj: 0,
};

// ─── Electron lifecycle ───────────────────────────────────────────────────────

let app: ElectronApplication;

test.beforeAll(async () => {
  app = await electron.launch({
    args: [path.join(process.cwd(), 'electron/main.mjs')],
    env: {
      ...process.env,
      // Tell Electron to load from the Vite dev server (started by playwright webServer)
      VITE_DEV_SERVER_URL: 'http://localhost:5173',
    },
  });
});

test.afterAll(async () => {
  await app.close();
});

// ─── Route interception helpers ───────────────────────────────────────────────

interface MockOptions {
  /** HTTP status for checkout_sale RPC. Default 200. */
  checkoutStatus?: number;
  /**
   * Body for checkout_sale RPC.
   * - On success (2xx): the UUID string.
   * - On error (4xx): the error message string (wrapped in PostgREST error shape).
   */
  checkoutBody?: string;
  /**
   * Override shop_stock rows returned for the validateStock call
   * (the one with a product_id=in.(...) filter).  The catalog-load call
   * always returns the full MOCK_STOCK_ROW so the product is visible in the UI.
   */
  validateStockRows?: object[];
}

/**
 * Register route intercepts for all Supabase REST API calls.
 * Routes are processed in LIFO order, so test-specific page.route() calls
 * registered AFTER this function will take precedence.
 */
async function mockSupabaseRoutes(page: Page, opts: MockOptions = {}) {
  const {
    checkoutStatus = 200,
    checkoutBody = JSON.stringify(INVOICE_UUID),
    validateStockRows,
  } = opts;

  await page.route('**/rest/v1/**', async (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();
    const accept = route.request().headers()['accept'] ?? '';
    // PostgREST adds this header when .single() is used — signals a single-object response
    const isSingleObject = accept.includes('vnd.pgrst.object');

    // ── shop_stock ─────────────────────────────────────────────────────────
    if (url.includes('/rest/v1/shop_stock')) {
      // validateStock appends `product_id=in.(...)` to the query string;
      // the catalog load uses `order=name.asc` with no id filter.
      const isValidateStock = url.includes('product_id=in');
      const rows = isValidateStock
        ? (validateStockRows ?? [MOCK_STOCK_ROW])
        : [MOCK_STOCK_ROW];

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: isSingleObject ? JSON.stringify(rows[0] ?? null) : JSON.stringify(rows),
      });
    }

    // ── customers ──────────────────────────────────────────────────────────
    if (url.includes('/rest/v1/customers') && method === 'GET') {
      // List requests (no .single()): return empty array — no customer dropdown items.
      // Single-object requests (loyalty / balance reads): return null so those
      // optional paths in posService.ts are silently skipped.
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: isSingleObject ? 'null' : '[]',
      });
    }

    // ── salespeople ────────────────────────────────────────────────────────
    if (url.includes('/salespeople') || url.includes('/salesperson')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }

    // ── checkout_sale RPC (atomic insert) ──────────────────────────────────
    if (url.includes('/rpc/checkout_sale')) {
      if (checkoutStatus >= 400) {
        // PostgREST error shape — Supabase JS client reads `.message` from this
        return route.fulfill({
          status: checkoutStatus,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'P0001',
            details: null,
            hint: null,
            message: checkoutBody,
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: checkoutBody,
      });
    }

    // ── stock deduction RPCs (fire-and-forget after successful insert) ─────
    if (url.includes('/rpc/deduct_stock')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    }

    // ── all other RPCs / tables ────────────────────────────────────────────
    if (url.includes('/rpc/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: method === 'GET' ? '[]' : 'null',
    });
  });
}

/** Navigate to /pos and wait until the product catalogue has loaded. */
async function openPOS(page: Page) {
  await page.goto('http://localhost:5173/pos');
  // The loading skeleton stays until data loads; wait for the first Add button
  await page
    .getByTestId(`pos-add-${PRODUCT_ID}`)
    .waitFor({ state: 'visible', timeout: 15_000 });
}

/** Set the quantity to `cartons` on the first product card and click Add. */
async function addProductToCart(page: Page, cartons = 1) {
  await page
    .getByLabel(`Enter quantity for ${MOCK_STOCK_ROW.name}`)
    .fill(String(cartons));
  await page.getByTestId(`pos-add-${PRODUCT_ID}`).click();
  // Confirm the item landed in the cart
  await expect(page.getByTestId('pos-cart')).toContainText(MOCK_STOCK_ROW.name);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

// serial: tests share a single Electron window, state must be set up fresh per test
test.describe.configure({ mode: 'serial' });

test.describe('POS Checkout', () => {
  let page: Page;

  test.beforeEach(async () => {
    page = await app.firstWindow();
    // Clear any routes from the previous test before wiring new ones
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  // ── Checkout button state ──────────────────────────────────────────────────

  test('Complete Sale is disabled when cart is empty', async () => {
    await mockSupabaseRoutes(page);
    await openPOS(page);

    await expect(page.getByTestId('pos-submit')).toBeDisabled();
  });

  test('Complete Sale is enabled after adding a product to the cart', async () => {
    await mockSupabaseRoutes(page);
    await openPOS(page);
    await addProductToCart(page);

    await expect(page.getByTestId('pos-submit')).toBeEnabled();
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  test('successful checkout shows the Transaction Complete modal', async () => {
    await mockSupabaseRoutes(page);
    await openPOS(page);
    await addProductToCart(page);

    await page.getByTestId('pos-submit').click();

    await expect(page.getByTestId('pos-success-modal')).toBeVisible({ timeout: 10_000 });
    // No error message must appear on success
    await expect(page.getByTestId('pos-error')).not.toBeVisible();
  });

  test('closing the success modal resets the cart to empty', async () => {
    await mockSupabaseRoutes(page);
    await openPOS(page);
    await addProductToCart(page);
    await page.getByTestId('pos-submit').click();
    await expect(page.getByTestId('pos-success-modal')).toBeVisible({ timeout: 10_000 });

    // Click the "Back to POS" button inside the receipt modal
    await page.getByRole('button', { name: /back to pos/i }).click();

    await expect(page.getByTestId('pos-cart')).toContainText('No items yet');
    await expect(page.getByTestId('pos-submit')).toBeDisabled();
  });

  // ── Error paths ────────────────────────────────────────────────────────────

  test('checkout_sale RPC error shows error message and no success modal', async () => {
    await mockSupabaseRoutes(page, {
      checkoutStatus: 400,
      checkoutBody: 'duplicate invoice number',
    });
    await openPOS(page);
    await addProductToCart(page);

    await page.getByTestId('pos-submit').click();

    await expect(page.getByTestId('pos-error')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('pos-error')).toContainText('Checkout failed');
    await expect(page.getByTestId('pos-success-modal')).not.toBeVisible();
  });

  test('empty-items DB guard rejection surfaces as error message', async () => {
    await mockSupabaseRoutes(page, {
      checkoutStatus: 400,
      checkoutBody: 'cart is empty — invoice not created',
    });
    await openPOS(page);
    await addProductToCart(page);

    await page.getByTestId('pos-submit').click();

    await expect(page.getByTestId('pos-error')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('pos-error')).toContainText('cart is empty');
    await expect(page.getByTestId('pos-success-modal')).not.toBeVisible();
  });

  test('insufficient stock at checkout shows stock error message', async () => {
    await mockSupabaseRoutes(page);
    // Override only the validateStock call (has product_id=in. filter) to return 0 pieces
    await page.route('**/rest/v1/shop_stock**', async (route) => {
      const isValidateStock = route.request().url().includes('product_id=in');
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          isValidateStock
            ? [{ ...MOCK_STOCK_ROW, cartons_in: 0, pieces_in: 0 }]  // 0 available
            : [MOCK_STOCK_ROW]                                        // product visible in catalog
        ),
      });
    });

    await openPOS(page);
    await addProductToCart(page);

    await page.getByTestId('pos-submit').click();

    await expect(page.getByTestId('pos-error')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('pos-error')).toContainText('Insufficient stock');
    await expect(page.getByTestId('pos-success-modal')).not.toBeVisible();
  });

  // ── Cart interactions ──────────────────────────────────────────────────────

  test('clear cart button empties the cart and disables checkout', async () => {
    await mockSupabaseRoutes(page);
    await openPOS(page);
    await addProductToCart(page);

    await page.getByTestId('pos-clear-cart').click();

    await expect(page.getByTestId('pos-cart')).toContainText('No items yet');
    await expect(page.getByTestId('pos-submit')).toBeDisabled();
  });

  test('product search filters visible products', async () => {
    await mockSupabaseRoutes(page);
    await openPOS(page);

    // Searching by name should keep the product visible
    await page.getByTestId('pos-search').fill('E2E Test');
    await expect(page.getByTestId(`pos-add-${PRODUCT_ID}`)).toBeVisible();

    // Searching for something that doesn't match should hide the product
    await page.getByTestId('pos-search').fill('zzz-no-match-product');
    await expect(page.getByTestId(`pos-add-${PRODUCT_ID}`)).not.toBeVisible();
  });
});
