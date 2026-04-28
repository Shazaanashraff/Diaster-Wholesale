import { supabase } from '../lib/supabase';
import type { Customer, Invoice, Payment } from '../types';

export const getCustomers = async (): Promise<Customer[]> => {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return data as Customer[];
}

export const getCustomerById = async (id: string): Promise<Customer> => {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
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
    .select('*')
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
  amount: number
): Promise<void> => {
  try {
    // Insert into payments table
    const { error: insertError } = await supabase
      .from('payments')
      .insert([
        {
          customer_id: customerId,
          invoice_id: invoiceId,
          amount,
          method: 'cash',
          paid_at: new Date().toISOString()
        }
      ]);

    if (insertError) throw insertError;

    // Fetch current customer outstanding_balance
    const customer = await getCustomerById(customerId);

    // Calculate newBalance
    const newBalance = Math.max(0, customer.outstanding_balance - amount);

    // Update customer outstanding_balance
    const { error: updateCustError } = await supabase
      .from('customers')
      .update({ outstanding_balance: newBalance })
      .eq('id', customerId);

    if (updateCustError) throw updateCustError;

    // Update invoice payment_status if applicable
    if (invoiceId) {
      const { data: invoice } = await supabase
        .from('invoices')
        .select('total')
        .eq('id', invoiceId)
        .single();

      if (invoice) {
        const { data: allPayments } = await supabase
          .from('payments')
          .select('amount')
          .eq('invoice_id', invoiceId);

        const totalPaid = (allPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);

        if (totalPaid >= invoice.total) {
          await supabase
            .from('invoices')
            .update({ payment_status: 'paid' })
            .eq('id', invoiceId);
        } else if (totalPaid > 0) {
          await supabase
            .from('invoices')
            .update({ payment_status: 'partial' })
            .eq('id', invoiceId);
        }
      }
    }
  } catch (error) {
    console.error('Error recording payment:', error);
    throw error;
  }
}

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
