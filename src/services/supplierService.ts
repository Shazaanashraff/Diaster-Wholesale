import { supabase } from '../lib/supabase';
import type { Supplier, SupplierPayment, Location } from '../types';

export interface SupplierWithBalance extends Supplier {
  total_purchased: number;
  total_paid: number;
  outstanding: number;
  advance_balance: number;
}

export async function getLocations(): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getSuppliers(): Promise<SupplierWithBalance[]> {
  const [{ data: suppliers }, { data: purchaseTotals }, { data: paymentTotals }] =
    await Promise.all([
      supabase.from('suppliers').select('*').eq('is_active', true).order('name', { ascending: true }),
      supabase.from('purchases').select('supplier_id, total_lkr').neq('status', 'draft').neq('status', 'cancelled'),
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

// ── Credit Validation ─────────────────────────────────────────────────────────
// Returns true if purchase amount is within credit limit
export async function validateCreditLimit(
  supplierId: string,
  purchaseAmount: number
): Promise<{ allowed: boolean; available: number; limit: number; current: number }> {
  const { data: supplier, error } = await supabase
    .from('suppliers')
    .select('credit_limit, current_payable')
    .eq('id', supplierId)
    .single();
  if (error) throw new Error(error.message);

  const limit = Number(supplier?.credit_limit ?? 0);
  const current = Number(supplier?.current_payable ?? 0);
  const available = Math.max(0, limit - current);
  const allowed = limit === 0 || purchaseAmount <= available; // 0 limit = no restriction

  return { allowed, available, limit, current };
}

// ── Ledger ────────────────────────────────────────────────────────────────────

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
    .filter((p) => p.status !== 'draft' && p.status !== 'cancelled')
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

// ── Full Payment (all methods including cheque & mixed/partial) ────────────────

export interface PaymentLineInput {
  amount: number;
  method: 'cash' | 'card' | 'cheque' | 'credit' | 'online' | 'bank_transfer';
  cheque_number?: string;
  bank_name?: string;
  due_date?: string;
  notes?: string;
}

export async function recordSupplierPaymentFull(data: {
  supplier_id: string;
  purchase_id?: string | null;
  total_amount: number;
  payment_lines: PaymentLineInput[]; // 1 line = single, 2 lines = mixed/partial
  notes?: string;
}): Promise<void> {
  if (data.total_amount <= 0) throw new Error('Payment amount must be greater than 0');
  if (data.payment_lines.length === 0) throw new Error('At least one payment method required');

  const sum = data.payment_lines.reduce((s, l) => s + l.amount, 0);
  if (Math.abs(sum - data.total_amount) > 0.01) {
    throw new Error(`Payment lines sum (${sum.toFixed(2)}) must equal total (${data.total_amount.toFixed(2)})`);
  }

  const isMixed = data.payment_lines.length > 1;
  const primaryMethod = isMixed ? 'mixed' : data.payment_lines[0].method;

  // Validate cheque lines
  for (const line of data.payment_lines) {
    if (line.method === 'cheque') {
      if (!line.cheque_number) throw new Error('Cheque number is required');
      if (!line.bank_name) throw new Error('Bank name is required');
      if (!line.due_date) throw new Error('Cheque due date is required');
    }
  }

  // Credit limit validation — only when any line uses 'credit'
  const creditLines = data.payment_lines.filter(l => l.method === 'credit');
  if (creditLines.length > 0) {
    const creditAmount = creditLines.reduce((s, l) => s + l.amount, 0);
    const creditCheck = await validateCreditLimit(data.supplier_id, creditAmount);
    if (!creditCheck.allowed) {
      throw new Error(
        `Credit limit exceeded. Available credit: LKR ${creditCheck.available.toLocaleString('en-LK', { minimumFractionDigits: 2 })} ` +
        `(Limit: LKR ${creditCheck.limit.toLocaleString('en-LK', { minimumFractionDigits: 2 })}, ` +
        `Current payable: LKR ${creditCheck.current.toLocaleString('en-LK', { minimumFractionDigits: 2 })})`
      );
    }
  }

  // Insert header payment row
  const { data: payment, error: pe } = await supabase
    .from('supplier_payments')
    .insert({
      supplier_id: data.supplier_id,
      purchase_id: data.purchase_id ?? null,
      amount: data.total_amount,
      method: primaryMethod,
      // For single cheque payment, also populate top-level cheque fields
      cheque_number: !isMixed && primaryMethod === 'cheque' ? data.payment_lines[0].cheque_number : undefined,
      bank_name: !isMixed && primaryMethod === 'cheque' ? data.payment_lines[0].bank_name : undefined,
      due_date: !isMixed && primaryMethod === 'cheque' ? data.payment_lines[0].due_date : undefined,
      notes: data.notes ?? '',
      paid_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (pe) throw new Error(pe.message);

  const paymentId = (payment as { id: string }).id;

  // Insert payment lines (always, for full audit trail)
  const { error: le } = await supabase.from('supplier_payment_lines').insert(
    data.payment_lines.map(l => ({
      payment_id: paymentId,
      amount: l.amount,
      method: l.method,
      cheque_number: l.cheque_number,
      bank_name: l.bank_name,
      due_date: l.due_date,
      notes: l.notes ?? '',
    }))
  );
  if (le) throw new Error(le.message);

  // Audit log
  await supabase.from('audit_log').insert({
    table_name: 'supplier_payments',
    record_id: paymentId,
    action: 'CREATE',
    new_values: { amount: data.total_amount, method: primaryMethod, lines: data.payment_lines.length },
    user_label: 'System',
    notes: `Supplier payment recorded: LKR ${data.total_amount}`,
  });
}

// Legacy compatibility — kept for existing call sites
export async function recordSupplierPayment(data: {
  supplier_id: string;
  amount: number;
  method: 'cash' | 'bank_transfer' | 'credit';
  notes?: string;
  allocations?: Array<{ purchase_id: string; amount: number }>;
}): Promise<void> {
  if (data.allocations && data.allocations.length > 0) {
    for (const alloc of data.allocations) {
      await recordSupplierPaymentFull({
        supplier_id: data.supplier_id,
        purchase_id: alloc.purchase_id,
        total_amount: alloc.amount,
        payment_lines: [{ amount: alloc.amount, method: data.method as any }],
        notes: data.notes,
      });
    }
  } else {
    await recordSupplierPaymentFull({
      supplier_id: data.supplier_id,
      purchase_id: null,
      total_amount: data.amount,
      payment_lines: [{ amount: data.amount, method: data.method as any }],
      notes: data.notes,
    });
  }
}

// ── Discount Approvals ────────────────────────────────────────────────────────

export async function requestDiscountApproval(data: {
  purchase_id: string;
  discount_type: 'item' | 'bill';
  discount_percent?: number;
  discount_amount?: number;
  requested_by: string;
  notes?: string;
}): Promise<string> {
  const { data: row, error } = await supabase
    .from('purchase_discount_approvals')
    .insert({
      purchase_id: data.purchase_id,
      discount_type: data.discount_type,
      discount_percent: data.discount_percent,
      discount_amount: data.discount_amount,
      requested_by: data.requested_by,
      notes: data.notes,
      status: 'pending',
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (row as { id: string }).id;
}

// ── Payment edit / delete ─────────────────────────────────────────────────────

export async function updateSupplierPaymentNotes(id: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from('supplier_payments')
    .update({ notes })
    .eq('id', id);
  if (error) throw new Error(error.message);

  await supabase.from('audit_log').insert({
    table_name: 'supplier_payments',
    record_id: id,
    action: 'UPDATE',
    new_values: { notes },
    user_label: 'System',
    notes: 'Payment notes updated',
  });
}

export async function deleteSupplierPayment(id: string): Promise<void> {
  // Fetch before delete for audit and credit reversal
  const { data: pmt, error: fe } = await supabase
    .from('supplier_payments')
    .select('*')
    .eq('id', id)
    .single();
  if (fe) throw new Error(fe.message);

  // If the payment was a credit payment, reverse the payable balance
  if (pmt.method === 'credit') {
    const { data: sup } = await supabase
      .from('suppliers')
      .select('current_payable')
      .eq('id', pmt.supplier_id)
      .single();
    if (sup) {
      await supabase.from('suppliers').update({
        current_payable: Math.max(0, Number(sup.current_payable) - Number(pmt.amount)),
      }).eq('id', pmt.supplier_id);
    }
  }

  // Delete payment lines first (cascade may handle this, but explicit is safer)
  await supabase.from('supplier_payment_lines').delete().eq('payment_id', id);

  const { error: de } = await supabase.from('supplier_payments').delete().eq('id', id);
  if (de) throw new Error(de.message);

  await supabase.from('audit_log').insert({
    table_name: 'supplier_payments',
    record_id: id,
    action: 'DELETE',
    old_values: pmt as Record<string, unknown>,
    user_label: 'System',
    notes: `Payment deleted — LKR ${pmt.amount} (${pmt.method})`,
  });
}

export async function resolveDiscountApproval(
  approvalId: string,
  approved: boolean,
  approvedBy: string
): Promise<void> {
  const { error } = await supabase
    .from('purchase_discount_approvals')
    .update({
      status: approved ? 'approved' : 'rejected',
      approved_by: approvedBy,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', approvalId);
  if (error) throw new Error(error.message);
}

export async function getPendingApprovals(): Promise<any[]> {
  const { data, error } = await supabase
    .from('purchase_discount_approvals')
    .select('*, purchases(reference, suppliers(name))')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
