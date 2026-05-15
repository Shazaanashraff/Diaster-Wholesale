import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, X, Loader2, AlertCircle, CheckCircle2,
  Package, ChevronRight, Trash2, RefreshCw,
} from 'lucide-react';
import { getPurchases, createPurchase, deletePurchase, requestDiscountApproval } from '../services/purchaseService';
import { getSuppliers, getLocations } from '../services/supplierService';
import { getProducts, createProduct } from '../services/productService';
import { getInventory, getMovementRates } from '../services/inventoryService';
import { usePermissions } from '../utils/permissions';
import type { Purchase, Product, ProductStock, Location } from '../types';
import type { SupplierWithBalance } from '../services/supplierService';
import { ConfirmModal } from '../components/ConfirmModal';
import { cn } from '../lib/utils';

const fmt = (n: number) =>
  'LKR ' + Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtRmb = (n: number) =>
  '¥ ' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft:      { label: 'Draft',      cls: 'text-gray-400 bg-gray-500/10 border border-gray-500/20' },
  ordered:    { label: 'Ordered',    cls: 'text-blue-400 bg-blue-500/10 border border-blue-500/20' },
  received:   { label: 'Received',   cls: 'text-green-400 bg-green-500/10 border border-green-500/20' },
  completed:  { label: 'Completed',  cls: 'text-purple-400 bg-purple-500/10 border border-purple-500/20' },
  cancelled:  { label: 'Cancelled',  cls: 'text-red-400 bg-red-500/10 border border-red-500/20' },
};

const ALL_STATUSES = ['all', 'draft', 'ordered', 'received', 'completed', 'cancelled'] as const;
type StatusFilter = (typeof ALL_STATUSES)[number];

interface NewItemRow {
  product_id: string;
  quantity_units: number;
  quantity_cartons: number;
  unit_price_rmb: number;
}

const EMPTY_ITEM: NewItemRow = { product_id: '', quantity_units: 0, quantity_cartons: 0, unit_price_rmb: 0 };

interface QuickProductForm {
  name: string;
  wholesale_price: string;
  retail_price: string;
  cost_price: string;
  pieces_per_carton: string;
  reorder_level: string;
  description: string;
}

const EMPTY_QUICK_PRODUCT: QuickProductForm = {
  name: '',
  wholesale_price: '',
  retail_price: '',
  cost_price: '',
  pieces_per_carton: '1',
  reorder_level: '0',
  description: '',
};

export const PurchasesPage: React.FC = () => {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierWithBalance[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<ProductStock[]>([]);
  const [movementRates, setMovementRates] = useState<Record<string, { units30d: number; perDay: number }>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { role, roleLabel } = usePermissions();

  // Panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [form, setForm] = useState({
    supplier_id: '',
    location_id: '',
    rep_name: '',
    exchange_rate: '48',
    discount_amount: '0',
    notes: '',
  });
  const [items, setItems] = useState<NewItemRow[]>([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [quickProductOpen, setQuickProductOpen] = useState(false);
  const [quickProductTargetRow, setQuickProductTargetRow] = useState<number | null>(null);
  const [quickProductForm, setQuickProductForm] = useState<QuickProductForm>({ ...EMPTY_QUICK_PRODUCT });
  const [quickProductSaving, setQuickProductSaving] = useState(false);
  const [quickProductError, setQuickProductError] = useState('');

  // Confirm delete
  const [deleteTarget, setDeleteTarget] = useState<Purchase | null>(null);

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  };

  async function load() {
    setLoading(true);
    try {
      const [p, s, locs, pr, inv, mv] = await Promise.all([
        getPurchases(), 
        getSuppliers(), 
        getLocations(),
        getProducts(),
        getInventory(),
        getMovementRates()
      ]);
      setPurchases(p);
      setSuppliers(s);
      setLocations(locs);
      setProducts(pr);
      setInventory(inv);
      setMovementRates(mv);
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    let list = purchases;
    if (statusFilter !== 'all') list = list.filter((p) => p.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.reference.toLowerCase().includes(q) ||
          (p.suppliers as any)?.name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [purchases, statusFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: purchases.length };
    for (const p of purchases) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [purchases]);

  // ── New purchase form ────────────────────────────────────────────
  function openPanel() {
  setForm({ supplier_id: '', location_id: '', rep_name: '', exchange_rate: '48', discount_amount: '0', notes: '' });
    setFormError('');
    setQuickProductOpen(false);
    setQuickProductError('');
    setQuickProductForm({ ...EMPTY_QUICK_PRODUCT });
    setPanelOpen(true);
  }

  function setItem(idx: number, patch: Partial<NewItemRow>) {
    setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addItemRow() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItemRow(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function openQuickProductForRow(idx: number) {
    setQuickProductTargetRow(idx);
    setQuickProductOpen(true);
    setQuickProductError('');
    setQuickProductForm({ ...EMPTY_QUICK_PRODUCT });
  }

  async function handleQuickCreateProduct() {
    const name = quickProductForm.name.trim();
    const wholesale_price = parseFloat(quickProductForm.wholesale_price) || 0;
    const retail_price = parseFloat(quickProductForm.retail_price) || 0;
    const cost_price = parseFloat(quickProductForm.cost_price) || 0;
    const pieces_per_carton = Math.max(1, parseInt(quickProductForm.pieces_per_carton, 10) || 1);
    const reorder_level = Math.max(0, parseInt(quickProductForm.reorder_level, 10) || 0);
    const description = quickProductForm.description.trim();

    if (!name) {
      setQuickProductError('Item name is required');
      return;
    }

    setQuickProductSaving(true);
    setQuickProductError('');
    try {
      const created = await createProduct({
        name,
        model: '',
        category: 'general',
        wholesale_price,
        retail_price,
        cost_price,
        pieces_per_carton,
        reorder_level,
        description,
      });

      setProducts((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      if (quickProductTargetRow !== null) {
        setItem(quickProductTargetRow, { product_id: created.id });
      }
      setQuickProductOpen(false);
      setQuickProductTargetRow(null);
      setQuickProductForm({ ...EMPTY_QUICK_PRODUCT });
      showToast(`${created.name} added`);
    } catch (e: any) {
      setQuickProductError(e.message ?? 'Failed to create product');
    } finally {
      setQuickProductSaving(false);
    }
  }

  const exchRate = parseFloat(form.exchange_rate) || 0;

  // Products sorted: low/zero stock first (need to reorder), then alphabetical
  const sortedProducts = useMemo(() => {
    const stockMap: Record<string, number> = {};
    for (const inv of inventory) {
      const total =
        (inv.cartons_in - inv.cartons_sold + inv.carton_adj) * inv.pieces_per_carton +
        (inv.pieces_in - inv.pieces_sold + inv.piece_adj);
      stockMap[inv.product_id] = total;
    }
    return [...products].sort((a, b) => {
      const sa = stockMap[a.id] ?? 0;
      const sb = stockMap[b.id] ?? 0;
      if (sa === 0 && sb > 0) return -1;
      if (sa > 0 && sb === 0) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [products, inventory]);

  const totals = useMemo(() => {
    const rmb = items.reduce((s, i) => s + i.quantity_units * i.unit_price_rmb, 0);
    return { rmb, lkr: rmb * exchRate };
  }, [items, exchRate]);

  async function handleCreate() {
    if (!form.supplier_id) { setFormError('Select a supplier'); return; }
    if (!exchRate || exchRate <= 0) { setFormError('Enter a valid exchange rate'); return; }
    const validItems = items.filter((i) => i.product_id && i.quantity_units > 0 && i.unit_price_rmb > 0);
    if (validItems.length === 0) { setFormError('Add at least one item with product, quantity and price'); return; }

    const discountVal = Number(form.discount_amount) || 0;
    const percent = totals.lkr > 0 ? (discountVal / totals.lkr) * 100 : 0;
    
    let needsApproval = false;
    let appliedDiscount = discountVal;

    if (percent > 15) {
      setFormError(`Discount exceeds maximum allowed limit (15%). You entered ${percent.toFixed(1)}%.`);
      return;
    }

    if (role === 'officer' || role === 'pos_operator') {
      if (percent > 10) {
        needsApproval = true;
        appliedDiscount = 0; // Applied after manager approval
      }
    }

    setSaving(true);
    setFormError('');
    try {
      const purchase = await createPurchase({
        supplier_id: form.supplier_id,
        location_id: form.location_id || undefined,
        rep_name: form.rep_name || undefined,
        exchange_rate: exchRate,
        discount_amount: appliedDiscount,
        notes: form.notes,
        items: validItems,
      });

      if (needsApproval) {
        await requestDiscountApproval({
          purchase_id: purchase.id,
          discount_type: 'bill',
          discount_amount: discountVal,
          discount_percent: percent,
          requested_by: roleLabel,
        });
        showToast(`${purchase.reference} drafted. Discount requires Manager approval.`, true);
      } else {
        showToast(`${purchase.reference} drafted`);
      }

      setPanelOpen(false);
      load();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteRequest(p: Purchase, e: React.MouseEvent) {
    e.stopPropagation();
    setDeleteTarget(p);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deletePurchase(deleteTarget.id);
      showToast(`${deleteTarget.reference} deleted`);
      load();
    } catch (err: any) {
      showToast(err.message, false);
    } finally {
      setDeleteTarget(null);
    }
  }

  // KPI summary
  const totalOrders = purchases.length;
  const totalValue = purchases.filter((p) => p.status !== 'draft' && p.status !== 'cancelled').reduce((s, p) => s + Number(p.total_lkr), 0);
  const activeOrders = purchases.filter((p) => p.status === 'ordered').length;

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
          <h1 className="text-xl font-bold text-white">Procurement</h1>
          <p className="text-xs text-gray-500 mt-0.5">Track purchases from suppliers</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 bg-[#1d222a] border border-[#2b313a] text-gray-400 rounded-xl hover:text-white hover:bg-[#252a33] transition-all"
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={openPanel}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors"
          >
            <Plus size={13} /> New Purchase
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Orders', value: totalOrders, sub: 'all time' },
          { label: 'Ordered', value: activeOrders, sub: 'active', accent: activeOrders > 0 },
          { label: 'Total Value', value: fmt(totalValue), sub: 'ordered+', mono: true },
        ].map((k) => (
          <div key={k.label} className="bg-[#1d222a] border border-[#2b313a] rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{k.label}</p>
            <p className={cn('text-xl font-bold mt-1', k.accent ? 'text-amber-400' : 'text-white', k.mono && 'font-mono text-base')}>
              {k.value}
            </p>
            <p className="text-[10px] text-gray-600 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 bg-[#1d222a] border border-[#2b313a] rounded-xl p-1">
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold capitalize transition-all',
              statusFilter === s
                ? 'bg-[#2b313a] text-white'
                : 'text-gray-500 hover:text-gray-300'
            )}
          >
            {s.replace('_', ' ')}
            {counts[s] > 0 && (
              <span className={cn('text-[9px] font-bold px-1 rounded-md', statusFilter === s ? 'bg-primary/30 text-primary' : 'bg-[#2b313a] text-gray-500')}>
                {counts[s]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by reference or supplier…"
          className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl py-2.5 pl-9 pr-4 focus:outline-none focus:border-primary/40"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
            <X size={12} />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#171c23] border border-[#f8fafc]/20 rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#f8fafc]/5 border-b border-[#2b313a]">
              {['Reference', 'Supplier', 'Status', 'Exchange Rate', 'Total RMB', 'Total LKR', 'Date', ''].map((h) => (
                <th key={h} className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 last:text-right">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2b313a]">
            {loading ? (
              <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-slate-600">Loading…</td></tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center">
                  <Package size={28} className="mx-auto text-slate-700 mb-2" />
                  <p className="text-sm text-slate-600 font-semibold">No purchases found.</p>
                </td>
              </tr>
            ) : visible.map((p, i) => {
              const supplier = (p.suppliers as any)?.name ?? '—';
              const cfg = STATUS_CONFIG[p.status];
              return (
                <tr
                  key={p.id}
                  className="hover:bg-[#1d222a] transition-colors cursor-pointer"
                  style={{ animation: 'posFadeIn 200ms ease both', animationDelay: `${i * 20}ms` }}
                  onClick={() => navigate(`/purchases/${p.id}`)}
                >
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-mono font-bold text-slate-100">{p.reference}</span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-300">{supplier}</td>
                  <td className="px-5 py-3.5">
                    <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide', cfg.cls)}>
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs font-mono text-slate-400">
                    1 RMB = {Number(p.exchange_rate).toFixed(2)} LKR
                  </td>
                  <td className="px-5 py-3.5 text-xs font-mono text-slate-300">{fmtRmb(p.total_rmb)}</td>
                  <td className="px-5 py-3.5 text-xs font-mono text-slate-100">{fmt(p.total_lkr)}</td>
                  <td className="px-5 py-3.5 text-xs text-slate-500">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      {p.status === 'draft' && (
                        <button
                          onClick={(e) => handleDeleteRequest(p, e)}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                      <ChevronRight size={14} className="text-slate-600" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── New Purchase Slide Panel ───────────────────────────────── */}
      {panelOpen && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" onClick={() => setPanelOpen(false)} />
          <div
            className="fixed right-0 top-0 h-full z-[110] w-[620px] bg-[#111315] border-l border-[#2b313a] flex flex-col shadow-2xl"
            style={{ animation: 'posFadeIn 180ms ease' }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between p-5 border-b border-[#2b313a]">
              <h2 className="font-bold text-slate-100">New Purchase Order</h2>
              <button onClick={() => setPanelOpen(false)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-[#2b313a] transition-colors">
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
              {formError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                  <AlertCircle size={12} /> {formError}
                </div>
              )}

              {/* Supplier + Location */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Supplier *</label>
                  <select
                    value={form.supplier_id}
                    onChange={(e) => setForm((p) => ({ ...p, supplier_id: e.target.value }))}
                    className="w-full bg-[#1d222a] border border-[#2b313a] text-slate-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-slate-500/40"
                  >
                    <option value="">Select supplier…</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.country})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Destination *</label>
                  <select
                    value={form.location_id}
                    onChange={(e) => setForm((p) => ({ ...p, location_id: e.target.value }))}
                    className="w-full bg-[#1d222a] border border-[#2b313a] text-slate-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-slate-500/40"
                  >
                    <option value="">Select location…</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Rate + Rep */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Exchange Rate (LKR for 1 RMB) *</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={form.exchange_rate}
                    onChange={(e) => setForm((p) => ({ ...p, exchange_rate: e.target.value }))}
                    className="w-full bg-[#1d222a] border border-[#2b313a] text-slate-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-slate-500/40 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Purchase Rep (Optional)</label>
                  <input
                    type="text"
                    value={form.rep_name}
                    onChange={(e) => setForm((p) => ({ ...p, rep_name: e.target.value }))}
                    placeholder="E.g., John Doe"
                    className="w-full bg-[#1d222a] border border-[#2b313a] text-slate-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-slate-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Notes</label>
                <input
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Optional notes…"
                  className="w-full bg-[#1d222a] border border-[#2b313a] text-slate-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-slate-500/40"
                />
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Items *</label>
                  <button
                    onClick={addItemRow}
                    className="flex items-center gap-1 text-[10px] font-bold text-slate-100 hover:text-slate-300 transition-colors"
                  >
                    <Plus size={11} /> Add Row
                  </button>
                </div>

                {quickProductOpen && (
                  <div className="mb-3 rounded-xl border border-[#2b313a] bg-[#171c23] p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Quick New Product</p>
                      <button
                        type="button"
                        onClick={() => setQuickProductOpen(false)}
                        className="text-gray-500 hover:text-white transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>

                    {quickProductError && (
                      <div className="text-[10px] font-semibold text-red-400">{quickProductError}</div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={quickProductForm.name}
                        onChange={(e) => setQuickProductForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Item name"
                        className="bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-primary/40"
                      />
                      <input
                        type="number"
                        min="1"
                        value={quickProductForm.pieces_per_carton}
                        onChange={(e) => setQuickProductForm((p) => ({ ...p, pieces_per_carton: e.target.value }))}
                        placeholder="Qty per carton"
                        className="bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-primary/40 font-mono"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={quickProductForm.cost_price}
                        onChange={(e) => setQuickProductForm((p) => ({ ...p, cost_price: e.target.value }))}
                        placeholder="Cost price"
                        className="bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-primary/40 font-mono"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={quickProductForm.wholesale_price}
                        onChange={(e) => setQuickProductForm((p) => ({ ...p, wholesale_price: e.target.value }))}
                        placeholder="Wholesale price"
                        className="bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-primary/40 font-mono"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={quickProductForm.retail_price}
                        onChange={(e) => setQuickProductForm((p) => ({ ...p, retail_price: e.target.value }))}
                        placeholder="Selling price"
                        className="bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-primary/40 font-mono"
                      />
                      <input
                        type="number"
                        min="0"
                        value={quickProductForm.reorder_level}
                        onChange={(e) => setQuickProductForm((p) => ({ ...p, reorder_level: e.target.value }))}
                        placeholder="Reorder level"
                        className="bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-primary/40 font-mono"
                      />
                    </div>

                    <input
                      value={quickProductForm.description}
                      onChange={(e) => setQuickProductForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Optional description"
                      className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-primary/40"
                    />

                    <button
                      type="button"
                      onClick={handleQuickCreateProduct}
                      disabled={quickProductSaving}
                      className="px-3 py-2 rounded-lg bg-primary text-white text-[10px] font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-1"
                    >
                      {quickProductSaving && <Loader2 size={10} className="animate-spin" />}
                      Create Item
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  {/* Column headers */}
                  <div className="grid grid-cols-[2fr_80px_80px_100px_24px] gap-2 px-1">
                    {['Product', 'Units', 'Cartons', 'Price (RMB)', ''].map((h) => (
                      <span key={h} className="text-[9px] font-bold uppercase tracking-widest text-slate-600">{h}</span>
                    ))}
                  </div>

                  {items.map((item, idx) => {
                    const lineLkr = item.quantity_units * item.unit_price_rmb * exchRate;
                    return (
                      <React.Fragment key={idx}>
                        <div className="grid grid-cols-[2fr_80px_80px_100px_24px] gap-2 items-center">
                          <div className="flex items-center gap-1">
                            <select
                              value={item.product_id}
                              onChange={(e) => setItem(idx, { product_id: e.target.value })}
                              className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-primary/40"
                            >
                              <option value="">Select product…</option>
                              {sortedProducts.map((p) => {
                                const inv = inventory.find(i => i.product_id === p.id);
                                const stock = inv
                                  ? (inv.cartons_in - inv.cartons_sold + inv.carton_adj) * inv.pieces_per_carton + (inv.pieces_in - inv.pieces_sold + inv.piece_adj)
                                  : 0;
                                return (
                                  <option key={p.id} value={p.id}>
                                    {stock <= 0 ? '⚠ ' : ''}{p.item_code} — {p.name}{stock > 0 ? ` (${stock} in stock)` : ' (out of stock)'}
                                  </option>
                                );
                              })}
                            </select>
                            <button
                              type="button"
                              onClick={() => openQuickProductForRow(idx)}
                              className="text-gray-500 hover:text-primary transition-colors p-1"
                              title="Quick create product"
                            >
                              <Plus size={14} />
                            </button>
                            <button
                              onClick={(e) => { e.preventDefault(); getProducts().then(setProducts); }}
                              className="text-gray-500 hover:text-primary transition-colors p-1"
                              title="Refresh products list"
                            >
                              <RefreshCw size={12} />
                            </button>
                          </div>
                          <input
                            type="number"
                            min="0"
                            value={item.quantity_units || ''}
                            onChange={(e) => setItem(idx, { quantity_units: parseInt(e.target.value) || 0 })}
                            placeholder="0"
                            className="bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-primary/40 font-mono"
                          />
                          <input
                            type="number"
                            min="0"
                            value={item.quantity_cartons || ''}
                            onChange={(e) => setItem(idx, { quantity_cartons: parseInt(e.target.value) || 0 })}
                            placeholder="0"
                            className="bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-primary/40 font-mono"
                          />
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              step="0.0001"
                              value={item.unit_price_rmb || ''}
                              onChange={(e) => setItem(idx, { unit_price_rmb: parseFloat(e.target.value) || 0 })}
                              placeholder="0.00"
                              className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-primary/40 font-mono"
                            />
                            {item.unit_price_rmb > 0 && exchRate > 0 && (
                              <span className="absolute -bottom-3 left-0 text-[8px] font-bold text-gray-500 whitespace-nowrap">
                                ≈ {fmt(lineLkr)}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => removeItemRow(idx)}
                            disabled={items.length === 1}
                            className="text-gray-600 hover:text-red-400 transition-colors disabled:opacity-20"
                          >
                            <X size={13} />
                          </button>
                        </div>
                        {item.product_id && (
                          <div className="col-span-5 bg-[#1d222a]/50 p-2 rounded-lg mt-1 mb-2 border border-[#2b313a] flex items-center gap-4">
                            {(() => {
                              const stock = inventory.find(i => i.product_id === item.product_id);
                              const movement = movementRates[item.product_id];
                              const totalPieces = stock ? (stock.cartons_in * stock.pieces_per_carton + stock.pieces_in - stock.cartons_sold * stock.pieces_per_carton - stock.pieces_sold + stock.piece_adj) : 0;
                              return (
                                <>
                                  <div className="text-[10px] text-gray-400">
                                    Current Stock: <span className="font-bold text-white">{totalPieces} pcs</span>
                                  </div>
                                  <div className="w-px h-3 bg-[#2b313a]" />
                                  <div className="text-[10px] text-gray-400">
                                    30d Movement: <span className="font-bold text-emerald-400">{movement ? movement.units30d : 0} pcs</span>
                                  </div>
                                  <div className="w-px h-3 bg-[#2b313a]" />
                                  <div className="text-[10px] text-gray-400">
                                    Wholesale Price: <span className="font-bold text-white">LKR {stock?.wholesale_price.toFixed(2) || 0}</span>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Summary + actions */}
            <div className="border-t border-[#2b313a] p-5 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Total RMB</span>
                <span className="font-mono font-bold text-white">{fmtRmb(totals.rmb)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Total LKR (at {exchRate} rate)</span>
                <span className="font-mono font-bold text-primary">{fmt(totals.lkr)}</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setPanelOpen(false)}
                  className="flex-1 py-2.5 bg-[#1d222a] border border-[#2b313a] text-gray-400 rounded-xl text-xs font-bold hover:text-white transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 size={12} className="animate-spin" />}
                  Save as Draft
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      {/* ── Confirm Delete ────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Purchase Order"
        message={`Are you sure you want to delete "${deleteTarget?.reference}"? This action cannot be undone.`}
        confirmText="Delete Purchase"
      />
    </div>
  );
};
