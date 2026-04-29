import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, X, Building2, Phone, Mail, Globe, Wallet,
  ChevronRight, Loader2, CreditCard, Banknote, CheckCircle2, AlertCircle,
  Trash2, Edit2,
} from 'lucide-react';
import {
  getSuppliers, createSupplier, updateSupplier, archiveSupplier,
  getSupplierLedger, recordSupplierPayment,
  type SupplierWithBalance, type SupplierLedger,
} from '../services/supplierService';
import type { Supplier } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { cn } from '../lib/utils';

const fmt = (n: number) =>
  'LKR ' + Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_BADGE: Record<string, string> = {
  draft:      'text-gray-400 bg-gray-500/10 border border-gray-500/20',
  confirmed:  'text-blue-400 bg-blue-500/10 border border-blue-500/20',
  in_transit: 'text-amber-400 bg-amber-500/10 border border-amber-500/20',
  received:   'text-green-400 bg-green-500/10 border border-green-500/20',
  closed:     'text-slate-400 bg-slate-500/10 border border-slate-500/20',
};

const EMPTY_FORM = {
  name: '', contact_person: '', phone: '', email: '', country: 'China', notes: '',
};

export const SuppliersPage: React.FC = () => {
  const [suppliers, setSuppliers] = useState<SupplierWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Drawer — supplier ledger
  const [drawerSupplier, setDrawerSupplier] = useState<SupplierWithBalance | null>(null);
  const [ledger, setLedger] = useState<SupplierLedger | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerTab, setLedgerTab] = useState<'purchases' | 'payments'>('purchases');

  // Add/Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Payment modal
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payForm, setPayForm] = useState({ 
    amount: '', 
    method: 'cash' as 'cash' | 'bank_transfer' | 'credit', 
    notes: '',
    allocations: {} as Record<string, string> // purchase_id -> amount
  });
  const [paying, setPaying] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Confirm delete
  const [deleteTarget, setDeleteTarget] = useState<SupplierWithBalance | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  };

  async function load() {
    setLoading(true);
    try {
      setSuppliers(await getSuppliers());
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const visible = useMemo(() =>
    suppliers.filter((s) =>
      !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.country.toLowerCase().includes(search.toLowerCase())
    ), [suppliers, search]);

  // ── Ledger drawer ────────────────────────────────────────────────
  async function openLedger(s: SupplierWithBalance) {
    setDrawerSupplier(s);
    setLedgerLoading(true);
    setLedger(null);
    try {
      setLedger(await getSupplierLedger(s.id));
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setLedgerLoading(false);
    }
  }

  // ── Add/Edit form ────────────────────────────────────────────────
  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditTarget(s);
    setForm({
      name: s.name, contact_person: s.contact_person, phone: s.phone,
      email: s.email, country: s.country, notes: s.notes,
    });
    setFormError('');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('Name is required'); return; }
    setSaving(true);
    try {
      if (editTarget) {
        await updateSupplier(editTarget.id, form);
        showToast('Supplier updated');
      } else {
        await createSupplier(form);
        showToast('Supplier added');
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteRequest(s: SupplierWithBalance) {
    setDeleteTarget(s);
    setDeleteError(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    setDeleteError(null);
    try {
      await archiveSupplier(deleteTarget.id);
      showToast('Supplier archived');
      load();
      setDeleteTarget(null);
    } catch (e: any) {
      setDeleteError(e.message || 'Failed to archive supplier');
    } finally {
      setSaving(false);
    }
  }

  // ── Payment ──────────────────────────────────────────────────────
  function openPayment(s: SupplierWithBalance) {
    setDrawerSupplier(s);
    setPayForm({ 
      amount: '', 
      method: 'cash', 
      notes: '',
      allocations: {}
    });
    setPayModalOpen(true);
  }

  async function handlePay() {
    if (!drawerSupplier) return;
    const amount = parseFloat(payForm.amount);
    if (!amount || amount <= 0) { showToast('Enter a valid amount', false); return; }
    
    const allocations = Object.entries(payForm.allocations)
      .filter(([_, amt]) => parseFloat(amt) > 0)
      .map(([id, amt]) => ({ purchase_id: id, amount: parseFloat(amt) }));

    setPaying(true);
    try {
      await recordSupplierPayment({
        supplier_id: drawerSupplier.id,
        amount,
        method: payForm.method,
        notes: payForm.notes,
        allocations: allocations.length > 0 ? allocations : undefined,
      });
      setPayModalOpen(false);
      showToast('Payment recorded');
      load();
      if (drawerSupplier) openLedger(drawerSupplier);
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setPaying(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────
  const totalOwed = suppliers.reduce((s, x) => s + x.outstanding, 0);
  const totalAdvances = suppliers.reduce((s, x) => s + x.advance_balance, 0);
  const totalSuppliers = suppliers.length;

  return (
    <div className="pos-standard-page p-6 space-y-6 relative">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'fixed top-5 right-5 z-[200] flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold shadow-xl',
            toast.ok
              ? 'bg-green-500/15 border border-green-500/30 text-green-400'
              : 'bg-red-500/15 border border-red-500/30 text-red-400'
          )}
          style={{ animation: 'posFadeIn 180ms ease' }}
        >
          {toast.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Suppliers</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage procurement partners & ledger</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors"
        >
          <Plus size={13} /> Add Supplier
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Suppliers', value: totalSuppliers, mono: false },
          { label: 'Total Outstanding', value: fmt(totalOwed), mono: true, red: totalOwed > 0 },
          { label: 'Total Advances', value: fmt(totalAdvances), mono: true, green: totalAdvances > 0 },
          { label: 'Active Suppliers', value: suppliers.filter((s) => s.total_purchased > 0).length, mono: false },
        ].map((k) => (
          <div key={k.label} className="bg-[#1d222a] border border-[#2b313a] rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{k.label}</p>
            <p className={cn('text-xl font-bold mt-1', k.red ? 'text-red-400' : (k.green ? 'text-emerald-400' : 'text-white'), k.mono && 'font-mono text-base')}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search suppliers…"
          className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl py-2.5 pl-9 pr-4 focus:outline-none focus:border-primary/40"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
            <X size={12} />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#1d222a] border-b border-[#2b313a]">
              {['Supplier', 'Country', 'Contact', 'Purchased', 'Paid', 'Bal/Adv', ''].map((h) => (
                <th key={h} className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 last:text-right">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2b313a]">
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-600">Loading…</td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-600 font-semibold">No suppliers found.</td></tr>
            ) : visible.map((s, i) => (
              <tr
                key={s.id}
                className="hover:bg-[#1d222a] transition-colors cursor-pointer"
                style={{ animation: 'posFadeIn 200ms ease both', animationDelay: `${i * 25}ms` }}
                onClick={() => openLedger(s)}
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                      <Building2 size={12} className="text-primary" />
                    </div>
                    <span className="text-sm font-semibold text-white">{s.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-xs text-gray-400">{s.country || '—'}</td>
                <td className="px-5 py-3.5 text-xs text-gray-400">{s.contact_person || '—'}</td>
                <td className="px-5 py-3.5 text-xs font-mono text-gray-300">{fmt(s.total_purchased)}</td>
                <td className="px-5 py-3.5 text-xs font-mono text-green-400">{fmt(s.total_paid)}</td>
                <td className="px-5 py-3.5">
                  {s.outstanding > 0 ? (
                    <span className="text-xs font-mono font-bold text-red-400">
                      {fmt(s.outstanding)}
                    </span>
                  ) : s.advance_balance > 0 ? (
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      Adv: {fmt(s.advance_balance)}
                    </span>
                  ) : (
                    <span className="text-xs font-mono font-bold text-gray-400">
                      {fmt(0)}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openPayment(s)}
                      className="px-2.5 py-1 bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold rounded-lg hover:bg-green-500/20 transition-colors"
                    >
                      Pay
                    </button>
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#2b313a] transition-colors">
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteRequest(s); }}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                    <ChevronRight size={14} className="text-gray-600" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Ledger Drawer ──────────────────────────────────────────── */}
      {drawerSupplier && !payModalOpen && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" onClick={() => setDrawerSupplier(null)} />
          <div
            className="fixed right-0 top-0 h-full z-[110] w-full max-w-[520px] bg-[#111315] border-l border-[#2b313a] flex flex-col shadow-2xl"
            style={{ animation: 'posFadeIn 180ms ease' }}
          >
            <div className="flex items-center justify-between p-5 border-b border-[#2b313a]">
              <div>
                <h2 className="text-base font-bold text-white">{drawerSupplier.name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  {drawerSupplier.phone && (
                    <span className="flex items-center gap-1 text-[10px] text-gray-500"><Phone size={10} />{drawerSupplier.phone}</span>
                  )}
                  {drawerSupplier.email && (
                    <span className="flex items-center gap-1 text-[10px] text-gray-500"><Mail size={10} />{drawerSupplier.email}</span>
                  )}
                  <span className="flex items-center gap-1 text-[10px] text-gray-500"><Globe size={10} />{drawerSupplier.country}</span>
                </div>
              </div>
              <button onClick={() => setDrawerSupplier(null)} className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-[#2b313a] transition-colors">
                <X size={15} />
              </button>
            </div>

            {/* Balance strip */}
            <div className="grid grid-cols-4 gap-3 p-5 border-b border-[#2b313a]">
              {[
                { label: 'Total Purchased', val: fmt(drawerSupplier.total_purchased), cls: 'text-white' },
                { label: 'Total Paid', val: fmt(drawerSupplier.total_paid), cls: 'text-green-400' },
                { label: 'Outstanding', val: fmt(drawerSupplier.outstanding), cls: drawerSupplier.outstanding > 0 ? 'text-red-400' : 'text-gray-400' },
                { label: 'Advance', val: fmt(drawerSupplier.advance_balance), cls: drawerSupplier.advance_balance > 0 ? 'text-emerald-400' : 'text-gray-400' },
              ].map((k) => (
                <div key={k.label} className="bg-[#1d222a] rounded-xl p-3">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600">{k.label}</p>
                  <p className={cn('text-xs font-mono font-bold mt-1', k.cls)}>{k.val}</p>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-[#1d222a] border-b border-[#2b313a] gap-1">
              {(['purchases', 'payments'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setLedgerTab(t)}
                  className={cn(
                    'flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all',
                    ledgerTab === t ? 'bg-[#f8fafc] text-black shadow-lg' : 'text-gray-500 hover:text-gray-300'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {ledgerLoading ? (
                <div className="flex items-center justify-center h-40 text-gray-600">
                  <Loader2 size={18} className="animate-spin" />
                </div>
              ) : !ledger ? null : ledgerTab === 'purchases' ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#1d222a]">
                      {['Reference', 'Status', 'Items', 'Total LKR'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2b313a]">
                    {ledger.purchases.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-gray-600">No purchases yet.</td></tr>
                    ) : ledger.purchases.map((p) => (
                      <tr key={p.id} className="hover:bg-[#1d222a] transition-colors">
                        <td className="px-4 py-3 text-xs font-mono font-bold text-white">{p.reference}</td>
                        <td className="px-4 py-3">
                          <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide', STATUS_BADGE[p.status])}>
                            {p.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{p.item_count}</td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-300">{fmt(p.total_lkr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#1d222a]">
                      {['Date', 'Amount', 'Method', 'Notes'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2b313a]">
                    {ledger.payments.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-gray-600">No payments yet.</td></tr>
                    ) : ledger.payments.map((p) => (
                      <tr key={p.id} className="hover:bg-[#1d222a] transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-400">{new Date(p.paid_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-xs font-mono font-bold text-green-400">{fmt(p.amount)}</td>
                        <td className="px-4 py-3 text-xs text-gray-400 capitalize">{p.method.replace('_', ' ')}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{p.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-4 border-t border-[#2b313a]">
              <button
                onClick={() => openPayment(drawerSupplier)}
                className="w-full py-4 bg-[#f8fafc] text-black border border-[#f8fafc] rounded-2xl text-sm font-bold hover:bg-white transition-all active:scale-[0.98] transition-colors"
              >
                Record Payment
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Add/Edit Modal ─────────────────────────────────────────── */}
      {modalOpen && (
        <>
          <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl w-full max-w-md shadow-2xl" style={{ animation: 'posFadeIn 180ms ease' }}>
              <div className="flex items-center justify-between p-5 border-b border-[#2b313a]">
                <h3 className="font-bold text-white">{editTarget ? 'Edit Supplier' : 'New Supplier'}</h3>
                <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#2b313a] transition-colors">
                  <X size={14} />
                </button>
              </div>
              <div className="p-5 space-y-3">
                {formError && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                    <AlertCircle size={12} /> {formError}
                  </div>
                )}
                {[
                  { key: 'name', label: 'Supplier Name *', placeholder: 'e.g. Guangzhou Trading Co.' },
                  { key: 'contact_person', label: 'Contact Person', placeholder: 'e.g. Wang Li' },
                  { key: 'phone', label: 'Phone', placeholder: '+86 …' },
                  { key: 'email', label: 'Email', placeholder: 'contact@example.com' },
                  { key: 'country', label: 'Country', placeholder: 'China' },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{f.label}</label>
                    <input
                      value={(form as any)[f.key]}
                      onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-primary/40"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    rows={2}
                    className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-primary/40 resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 p-5 border-t border-[#2b313a]">
                <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 bg-[#1d222a] border border-[#2b313a] text-gray-400 rounded-xl text-xs font-bold hover:text-white transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 size={12} className="animate-spin" />}
                  {editTarget ? 'Save Changes' : 'Add Supplier'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Payment Modal ──────────────────────────────────────────── */}
      {payModalOpen && drawerSupplier && (
        <>
          <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm" onClick={() => setPayModalOpen(false)} />
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" style={{ animation: 'posFadeIn 180ms ease' }}>
              <div className="flex items-center justify-between p-5 border-b border-[#2b313a]">
                <h3 className="font-bold text-white">Record Payment — {drawerSupplier.name}</h3>
                <button onClick={() => setPayModalOpen(false)} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#2b313a] transition-colors">
                  <X size={14} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Amount (LKR)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payForm.amount}
                    onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-primary/40 font-mono"
                  />
                  {drawerSupplier.outstanding > 0 && (
                    <p className="text-[10px] text-gray-600 mt-1">Outstanding: {fmt(drawerSupplier.outstanding)}</p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Method</label>
                  <div className="flex gap-2">
                    {[
                      { val: 'cash', icon: Banknote, label: 'Cash' },
                      { val: 'bank_transfer', icon: CreditCard, label: 'Bank' },
                      { val: 'credit', icon: Wallet, label: 'Credit' },
                    ].map((m) => (
                      <button
                        key={m.val}
                        onClick={() => setPayForm((p) => ({ ...p, method: m.val as any }))}
                        className={cn(
                          'flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border text-[10px] font-bold transition-all',
                          payForm.method === m.val
                            ? 'bg-primary/15 border-primary/40 text-primary'
                            : 'bg-[#1d222a] border-[#2b313a] text-gray-500 hover:border-[#3d4652]'
                        )}
                      >
                        <m.icon size={14} />{m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">Allocate to Purchases (Optional)</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                    {ledger?.purchases.filter(p => p.status !== 'draft').map(p => {
                      const allocated = payForm.allocations[p.id] || '';
                      return (
                        <div key={p.id} className="flex items-center gap-3 bg-[#1d222a] border border-[#2b313a] rounded-xl p-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-mono font-bold text-white truncate">{p.reference}</p>
                            <p className="text-[9px] text-gray-500">Total: {fmt(p.total_lkr)}</p>
                          </div>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={allocated}
                            onChange={(e) => setPayForm(prev => ({
                              ...prev,
                              allocations: { ...prev.allocations, [p.id]: e.target.value }
                            }))}
                            className="w-24 bg-[#171c23] border border-[#2b313a] text-xs text-primary font-mono rounded-lg px-2 py-1 outline-none focus:border-primary/40"
                          />
                        </div>
                      );
                    })}
                    {ledger?.purchases.filter(p => p.status !== 'draft').length === 0 && (
                      <p className="text-[10px] text-gray-600 italic">No confirmed/received purchases to allocate.</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Notes</label>
                  <input
                    value={payForm.notes}
                    onChange={(e) => setPayForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Optional reference…"
                    className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-primary/40"
                  />
                </div>
              </div>
              <div className="flex gap-3 p-5 border-t border-[#2b313a]">
                <button onClick={() => setPayModalOpen(false)} className="flex-1 py-2.5 bg-[#1d222a] border border-[#2b313a] text-gray-400 rounded-xl text-xs font-bold hover:text-white transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handlePay}
                  disabled={paying}
                  className="flex-1 py-4 bg-[#f8fafc] text-black border border-[#f8fafc] rounded-2xl text-sm font-bold hover:bg-white transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {paying && <Loader2 size={12} className="animate-spin" />}
                  Record Payment
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Confirm Delete ────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setDeleteError(null); }}
        onConfirm={handleDelete}
        title="Archive Supplier"
        message={`Are you sure you want to archive "${deleteTarget?.name}"? They will no longer appear in active lists, but all historical transactions will be preserved.`}
        confirmText="Archive Supplier"
        variant="warning"
        isLoading={saving}
        error={deleteError}
      />
    </div>
  );
};
