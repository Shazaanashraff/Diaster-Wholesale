import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, X, Loader2, AlertCircle, CheckCircle2, RefreshCw, ArrowRight } from 'lucide-react';
import {
  getStockTransfers, createStockTransfer, completeStockTransfer, cancelStockTransfer,
} from '../services/transferService';
import { getLocations } from '../services/supplierService';
import { getProducts } from '../services/productService';
import { getInventory } from '../services/inventoryService';
import { usePermissions } from '../utils/permissions';
import type { StockTransfer, Location, Product, ProductStock } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { cn } from '../lib/utils';

const fmt = (n: number) => Number(n).toLocaleString('en-LK');

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Pending',   cls: 'text-amber-400 bg-amber-500/10 border border-amber-500/20' },
  completed: { label: 'Completed', cls: 'text-green-400 bg-green-500/10 border border-green-500/20' },
  cancelled: { label: 'Cancelled', cls: 'text-red-400 bg-red-500/10 border border-red-500/20' },
};

interface TransferItemRow { product_id: string; quantity: number; }

export const StockTransfersPage: React.FC = () => {
  const { role, roleLabel, can } = usePermissions();
  const isManager = role === 'admin' || role === 'officer';

  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<ProductStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<StockTransfer | null>(null);
  const [completeTarget, setCompleteTarget] = useState<StockTransfer | null>(null);

  const [form, setForm] = useState({ from_location_id: '', to_location_id: '', notes: '' });
  const [items, setItems] = useState<TransferItemRow[]>([{ product_id: '', quantity: 0 }]);

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  async function load() {
    setLoading(true);
    try {
      const [t, l, p, inv] = await Promise.all([
        getStockTransfers(), getLocations(), getProducts(), getInventory(),
      ]);
      setTransfers(t); setLocations(l); setProducts(p); setInventory(inv);
    } catch (e: any) { showToast(e.message, false); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const visible = useMemo(() =>
    transfers.filter(t => !search ||
      t.reference.toLowerCase().includes(search.toLowerCase()) ||
      (t.from_location as any)?.name?.toLowerCase().includes(search.toLowerCase()) ||
      (t.to_location as any)?.name?.toLowerCase().includes(search.toLowerCase())
    ), [transfers, search]);

  // Stock map for validation and display
  const stockMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const inv of inventory) {
      m[inv.product_id] =
        (inv.cartons_in - inv.cartons_sold + inv.carton_adj) * inv.pieces_per_carton +
        (inv.pieces_in - inv.pieces_sold + inv.piece_adj);
    }
    return m;
  }, [inventory]);

  // Products sorted: in-stock first
  const sortedProducts = useMemo(() =>
    [...products].sort((a, b) => {
      const sa = stockMap[a.id] ?? 0, sb = stockMap[b.id] ?? 0;
      if (sa === 0 && sb > 0) return 1;
      if (sa > 0 && sb === 0) return -1;
      return a.name.localeCompare(b.name);
    }), [products, stockMap]);

  // Role restriction: Shop → Shop requires manager
  const fromLoc = locations.find(l => l.id === form.from_location_id);
  const toLoc = locations.find(l => l.id === form.to_location_id);
  const isShopToShop = fromLoc?.type === 'shop' && toLoc?.type === 'shop';
  const shopToShopBlocked = isShopToShop && !isManager;

  function setItem(idx: number, patch: Partial<TransferItemRow>) {
    setItems(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }

  async function handleCreate() {
    setFormError('');
    if (!form.from_location_id) { setFormError('Select a source location'); return; }
    if (!form.to_location_id) { setFormError('Select a destination location'); return; }
    if (form.from_location_id === form.to_location_id) { setFormError('Source and destination must be different'); return; }
    if (shopToShopBlocked) { setFormError('Shop → Shop transfers require Manager role'); return; }

    const validItems = items.filter(i => i.product_id && i.quantity > 0);
    if (validItems.length === 0) { setFormError('Add at least one item with quantity'); return; }

    // Stock availability check
    for (const item of validItems) {
      const available = stockMap[item.product_id] ?? 0;
      if (item.quantity > available) {
        const product = products.find(p => p.id === item.product_id);
        setFormError(`Insufficient stock for "${product?.name ?? item.product_id}". Available: ${available}, requested: ${item.quantity}.`);
        return;
      }
    }

    setSaving(true);
    try {
      await createStockTransfer({
        from_location_id: form.from_location_id,
        to_location_id: form.to_location_id,
        notes: form.notes,
        requested_by: roleLabel,
        items: validItems,
      });
      showToast('Transfer created');
      setPanelOpen(false);
      setForm({ from_location_id: '', to_location_id: '', notes: '' });
      setItems([{ product_id: '', quantity: 0 }]);
      load();
    } catch (e: any) { setFormError(e.message); }
    finally { setSaving(false); }
  }

  async function handleComplete(t: StockTransfer) {
    if (!isManager) { showToast('Only Managers can approve transfers', false); return; }
    setCompleteTarget(t);
  }

  async function confirmComplete() {
    if (!completeTarget) return;
    try {
      await completeStockTransfer(completeTarget.id, roleLabel);
      showToast('Transfer completed — stock updated');
      load();
    } catch (e: any) { showToast(e.message, false); }
    finally { setCompleteTarget(null); }
  }

  const totalItems = transfers.reduce((s) => s + 1, 0);
  const pending = transfers.filter(t => t.status === 'pending').length;
  const completed = transfers.filter(t => t.status === 'completed').length;

  return (
    <div className="pos-standard-page p-6 space-y-6 relative">
      {toast && (
        <div className={cn('fixed top-5 right-5 z-[200] flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold shadow-xl', toast.ok ? 'bg-green-500/15 border border-green-500/30 text-green-400' : 'bg-red-500/15 border border-red-500/30 text-red-400')} style={{ animation: 'posFadeIn 180ms ease' }}>
          {toast.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />} {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Stock Transfers</h1>
          <p className="text-xs text-gray-500 mt-0.5">Move stock between locations</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 bg-[#1d222a] border border-[#2b313a] text-gray-400 rounded-xl hover:text-white transition-all"><RefreshCw size={13} /></button>
          <button onClick={() => { setFormError(''); setPanelOpen(true); }} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90">
            <Plus size={13} /> New Transfer
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Transfers', value: totalItems },
          { label: 'Pending Approval', value: pending, accent: pending > 0 ? 'text-amber-400' : 'text-white' },
          { label: 'Completed', value: completed, accent: 'text-green-400' },
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
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by reference or location…" className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl py-2.5 pl-9 pr-4 focus:outline-none focus:border-primary/40" />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X size={12} /></button>}
      </div>

      {/* Table */}
      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#1d222a] border-b border-[#2b313a]">
              {['Reference', 'From', '', 'To', 'Status', 'Requested By', 'Date', ''].map((h, i) => (
                <th key={i} className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 last:text-right">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2b313a]">
            {loading ? (
              <tr><td colSpan={8} className="px-5 py-12 text-center"><Loader2 size={20} className="animate-spin text-primary mx-auto" /></td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-gray-600">No transfers found.</td></tr>
            ) : visible.map((t, i) => {
              const cfg = STATUS_CFG[t.status];
              const from = t.from_location as any;
              const to = t.to_location as any;
              return (
                <tr key={t.id} className="hover:bg-[#1d222a] transition-colors" style={{ animation: 'posFadeIn 200ms ease both', animationDelay: `${i * 20}ms` }}>
                  <td className="px-4 py-3.5 text-sm font-mono font-bold text-white">{t.reference}</td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-gray-300">{from?.name ?? '—'}</span>
                    <span className={cn('ml-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded', from?.type === 'warehouse' ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400')}>{from?.type}</span>
                  </td>
                  <td className="px-1"><ArrowRight size={12} className="text-gray-600" /></td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-gray-300">{to?.name ?? '—'}</span>
                    <span className={cn('ml-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded', to?.type === 'warehouse' ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400')}>{to?.type}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide', cfg.cls)}>{cfg.label}</span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-400">{t.requested_by}</td>
                  <td className="px-4 py-3.5 text-xs text-gray-500">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3.5 text-right">
                    {t.status === 'pending' && (
                      <div className="flex items-center justify-end gap-1">
                        {isManager && (
                          <button onClick={() => handleComplete(t)} className="px-2.5 py-1 bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold rounded-lg hover:bg-green-500/20 transition-colors">Approve</button>
                        )}
                        <button onClick={() => setCancelTarget(t)} className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold rounded-lg hover:bg-red-500/20 transition-colors">Cancel</button>
                      </div>
                    )}
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
          <div className="fixed right-0 top-0 h-full z-[110] w-[520px] bg-[#111315] border-l border-[#2b313a] flex flex-col shadow-2xl" style={{ animation: 'posFadeIn 180ms ease' }}>
            <div className="flex items-center justify-between p-5 border-b border-[#2b313a]">
              <h2 className="font-bold text-white">New Stock Transfer</h2>
              <button onClick={() => setPanelOpen(false)} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#2b313a] transition-colors"><X size={15} /></button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
              {formError && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400"><AlertCircle size={12} />{formError}</div>}

              {/* Locations */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">From Location *</label>
                  <select value={form.from_location_id} onChange={e => setForm(p => ({ ...p, from_location_id: e.target.value }))} className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40">
                    <option value="">Select…</option>
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>[{l.type}] {l.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">To Location *</label>
                  <select value={form.to_location_id} onChange={e => setForm(p => ({ ...p, to_location_id: e.target.value }))} className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40">
                    <option value="">Select…</option>
                    {locations.filter(l => l.id !== form.from_location_id).map(l => (
                      <option key={l.id} value={l.id}>[{l.type}] {l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Role restriction warning */}
              {shopToShopBlocked && (
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400">
                  <AlertCircle size={12} /> Shop → Shop transfers require Manager approval. Contact your manager.
                </div>
              )}

              {isShopToShop && isManager && (
                <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-400">
                  <CheckCircle2 size={12} /> Shop → Shop transfer — you have Manager authority to approve.
                </div>
              )}

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Items *</label>
                  <button onClick={() => setItems(p => [...p, { product_id: '', quantity: 0 }])} className="flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary/80 px-2 py-1 bg-primary/10 rounded-lg border border-primary/20">
                    <Plus size={10} /> Add Item
                  </button>
                </div>
                <div className="space-y-2">
                  {items.map((item, idx) => {
                    const available = item.product_id ? (stockMap[item.product_id] ?? 0) : null;
                    const overStock = available !== null && item.quantity > available;
                    return (
                      <div key={idx} className={cn('rounded-xl border p-3 space-y-2', overStock ? 'border-red-500/30 bg-red-500/5' : 'border-[#2b313a] bg-[#1d222a]')}>
                        <div className="grid grid-cols-[2fr_80px_24px] gap-2 items-center">
                          <select value={item.product_id} onChange={e => setItem(idx, { product_id: e.target.value })} className="bg-[#171c23] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary/40">
                            <option value="">Select product…</option>
                            {sortedProducts.map(p => {
                              const stock = stockMap[p.id] ?? 0;
                              return (
                                <option key={p.id} value={p.id}>
                                  {stock <= 0 ? '⚠ ' : ''}{p.item_code} — {p.name} ({stock} in stock)
                                </option>
                              );
                            })}
                          </select>
                          <input type="number" min="1" value={item.quantity || ''} onChange={e => setItem(idx, { quantity: parseInt(e.target.value) || 0 })} placeholder="Qty" className={cn('bg-[#171c23] border text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none font-mono', overStock ? 'border-red-500/50 focus:border-red-500' : 'border-[#2b313a] focus:border-primary/40')} />
                          <button onClick={() => setItems(p => p.filter((_, i) => i !== idx))} disabled={items.length === 1} className="text-gray-600 hover:text-red-400 transition-colors disabled:opacity-20"><X size={11} /></button>
                        </div>
                        {available !== null && (
                          <p className={cn('text-[9px]', overStock ? 'text-red-400' : 'text-gray-600')}>
                            {overStock ? `⚠ Exceeds available stock (${available})` : `Available: ${fmt(available)} units`}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Notes</label>
                <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Reason for transfer…" className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40" />
              </div>
            </div>

            <div className="border-t border-[#2b313a] p-5">
              {!isManager && (
                <p className="text-[10px] text-gray-600 mb-3 text-center">Transfer will be created as Pending — a Manager must approve to update stock.</p>
              )}
              <div className="flex gap-3">
                <button onClick={() => setPanelOpen(false)} className="flex-1 py-2.5 bg-[#1d222a] border border-[#2b313a] text-gray-400 rounded-xl text-xs font-bold hover:text-white transition-colors">Discard</button>
                <button onClick={handleCreate} disabled={saving || shopToShopBlocked} className="flex-1 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <Loader2 size={12} className="animate-spin" />} Create Transfer
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Approve confirm */}
      <ConfirmModal
        isOpen={!!completeTarget}
        onClose={() => setCompleteTarget(null)}
        onConfirm={confirmComplete}
        title="Approve Transfer"
        message={`Approve transfer ${completeTarget?.reference}? Stock will be immediately deducted from source and added to destination.`}
        confirmText="Approve & Complete"
        variant="warning"
      />

      {/* Cancel confirm */}
      <ConfirmModal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={async () => {
          if (!cancelTarget) return;
          try { await cancelStockTransfer(cancelTarget.id); showToast('Transfer cancelled'); load(); }
          catch (e: any) { showToast(e.message, false); }
          finally { setCancelTarget(null); }
        }}
        title="Cancel Transfer"
        message={`Cancel transfer ${cancelTarget?.reference}? No stock changes will be made.`}
        confirmText="Cancel Transfer"
        variant="warning"
      />
    </div>
  );
};
