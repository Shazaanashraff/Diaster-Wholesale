import { supabase } from '../lib/supabase';

export interface Salesperson {
  id: string;
  name: string;
  active: boolean;
  created_at?: string;
}

export interface SalespersonInvoice {
  id: string;
  invoice_no: string;
  total: number;
  payment_status: string;
  created_at: string;
  customers: { name: string } | { name: string }[] | null;
}

export const getSalespeople = async (): Promise<Salesperson[]> => {
  const { data, error } = await supabase
    .from('salespeople')
    .select('id, name, active, created_at')
    .eq('active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Salesperson[];
};

export const getAllSalespeople = async (): Promise<Salesperson[]> => {
  const { data, error } = await supabase
    .from('salespeople')
    .select('id, name, active, created_at')
    .order('active', { ascending: false })
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Salesperson[];
};

export const addSalesperson = async (name: string): Promise<Salesperson> => {
  const { data, error } = await supabase
    .from('salespeople')
    .insert({ name: name.trim() })
    .select('id, name, active, created_at')
    .single();

  if (error) throw error;
  return data as Salesperson;
};

export const renameSalesperson = async (id: string, name: string): Promise<Salesperson> => {
  const { data, error } = await supabase
    .from('salespeople')
    .update({ name: name.trim() })
    .eq('id', id)
    .select('id, name, active, created_at')
    .single();

  if (error) throw error;
  return data as Salesperson;
};

export const setSalespersonActive = async (id: string, active: boolean): Promise<Salesperson> => {
  const { data, error } = await supabase
    .from('salespeople')
    .update({ active })
    .eq('id', id)
    .select('id, name, active, created_at')
    .single();

  if (error) throw error;
  return data as Salesperson;
};

export const getSalespersonInvoices = async (salespersonId: string): Promise<SalespersonInvoice[]> => {
  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_no, total, payment_status, created_at, customers(name)')
    .eq('salesperson_id', salespersonId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as SalespersonInvoice[];
};
