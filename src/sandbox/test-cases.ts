export interface TestCase {
  name: string;
  what: string;
  type: 'unit' | 'e2e' | 'integration';
}

export const TEST_CASES: Record<string, TestCase[]> = {
  'sales-pos': [
    // ── computeLoyaltyEarned ─────────────────────────────────────────────────
    {
      name: 'computeLoyaltyEarned: floors netTotal / 100',
      what: 'Every LKR 100 of the net sale total earns exactly 1 loyalty point; the remainder is dropped (floor, not round). LKR 1099 earns 10 points; LKR 1100 earns 11.',
      type: 'unit',
    },
    // ── computeRedemptionValue ───────────────────────────────────────────────
    {
      name: 'computeRedemptionValue: 1 point = LKR 1',
      what: '250 loyalty points are worth exactly LKR 250.00 off the total; 0 points give LKR 0 off.',
      type: 'unit',
    },
    // ── happy path ───────────────────────────────────────────────────────────
    {
      name: 'returns invoiceId, invoiceNo, and earnedPoints on success',
      what: 'A successful wholesale checkout returns the invoice UUID from the DB, an invoice number matching INV-XXXXXX, and the correct loyalty points (LKR 1 200 → 12 points).',
      type: 'unit',
    },
    {
      name: 'passes wholesale mode to checkout_sale RPC',
      what: 'When isWholesale=true, the checkout_sale RPC receives p_mode="wholesale".',
      type: 'unit',
    },
    {
      name: 'passes retail mode when isWholesale=false',
      what: 'When isWholesale=false, the checkout_sale RPC receives p_mode="retail".',
      type: 'unit',
    },
    {
      name: 'invoice number matches INV-XXXXXX format',
      what: 'The generated invoice number always matches the pattern INV-XXXXXX (6 digits), even for a walk-in (null) customer.',
      type: 'unit',
    },
    // ── payment status ───────────────────────────────────────────────────────
    {
      name: 'sets payment_status "paid" when splits cover the total',
      what: 'If the payment splits sum to the full invoice total, the RPC is called with p_payment_status="paid".',
      type: 'unit',
    },
    {
      name: 'sets payment_status "partial" when splits partially cover total',
      what: 'If the payment splits cover only part of the total, p_payment_status="partial" is sent.',
      type: 'unit',
    },
    {
      name: 'sets payment_status "unpaid" when no payment splits',
      what: 'An empty splits array results in p_payment_status="unpaid".',
      type: 'unit',
    },
    // ── walk-in customer ─────────────────────────────────────────────────────
    {
      name: 'walk-in customer: skips credit check and returns earnedPoints=0',
      what: 'A null customerId bypasses credit limit checks entirely and earns 0 loyalty points (no customer account to credit).',
      type: 'unit',
    },
    // ── loyalty ──────────────────────────────────────────────────────────────
    {
      name: 'deducts redemption value from netTotal before computing earnedPoints',
      what: 'If a customer redeems 200 points (LKR 200 off), earned points are computed on the reduced total (LKR 1 000, not LKR 1 200), and the RPC receives the reduced p_total.',
      type: 'unit',
    },
    {
      name: 'clamps netTotal to 0 if redemption value exceeds total',
      what: 'Redeeming more points than the total clamps netTotal to LKR 0 — the RPC gets p_total=0 and earnedPoints=0.',
      type: 'unit',
    },
    // ── stock validation ─────────────────────────────────────────────────────
    {
      name: 'throws "Insufficient stock" before calling the RPC when stock is low',
      what: 'If shop stock has fewer pieces than the cart requires, checkout throws before the checkout_sale RPC is ever called — the database is never asked to record the sale.',
      type: 'unit',
    },
    {
      name: 'throws when shop_stock query itself fails',
      what: 'A DB error on the shop_stock query propagates as "Failed to validate stock" before any sale is recorded.',
      type: 'unit',
    },
    {
      name: 'treats missing stock row as 0 available',
      what: 'A product absent from the shop_stock view is treated as having 0 units — insufficient stock for any cart quantity.',
      type: 'unit',
    },
    {
      name: 'skips a cart item with 0 total pieces in stock deduction loop',
      what: 'A cart item with quantityCartons=0 and quantityPieces=0 is skipped during FIFO deduction — deduct_stock_fifo is only called once for the non-zero item.',
      type: 'unit',
    },
    // ── credit limit ─────────────────────────────────────────────────────────
    {
      name: 'throws "Credit limit exceeded" when outstanding would breach limit',
      what: 'If adding the unpaid portion of the invoice to a customer\'s existing balance would exceed their credit limit, checkout throws before the RPC is called.',
      type: 'unit',
    },
    {
      name: 'skips credit check for walk-in customer even with outstanding',
      what: 'A null customerId bypasses credit checks regardless of the unpaid amount — the checkout succeeds even with a LKR 1 200 unpaid total.',
      type: 'unit',
    },
    // ── RPC failure ──────────────────────────────────────────────────────────
    {
      name: 'throws "Checkout failed" when checkout_sale RPC returns an error',
      what: 'A DB error from the checkout_sale RPC surfaces as "Checkout failed: <message>" rather than being swallowed silently.',
      type: 'unit',
    },
    // ── stock deduction routing ───────────────────────────────────────────────
    {
      name: 'calls deduct_stock_from_batch when item has a batchId',
      what: 'When a cart item carries a batchId, stock is deducted from that specific batch (deduct_stock_from_batch), not via FIFO.',
      type: 'unit',
    },
    {
      name: 'calls deduct_stock_fifo when item has no batchId',
      what: 'When no batchId is set, stock is deducted via the FIFO algorithm (deduct_stock_fifo), oldest batch first.',
      type: 'unit',
    },
    {
      name: 'throws when deduct_stock_fifo returns an error (no longer silently swallowed)',
      what: 'A FIFO deduction error after a successful invoice insert now re-throws as "Stock deduction failed for <product>", preventing a sale with no stock movement.',
      type: 'unit',
    },
    {
      name: 'throws when deduct_stock_from_batch returns an error',
      what: 'A batch-specific deduction error similarly throws "Stock deduction failed for <product>: <message>".',
      type: 'unit',
    },
    // ── multi-item cart ──────────────────────────────────────────────────────
    {
      name: 'calls deduct_stock_fifo once per unique item in cart',
      what: 'A two-item cart triggers two separate FIFO deduction calls, each with the correct product ID and unit count.',
      type: 'unit',
    },
    // ── payment splits passed to RPC ─────────────────────────────────────────
    {
      name: 'filters out zero-amount splits before passing to RPC',
      what: 'A split with amount=0 (e.g. an unused card slot) is stripped before the checkout_sale RPC receives the payments array.',
      type: 'unit',
    },
    {
      name: 'passes all payment splits correctly including cheque fields',
      what: 'A split mix of cheque (with cheque_number and bank_name) plus cash is forwarded intact to the RPC.',
      type: 'unit',
    },
    // ── checkCreditLimit standalone ───────────────────────────────────────────
    {
      name: 'checkCreditLimit: returns ok=true when credit is available',
      what: 'If outstanding + new amount is within the credit limit, ok=true and available reflects the remaining headroom.',
      type: 'unit',
    },
    {
      name: 'checkCreditLimit: returns ok=false with message when limit would be exceeded',
      what: 'If the new amount would push the customer over their credit limit, ok=false with a human-readable "Credit limit exceeded" message.',
      type: 'unit',
    },
    {
      name: 'checkCreditLimit: returns ok=true when customer fetch fails (fail open)',
      what: 'A DB error fetching the customer row causes the credit check to pass (fail open), avoiding blocking a sale due to a connectivity issue.',
      type: 'unit',
    },
    // ── E2E ──────────────────────────────────────────────────────────────────
    {
      name: 'pos-checkout E2E',
      what: 'Full end-to-end checkout: add items to cart, apply discount, split payment, complete sale, and verify the invoice appears in the sales history.',
      type: 'e2e',
    },
  ],

  sandbox: [
    {
      name: 'sandbox.app_meta.schema_marker is "sandbox"',
      what: 'Confirms the migration seeded the sandbox.app_meta row with schema_marker="sandbox", proving the migration ran and the marker table exists.',
      type: 'integration',
    },
    {
      name: 'reset_all does not change public row counts',
      what: 'Calls sandbox.reset_all() and replays the seed; then asserts public.products, public.customers, and public.invoices have exactly the same row counts as before — the sandbox wipe never touches production data.',
      type: 'integration',
    },
    {
      name: 'seeded sandbox product exists after reset',
      what: 'After a reset+reseed cycle, the fixed-UUID Bluetooth Headphones row (item_code 100001) exists in sandbox.products.',
      type: 'integration',
    },
    {
      name: 'seeded Walk-in Customer exists in sandbox',
      what: 'After reset+reseed, a customer named "Walk-in Customer" exists in sandbox.customers — required for the POS walk-in flow in sandbox mode.',
      type: 'integration',
    },
    {
      name: 'catalog precision contract: every test file is registered in exactly one group',
      what: 'Globs all src/**/*.test.{ts,tsx} files and asserts each appears in exactly one TEST_GROUP\'s vitestFiles. Fails the build if a new test file is added without updating the catalog.',
      type: 'unit',
    },
    {
      name: 'catalog precision contract: every listed vitestFiles path exists on disk',
      what: 'Asserts that every path listed in any TEST_GROUP\'s vitestFiles resolves to a real file, preventing stale catalog entries.',
      type: 'unit',
    },
  ],
};
