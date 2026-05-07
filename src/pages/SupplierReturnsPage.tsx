import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, X, Loader2, AlertCircle, CheckCircle2, RefreshCw, Printer } from 'lucide-react';
import { getSupplierReturns, getSupplierReturnById, createSupplierReturn, completeSupplierReturn, cancelSupplierReturn } from '../services/purchaseReturnService';
import { getSuppliers } from '../services/supplierService';
import { getPurchases } from '../services/purchaseService';
import { getProducts } from '../services/productService';
import type { SupplierReturn, SupplierReturnItem, Purchase, Product } from '../types';
import type { SupplierWithBalance } from '../services/supplierService';
import { ConfirmModal } from '../components/ConfirmModal';
import { SupplierReturnPrint } from '../components/SupplierReturnPrint';
import { cn } from '../lib/utils';

const fmt = (n: number) => 'LKR ' + Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Pending',   cls: 'text-amber-400 bg-amber-500/10 border border-amber-500/20' },
  completed: { label: 'Completed', cls: 'text-green-400 bg-green-500/10 border border-green-500/20' },
  cancelled: { label: 'Cancelled', cls: 'text-red-400 bg-red-500/10 border border-red-500/20' },
};

interface ReturnItemRow { product_id: string; item_type: 'return' | 'replacement'; quantity: number; unit_value_lkr: number; }

export const SupplierReturnsPage: React.FC = () => {
  const [returns, setReturns] = useState<SupplierReturn[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierWithBalance[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [detailRet, setDetailRet] = useState<SupplierReturn | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<SupplierReturn | null>(null);
  const [printTarget, setPrintTarget] = useState<{ ret: SupplierReturn; items: SupplierReturnItem[] } | null>(null);
  const [printLoading, setPrintLoading] = useState(false);

  const [form, setForm] = useState({ supplier_id: '', purchase_id: '', return_type: 'return' as 'return' | 'exchange', notes: '' });
  const [items, setItems] = useState<ReturnItemRow[]>([{ product_id: '', item_type: 'return', quantity: 0, unit_value_lkr: 0 }]);
  const [settling, setSettling] = useState<{ open: boolean; type: 'payable'|'refund'|'credit_note'|'even'; notes: string }>({ open: false, type: 'even', notes: '' });

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  async function load() {
    setLoading(true);
    try {
      const [r, s, p, pr] = await Promise.all([getSupplierReturns(), getSuppliers(), getPurchases(), getProducts()]);
      setReturns(r); setSuppliers(s); setPurchases(p); setProducts(pr);
    } catch (e: any) { showToast(e.message, false); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => returns.filter(r =>
    !search || r.reference.toLowerCase().includes(search.toLowerCase()) ||
    (r.suppliers as any)?.name?.toLowerCase().includes(search.toLowerCase())
  ), [returns, search]);

  const supplierPurchases = useMemo(() =>
    purchases.filter(p => p.supplier_id === form.supplier_id && (p.status === 'received' || p.status === 'completed')),
    [purchases, form.supplier_id]);

  function addItem(type: 'return' | 'replacement') {
    setItems(p => [...p, { product_id: '', item_type: type, quantity: 0, unit_value_lkr: 0 }]);
  }

  function setItem(idx: number, patch: Partial<ReturnItemRow>) {
    setItems(p => p.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }

  const returnVal = items.filter(i => i.item_type === 'return').reduce((s, i) => s + i.quantity * i.unit_value_lkr, 0);
  const replaceVal = items.filter(i => i.item_type === 'replacement').reduce((s, i) => s + i.quantity * i.unit_value_lkr, 0);
  const diff = replaceVal - returnVal;

  async function handleCreate() {
    setFormError('');
    if (!form.supplier_id) { setFormError('Select a supplier'); return; }
    const validItems = items.filter(i => i.product_id && i.quantity > 0 && i.unit_value_lkr > 0);
    if (validItems.length === 0) { setFormError('Add at least one valid item'); return; }
    setSaving(true);
    try {
      await createSupplierReturn({ supplier_id: form.supplier_id, purchase_id: form.purchase_id || undefined, return_type: form.return_type, notes: form.notes, items: validItems });
      showToast('Return created');
      setPanelOpen(false);
      setForm({ supplier_id: '', purchase_id: '', return_type: 'return', notes: '' });
      setItems([{ product_id: '', item_type: 'return', quantity: 0, unit_value_lkr: 0 }]);
      load();
    } catch (e: any) { setFormError(e.message); }
    finally { setSaving(false); }
  }

  async function handleComplete(ret: SupplierReturn) {
    if (ret.return_type === 'exchange' && Math.abs(ret.difference_lkr) > 0.01) {
      setDetailRet(ret);
      setSettling({ open: true, type: ret.difference_lkr > 0 ? 'payable' : 'refund', notes: '' });
      return;
    }
    try {
      await completeSupplierReturn(ret.id, 'even');
      showToast('Return completed — stock updated');
      load();
    } catch (e: any) { showToast(e.message, false); }
  }

  async function handleSettle() {
    if (!detailRet) return;
    setSaving(true);
    try {
      await completeSupplierReturn(detailRet.id, settling.type, settling.notes);
      showToast('Exchange completed — stock updated');
      setSettling({ open: false, type: 'even', notes: '' });
      setDetailRet(null);
      load();
    } catch (e: any) { showToast(e.message, false); }
    finally { setSaving(false); }
  }

  async function handlePrint(ret: SupplierReturn) {
    setPrintLoading(true);
    try {
      const { ret: full, items: fullItems } = await getSupplierReturnById(ret.id);
      setPrintTarget({ ret: full, items: fullItems });
    } catch (e: any) { showToast(e.message, false); }
    finally { setPrintLoading(false); }
  }

  return (
    <div className="pos-standard-page p-6 space-y-6 relative">
      {toast && (
        <div className={cn('fixed top-5 right-5 z-[200] flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold shadow-xl', toast.ok ? 'bg-green-500/15 border border-green-500/30 text-green-400' : 'bg-red-500/15 border border-red-500/30 text-red-400')} style={{ animation: 'posFadeIn 180ms ease' }}>
          {toast.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />} {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Supplier Returns</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage returns & exchanges with suppliers</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 bg-[#1d222a] border border-[#2b313a] text-gray-400 rounded-xl hover:text-white transition-all"><RefreshCw size={13} /></button>
          <button onClick={() => { setFormError(''); setPanelOpen(true); }} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90">
            <Plus size={13} /> New Return
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Returns', value: returns.length },
          { label: 'Pending', value: returns.filter(r => r.status === 'pending').length, accent: 'text-amber-400' },
          { label: 'Completed', value: returns.filter(r => r.status === 'completed').length, accent: 'text-green-400' },
        ].map(k => (
          <div key={k.label} className="bg-[#1d222a] border border-[#2b313a] rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{k.label}</p>
            <p className={cn('text-xl font-bold mt-1', k.accent ?? 'text-white')}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by reference or supplier…" className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl py-2.5 pl-9 pr-4 focus:outline-none focus:border-primary/40" />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X size={12} /></button>}
      </div>

      {/* Table */}
      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#1d222a] border-b border-[#2b313a]">
              {['Reference', 'Supplier', 'Type', 'Status', 'Return Value', 'Difference', 'Date', ''].map(h => (
                <th key={h} className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 last:text-right">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2b313a]">
            {loading ? (
              <tr><td colSpan={8} className="px-5 py-12 text-center"><Loader2 size={20} className="animate-spin text-primary mx-auto" /></td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-gray-600 font-semibold">No returns found.</td></tr>
            ) : visible.map((r, i) => {
              const cfg = STATUS_CFG[r.status];
              return (
                <tr key={r.id} className="hover:bg-[#1d222a] transition-colors" style={{ animation: 'posFadeIn 200ms ease both', animationDelay: `${i * 20}ms` }}>
                  <td className="px-5 py-3.5 text-sm font-mono font-bold text-white">{r.reference}</td>
                  <td className="px-5 py-3.5 text-xs text-gray-300">{(r.suppliers as any)?.name ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide', r.return_type === 'exchange' ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' : 'text-orange-400 bg-orange-500/10 border border-orange-500/20')}>{r.return_type}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide', cfg.cls)}>{cfg.label}</span>
                  </td>
                  <td className="px-5 py-3.5 text-xs font-mono text-gray-300">{fmt(r.return_value_lkr)}</td>
                  <td className="px-5 py-3.5">
                    {Math.abs(r.difference_lkr) < 0.01
                      ? <span className="text-xs text-gray-500">Even</span>
                      : <span className={cn('text-xs font-mono font-bold', r.difference_lkr > 0 ? 'text-red-400' : 'text-emerald-400')}>{r.difference_lkr > 0 ? '+' : ''}{fmt(r.difference_lkr)}</span>}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {r.status === 'pending' && (
                        <>
                          <button onClick={() => handleComplete(r)} className="px-2.5 py-1 bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold rounded-lg hover:bg-green-500/20 transition-colors">Complete</button>
                          <button onClick={() => setCancelTarget(r)} className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold rounded-lg hover:bg-red-500/20 transition-colors">Cancel</button>
                        </>
                      )}
                      <button onClick={() => handlePrint(r)} disabled={printLoading} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#2b313a] transition-colors" title="Print"><Printer size={12} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create Panel */}
      {panelOpen && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" onClick={() => setPanelOpen(false)} />
          <div className="fixed right-0 top-0 h-full z-[110] w-[560px] bg-[#111315] border-l border-[#2b313a] flex flex-col shadow-2xl" style={{ animation: 'posFadeIn 180ms ease' }}>
            <div className="flex items-center justify-between p-5 border-b border-[#2b313a]">
              <h2 className="font-bold text-white">New Supplier Return</h2>
              <button onClick={() => setPanelOpen(false)} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#2b313a] transition-colors"><X size={15} /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
              {formError && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400"><AlertCircle size={12} />{formError}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Supplier *</label>
                  <select value={form.supplier_id} onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value, purchase_id: '' }))} className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40">
                    <option value="">Select supplier…</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Type *</label>
                  <select value={form.return_type} onChange={e => setForm(p => ({ ...p, return_type: e.target.value as any }))} className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40">
                    <option value="return">Return Only</option>
                    <option value="exchange">Exchange</option>
                  </select>
                </div>
              </div>

              {form.supplier_id && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Linked Purchase (Optional)</label>
                  <select value={form.purchase_id} onChange={e => setForm(p => ({ ...p, purchase_id: e.target.value }))} className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40">
                    <option value="">No linked purchase</option>
                    {supplierPurchases.map(p => <option key={p.id} value={p.id}>{p.reference} — {new Date(p.created_at).toLocaleDateString()}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Notes</label>
                <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Reason for return…" className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40" />
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Items *</label>
                  <div className="flex gap-1">
                    <button onClick={() => addItem('return')} className="flex items-center gap-1 text-[10px] font-bold text-orange-400 hover:text-orange-300 px-2 py-1 bg-orange-500/10 rounded-lg border border-orange-500/20"><Plus size={10} /> Return</button>
                    {form.return_type === 'exchange' && <button onClick={() => addItem('replacement')} className="flex items-center gap-1 text-[10px] font-bold text-blue-400 hover:text-blue-300 px-2 py-1 bg-blue-500/10 rounded-lg border border-blue-500/20"><Plus size={10} /> Replacement</button>}
                  </div>
                </div>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className={cn('rounded-xl border p-3 space-y-2', item.item_type === 'return' ? 'border-orange-500/20 bg-orange-500/5' : 'border-blue-500/20 bg-blue-500/5')}>
                      <div className="flex items-center justify-between">
                        <span className={cn('text-[9px] font-bold uppercase tracking-widest', item.item_type === 'return' ? 'text-orange-400' : 'text-blue-400')}>{item.item_type}</span>
                        <button onClick={() => setItems(p => p.filter((_, i) => i !== idx))} disabled={items.length === 1} className="text-gray-600 hover:text-red-400 transition-colors disabled:opacity-20"><X size={11} /></button>
                      </div>
                      <div className="grid grid-cols-[2fr_70px_90px] gap-2">
                        <select value={item.product_id} onChange={e => setItem(idx, { product_id: e.target.value })} className="bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary/40">
                          <option value="">Select product…</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.item_code} — {p.name}</option>)}
                        </select>
                        <input type="number" min="1" value={item.quantity || ''} onChange={e => setItem(idx, { quantity: parseInt(e.target.value) || 0 })} placeholder="Qty" className="bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary/40 font-mono" />
                        <input type="number" min="0" step="0.01" value={item.unit_value_lkr || ''} onChange={e => setItem(idx, { unit_value_lkr: parseFloat(e.target.value) || 0 })} placeholder="Unit LKR" className="bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary/40 font-mono" />
                      </div>
                      {item.quantity > 0 && item.unit_value_lkr > 0 && (
                        <p className="text-[9px] text-gray-500">Line total: {fmt(item.quantity * item.unit_value_lkr)}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer summary */}
            <div className="border-t border-[#2b313a] p-5 space-y-3">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-gray-500">Return Value</span><span className="font-mono text-orange-400">{fmt(returnVal)}</span></div>
                {form.return_type === 'exchange' && <div className="flex justify-between"><span className="text-gray-500">Replacement Value</span><span className="font-mono text-blue-400">{fmt(replaceVal)}</span></div>}
                {form.return_type === 'exchange' && <div className="flex justify-between font-bold border-t border-[#2b313a] pt-1.5"><span className="text-gray-300">Difference</span><span className={cn('font-mono', Math.abs(diff) < 0.01 ? 'text-gray-400' : diff > 0 ? 'text-red-400' : 'text-emerald-400')}>{diff > 0 ? '+' : ''}{fmt(diff)}</span></div>}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setPanelOpen(false)} className="flex-1 py-2.5 bg-[#1d222a] border border-[#2b313a] text-gray-400 rounded-xl text-xs font-bold hover:text-white transition-colors">Discard</button>
                <button onClick={handleCreate} disabled={saving} className="flex-1 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <Loader2 size={12} className="animate-spin" />} Create Return
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Settlement Modal */}
      {settling.open && detailRet && (
        <>
          <div className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-sm" onClick={() => setSettling(p => ({ ...p, open: false }))} />
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4" style={{ animation: 'posFadeIn 180ms ease' }}>
              <h3 className="font-bold text-white">Settle Difference</h3>
              <div className={cn('p-3 rounded-xl text-xs font-bold', detailRet.difference_lkr > 0 ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400')}>
                {detailRet.difference_lkr > 0 ? `You owe supplier ${fmt(detailRet.difference_lkr)}` : `Supplier owes you ${fmt(Math.abs(detailRet.difference_lkr))}`}
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Settlement Type</label>
                <select value={settling.type} onChange={e => setSettling(p => ({ ...p, type: e.target.value as any }))} className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40">
                  {detailRet.difference_lkr > 0 ? <option value="payable">Create Payable</option> : (<><option value="refund">Receive Refund</option><option value="credit_note">Credit Note (reduce payable)</option></>)}
                  <option value="even">Mark as Even</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Notes</label>
                <input value={settling.notes} onChange={e => setSettling(p => ({ ...p, notes: e.target.value }))} placeholder="Settlement notes…" className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setSettling(p => ({ ...p, open: false }))} className="flex-1 py-2.5 bg-[#1d222a] border border-[#2b313a] text-gray-400 rounded-xl text-xs font-bold">Cancel</button>
                <button onClick={handleSettle} disabled={saving} className="flex-1 py-2.5 bg-primary text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <Loader2 size={12} className="animate-spin" />} Complete Exchange
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Print Modal */}
      {printTarget && (
        <>
          <div className="fixed inset-0 z-[140] bg-black/70 backdrop-blur-sm" onClick={() => setPrintTarget(null)} />
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 overflow-y-auto">
            <div className="relative w-full max-w-2xl">
              <button onClick={() => setPrintTarget(null)} className="no-print absolute -top-10 right-0 p-2 text-white hover:text-gray-300"><X size={18} /></button>
              <SupplierReturnPrint
                ret={printTarget.ret}
                items={printTarget.items}
                supplier={suppliers.find(s => s.id === printTarget.ret.supplier_id) as any}
                onClose={() => setPrintTarget(null)}
              />
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={async () => { if (!cancelTarget) return; try { await cancelSupplierReturn(cancelTarget.id); showToast('Return cancelled'); load(); } catch (e: any) { showToast(e.message, false); } finally { setCancelTarget(null); } }}
        title="Cancel Return"
        message={`Cancel return ${cancelTarget?.reference}? No stock changes will be made.`}
        confirmText="Cancel Return"
        variant="warning"
      />
    </div>
  );
};
