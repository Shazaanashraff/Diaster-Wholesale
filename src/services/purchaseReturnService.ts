import { supabase } from '../lib/supabase';
import type {
  SupplierReturn, SupplierReturnItem,
  OtherIncome, OtherIncomeSource,
} from '../types';

// ── Reference generator ────────────────────────────────────────────────────────

async function generateReturnReference(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_return_reference');
  if (error) throw new Error(error.message);
  return data as string;
}

// ── Fetch ──────────────────────────────────────────────────────────────────────

export async function getSupplierReturns(supplierId?: string): Promise<SupplierReturn[]> {
  let q = supabase
    .from('supplier_returns')
    .select('*, suppliers(name), purchases(reference)')
    .order('created_at', { ascending: false });

  if (supplierId) q = q.eq('supplier_id', supplierId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as SupplierReturn[];
}

export async function getSupplierReturnById(id: string): Promise<{
  ret: SupplierReturn;
  items: SupplierReturnItem[];
}> {
  const [{ data: ret, error: re }, { data: items, error: ie }] = await Promise.all([
    supabase
      .from('supplier_returns')
      .select('*, suppliers(name), purchases(reference)')
      .eq('id', id)
      .single(),
    supabase
      .from('supplier_return_items')
      .select('*, products(id, name, model, item_code, cost_price, pieces_per_carton)')
      .eq('return_id', id),
  ]);
  if (re) throw new Error(re.message);
  if (ie) throw new Error(ie.message);
  return { ret: ret as SupplierReturn, items: (items ?? []) as SupplierReturnItem[] };
}

// ── Create Supplier Return ─────────────────────────────────────────────────────

export interface NewReturnItemInput {
  product_id: string;
  item_type: 'return' | 'replacement';
  quantity: number;
  unit_value_lkr: number;
}

export interface CreateReturnInput {
  supplier_id: string;
  purchase_id?: string;
  return_type: 'return' | 'exchange';
  notes?: string;
  items: NewReturnItemInput[];
}

export async function createSupplierReturn(input: CreateReturnInput): Promise<SupplierReturn> {
  const reference = await generateReturnReference();

  // Validate return quantities against received quantities on linked purchase
  const returnItems = input.items.filter(i => i.item_type === 'return');
  if (input.purchase_id && returnItems.length > 0) {
    const { data: received, error: re } = await supabase
      .from('purchase_receive')
      .select('product_id, received_units, damaged_units')
      .eq('purchase_id', input.purchase_id);
    if (re) throw new Error(re.message);

    for (const item of returnItems) {
      const rec = (received ?? []).find(r => r.product_id === item.product_id);
      if (!rec) {
        throw new Error(`Product was not received on the linked purchase and cannot be returned.`);
      }
      const sellable = rec.received_units - rec.damaged_units;
      if (item.quantity > sellable) {
        throw new Error(
          `Return quantity (${item.quantity}) exceeds sellable received quantity (${sellable}) for this product.`
        );
      }
    }
  }

  // Calculate values
  const replacementItems = input.items.filter(i => i.item_type === 'replacement');

  const return_value_lkr = returnItems.reduce((s, i) => s + i.quantity * i.unit_value_lkr, 0);
  const replacement_value_lkr = replacementItems.reduce((s, i) => s + i.quantity * i.unit_value_lkr, 0);
  const difference_lkr = replacement_value_lkr - return_value_lkr;

  // Determine settlement type
  let settlement_type: 'payable' | 'refund' | 'credit_note' | 'even' | null = null;
  if (input.return_type === 'exchange') {
    if (Math.abs(difference_lkr) < 0.01) settlement_type = 'even';
    else if (difference_lkr > 0) settlement_type = 'payable'; // owe supplier
    else settlement_type = 'refund'; // supplier owes us (default, can be changed to credit_note)
  }

  const { data: ret, error: re } = await supabase
    .from('supplier_returns')
    .insert({
      reference,
      supplier_id: input.supplier_id,
      purchase_id: input.purchase_id ?? null,
      return_type: input.return_type,
      status: 'pending',
      return_value_lkr,
      replacement_value_lkr,
      difference_lkr,
      settlement_type,
      notes: input.notes ?? '',
    })
    .select()
    .single();
  if (re) throw new Error(re.message);

  const returnId = (ret as SupplierReturn).id;

  // Insert items
  if (input.items.length > 0) {
    const { error: ie } = await supabase.from('supplier_return_items').insert(
      input.items.map(i => ({
        return_id: returnId,
        product_id: i.product_id,
        item_type: i.item_type,
        quantity: i.quantity,
        unit_value_lkr: i.unit_value_lkr,
      }))
    );
    if (ie) throw new Error(ie.message);
  }

  // Audit log
  await supabase.from('audit_log').insert({
    table_name: 'supplier_returns',
    record_id: returnId,
    action: 'CREATE',
    new_values: { reference, return_type: input.return_type, return_value_lkr },
    user_label: 'System',
    notes: `Created ${input.return_type} ${reference}`,
  });

  return ret as SupplierReturn;
}

// ── Complete Return / Exchange ─────────────────────────────────────────────────
// Stock updates handled by DB trigger (trg_supplier_return_complete)

export async function completeSupplierReturn(
  returnId: string,
  settlementType: 'payable' | 'refund' | 'credit_note' | 'even',
  settlementNotes?: string
): Promise<void> {
  const { error } = await supabase
    .from('supplier_returns')
    .update({
      status: 'completed',
      settlement_type: settlementType,
      settlement_notes: settlementNotes ?? '',
    })
    .eq('id', returnId)
    .eq('status', 'pending');
  if (error) throw new Error(error.message);

  // Audit log
  await supabase.from('audit_log').insert({
    table_name: 'supplier_returns',
    record_id: returnId,
    action: 'COMPLETE',
    new_values: { status: 'completed', settlement_type: settlementType },
    user_label: 'System',
    notes: 'Return/Exchange completed — stock updated',
  });
}

export async function cancelSupplierReturn(returnId: string): Promise<void> {
  const { error } = await supabase
    .from('supplier_returns')
    .update({ status: 'cancelled' })
    .eq('id', returnId)
    .eq('status', 'pending');
  if (error) throw new Error(error.message);
}

// ── Settlement: Record Payable (difference > 0) ────────────────────────────────

export async function recordExchangePayable(data: {
  supplier_id: string;
  return_id: string;
  amount: number;
  method: 'cash' | 'card' | 'cheque' | 'credit' | 'online' | 'bank_transfer';
  cheque_number?: string;
  bank_name?: string;
  due_date?: string;
  notes?: string;
}): Promise<void> {
  const { error } = await supabase.from('supplier_payments').insert({
    supplier_id: data.supplier_id,
    purchase_id: null,
    amount: data.amount,
    method: data.method,
    cheque_number: data.cheque_number,
    bank_name: data.bank_name,
    due_date: data.due_date,
    notes: data.notes ?? `Exchange payable for return linked to supplier`,
    paid_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

// ── Settlement: Record Refund (difference < 0) as Other Income ─────────────────

export async function recordExchangeRefund(data: {
  supplier_id: string;
  amount: number;
  method: string;
  notes?: string;
}): Promise<void> {
  const { error } = await supabase.from('other_income').insert({
    source_type: 'supplier_refund',
    amount: data.amount,
    method: data.method,
    supplier_id: data.supplier_id,
    notes: data.notes ?? 'Supplier exchange refund',
    created_by: 'System',
  });
  if (error) throw new Error(error.message);
}

// ── Other Income ────────────────────────────────────────────────────────────────

export async function getOtherIncome(filters?: { from?: string; to?: string }): Promise<OtherIncome[]> {
  let q = supabase
    .from('other_income')
    .select('*, suppliers(name)')
    .order('created_at', { ascending: false });
  if (filters?.from) q = q.gte('created_at', filters.from);
  if (filters?.to)   q = q.lte('created_at', filters.to);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as OtherIncome[];
}

export async function createOtherIncome(data: {
  source_type: OtherIncomeSource;
  amount: number;
  method: string;
  supplier_id?: string;
  notes: string;
}): Promise<OtherIncome> {
  if (data.amount <= 0) throw new Error('Amount must be greater than 0');
  if (!data.notes.trim()) throw new Error('Notes are required');

  const { data: row, error } = await supabase
    .from('other_income')
    .insert({ ...data, created_by: 'System' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return row as OtherIncome;
}

export async function deleteOtherIncome(id: string): Promise<void> {
  const { error } = await supabase.from('other_income').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
