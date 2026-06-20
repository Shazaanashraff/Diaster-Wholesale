import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, X, Loader2, AlertCircle, CheckCircle2,
  Trash2, Edit2, Receipt, TrendingDown, TrendingUp, RefreshCw,
} from 'lucide-react';
import { getExpenses, createExpense, updateExpense, deleteExpense, EXPENSE_CATEGORIES } from '../services/expenseService';
import { getOtherIncome, createOtherIncome, deleteOtherIncome } from '../services/purchaseReturnService';
import { getLocations, getSuppliers } from '../services/supplierService';
import type { Expense, OtherIncome, Location } from '../types';
import type { SupplierWithBalance } from '../services/supplierService';
import { ConfirmModal } from '../components/ConfirmModal';
import { DailyFinanceReport } from './reports/DailyFinanceReport';
import { DateRangePicker } from './reports/shared/DateRangePicker';
import { type ReportPeriod, getReportDateRange } from '../utils/reportUtils';
import { cn } from '../lib/utils';

const fmt = (n: number) =>
  'LKR ' + Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'cheque', 'online'] as const;
const INCOME_SOURCES = [
  { val: 'supplier_refund', label: 'Supplier Refund' },
  { val: 'credit_note',     label: 'Credit Note' },
  { val: 'discount_received', label: 'Discount Received' },
  { val: 'other',           label: 'Other' },
] as const;

const EMPTY_EXPENSE = { category: '', description: '', amount: '', method: 'cash', location_id: '', notes: '' };
const EMPTY_INCOME  = { source_type: 'other' as const, amount: '', method: 'cash', supplier_id: '', notes: '' };

type Tab = 'expenses' | 'income' | 'day-end';

export const DayTransactionsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('expenses');

  // ── Shared date range (drives all three tabs) ──────────────────────────────
  const [period,     setPeriod]     = useState<ReportPeriod>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo,   setCustomTo]   = useState('');

  // ── Data ──────────────────────────────────────────────────────────────────
  const [expenses,  setExpenses]  = useState<Expense[]>([]);
  const [income,    setIncome]    = useState<OtherIncome[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierWithBalance[]>([]);
  const [loading,   setLoading]   = useState(true);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [search,      setSearch]      = useState('');
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editTarget,  setEditTarget]  = useState<Expense | null>(null);
  const [form,        setForm]        = useState({ ...EMPTY_EXPENSE });
  const [incomeForm,  setIncomeForm]  = useState({ ...EMPTY_INCOME });
  const [saving,      setSaving]      = useState(false);
  const [formError,   setFormError]   = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: 'expense' | 'income' } | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  async function load(from?: string, to?: string) {
    setLoading(true);
    try {
      const [ex, inc, locs, sups] = await Promise.all([
        getExpenses({ from, to }), getOtherIncome({ from, to }), getLocations(), getSuppliers(),
      ]);
      setExpenses(ex); setIncome(inc); setLocations(locs); setSuppliers(sups);
    } catch (e: any) { showToast(e.message, false); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const { from, to } = getReportDateRange(period, customFrom, customTo);
    load(from, to);
  }, [period, customFrom, customTo]);

  const visibleExpenses = useMemo(() =>
    expenses.filter(e =>
      !search ||
      e.category.toLowerCase().includes(search.toLowerCase()) ||
      e.notes.toLowerCase().includes(search.toLowerCase())
    ), [expenses, search]);

  const visibleIncome = useMemo(() =>
    income.filter(i => !search || i.notes.toLowerCase().includes(search.toLowerCase())),
    [income, search]);

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalIncome   = income.reduce((s, i) => s + Number(i.amount), 0);

  // ── Expense CRUD ──────────────────────────────────────────────────────────
  function openAddExpense() {
    setEditTarget(null); setForm({ ...EMPTY_EXPENSE }); setFormError(''); setModalOpen(true);
  }
  function openEditExpense(e: Expense) {
    setEditTarget(e);
    setForm({ category: e.category, description: e.description || '', amount: String(e.amount), method: e.method, location_id: e.location_id || '', notes: e.notes });
    setFormError(''); setModalOpen(true);
  }
  async function handleSaveExpense() {
    setFormError('');
    const amt = parseFloat(form.amount);
    if (!form.category)       { setFormError('Category is required'); return; }
    if (!amt || amt <= 0)     { setFormError('Amount must be greater than 0'); return; }
    if (!form.notes.trim())   { setFormError('Notes are required'); return; }
    if (!form.method)         { setFormError('Payment method is required'); return; }
    setSaving(true);
    try {
      if (editTarget) {
        await updateExpense(editTarget.id, { category: form.category, description: form.description, amount: amt, method: form.method, location_id: form.location_id || undefined, notes: form.notes });
        showToast('Expense updated');
      } else {
        await createExpense({ category: form.category, description: form.description, amount: amt, method: form.method, location_id: form.location_id || undefined, notes: form.notes });
        showToast('Expense recorded');
      }
      setModalOpen(false); load();
    } catch (e: any) { setFormError(e.message); }
    finally { setSaving(false); }
  }

  // ── Income CRUD ───────────────────────────────────────────────────────────
  async function handleSaveIncome() {
    setFormError('');
    const amt = parseFloat(incomeForm.amount);
    if (!amt || amt <= 0)           { setFormError('Amount must be greater than 0'); return; }
    if (!incomeForm.notes.trim())   { setFormError('Notes are required'); return; }
    setSaving(true);
    try {
      await createOtherIncome({ source_type: incomeForm.source_type, amount: amt, method: incomeForm.method, supplier_id: incomeForm.supplier_id || undefined, notes: incomeForm.notes });
      showToast('Income recorded');
      setModalOpen(false); setIncomeForm({ ...EMPTY_INCOME }); load();
    } catch (e: any) { setFormError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'expense') { await deleteExpense(deleteTarget.id); showToast('Expense deleted'); }
      else { await deleteOtherIncome(deleteTarget.id); showToast('Income record deleted'); }
      load();
    } catch (e: any) { showToast(e.message, false); }
    finally { setDeleteTarget(null); }
  }

  const showAddButton = tab === 'expenses' || tab === 'income';

  return (
    <div className="pos-standard-page p-6 space-y-6 relative">

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-5 right-5 z-[200] flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold shadow-xl',
          toast.ok
            ? 'bg-green-500/15 border border-green-500/30 text-green-400'
            : 'bg-red-500/15 border border-red-500/30 text-red-400',
        )} style={{ animation: 'posFadeIn 180ms ease' }}>
          {toast.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Day Transactions</h1>
          <p className="text-xs text-gray-500 mt-0.5">Expenses, income, and daily financial summary</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker
            value={period} onChange={setPeriod}
            customFrom={customFrom} customTo={customTo}
            onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }}
          />
          {(tab === 'expenses' || tab === 'income') && (
            <button
              onClick={() => { const { from, to } = getReportDateRange(period, customFrom, customTo); load(from, to); }}
              className="p-2 bg-[#1d222a] border border-[#2b313a] text-gray-400 rounded-xl hover:text-white transition-all"
            >
              <RefreshCw size={13} />
            </button>
          )}
          {showAddButton && (
            <button
              onClick={() => {
                setFormError('');
                if (tab === 'expenses') openAddExpense();
                else { setIncomeForm({ ...EMPTY_INCOME }); setModalOpen(true); }
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors">
              <Plus size={13} />
              {tab === 'expenses' ? 'Add Expense' : 'Add Income'}
            </button>
          )}
        </div>
      </div>

      {/* KPI strip — only for expenses/income tabs */}
      {(tab === 'expenses' || tab === 'income') && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Expenses', value: fmt(totalExpenses), accent: 'text-red-400',     icon: TrendingDown },
            { label: 'Other Income',   value: fmt(totalIncome),   accent: 'text-emerald-400', icon: TrendingUp },
            { label: 'Net',            value: fmt(totalIncome - totalExpenses),
              accent: totalIncome >= totalExpenses ? 'text-emerald-400' : 'text-red-400', icon: Receipt },
          ].map(k => (
            <div key={k.label} className="bg-[#1d222a] border border-[#2b313a] rounded-2xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#2b313a] flex items-center justify-center">
                <k.icon size={16} className={k.accent} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{k.label}</p>
                <p className={cn('text-base font-bold font-mono mt-0.5', k.accent)}>{k.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[#1d222a] border border-[#2b313a] rounded-xl p-1">
        {([
          { id: 'expenses', label: 'Expenses' },
          { id: 'income',   label: 'Other Income' },
          { id: 'day-end',  label: 'Day End Report' },
        ] as { id: Tab; label: string }[]).map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSearch(''); }}
            className={cn(
              'flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all',
              tab === t.id ? 'bg-[#f8fafc] text-black' : 'text-gray-500 hover:text-gray-300',
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Day End Report ── */}
      {tab === 'day-end' && (
        <DailyFinanceReport
          period={period}
          customFrom={customFrom}
          customTo={customTo}
          onPeriodChange={setPeriod}
          onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }}
        />
      )}

      {/* ── Expenses / Income tables ── */}
      {(tab === 'expenses' || tab === 'income') && (
        <>
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl py-2.5 pl-9 pr-4 focus:outline-none focus:border-primary/40" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={20} className="animate-spin text-primary" />
              </div>
            ) : tab === 'expenses' ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#1d222a] border-b border-[#2b313a]">
                    {['Date', 'Category', 'Description', 'Method', 'Amount', ''].map(h => (
                      <th key={h} className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 last:text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2b313a]">
                  {visibleExpenses.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-600">No expenses found.</td></tr>
                  ) : visibleExpenses.map((e, i) => (
                    <tr key={e.id} className="hover:bg-[#1d222a] transition-colors"
                      style={{ animation: 'posFadeIn 200ms ease both', animationDelay: `${i * 20}ms` }}>
                      <td className="px-5 py-3.5 text-xs text-gray-500">{new Date(e.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-3.5 text-xs font-semibold text-white">{e.category}</td>
                      <td className="px-5 py-3.5 text-xs text-gray-400">{e.notes || e.description || '—'}</td>
                      <td className="px-5 py-3.5 text-xs text-gray-400 capitalize">{e.method.replace('_', ' ')}</td>
                      <td className="px-5 py-3.5 text-xs font-mono font-bold text-red-400">{fmt(e.amount)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditExpense(e)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#2b313a] transition-colors">
                            <Edit2 size={11} />
                          </button>
                          <button onClick={() => setDeleteTarget({ id: e.id, type: 'expense' })}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#1d222a] border-b border-[#2b313a]">
                    {['Date', 'Source', 'Supplier', 'Method', 'Amount', 'Notes', ''].map(h => (
                      <th key={h} className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 last:text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2b313a]">
                  {visibleIncome.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-600">No income records found.</td></tr>
                  ) : visibleIncome.map((inc, i) => (
                    <tr key={inc.id} className="hover:bg-[#1d222a] transition-colors"
                      style={{ animation: 'posFadeIn 200ms ease both', animationDelay: `${i * 20}ms` }}>
                      <td className="px-5 py-3.5 text-xs text-gray-500">{new Date(inc.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-3.5 text-xs font-semibold text-white capitalize">{inc.source_type.replace('_', ' ')}</td>
                      <td className="px-5 py-3.5 text-xs text-gray-400">{(inc.suppliers as any)?.name || '—'}</td>
                      <td className="px-5 py-3.5 text-xs text-gray-400 capitalize">{inc.method.replace('_', ' ')}</td>
                      <td className="px-5 py-3.5 text-xs font-mono font-bold text-emerald-400">{fmt(inc.amount)}</td>
                      <td className="px-5 py-3.5 text-xs text-gray-400">{inc.notes}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button onClick={() => setDeleteTarget({ id: inc.id, type: 'income' })}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                          <Trash2 size={11} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <>
          <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl w-full max-w-md shadow-2xl"
              style={{ animation: 'posFadeIn 180ms ease' }}>
              <div className="flex items-center justify-between p-5 border-b border-[#2b313a]">
                <h3 className="font-bold text-white">
                  {tab === 'expenses' ? (editTarget ? 'Edit Expense' : 'New Expense') : 'Record Other Income'}
                </h3>
                <button onClick={() => setModalOpen(false)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#2b313a] transition-colors">
                  <X size={14} />
                </button>
              </div>
              <div className="p-5 space-y-3">
                {formError && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                    <AlertCircle size={12} />{formError}
                  </div>
                )}

                {tab === 'expenses' ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Category *</label>
                        <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                          className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40">
                          <option value="">Select…</option>
                          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Method *</label>
                        <select value={form.method} onChange={e => setForm(p => ({ ...p, method: e.target.value }))}
                          className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40">
                          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Amount (LKR) *</label>
                      <input type="number" min="0" step="0.01" value={form.amount}
                        onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                        placeholder="0.00"
                        className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40 font-mono" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Location</label>
                      <select value={form.location_id} onChange={e => setForm(p => ({ ...p, location_id: e.target.value }))}
                        className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40">
                        <option value="">All Locations</option>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Notes *</label>
                      <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                        placeholder="What is this expense for?"
                        className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Source *</label>
                        <select value={incomeForm.source_type}
                          onChange={e => setIncomeForm(p => ({ ...p, source_type: e.target.value as any }))}
                          className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40">
                          {INCOME_SOURCES.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Method *</label>
                        <select value={incomeForm.method}
                          onChange={e => setIncomeForm(p => ({ ...p, method: e.target.value }))}
                          className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40">
                          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Amount (LKR) *</label>
                      <input type="number" min="0" step="0.01" value={incomeForm.amount}
                        onChange={e => setIncomeForm(p => ({ ...p, amount: e.target.value }))}
                        placeholder="0.00"
                        className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40 font-mono" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Supplier (Optional)</label>
                      <select value={incomeForm.supplier_id}
                        onChange={e => setIncomeForm(p => ({ ...p, supplier_id: e.target.value }))}
                        className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40">
                        <option value="">Select supplier…</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Notes *</label>
                      <input value={incomeForm.notes}
                        onChange={e => setIncomeForm(p => ({ ...p, notes: e.target.value }))}
                        placeholder="Description of income…"
                        className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40" />
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-3 p-5 border-t border-[#2b313a]">
                <button onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 bg-[#1d222a] border border-[#2b313a] text-gray-400 rounded-xl text-xs font-bold hover:text-white transition-colors">
                  Cancel
                </button>
                <button onClick={tab === 'expenses' ? handleSaveExpense : handleSaveIncome}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <Loader2 size={12} className="animate-spin" />}
                  {tab === 'expenses' ? (editTarget ? 'Save Changes' : 'Record Expense') : 'Record Income'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Record"
        message="Are you sure you want to delete this record? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};
