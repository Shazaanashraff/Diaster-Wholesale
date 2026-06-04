import { supabase } from '../lib/supabase';
import type { InvoiceItem } from '../types';

export interface SaleData {
  customer_id: string;
  mode: 'wholesale' | 'retail';
  subtotal: number;
  discount: number;
  total: number;
  payment_status: 'unpaid' | 'partial' | 'paid';
  payment_method: 'cash' | 'bank_transfer' | 'cheque' | 'credit';
  items: Omit<InvoiceItem, 'id' | 'invoice_id' | 'created_at'>[];
  notes?: string;
}

export const processSale = async (data: SaleData): Promise<string> => {
  const { data: invoiceId, error } = await supabase.rpc('process_sale', {
    p_customer_id: data.customer_id,
    p_mode: data.mode,
    p_subtotal: data.subtotal,
    p_discount: data.discount,
    p_total: data.total,
    p_payment_status: data.payment_status,
    p_payment_method: data.payment_method,
    p_items: data.items,
    p_notes: data.notes || ''
  });

  if (error) {
    console.error('Error in processSale RPC:', error);
    throw new Error(error.message);
  }

  return invoiceId;
};

const INVOICE_LIST_COLUMNS =
  'id, invoice_no, customer_id, mode, subtotal, discount, total, payment_status, salesperson_id, notes, created_at, updated_at, customers(name)';

const INVOICE_DETAIL_COLUMNS =
  'id, invoice_no, customer_id, mode, subtotal, discount, total, payment_status, salesperson_id, notes, created_at, updated_at, customers(id, name, phone, email, address, type, credit_limit, outstanding_balance)';

const INVOICE_ITEM_DETAIL_COLUMNS =
  'id, invoice_id, product_id, cartons, pieces, unit_price, total, created_at, products(id, name, item_code, model, pieces_per_carton, wholesale_price, retail_price)';

export const getInvoices = async () => {
  const { data, error } = await supabase
    .from('invoices')
    .select(INVOICE_LIST_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

export const getInvoiceById = async (id: string) => {
  const { data, error } = await supabase
    .from('invoices')
    .select(`${INVOICE_DETAIL_COLUMNS}, invoice_items(${INVOICE_ITEM_DETAIL_COLUMNS})`)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
};
