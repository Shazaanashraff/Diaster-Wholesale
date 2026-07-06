import { supabase } from '../lib/supabase';

const RETURN_TAG = '[RETURNED]';

export interface ReturnInvoiceItem {
  id: string;
  product_id: string;
  product_name: string;
  item_code: string;
  pieces_per_carton: number;
  cartons: number;
  pieces: number;
  unit_price: number;
  total: number;
}

export interface ReturnInvoice {
  id: string;
  invoice_no: string;
  customer_id: string;
  customer_name: string;
  total: number;
  payment_status: 'unpaid' | 'partial' | 'paid';
  notes: string;
  created_at: string;
  is_returned: boolean;
  items: ReturnInvoiceItem[];
}

type InvoiceQueryRow = {
  id: string;
  invoice_no: string;
  customer_id: string;
  total: number;
  payment_status: 'unpaid' | 'partial' | 'paid';
  notes: string;
  created_at: string;
  customers?: { name?: string } | Array<{ name?: string }>;
  invoice_items?: Array<{
    id: string;
    product_id: string;
    cartons: number;
    pieces: number;
    unit_price: number;
    total: number;
    products?: {
      name?: string;
      item_code?: string;
      pieces_per_carton?: number;
    } | Array<{
      name?: string;
      item_code?: string;
      pieces_per_carton?: number;
    }>;
  }>;
};

function mapInvoice(row: InvoiceQueryRow): ReturnInvoice {
  const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
  const items = (row.invoice_items ?? []).map((item) => {
    const product = Array.isArray(item.products) ? item.products[0] : item.products;

    return {
      id: item.id,
      product_id: item.product_id,
      product_name: product?.name ?? 'Unknown Product',
      item_code: product?.item_code ?? '-',
      pieces_per_carton: Number(product?.pieces_per_carton ?? 1) || 1,
      cartons: Number(item.cartons ?? 0),
      pieces: Number(item.pieces ?? 0),
      unit_price: Number(item.unit_price ?? 0),
      total: Number(item.total ?? 0),
    };
  });

  return {
    id: row.id,
    invoice_no: row.invoice_no,
    customer_id: row.customer_id,
    customer_name: customer?.name ?? 'Unknown Customer',
    total: Number(row.total ?? 0),
    payment_status: row.payment_status,
    notes: row.notes ?? '',
    created_at: row.created_at,
    is_returned: (row.notes ?? '').includes(RETURN_TAG),
    items,
  };
}

export async function searchReturnableInvoices(searchTerm: string): Promise<ReturnInvoice[]> {
  let query = supabase
    .from('invoices')
    .select(`
      id,
      invoice_no,
      customer_id,
      total,
      payment_status,
      notes,
      created_at,
      customers(name),
      invoice_items(
        id,
        product_id,
        cartons,
        pieces,
        unit_price,
        total,
        products(name, item_code, pieces_per_carton)
      )
    `)
    .neq('payment_status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(60);

  if (searchTerm.trim()) {
    query = query.ilike('invoice_no', `%${searchTerm.trim()}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('searchReturnableInvoices error:', error.message);
    throw new Error(error.message);
  }

  return ((data ?? []) as InvoiceQueryRow[]).map(mapInvoice);
}

export type RefundMethod = 'cash' | 'bank_transfer' | 'credit_note' | 'no_refund';

export const REFUND_METHOD_LABELS: Record<RefundMethod, string> = {
  cash: 'Cash Refund',
  bank_transfer: 'Bank Transfer',
  credit_note: 'Credit Note (Add to Balance)',
  no_refund: 'No Refund',
};

export async function processInvoiceReturn(
  invoiceId: string,
  reason: string,
  adjustedBy: string,
  refundMethod: RefundMethod = 'cash'
): Promise<void> {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      id,
      invoice_no,
      customer_id,
      total,
      payment_status,
      notes,
      created_at,
      customers(name),
      invoice_items(
        id,
        product_id,
        cartons,
        pieces,
        unit_price,
        total,
        products(name, item_code, pieces_per_carton)
      )
    `)
    .eq('id', invoiceId)
    .single();

  if (error || !data) {
    console.error('processInvoiceReturn fetch error:', error?.message);
    throw new Error(error?.message ?? 'Invoice not found');
  }

  const invoice = mapInvoice(data as InvoiceQueryRow);

  if (invoice.is_returned) {
    throw new Error('This invoice has already been returned.');
  }

  if (invoice.items.length === 0) {
    throw new Error('Invoice has no items to return.');
  }

  const now = new Date().toISOString();
  const safeReason = reason.trim() || 'Customer return';
  const safeAdjustedBy = adjustedBy.trim() || 'system';

  const stockAdjustments = invoice.items.map((item) => {
    const totalPieces = item.cartons * (item.pieces_per_carton || 1) + item.pieces;

    return {
      product_id: item.product_id,
      adjustment_pieces: totalPieces,
      reason: `Return ${invoice.invoice_no}: ${safeReason}`,
      adjusted_by: safeAdjustedBy,
    };
  });

  const { error: adjustError } = await supabase
    .from('stock_adjustments')
    .insert(stockAdjustments);

  if (adjustError) {
    console.error('processInvoiceReturn stock adjustment error:', adjustError.message);
    throw new Error(adjustError.message);
  }

  if (invoice.payment_status === 'paid' || invoice.payment_status === 'partial') {
    if (refundMethod !== 'no_refund') {
      const paymentMethod = refundMethod === 'credit_note' ? 'credit' : refundMethod;
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          invoice_id: invoice.id,
          customer_id: invoice.customer_id,
          amount: -Math.abs(invoice.total),
          method: paymentMethod,
          reference: `RETURN-${invoice.invoice_no}`,
          paid_at: now,
        });

      if (paymentError) {
        console.error('processInvoiceReturn payment error:', paymentError.message);
        throw new Error(paymentError.message);
      }

      // credit_note: add refund to customer outstanding (they can use it later)
      if (refundMethod === 'credit_note') {
        const { data: cust } = await supabase
          .from('customers')
          .select('outstanding_balance')
          .eq('id', invoice.customer_id)
          .single();
        if (cust) {
          await supabase
            .from('customers')
            .update({ outstanding_balance: Math.max(0, Number(cust.outstanding_balance) - invoice.total) })
            .eq('id', invoice.customer_id);
        }
      }
    }
  }

  const updatedNotes = [
    (invoice.notes ?? '').trim(),
    `${RETURN_TAG} ${now}`,
    safeReason,
  ]
    .filter(Boolean)
    .join('\n');

  const { error: invoiceError } = await supabase
    .from('invoices')
    .update({ notes: updatedNotes })
    .eq('id', invoice.id);

  if (invoiceError) {
    console.error('processInvoiceReturn update invoice error:', invoiceError.message);
    throw new Error(invoiceError.message);
  }
}
