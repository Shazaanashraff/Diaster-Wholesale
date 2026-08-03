/**
 * Sandbox catalog — Layer 1 (todo-010), companion to test-groups.ts.
 *
 * One entry per real test today: every `it(...)` in a registered Vitest file,
 * plus one entry per registered E2E flow. Descriptions are plain-English, for
 * an owner who isn't a developer — money in this app is LKR, decimal (no
 * ledger, no bigint minor units).
 */

export interface TestCase {
  name: string;
  what: string;
  type: 'unit' | 'integration' | 'e2e';
}

export const TEST_CASES: Record<string, TestCase[]> = {
  'products-inventory': [
    {
      name: 'receiving a purchase creates a stock batch with received-minus-damaged sellable units',
      what: 'When a container of stock arrives and is marked received, the sellable stock batch is the received amount minus whatever arrived damaged — never the full ordered amount.',
      type: 'integration',
    },
    {
      name: 'a fully damaged receipt (0 sellable) creates no stock batch',
      what: 'If everything in a shipment arrived damaged, no stock batch is created at all — damaged goods are never added to sellable stock.',
      type: 'integration',
    },
    {
      name: 'deduct_stock_fifo consumes the oldest batch first, deleting it once emptied',
      what: 'Selling stock always takes from the oldest delivery first; once a batch is fully sold out it disappears rather than sitting at zero.',
      type: 'integration',
    },
    {
      name: 'deduct_stock_fifo raises "Insufficient stock" and leaves batches unchanged when demand exceeds supply',
      what: 'Trying to sell more than is actually in stock is rejected with a clear error, and no stock is deducted at all — never a partial, silent short-sale.',
      type: 'integration',
    },
  ],
  'payments-cheques': [
    {
      name: 'depositCheque moves a cheque to "processing"',
      what: 'Marking a received cheque as deposited at the bank moves it into "processing".',
      type: 'unit',
    },
    {
      name: 'completeCheque moves a cheque to "completed"',
      what: 'Marking a deposited cheque as cleared moves it into "completed" and settles it against the customer\'s balance.',
      type: 'unit',
    },
    {
      name: 'returnCheque moves a cheque to "returned" (bounced before clearing)',
      what: 'A cheque that bounces before it clears is marked "returned".',
      type: 'unit',
    },
    {
      name: 'reverseChequeToReturned moves a completed cheque back to "returned" (bounced after clearing)',
      what: 'A cheque that bounces after it already cleared is reversed back to "returned", putting the amount back on the customer\'s outstanding balance.',
      type: 'unit',
    },
    {
      name: 'undoChequeDeposit moves a cheque back to "pending"',
      what: 'Accidentally marking a cheque as deposited can be undone, moving it back to "pending" as if it never went to the bank.',
      type: 'unit',
    },
    {
      name: 'representCheque moves a returned cheque back to "processing" (re-presented at the bank)',
      what: 'A bounced cheque that gets re-presented at the bank goes back into "processing".',
      type: 'unit',
    },
    {
      name: 'propagates an invalid-transition rejection from the RPC instead of swallowing it',
      what: 'An invalid cheque status change (e.g. skipping straight from pending to completed) is rejected with a clear error instead of silently doing nothing.',
      type: 'unit',
    },
  ],
  'sales-pos': [
    {
      name: 'floors netTotal / 100',
      what: 'Loyalty points earned are the net sale total divided by 100, rounded down — never up.',
      type: 'unit',
    },
    {
      name: '1 point = LKR 1',
      what: 'Redeeming loyalty points knocks LKR 1 off the bill for every point spent.',
      type: 'unit',
    },
    {
      name: 'returns invoiceId, invoiceNo, and earnedPoints on success',
      what: 'A normal checkout hands back the new invoice ID, a formatted invoice number, and how many loyalty points were earned.',
      type: 'unit',
    },
    {
      name: 'passes wholesale mode to checkout_sale RPC',
      what: 'Ringing up a sale in wholesale mode tells the database this was a wholesale, not retail, sale.',
      type: 'unit',
    },
    {
      name: 'passes retail mode when isWholesale=false',
      what: 'Ringing up a sale in retail mode tells the database this was a retail, not wholesale, sale.',
      type: 'unit',
    },
    {
      name: 'invoice number matches INV-XXXXXX format',
      what: 'Every invoice gets a number in the shape INV-000123, never something else.',
      type: 'unit',
    },
    {
      name: 'sets payment_status "paid" when splits cover the total',
      what: 'If the customer pays the full bill amount, the invoice is marked fully paid.',
      type: 'unit',
    },
    {
      name: 'sets payment_status "partial" when splits partially cover total',
      what: 'If the customer pays part of the bill and the rest goes on their account, the invoice is marked partially paid.',
      type: 'unit',
    },
    {
      name: 'sets payment_status "unpaid" when no payment splits',
      what: 'If the whole bill goes on the customer\'s account with no cash/card/cheque at all, the invoice is marked unpaid.',
      type: 'unit',
    },
    {
      name: 'walk-in customer: skips credit check and returns earnedPoints=0',
      what: 'A walk-in sale with no linked customer never checks a credit limit and never earns loyalty points, since there\'s no account to credit them to.',
      type: 'unit',
    },
    {
      name: 'deducts redemption value from netTotal before computing earnedPoints',
      what: 'Loyalty points earned are calculated on what the customer actually paid after redeeming points, not the pre-redemption sticker total.',
      type: 'unit',
    },
    {
      name: 'clamps netTotal to 0 if redemption value exceeds total',
      what: 'If a customer tries to redeem more points than the bill is worth, the bill floors at LKR 0 — it never goes negative.',
      type: 'unit',
    },
    {
      name: 'throws "Insufficient stock" before calling the RPC when stock is low',
      what: 'If the cart wants more than is in shop stock, checkout stops before the database is ever asked to record the sale.',
      type: 'unit',
    },
    {
      name: 'throws when shop_stock query itself fails',
      what: 'If the app can\'t even read shop stock levels (a database error), checkout fails with a clear "failed to validate stock" message instead of guessing.',
      type: 'unit',
    },
    {
      name: 'treats missing stock row as 0 available',
      what: 'A product with no shop-stock record at all is treated as having zero pieces available, not as "unlimited" or a crash.',
      type: 'unit',
    },
    {
      name: 'skips a cart item with 0 total pieces in stock deduction loop',
      what: 'A cart line with 0 cartons and 0 pieces is simply skipped when deducting stock, instead of erroring or deducting nothing meaningfully twice.',
      type: 'unit',
    },
    {
      name: 'throws "Credit limit exceeded" when outstanding would breach limit',
      what: 'A credit sale that would push a customer\'s outstanding balance over their approved credit limit is rejected before the sale is recorded.',
      type: 'unit',
    },
    {
      name: 'skips credit check for walk-in customer even with outstanding',
      what: 'Walk-in sales (no customer account) never get blocked by a credit-limit check, since there is no account balance to check.',
      type: 'unit',
    },
    {
      name: 'throws "Checkout failed" when checkout_sale RPC returns an error',
      what: 'If the database rejects the sale (e.g. a duplicate invoice number), the cashier sees a clear "checkout failed" error with the underlying reason.',
      type: 'unit',
    },
    {
      name: 'calls deduct_stock_from_batch when item has a batchId',
      what: 'When a cart line was picked from a specific batch, stock is deducted from that exact batch, not from general shop stock.',
      type: 'unit',
    },
    {
      name: 'calls deduct_stock_fifo when item has no batchId',
      what: 'When a cart line has no specific batch attached, stock is deducted oldest-first (FIFO) from shop stock.',
      type: 'unit',
    },
    {
      name: 'throws when deduct_stock_fifo returns an error (no longer silently swallowed)',
      what: 'If deducting FIFO stock fails partway through, the whole checkout fails loudly instead of quietly recording a sale with stock left unadjusted.',
      type: 'unit',
    },
    {
      name: 'throws when deduct_stock_from_batch returns an error',
      what: 'If deducting stock from a specific batch fails, the whole checkout fails loudly instead of silently recording a sale with the wrong stock left behind.',
      type: 'unit',
    },
    {
      name: 'calls deduct_stock_fifo once per unique item in cart',
      what: 'A cart with several different products deducts stock separately for each product, once each — not merged, not skipped.',
      type: 'unit',
    },
    {
      name: 'filters out zero-amount splits before passing to RPC',
      what: 'A payment method left at LKR 0 (e.g. an unused card field) is dropped before the sale is recorded, so the invoice never lists a payment of nothing.',
      type: 'unit',
    },
    {
      name: 'passes all payment splits correctly including cheque fields',
      what: 'Splitting a bill across cash and cheque records both payments, keeping the cheque number and bank name attached to the cheque portion.',
      type: 'unit',
    },
    {
      name: 'returns ok=true when credit is available',
      what: 'Checking a customer\'s credit limit says "ok" and reports how much headroom is left when they\'re well within their limit.',
      type: 'unit',
    },
    {
      name: 'returns ok=false with message when limit would be exceeded',
      what: 'Checking a customer\'s credit limit says "not ok" with an explanation when a sale would push them over their limit.',
      type: 'unit',
    },
    {
      name: 'returns ok=true when customer fetch fails (fail open)',
      what: 'If the customer\'s account can\'t be looked up at all, the credit check fails open (allows the sale) rather than blocking a cashier over a lookup glitch.',
      type: 'unit',
    },
    {
      name: 'POS checkout flow',
      what: 'Opens the real POS screen in Electron, adds a product to the cart, completes a sale, and checks the success modal, error states (RPC failure, insufficient stock), and cart-clearing all behave correctly end-to-end.',
      type: 'e2e',
    },
  ],
  'customers-credit': [
    {
      name: 'allows a sale that keeps outstanding + total within the limit',
      what: 'A sale that keeps a customer\'s total owed within their approved credit limit goes through.',
      type: 'unit',
    },
    {
      name: 'blocks a sale that would push outstanding + total over the limit',
      what: 'A sale that would push a customer\'s total owed past their approved credit limit is blocked.',
      type: 'unit',
    },
    {
      name: 'allows a sale that lands exactly on the limit',
      what: 'A sale that brings a customer\'s balance to exactly their credit limit (not over it) is still allowed.',
      type: 'unit',
    },
    {
      name: 'treats a credit_limit of 0 or negative as unlimited — never blocks',
      what: 'A customer with no credit limit set (0, or a negative value) is never blocked from a credit sale.',
      type: 'unit',
    },
    {
      name: 'a credit sale increases outstanding_balance by exactly the credit portion',
      what: 'Putting part of a sale on a customer\'s account increases what they owe by exactly that amount, verified against the sandbox database.',
      type: 'integration',
    },
    {
      name: 'a cash payment decreases outstanding_balance by the paid amount',
      what: 'A cash or bank payment reduces what a customer owes by exactly the amount paid, verified against the sandbox database.',
      type: 'integration',
    },
    {
      name: 'a payment larger than the outstanding balance clamps outstanding_balance at 0, never negative',
      what: 'Overpaying never leaves a customer with a negative balance — it floors at zero, verified against the sandbox database.',
      type: 'integration',
    },
    {
      name: 'a sale followed by a full payment nets the balance back to its starting point',
      what: 'Selling on credit and then paying that exact amount back leaves the customer\'s balance unchanged overall, verified against the sandbox database.',
      type: 'integration',
    },
  ],
  sandbox: [
    {
      name: 'reset_all() + reseed never changes public row counts',
      what: 'Resetting and reseeding the sandbox schema never adds, removes, or changes a single row in the real (public) product, customer, or invoice tables.',
      type: 'integration',
    },
    {
      name: 'sandbox marker is set and a seeded sandbox product exists',
      what: 'After seeding, the sandbox schema is clearly marked as "sandbox" (not "public"), and the known seeded test product is present.',
      type: 'integration',
    },
    {
      name: 'every src/**/*.test.{ts,tsx} file is listed in exactly one group',
      what: 'Every automated test file in the codebase is registered in the Sandbox catalog under exactly one feature group — never missing, never duplicated.',
      type: 'unit',
    },
    {
      name: 'every vitestFiles path in TEST_GROUPS resolves to a real file',
      what: 'Every test file the catalog claims to cover a feature actually exists on disk — the catalog can\'t point at a file that was deleted or renamed.',
      type: 'unit',
    },
    {
      name: 'every non-null e2e entry resolves to e2e/<name>.spec.ts',
      what: 'Every E2E flow the catalog lists actually has a matching Playwright spec file on disk.',
      type: 'unit',
    },
  ],
};
