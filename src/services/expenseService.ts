import { supabase } from '../lib/supabase';
import type { Expense } from '../types';

// ── Expense Categories ─────────────────────────────────────────────────────────
export const EXPENSE_CATEGORIES = [
  'Rent', 'Utilities', 'Salaries', 'Transport', 'Packaging',
  'Maintenance', 'Marketing', 'Office Supplies', 'Bank Charges',
  'Insurance', 'Other',
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

const EXPENSE_COLUMNS = 'id, category, description, amount, method, location_id, notes, created_by, reference, created_at';

// ── Fetch ──────────────────────────────────────────────────────────────────────

export async function getExpenses(filters?: {
  category?: string;
  from?: string;
  to?: string;
}): Promise<Expense[]> {
  let q = supabase
    .from('expenses')
    .select(`${EXPENSE_COLUMNS}, locations(name)`)
    .order('created_at', { ascending: false });

  if (filters?.category) q = q.eq('category', filters.category);
  if (filters?.from) q = q.gte('created_at', filters.from);
  if (filters?.to) q = q.lte('created_at', filters.to);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Expense[];
}

// ── Total company cash (expenses in - income) — simplified ───────────────────

export async function getCompanyCashBalance(): Promise<number> {
  const [{ data: inc }, { data: exp }] = await Promise.all([
    supabase.from('other_income').select('amount').eq('method', 'cash'),
    supabase.from('expenses').select('amount').eq('method', 'cash'),
  ]);
  const totalIncome = (inc ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const totalExpenses = (exp ?? []).reduce((s, r) => s + Number(r.amount), 0);
  // This is a simplified model — in production you'd sum POS cash sales too
  return totalIncome - totalExpenses;
}

// ── Create ─────────────────────────────────────────────────────────────────────

export async function createExpense(data: {
  category: string;
  description?: string;
  amount: number;
  method: string;
  location_id?: string;
  notes: string;
}): Promise<Expense> {
  if (!data.category) throw new Error('Category is required');
  if (data.amount <= 0) throw new Error('Amount must be greater than 0');
  if (!data.notes.trim()) throw new Error('Notes are required');
  if (!data.method) throw new Error('Payment method is required');

  // Cash balance check — only enforce for cash expenses
  if (data.method === 'cash') {
    const balance = await getCompanyCashBalance();
    if (data.amount > balance) {
      throw new Error(
        `Insufficient cash balance. Available: LKR ${balance.toLocaleString('en-LK', { minimumFractionDigits: 2 })}, Required: LKR ${data.amount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}.`
      );
    }
  }

  const { data: row, error } = await supabase
    .from('expenses')
    .insert({
      category: data.category,
      description: data.description ?? '',
      amount: data.amount,
      method: data.method,
      location_id: data.location_id ?? null,
      notes: data.notes,
      created_by: 'System',
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Audit log
  await supabase.from('audit_log').insert({
    table_name: 'expenses',
    record_id: (row as Expense).id,
    action: 'CREATE',
    new_values: { category: data.category, amount: data.amount, method: data.method },
    user_label: 'System',
    notes: `Expense created: ${data.category} — LKR ${data.amount}`,
  });

  return row as Expense;
}

// ── Update ─────────────────────────────────────────────────────────────────────

export async function updateExpense(
  id: string,
  data: Partial<{
    category: string;
    description: string;
    amount: number;
    method: string;
    location_id: string;
    notes: string;
  }>
): Promise<Expense> {
  const { data: row, error } = await supabase
    .from('expenses')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Audit log
  await supabase.from('audit_log').insert({
    table_name: 'expenses',
    record_id: id,
    action: 'UPDATE',
    new_values: data as Record<string, unknown>,
    user_label: 'System',
    notes: 'Expense updated',
  });

  return row as Expense;
}

// ── Delete ─────────────────────────────────────────────────────────────────────

export async function deleteExpense(id: string): Promise<void> {
  // Audit before delete
  const { data: existing } = await supabase.from('expenses').select(EXPENSE_COLUMNS).eq('id', id).single();

  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw new Error(error.message);

  await supabase.from('audit_log').insert({
    table_name: 'expenses',
    record_id: id,
    action: 'DELETE',
    old_values: existing as Record<string, unknown>,
    user_label: 'System',
    notes: 'Expense deleted',
  });
}
