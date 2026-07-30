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
  'products-inventory': [
    {
      name: 'receiving a GRN creates a stock batch sized to received-minus-damaged units',
      what: 'When a container of stock arrives and is marked received, the sellable amount added to stock is what actually arrived minus whatever was damaged — never the full ordered amount.',
      type: 'integration',
    },
    {
      name: 'a fully-damaged GRN line adds zero stock (sellable floors at 0, never negative)',
      what: 'If every unit in a delivery line was damaged, nothing is added to sellable stock — it never goes negative or adds phantom stock.',
      type: 'integration',
    },
    {
      name: 'selling deducts stock FIFO, oldest batch first, across multiple GRNs',
      what: 'When two containers of the same product have arrived on different days, a sale eats into the oldest delivery first before touching the newer one.',
      type: 'integration',
    },
    {
      name: 'selling more than available raises a specific "Insufficient stock" error',
      what: 'Trying to sell more units than are actually in stock is rejected with a specific error naming exactly how many units are short, and leaves existing stock untouched.',
      type: 'integration',
    },
  ],
  'payments-cheques': [
    {
      name: 'received: recordPayment with method "cheque" carries the cheque details',
      what: 'Recording a customer\'s cheque payment keeps the bank name, cheque number, and due date attached to it from the moment it\'s received.',
      type: 'unit',
    },
    {
      name: 'deposited: depositCheque moves pending -> processing',
      what: 'Taking a received cheque to the bank marks it as "processing" — on its way to clearing.',
      type: 'unit',
    },
    {
      name: 'cleared: completeCheque moves processing -> completed',
      what: 'When a deposited cheque clears at the bank, it\'s marked "completed" and the customer\'s account is credited.',
      type: 'unit',
    },
    {
      name: 'bounced: returnCheque moves processing -> returned',
      what: 'When a deposited cheque bounces, it\'s marked "returned" instead of completed.',
      type: 'unit',
    },
    {
      name: 'bounced after clearing: reverseChequeToReturned also requests "returned"',
      what: 'A cheque that bounces after already being marked cleared can still be flipped back to "returned", reversing the credit it gave the customer.',
      type: 'unit',
    },
    {
      name: 'undo: undoChequeDeposit moves processing back to pending',
      what: 'An accidental "deposit" click can be undone, putting the cheque back to square one.',
      type: 'unit',
    },
    {
      name: 're-present: representCheque moves returned back to processing',
      what: 'A bounced cheque can be re-presented at the bank a second time, putting it back into processing.',
      type: 'unit',
    },
    {
      name: 'invalid transition (e.g. completing a cheque still pending) rejects with the DB\'s specific error',
      what: 'Trying to clear a cheque that was never deposited is rejected with a specific "invalid transition" error instead of silently succeeding.',
      type: 'unit',
    },
    {
      name: 'invalid transition (depositing a payment that is not a cheque) rejects with a specific error',
      what: 'Trying to "deposit" a cash or card payment (which was never a cheque) is rejected with a specific error naming the payment.',
      type: 'unit',
    },
  ],
  'customers-credit': [
    {
      name: 'calls record_payment_atomic with the customer, invoice, amount, and method',
      what: 'Recording a cash payment against an invoice records exactly that customer, that invoice, that amount, and the cash method — nothing more, nothing less.',
      type: 'unit',
    },
    {
      name: 'passes bank_name, cheque_number, and due_date through for a cheque payment',
      what: 'A cheque payment keeps its bank name, cheque number, and due date attached when it\'s recorded.',
      type: 'unit',
    },
    {
      name: 'records a walk-in payment with no invoice as p_invoice_id: null',
      what: 'A payment not tied to any specific invoice (e.g. a general account payment) is recorded with no invoice attached, not a made-up one.',
      type: 'unit',
    },
    {
      name: 'throws when the RPC returns an error',
      what: 'If the database rejects a payment (e.g. a negative amount), the person recording it sees the real reason instead of it looking like it worked.',
      type: 'unit',
    },
    {
      name: 'combines invoices and payments for the customer',
      what: 'A customer\'s ledger shows both everything they\'ve been invoiced and every payment they\'ve made, pulled together in one place.',
      type: 'unit',
    },
    {
      name: 'throws when the invoices query fails, without touching payments',
      what: 'If a customer\'s invoice history can\'t be loaded, their ledger fails loudly rather than showing a payment history next to a blank, misleading invoice list.',
      type: 'unit',
    },
    {
      name: 'throws when the payments query fails even if invoices succeeded',
      what: 'If a customer\'s payment history can\'t be loaded, their ledger fails loudly rather than showing invoices next to a blank, misleading payment list.',
      type: 'unit',
    },
    {
      name: 'calls the RPC with the exact signed delta, reason, and adjuster',
      what: 'An admin\'s manual correction to a customer\'s balance records the exact amount, the reason given, and which admin made it.',
      type: 'unit',
    },
    {
      name: 'passes a positive delta through unchanged for an increase',
      what: 'A manual correction that increases what a customer owes is recorded as a positive amount, not silently flipped.',
      type: 'unit',
    },
    {
      name: 'throws when the RPC returns an error',
      what: 'A manual balance correction with no reason given is rejected by the database, and the admin sees exactly why.',
      type: 'unit',
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
