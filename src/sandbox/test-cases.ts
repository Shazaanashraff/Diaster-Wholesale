export interface TestCase {
  name: string;
  what: string;
  type: 'unit' | 'e2e' | 'integration';
}

export const TEST_CASES: Record<string, TestCase[]> = {
  'sales-pos': [
    {
      name: 'computeLoyaltyEarned — floors netTotal / 100',
      what: 'Every LKR 100 spent earns exactly 1 loyalty point; partial hundreds are dropped (LKR 1099 earns 10, not 11).',
      type: 'unit',
    },
    {
      name: 'computeRedemptionValue — 1 point = LKR 1',
      what: '250 loyalty points deducted from a checkout reduce the total by LKR 250.',
      type: 'unit',
    },
    {
      name: 'returns invoiceId, invoiceNo, and earnedPoints on success',
      what: 'A successful checkout returns a UUID invoice ID, an INV-XXXXXX formatted number, and the correct loyalty points earned.',
      type: 'unit',
    },
    {
      name: 'passes wholesale mode to checkout_sale RPC',
      what: 'When isWholesale=true, the RPC receives p_mode="wholesale" so wholesale pricing and stock rules apply.',
      type: 'unit',
    },
    {
      name: 'passes retail mode when isWholesale=false',
      what: 'When isWholesale=false, the RPC receives p_mode="retail" so retail pricing applies.',
      type: 'unit',
    },
    {
      name: 'invoice number matches INV-XXXXXX format',
      what: 'The generated invoice number always matches the pattern INV- followed by exactly 6 digits.',
      type: 'unit',
    },
    {
      name: 'sets payment_status "paid" when splits cover the total',
      what: 'When payment amount equals the invoice total, the invoice is recorded as fully paid.',
      type: 'unit',
    },
    {
      name: 'sets payment_status "partial" when splits partially cover total',
      what: 'When less than the full amount is paid upfront, the invoice is marked partial and the balance stays outstanding.',
      type: 'unit',
    },
    {
      name: 'sets payment_status "unpaid" when no payment splits',
      what: 'A sale with no payment at all is recorded as unpaid — the full total is added to the outstanding balance.',
      type: 'unit',
    },
    {
      name: 'walk-in customer: skips credit check and returns earnedPoints=0',
      what: 'Walk-in customers (null customerId) bypass credit limit checks and do not accumulate loyalty points.',
      type: 'unit',
    },
    {
      name: 'deducts redemption value from netTotal before computing earnedPoints',
      what: 'Redeeming 200 points (LKR 200) on a LKR 1200 sale calculates earned points on the net LKR 1000, not the gross total.',
      type: 'unit',
    },
    {
      name: 'clamps netTotal to 0 if redemption value exceeds total',
      what: 'If redeemed points exceed the sale total, the net total is clamped to LKR 0 and no points are earned — the customer cannot go negative.',
      type: 'unit',
    },
    {
      name: 'throws "Insufficient stock" before calling the RPC when stock is low',
      what: 'If the cart wants more pieces than are in shop stock, checkout stops immediately — the database is never asked to record a sale that cannot be fulfilled.',
      type: 'unit',
    },
    {
      name: 'throws when shop_stock query itself fails',
      what: 'A database error while reading stock levels surfaces as "Failed to validate stock" rather than silently selling phantom inventory.',
      type: 'unit',
    },
    {
      name: 'treats missing stock row as 0 available',
      what: 'A product with no stock record is treated as having zero stock — not as infinitely available.',
      type: 'unit',
    },
    {
      name: 'skips a cart item with 0 total pieces in stock deduction loop',
      what: 'A cart item where both cartons and pieces are 0 is silently skipped — no FIFO deduction call is made for it.',
      type: 'unit',
    },
    {
      name: 'throws "Credit limit exceeded" when outstanding would breach limit',
      what: 'When adding an unpaid invoice would push a customer past their credit limit, checkout is blocked before any database write.',
      type: 'unit',
    },
    {
      name: 'skips credit check for walk-in customer even with outstanding',
      what: 'Walk-in customers have no credit account, so the credit-limit check is completely bypassed.',
      type: 'unit',
    },
    {
      name: 'throws "Checkout failed" when checkout_sale RPC returns an error',
      what: 'A database-level error from the checkout_sale RPC (e.g. unique constraint) is surfaced as a user-readable "Checkout failed" message.',
      type: 'unit',
    },
    {
      name: 'calls deduct_stock_from_batch when item has a batchId',
      what: 'When a cart item specifies a batchId, stock is deducted from that exact batch rather than through FIFO.',
      type: 'unit',
    },
    {
      name: 'calls deduct_stock_fifo when item has no batchId',
      what: 'When no specific batch is selected, stock is deducted using FIFO (oldest batch first).',
      type: 'unit',
    },
    {
      name: 'throws when deduct_stock_fifo returns an error',
      what: 'A FIFO deduction failure raises an error — it is no longer silently swallowed, preventing ghost stock.',
      type: 'unit',
    },
    {
      name: 'throws when deduct_stock_from_batch returns an error',
      what: 'A batch-specific deduction failure raises an error and aborts the checkout.',
      type: 'unit',
    },
    {
      name: 'calls deduct_stock_fifo once per unique item in cart',
      what: 'A multi-item cart triggers one FIFO deduction per line item — two products produce two separate calls with the correct unit counts.',
      type: 'unit',
    },
    {
      name: 'filters out zero-amount splits before passing to RPC',
      what: 'A payment split with amount=0 is dropped before the RPC is called — only real payments are recorded.',
      type: 'unit',
    },
    {
      name: 'passes all payment splits correctly including cheque fields',
      what: 'A split payment including a cheque carries cheque_number and bank_name through to the RPC with no fields dropped.',
      type: 'unit',
    },
    {
      name: 'checkCreditLimit — returns ok=true when credit is available',
      what: 'Given LKR 10 000 limit and LKR 2 000 outstanding, the standalone credit-check returns ok=true with LKR 8 000 available.',
      type: 'unit',
    },
    {
      name: 'checkCreditLimit — returns ok=false with message when limit would be exceeded',
      what: 'A customer with only LKR 500 headroom trying to charge LKR 2 000 gets ok=false and a "Credit limit exceeded" message.',
      type: 'unit',
    },
    {
      name: 'checkCreditLimit — returns ok=true when customer fetch fails (fail open)',
      what: 'If the customer record cannot be fetched, credit check fails open (ok=true) so a network hiccup does not block a legitimate sale.',
      type: 'unit',
    },
    {
      name: 'pos-checkout E2E flow',
      what: 'Full end-to-end checkout through the POS screen against the live sandbox schema: add items, select customer, submit payment, verify invoice created.',
      type: 'e2e',
    },
  ],

  sandbox: [
    {
      name: 'sandbox isolation — reset_all() leaves public tables untouched',
      what: 'Running sandbox.reset_all() followed by the baseline seed does not change any row count in the public schema — the function is structurally prevented from touching production data.',
      type: 'integration',
    },
    {
      name: 'sandbox isolation — schema_marker is "sandbox"',
      what: 'sandbox.app_meta.schema_marker returns "sandbox", confirming the identity marker is present and correct after every migration apply.',
      type: 'integration',
    },
    {
      name: 'sandbox isolation — seeded product exists after reset',
      what: 'After reset_all() and seed replay, the fixed-UUID product b1000000-...-000000000001 exists in sandbox.products, confirming the seed executed and committed.',
      type: 'integration',
    },
    {
      name: 'test catalog precision contract — every test file is in exactly one group',
      what: "The test catalog is exhaustive: every *.test.{ts,tsx} under src/ belongs to exactly one group. A new file not yet registered here causes this test to fail, keeping the Sandbox screen's catalog current.",
      type: 'unit',
    },
    {
      name: 'test catalog precision contract — every listed path exists on disk',
      what: 'Every path in vitestFiles actually exists on disk. A renamed or deleted test file still in the catalog causes this test to fail.',
      type: 'unit',
    },
  ],
};
