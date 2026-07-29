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
      name: 'rejects receiving more units than were ordered',
      what: 'Trying to mark more units as received than were originally ordered is refused before anything is saved.',
      type: 'unit',
    },
    {
      name: 'rejects more damaged units than received units',
      what: 'Trying to log more damaged units than the total units received on that line is refused before anything is saved.',
      type: 'unit',
    },
    {
      name: 'inserts one purchase_receive row per item and marks the purchase "received" on success',
      what: 'Confirming a good receive records each product line and flips the purchase order to "received".',
      type: 'unit',
    },
    {
      name: 'rejects the whole batch if any single item fails validation, even when others are valid',
      what: 'If even one product line in a receive is invalid, none of the lines are saved — it\'s all or nothing.',
      type: 'unit',
    },
    {
      name: 'throws the underlying database error message when the purchase_receive insert fails',
      what: 'If saving the receive fails in the database, the real reason is shown instead of a generic failure.',
      type: 'unit',
    },
    {
      name: 'computes total_rmb as the sum of quantity_units * unit_price_rmb across items',
      what: 'A new purchase order\'s total in RMB is the sum of every line\'s quantity times its unit price.',
      type: 'unit',
    },
    {
      name: 'throws when generate_purchase_reference RPC returns an error, without inserting the purchase',
      what: 'If the database can\'t generate a PO reference number, no purchase order is created.',
      type: 'unit',
    },
    {
      name: 'throws when the purchase_items insert fails after the purchase row was created',
      what: 'If a purchase order\'s line items fail to save after the order itself was created, the failure surfaces clearly.',
      type: 'unit',
    },
    {
      name: 'receiving a PO adds a stock_batches row (received - damaged), and deduct_stock_fifo consumes it correctly',
      what: 'Against a real sandbox database: receiving a PO adds exactly the sellable stock (received minus damaged, split into full cartons and loose pieces), a sale eats into that stock oldest-batch-first down to the exact right amount, and trying to sell more than remains is rejected instead of letting stock go negative.',
      type: 'integration',
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
  'payments-cheques': [
    {
      name: 'depositCheque moves pending -> processing',
      what: 'Depositing a cheque at the bank moves it from "pending" to "processing".',
      type: 'unit',
    },
    {
      name: 'completeCheque moves processing -> completed',
      what: 'Marking a deposited cheque as cleared moves it from "processing" to "completed".',
      type: 'unit',
    },
    {
      name: 'returnCheque moves processing -> returned (bounced before clearing)',
      what: 'A cheque that bounces while still at the bank moves from "processing" to "returned".',
      type: 'unit',
    },
    {
      name: 'reverseChequeToReturned moves completed -> returned (bounced after clearing)',
      what: 'A cheque that bounces after it had already been marked cleared is reversed to "returned".',
      type: 'unit',
    },
    {
      name: 'undoChequeDeposit moves processing -> pending',
      what: 'Undoing an accidental "deposit" click moves a cheque back from "processing" to "pending".',
      type: 'unit',
    },
    {
      name: 'representCheque moves returned -> processing (re-presented at the bank)',
      what: 'Re-presenting a bounced cheque at the bank moves it from "returned" back to "processing".',
      type: 'unit',
    },
    {
      name: 'propagates an invalid-transition rejection from the DB unchanged (e.g. pending -> completed)',
      what: 'If a cheque status change skips a required step (like jumping straight from "pending" to "completed"), the database\'s rejection reason is shown as-is.',
      type: 'unit',
    },
    {
      name: 'propagates a "not a cheque payment" rejection from the DB unchanged',
      what: 'Trying to change the cheque status of a payment that was never a cheque is rejected with a clear reason.',
      type: 'unit',
    },
  ],
  'customers-credit': [
    {
      name: 'calls record_payment_atomic with the customer, invoice, amount, and method',
      what: 'Recording a customer payment sends the customer, invoice, amount, and payment method to the database exactly as entered.',
      type: 'unit',
    },
    {
      name: 'passes a null invoice_id through unchanged for a general (no-invoice) payment',
      what: 'A payment that isn\'t tied to a specific invoice is recorded as a general payment against the customer\'s account, not forced onto an invoice.',
      type: 'unit',
    },
    {
      name: 'carries bank_name, cheque_number, and due_date through for a cheque payment',
      what: 'A cheque payment keeps its bank name, cheque number, and due date attached when it\'s recorded.',
      type: 'unit',
    },
    {
      name: 'throws when the RPC returns an error, leaving the outstanding balance untouched',
      what: 'If recording a payment fails (e.g. an invalid amount), nothing is applied to the customer\'s outstanding balance.',
      type: 'unit',
    },
    {
      name: 'calls the RPC with the exact signed delta, reason, and adjuster',
      what: 'An admin\'s manual balance correction sends the exact amount, reason, and admin name to the database.',
      type: 'unit',
    },
    {
      name: 'passes a positive delta through unchanged for an increase',
      what: 'An admin correction that increases what a customer owes is sent to the database as a positive amount, unchanged.',
      type: 'unit',
    },
    {
      name: 'throws when the RPC returns an error',
      what: 'If an admin tries to adjust a balance without a valid reason, the database\'s rejection is shown to them.',
      type: 'unit',
    },
  ],
};
