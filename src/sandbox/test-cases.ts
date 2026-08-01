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
      name: 'GRN receiving creates a stock batch sized received-minus-damaged, split into cartons/loose',
      what: 'Receiving a shipment records only the sellable units (received minus damaged) as new stock, correctly split into full cartons and loose pieces.',
      type: 'integration',
    },
    {
      name: 'a GRN line fully written off as damaged never creates a stock batch',
      what: 'If every unit in a shipment line is marked damaged, no stock is added at all — nothing sellable came in.',
      type: 'integration',
    },
    {
      name: 're-updating an already-received purchase does not create a duplicate batch',
      what: 'Touching an already-received purchase again (e.g. editing its notes) never receives the stock a second time.',
      type: 'integration',
    },
    {
      name: 'sold units deduct from remaining stock FIFO across batches, oldest received first',
      what: 'Selling stock always eats into the oldest-received batch first, spilling into the next batch only once the oldest one runs out.',
      type: 'integration',
    },
    {
      name: 'deducting 0 units is a no-op',
      what: 'A sale of zero units never touches stock levels at all.',
      type: 'integration',
    },
    {
      name: 'deducting more than available raises "Insufficient stock" naming the exact shortfall',
      what: 'Trying to sell more than is in stock fails with the exact number of units short, and leaves the stock untouched rather than partially deducting.',
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
  'refunds-returns': [
    {
      name: 'a full return against an unpaid invoice releases the entire amount from outstanding_balance',
      what: 'Returning everything on a credit sale wipes out exactly what that sale added to the customer\'s account balance — no more, no less.',
      type: 'integration',
    },
    {
      name: 'a partial return releases only the returned portion, leaving the rest outstanding',
      what: 'Returning some (not all) of a credit sale only releases the value of what came back; the rest is still owed.',
      type: 'integration',
    },
    {
      name: 'restore_stock_pieces adds a new stock batch sized to the returned cartons/pieces',
      what: 'Stock coming back from a customer return is added back as a new batch, sized exactly to what was returned.',
      type: 'integration',
    },
    {
      name: 'restore_stock_pieces with 0/0 is a no-op — no batch row is created',
      what: 'A "return" of nothing (0 cartons, 0 pieces) never creates a stock batch out of thin air.',
      type: 'integration',
    },
    {
      name: 'create_sales_return_atomic computes the refund_amount as unit_price × returned pieces and leaves the return Pending',
      what: 'Filing a return correctly totals the refund owed from the price and quantity returned, and leaves it as Pending until someone resolves it.',
      type: 'integration',
    },
    {
      name: 'create_sales_return_atomic rejects a return item that does not belong to the original invoice',
      what: 'A return can\'t claim to be returning a line item that was never actually on the invoice it\'s filed against.',
      type: 'integration',
    },
    {
      name: 'create_sales_return_atomic rejects a missing original_invoice_id',
      what: 'A return can\'t be filed at all without saying which invoice it\'s against.',
      type: 'integration',
    },
    {
      name: 'create_sales_return_atomic rejects an invoice that does not exist',
      what: 'A return filed against an invoice ID that isn\'t real is rejected, not silently accepted.',
      type: 'integration',
    },
  ],
  'payments-cheques': [
    {
      name: 'records a cheque payment via record_payment_atomic with all cheque fields',
      what: 'Recording a cheque payment sends the bank name, cheque number, and due date through to the database untouched.',
      type: 'unit',
    },
    {
      name: 'defaults optional cheque fields to empty strings when omitted',
      what: 'A cash payment with no bank/cheque details never sends missing/undefined fields to the database — they default cleanly to blank.',
      type: 'unit',
    },
    {
      name: 'throws when the RPC errors',
      what: 'If the database rejects a payment, the app surfaces that failure instead of pretending it succeeded.',
      type: 'unit',
    },
    {
      name: 'depositCheque: pending → processing',
      what: 'Marking a cheque as deposited at the bank moves it from received to processing.',
      type: 'unit',
    },
    {
      name: 'completeCheque: processing → completed',
      what: 'Marking a cheque as cleared moves it from processing to completed.',
      type: 'unit',
    },
    {
      name: 'returnCheque: processing → returned (bounced)',
      what: 'Marking a cheque as bounced before it cleared moves it from processing to returned.',
      type: 'unit',
    },
    {
      name: 'reverseChequeToReturned: completed → returned (bounced after clearing)',
      what: 'A cheque that bounces after already being marked cleared can be reversed back to returned.',
      type: 'unit',
    },
    {
      name: 'undoChequeDeposit: processing → pending (undo an accidental deposit click)',
      what: 'An accidental "mark as deposited" click can be undone, putting the cheque back to received.',
      type: 'unit',
    },
    {
      name: 'representCheque: returned → processing (re-presented at the bank)',
      what: 'A bounced cheque that\'s being re-presented at the bank moves back from returned to processing.',
      type: 'unit',
    },
    {
      name: 'propagates the DB\'s "Invalid cheque transition" error when the transition is out of order',
      what: 'Trying to move a cheque through its stages out of order (e.g. straight from received to cleared) fails with a specific, exact error instead of silently succeeding.',
      type: 'unit',
    },
    {
      name: 'propagates "Payment not found" for an unknown payment id',
      what: 'Acting on a cheque payment that doesn\'t exist fails with a clear "not found" error.',
      type: 'unit',
    },
    {
      name: 'propagates "not a cheque payment" when acting on a cash/bank_transfer payment',
      what: 'Trying to walk a cash or bank-transfer payment through the cheque lifecycle is rejected — that lifecycle only applies to actual cheques.',
      type: 'unit',
    },
  ],
  'customers-credit': [
    {
      name: 'calls the RPC with the exact signed delta, reason, and adjuster',
      what: 'A manual balance correction sends the database the exact amount, reason, and who made the change — nothing altered along the way.',
      type: 'unit',
    },
    {
      name: 'passes a positive delta through unchanged for an increase',
      what: 'Correcting a balance upward sends a positive amount through exactly as entered.',
      type: 'unit',
    },
    {
      name: 'throws when the RPC returns an error',
      what: 'If the database rejects a manual balance correction (e.g. no reason given), the app surfaces that failure instead of pretending it worked.',
      type: 'unit',
    },
    {
      name: 'an unpaid sale followed by a full payment nets outstanding_balance back to 0',
      what: 'A sale on credit followed by paying it off in full leaves the customer owing exactly nothing.',
      type: 'integration',
    },
    {
      name: 'an overpayment clamps outstanding_balance at 0, never negative',
      what: 'Paying more than a customer owes never leaves their account balance negative — it floors at zero.',
      type: 'integration',
    },
    {
      name: 'adjust_customer_outstanding on an unknown customer raises "Customer ... not found"',
      what: 'Trying to adjust a balance for a customer that doesn\'t exist fails clearly instead of silently doing nothing.',
      type: 'integration',
    },
    {
      name: 'the credit-limit rule is NOT enforced at the database layer — outstanding_balance can exceed credit_limit',
      what: 'The database itself will let a customer\'s balance go over their credit limit — that check only happens in the POS screen before a sale, confirmed directly against the real schema.',
      type: 'integration',
    },
    {
      name: 'adjust_customer_outstanding_manual rejects an empty reason',
      what: 'An admin can\'t manually adjust a customer\'s balance without typing a reason.',
      type: 'integration',
    },
    {
      name: 'adjust_customer_outstanding_manual rejects a zero delta',
      what: 'An admin can\'t "adjust" a balance by zero — that\'s not an adjustment.',
      type: 'integration',
    },
    {
      name: 'adjust_customer_outstanding_manual on an unknown customer raises "Customer ... not found"',
      what: 'Trying to manually adjust a customer that doesn\'t exist fails clearly.',
      type: 'integration',
    },
    {
      name: 'BUG: adjust_customer_outstanding_manual with valid input always fails',
      what: 'A known, currently-shipped defect: even a well-formed manual balance adjustment fails outright, because the database function tries to record it as a payment with no invoice attached, which the payments table doesn\'t allow.',
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
