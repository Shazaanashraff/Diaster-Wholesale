import { supabase } from '../lib/supabase';
import type { Customer, Invoice, Payment } from '../types';

const CUSTOMER_COLUMNS = 'id, name, phone, email, address, type, credit_limit, outstanding_balance, cheque_float, created_at, updated_at';
const PAYMENT_COLUMNS = 'id, invoice_id, customer_id, amount, method, reference, bank_name, cheque_number, due_date, cheque_status, payment_type, paid_at, created_at';

export const getCustomers = async (): Promise<Customer[]> => {
  const { data, error } = await supabase
    .from('customers')
    .select(CUSTOMER_COLUMNS)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return data as Customer[];
}

/** Minimal customer list for POS dropdowns (less egress than getCustomers). */
export const getPosCustomers = async (): Promise<Pick<Customer, 'id' | 'name'>[]> => {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
};

export const getCustomerById = async (id: string): Promise<Customer> => {
  const { data, error } = await supabase
    .from('customers')
    .select(CUSTOMER_COLUMNS)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Customer;
}

export const createCustomer = async (
  data: Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'outstanding_balance'>
): Promise<Customer> => {
  const { data: customer, error } = await supabase
    .from('customers')
    .insert([{ ...data, outstanding_balance: 0 }])
    .select()
    .single();

  if (error) throw error;
  return customer as Customer;
}

export const updateCustomer = async (
  id: string,
  data: Partial<Customer>
): Promise<Customer> => {
  const { data: customer, error } = await supabase
    .from('customers')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return customer as Customer;
}

export const getCustomerLedger = async (
  id: string
): Promise<{ invoices: Invoice[]; payments: Payment[] }> => {
  const { data: invoices, error: invError } = await supabase
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('customer_id', id)
    .order('created_at', { ascending: false });

  if (invError) throw invError;

  const { data: payments, error: payError } = await supabase
    .from('payments')
    .select(PAYMENT_COLUMNS)
    .eq('customer_id', id)
    .order('paid_at', { ascending: false });

  if (payError) throw payError;

  return {
    invoices: invoices as Invoice[],
    payments: payments as Payment[]
  };
}

export const recordPayment = async (
  customerId: string,
  invoiceId: string | null,
  amount: number,
  method: 'cash' | 'bank_transfer' | 'cheque' = 'cash',
  bankName?: string,
  chequeNumber?: string,
  dueDate?: string
): Promise<void> => {
  const { error } = await supabase.rpc('record_payment_atomic', {
    p_customer_id:   customerId,
    p_invoice_id:    invoiceId,
    p_amount:        amount,
    p_method:        method,
    p_bank_name:     bankName     ?? '',
    p_cheque_number: chequeNumber ?? '',
    p_due_date:      dueDate      ?? '',
  });
  if (error) throw error;
};

export const depositCheque = async (paymentId: string): Promise<void> => {
  const { error } = await supabase.rpc('update_cheque_status', {
    p_payment_id: paymentId,
    p_new_status: 'processing',
  });
  if (error) throw error;
};

export const completeCheque = async (paymentId: string): Promise<void> => {
  const { error } = await supabase.rpc('update_cheque_status', {
    p_payment_id: paymentId,
    p_new_status: 'completed',
  });
  if (error) throw error;
};

export const returnCheque = async (paymentId: string): Promise<void> => {
  const { error } = await supabase.rpc('update_cheque_status', {
    p_payment_id: paymentId,
    p_new_status: 'returned',
  });
  if (error) throw error;
};

export const deleteCustomer = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export const archiveCustomer = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('customers')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;
}
