import { supabase } from '../lib/supabase';
import type { Product } from '../types';
import {
  saveOfflineSale,
  syncPendingSales,
  getPendingCount,
  type OfflineSale,
} from './offlineService';

export interface CartItem {
  product: Product;
  quantityCartons: number;
  quantityPieces: number;
  batchId?: string;
  unitPrice?: number;
  lineDiscount?: number;
}

export interface PaymentSplit {
  method: 'cash' | 'card' | 'cheque' | 'online' | 'bank_transfer';
  amount: number;
  bank_name?: string;
  cheque_number?: string;
  due_date?: string;
}

export interface LoyaltyOptions {
  redeemPoints: number;   // points to redeem (0 = none)
  earnedPoints?: number;  // computed by service after checkout
}

// ─── Stock validation ─────────────────────────────────────────────────────────

async function validateStock(cart: CartItem[]): Promise<void> {
  const productIds = [...new Set(cart.map(i => i.product.id))];

  // shop_stock only shows stock physically transferred to the shop.
  // Warehouse stock is invisible to POS until a Stock Transfer is approved.
  const { data: stockRows, error } = await supabase
    .from('shop_stock')
    .select('product_id, pieces_per_carton, cartons_in, pieces_in, cartons_sold, pieces_sold, carton_adj, piece_adj')
    .in('product_id', productIds);

  if (error) throw new Error(`Failed to validate stock: ${error.message}`);

  const stockMap = new Map<string, number>(
    ((stockRows ?? []) as Array<{
      product_id: string; pieces_per_carton: number;
      cartons_in: number; pieces_in: number;
      cartons_sold: number; pieces_sold: number;
      carton_adj: number; piece_adj: number;
    }>).map(r => {
      const ppc = r.pieces_per_carton || 1;
      const avail = Math.max(0,
        r.cartons_in * ppc + r.pieces_in
        - r.cartons_sold * ppc - r.pieces_sold
        + r.carton_adj * ppc + r.piece_adj
      );
      return [r.product_id, avail];
    })
  );

  for (const item of cart) {
    const ppc = item.product.pieces_per_carton || 1;
    const needed = item.quantityCartons * ppc + item.quantityPieces;
    const avail = stockMap.get(item.product.id) ?? 0;
    if (needed > avail) {
      throw new Error(`Insufficient stock for ${item.product.name}. Needed ${needed}, available ${avail}.`);
    }
  }
}

// ─── Credit limit check ───────────────────────────────────────────────────────

export async function checkCreditLimit(
  customerId: string,
  _saleTotal: number,
  creditAmount: number
): Promise<{ ok: boolean; available: number; limit: number; message?: string }> {
  const { data, error } = await supabase
    .from('customers')
    .select('credit_limit, outstanding_balance')
    .eq('id', customerId)
    .single();

  if (error || !data) return { ok: true, available: 0, limit: 0 };

  const limit = Number(data.credit_limit);
  const used = Number(data.outstanding_balance);
  const available = Math.max(0, limit - used);

  if (creditAmount > available) {
    return {
      ok: false,
      available,
      limit,
      message: `Credit limit exceeded. Available: LKR ${available.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`,
    };
  }
  return { ok: true, available, limit };
}

// ─── Loyalty helpers ──────────────────────────────────────────────────────────

export function computeLoyaltyEarned(netTotal: number): number {
  return Math.floor(netTotal / 100);
}

export function computeRedemptionValue(points: number): number {
  return points; // 1 point = LKR 1
}

export async function getCustomerLoyalty(
  customerId: string
): Promise<{ points: number; totalEarned: number; totalRedeemed: number }> {
  const { data } = await supabase
    .from('customers')
    .select('loyalty_points, total_loyalty_earned, total_loyalty_redeemed')
    .eq('id', customerId)
    .single();

  return {
    points: Number(data?.loyalty_points ?? 0),
    totalEarned: Number(data?.total_loyalty_earned ?? 0),
    totalRedeemed: Number(data?.total_loyalty_redeemed ?? 0),
  };
}

// ─── Main checkout (online) ───────────────────────────────────────────────────

export const checkout = async (
  cart: CartItem[],
  customerId: string | null,
  isWholesale: boolean,
  subtotal: number,
  discount: number,
  total: number,
  paymentSplits: PaymentSplit[],   // empty = full credit / unpaid
  loyalty?: LoyaltyOptions,
  salespersonId?: string
): Promise<{ invoiceId: string; invoiceNo: string; earnedPoints: number }> => {
  // Stock validation
  await validateStock(cart);

  const totalPaid = paymentSplits.reduce((s, p) => s + p.amount, 0);
  const outstandingAmount = total - totalPaid;

  if (outstandingAmount > 0 && customerId) {
    const check = await checkCreditLimit(customerId, total, outstandingAmount);
    if (!check.ok) throw new Error(check.message!);
  }

  // Loyalty redemption deducted from total
  const redeemPoints = loyalty?.redeemPoints ?? 0;
  const redemptionValue = computeRedemptionValue(redeemPoints);
  const netTotal = Math.max(0, total - redemptionValue);
  const earnedPoints = computeLoyaltyEarned(netTotal);

  // Payment status
  const paymentStatus: 'paid' | 'partial' | 'unpaid' =
    paymentSplits.length === 0 ? 'unpaid'
    : totalPaid >= total       ? 'paid'
    : totalPaid > 0            ? 'partial'
                               : 'unpaid';

  // Invoice number
  const invoiceNo = `INV-${Math.floor(100000 + Math.random() * 900000)}`;

  // 1. Insert invoice
  const { data: invoiceData, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      invoice_no: invoiceNo,
      customer_id: customerId,
      mode: isWholesale ? 'wholesale' : 'retail',
      subtotal,
      discount,
      total: netTotal,
      payment_status: paymentStatus,
      salesperson_id: salespersonId || null,
    })
    .select('id')
    .single();

  if (invoiceError) throw new Error(`Failed to create invoice: ${invoiceError.message}`);
  const invoiceId = invoiceData.id;

  // 2. Insert invoice items
  const invoiceItems = cart.map(item => {
    const basePrice = Number(
      item.unitPrice ?? (isWholesale ? item.product.wholesale_price : item.product.retail_price)
    );
    const effectivePrice = Math.max(0, basePrice - (item.lineDiscount ?? 0));
    const ppc = item.product.pieces_per_carton || 1;
    const totalPieces = item.quantityCartons * ppc + item.quantityPieces;
    return {
      invoice_id: invoiceId,
      product_id: item.product.id,
      cartons: item.quantityCartons,
      pieces: item.quantityPieces,
      unit_price: basePrice,               // sale price before line discount — allows invoice modal to derive discount
      total: effectivePrice * totalPieces, // actual amount charged
      batch_id: item.batchId || null,
    };
  });

  const { error: itemsError } = await supabase.from('invoice_items').insert(invoiceItems);
  if (itemsError) throw new Error(`Failed to create invoice items: ${itemsError.message}`);

  // 3. Payment rows
  for (const split of paymentSplits) {
    if (split.amount <= 0) continue;
    const { error: payErr } = await supabase.from('payments').insert({
      invoice_id: invoiceId,
      customer_id: customerId,
      amount: split.amount,
      method: split.method,
      reference: invoiceNo,
      cheque_number: split.cheque_number || null,
      bank_name: split.bank_name || null,
      due_date: split.due_date || null,
      paid_at: new Date().toISOString(),
    });
    if (payErr) throw new Error(`Failed to create payment: ${payErr.message}`);
  }

  // 4. Update customer outstanding balance
  if (outstandingAmount > 0) {
    const { data: cust } = await supabase
      .from('customers')
      .select('outstanding_balance')
      .eq('id', customerId)
      .single();
    if (cust) {
      await supabase
        .from('customers')
        .update({ outstanding_balance: Number(cust.outstanding_balance) + outstandingAmount })
        .eq('id', customerId);
    }
  }

  // 5. Loyalty: update customer points + insert transactions
  if (customerId) {
    const { data: custLoy } = await supabase
      .from('customers')
      .select('loyalty_points, total_loyalty_earned, total_loyalty_redeemed')
      .eq('id', customerId)
      .single();

    if (custLoy) {
      const currentPoints = Number(custLoy.loyalty_points ?? 0);
      const newPoints = Math.max(0, currentPoints - redeemPoints + earnedPoints);

      await supabase.from('customers').update({
        loyalty_points: newPoints,
        total_loyalty_earned: Number(custLoy.total_loyalty_earned ?? 0) + earnedPoints,
        total_loyalty_redeemed: Number(custLoy.total_loyalty_redeemed ?? 0) + redeemPoints,
      }).eq('id', customerId);

      if (earnedPoints > 0) {
        await supabase.from('loyalty_transactions').insert({
          customer_id: customerId,
          invoice_id: invoiceId,
          transaction_type: 'EARN',
          points: earnedPoints,
          notes: `Earned on invoice ${invoiceNo}`,
        });
      }
      if (redeemPoints > 0) {
        await supabase.from('loyalty_transactions').insert({
          customer_id: customerId,
          invoice_id: invoiceId,
          transaction_type: 'REDEEM',
          points: redeemPoints,
          notes: `Redeemed on invoice ${invoiceNo}`,
        });
      }
    }
  }

  // 6. FIFO stock deduction
  for (const item of cart) {
    const ppc = item.product.pieces_per_carton || 1;
    const totalPieces = item.quantityCartons * ppc + item.quantityPieces;
    if (totalPieces <= 0) continue;

    if (item.batchId) {
      const { error } = await supabase.rpc('deduct_stock_from_batch', {
        p_batch_id: item.batchId,
        p_units: totalPieces,
      });
      if (error) console.warn('Batch deduction warning:', error.message);
    } else {
      const { error } = await supabase.rpc('deduct_stock_fifo', {
        p_product_id: item.product.id,
        p_units: totalPieces,
      });
      if (error) console.warn('FIFO deduction warning:', error.message);
    }
  }

  return { invoiceId, invoiceNo, earnedPoints: customerId ? earnedPoints : 0 };
};

// ─── Offline checkout ─────────────────────────────────────────────────────────

export const checkoutOffline = async (
  cart: CartItem[],
  customerId: string | null,
  customerName: string,
  isWholesale: boolean,
  subtotal: number,
  discount: number,
  total: number,
  paymentMethod: string,
  paymentAmount: number
): Promise<{ invoiceNo: string }> => {
  const invoiceNo = await saveOfflineSale({
    customerId,
    customerName,
    isWholesale,
    subtotal,
    discount,
    total,
    paymentMethod,
    paymentAmount,
    items: cart.map(item => ({
      productId: item.product.id,
      productName: item.product.name,
      quantityCartons: item.quantityCartons,
      quantityPieces: item.quantityPieces,
      piecesPerCarton: item.product.pieces_per_carton || 1,
      unitPrice: Math.max(0, Number(item.unitPrice ?? (isWholesale ? item.product.wholesale_price : item.product.retail_price)) - (item.lineDiscount ?? 0)),
      total: Math.max(0, Number(item.unitPrice ?? (isWholesale ? item.product.wholesale_price : item.product.retail_price)) - (item.lineDiscount ?? 0))
        * (item.quantityCartons * (item.product.pieces_per_carton || 1) + item.quantityPieces),
      batchId: item.batchId,
    })),
    createdAt: new Date().toISOString(),
  });

  return { invoiceNo };
};

// ─── Sync pending offline sales ───────────────────────────────────────────────

export const syncOfflineSales = async (
  onProgress: (done: number, total: number) => void
): Promise<{ synced: number; failed: number }> => {
  return syncPendingSales(onProgress, async (sale: OfflineSale) => {
    // Re-use online checkout logic with single cash split
    const cartItems: CartItem[] = sale.items.map(item => ({
      product: {
        id: item.productId,
        name: item.productName,
        pieces_per_carton: item.piecesPerCarton,
        wholesale_price: item.unitPrice,
        retail_price: item.unitPrice,
      } as Product,
      quantityCartons: item.quantityCartons,
      quantityPieces: item.quantityPieces,
      batchId: item.batchId,
      unitPrice: item.unitPrice,
    }));

    const splits: PaymentSplit[] =
      sale.paymentAmount > 0
        ? [{ method: sale.paymentMethod as PaymentSplit['method'], amount: sale.paymentAmount }]
        : [];

    await checkout(cartItems, sale.customerId, sale.isWholesale,
      sale.subtotal, sale.discount, sale.total, splits);
  });
};

export { getPendingCount as getOfflinePendingCount };

// ─── Cancel invoice ───────────────────────────────────────────────────────────

export async function cancelInvoice(invoiceId: string, reason: string): Promise<void> {
  const { data: inv, error: fetchErr } = await supabase
    .from('invoices')
    .select('id, invoice_no, total, payment_status, customer_id')
    .eq('id', invoiceId)
    .single();

  if (fetchErr || !inv) throw new Error('Invoice not found');
  if (inv.payment_status === 'cancelled') throw new Error('Invoice is already cancelled');

  // Fetch invoice items and payments in parallel
  const [{ data: items }, { data: payments }] = await Promise.all([
    supabase
      .from('invoice_items')
      .select('product_id, cartons, pieces, batch_id, products(pieces_per_carton)')
      .eq('invoice_id', invoiceId),
    supabase
      .from('payments')
      .select('amount')
      .eq('invoice_id', invoiceId),
  ]);

  const totalPaid = (payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
  const outstanding = Math.max(0, Number(inv.total) - totalPaid);

  // 1. Reverse customer outstanding balance
  if (outstanding > 0 && inv.customer_id) {
    const { data: cust } = await supabase
      .from('customers')
      .select('outstanding_balance')
      .eq('id', inv.customer_id)
      .single();
    if (cust) {
      await supabase
        .from('customers')
        .update({ outstanding_balance: Math.max(0, Number(cust.outstanding_balance) - outstanding) })
        .eq('id', inv.customer_id);
    }
  }

  // 2. Restore stock for each invoice item + log to stock_adjustments
  const adjustedBy = sessionStorage.getItem('user_role') || 'admin';
  const adjustmentReason = `[CANCEL] ${(inv as any).invoice_no} — ${reason}`;
  for (const item of (items ?? []) as any[]) {
    const ppc = item.products?.pieces_per_carton || 1;
    const totalPieces = Number(item.cartons) * ppc + Number(item.pieces);
    if (totalPieces <= 0) continue;
    const { error: restoreErr } = await supabase.rpc('restore_stock_to_batch', {
      p_batch_id:   item.batch_id ?? null,
      p_product_id: item.product_id,
      p_units:      totalPieces,
    });
    if (restoreErr) console.warn('Stock restore warning:', restoreErr.message);
    await supabase.from('stock_adjustments').insert({
      product_id:         item.product_id,
      adjustment_pieces:  totalPieces,
      adjustment_cartons: 0,
      reason:             adjustmentReason,
      adjusted_by:        adjustedBy,
    });
  }

  // 3. Delete payment records so they no longer appear in sales totals
  await supabase.from('payments').delete().eq('invoice_id', invoiceId);

  // 4. Reverse earned loyalty points linked to this invoice
  if (inv.customer_id) {
    const { data: loyaltyTx } = await supabase
      .from('loyalty_transactions')
      .select('points')
      .eq('invoice_id', invoiceId)
      .eq('transaction_type', 'EARN');

    const earnedPoints = (loyaltyTx ?? []).reduce((s: number, t: any) => s + Number(t.points), 0);
    if (earnedPoints > 0) {
      const { data: cust } = await supabase
        .from('customers')
        .select('loyalty_points, total_loyalty_earned')
        .eq('id', inv.customer_id)
        .single();
      if (cust) {
        await supabase
          .from('customers')
          .update({
            loyalty_points:       Math.max(0, Number(cust.loyalty_points) - earnedPoints),
            total_loyalty_earned: Math.max(0, Number((cust as any).total_loyalty_earned) - earnedPoints),
          })
          .eq('id', inv.customer_id);
        await supabase.from('loyalty_transactions').insert({
          customer_id:      inv.customer_id,
          invoice_id:       invoiceId,
          transaction_type: 'RETURN_REVERSAL',
          points:           -earnedPoints,
          notes:            'Points reversed — invoice cancelled',
        });
      }
    }
  }

  // 5. Mark invoice as cancelled and record the reason
  const { error } = await supabase
    .from('invoices')
    .update({ payment_status: 'cancelled', notes: reason })
    .eq('id', invoiceId);

  if (error) throw new Error(error.message);
}
