import { supabase } from '../lib/supabase';
import type { Supplier, SupplierPayment } from '../types';

export interface SupplierWithBalance extends Supplier {
  total_purchased: number;
  total_paid: number;
  outstanding: number;
  advance_balance: number;
}

export async function getSuppliers(): Promise<SupplierWithBalance[]> {
  const [{ data: suppliers }, { data: purchaseTotals }, { data: paymentTotals }] =
    await Promise.all([
      supabase.from('suppliers').select('*').eq('is_active', true).order('name', { ascending: true }),
      supabase.from('purchases').select('supplier_id, total_lkr').neq('status', 'draft'),
      supabase.from('supplier_payments').select('supplier_id, amount'),
    ]);

  const purchased: Record<string, number> = {};
  for (const p of purchaseTotals ?? []) {
    purchased[p.supplier_id] = (purchased[p.supplier_id] ?? 0) + Number(p.total_lkr);
  }
  const paid: Record<string, number> = {};
  for (const p of paymentTotals ?? []) {
    paid[p.supplier_id] = (paid[p.supplier_id] ?? 0) + Number(p.amount);
  }

  return (suppliers ?? []).map((s) => {
    const tp = purchased[s.id] ?? 0;
    const tpaid = paid[s.id] ?? 0;
    return {
      ...(s as Supplier),
      total_purchased: tp,
      total_paid: tpaid,
      outstanding: Math.max(0, tp - tpaid),
      advance_balance: Math.max(0, tpaid - tp),
    };
  });
}

export async function getSupplierById(id: string): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return data as Supplier;
}

export async function createSupplier(
  data: Omit<Supplier, 'id' | 'created_at'>
): Promise<Supplier> {
  const { data: row, error } = await supabase
    .from('suppliers')
    .insert(data)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return row as Supplier;
}

export async function updateSupplier(
  id: string,
  data: Partial<Omit<Supplier, 'id' | 'created_at'>>
): Promise<Supplier> {
  const { data: row, error } = await supabase
    .from('suppliers')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return row as Supplier;
}

export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await supabase.from('suppliers').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function archiveSupplier(id: string): Promise<void> {
  const { error } = await supabase
    .from('suppliers')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export interface SupplierLedger {
  purchases: Array<{
    id: string;
    reference: string;
    status: string;
    total_rmb: number;
    total_lkr: number;
    exchange_rate: number;
    created_at: string;
    item_count: number;
  }>;
  payments: SupplierPayment[];
  total_purchased: number;
  total_paid: number;
  outstanding: number;
  advance_balance: number;
}

export async function getSupplierLedger(supplierId: string): Promise<SupplierLedger> {
  const [{ data: purchases }, { data: payments }] = await Promise.all([
    supabase
      .from('purchases')
      .select('id, reference, status, total_rmb, total_lkr, exchange_rate, created_at, purchase_items(id)')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false }),
    supabase
      .from('supplier_payments')
      .select('*, purchases(reference)')
      .eq('supplier_id', supplierId)
      .order('paid_at', { ascending: false }),
  ]);

  const purchaseRows = (purchases ?? []).map((p: any) => ({
    ...p,
    item_count: Array.isArray(p.purchase_items) ? p.purchase_items.length : 0,
  }));

  const total_purchased = purchaseRows
    .filter((p) => p.status !== 'draft')
    .reduce((sum, p) => sum + Number(p.total_lkr), 0);

  const total_paid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  return {
    purchases: purchaseRows,
    payments: (payments ?? []) as SupplierPayment[],
    total_purchased,
    total_paid,
    outstanding: Math.max(0, total_purchased - total_paid),
    advance_balance: Math.max(0, total_paid - total_purchased),
  };
}

export async function recordSupplierPayment(data: {
  supplier_id: string;
  amount: number;
  method: 'cash' | 'bank_transfer' | 'credit';
  notes?: string;
  allocations?: Array<{ purchase_id: string; amount: number }>;
}): Promise<void> {
  if (data.allocations && data.allocations.length > 0) {
    // Insert multiple rows
    const rows = data.allocations.map(a => ({
      supplier_id: data.supplier_id,
      purchase_id: a.purchase_id,
      amount: a.amount,
      method: data.method,
      notes: data.notes ?? '',
      paid_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('supplier_payments').insert(rows);
    if (error) throw new Error(error.message);
  } else {
    // Insert single unallocated row
    const { error } = await supabase.from('supplier_payments').insert({
      supplier_id: data.supplier_id,
      purchase_id: null,
      amount: data.amount,
      method: data.method,
      notes: data.notes ?? '',
      paid_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }
}
