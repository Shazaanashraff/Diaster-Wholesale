import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, AlertCircle, Loader2, Package,
  Truck, Lock, ClipboardList, Calculator, Plus, Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  getPurchaseById,
  confirmPurchase,
  markInTransit,
  receivePurchase,
  addPurchaseCost,
  deletePurchaseCost,
  finalizeCostingAndClose,
  type ReceiveItemInput,
} from '../services/purchaseService';
import type { Purchase, PurchaseItem, PurchaseCost, PurchaseReceive, Carton } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { cn } from '../lib/utils';

const fmt = (n: number) =>
  'LKR ' + Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtRmb = (n: number) =>
  '¥ ' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  draft:      { label: 'Draft',      cls: 'text-gray-400 bg-gray-500/10 border border-gray-500/20',   icon: ClipboardList },
  confirmed:  { label: 'Confirmed',  cls: 'text-blue-400 bg-blue-500/10 border border-blue-500/20',   icon: CheckCircle2 },
  in_transit: { label: 'In Transit', cls: 'text-amber-400 bg-amber-500/10 border border-amber-500/20', icon: Truck },
  received:   { label: 'Received',   cls: 'text-green-400 bg-green-500/10 border border-green-500/20', icon: Package },
  closed:     { label: 'Closed',     cls: 'text-slate-400 bg-slate-500/10 border border-slate-500/20', icon: Lock },
};

const COST_TYPES = ['shipping', 'clearing', 'tax', 'other'] as const;

export const PurchaseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [costs, setCosts] = useState<PurchaseCost[]>([]);
  const [received, setReceived] = useState<PurchaseReceive[]>([]);
  const [cartons, setCartons] = useState<Carton[]>([]);
  const [loading, setLoading] = useState(true);

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  // Action loading
  const [actionLoading, setActionLoading] = useState(false);

  // Receive form state (per item)
  const [receiveForm, setReceiveForm] = useState<Record<string, { received: string; damaged: string; notes: string }>>({});

  // Cost form state
  const [costForm, setCostForm] = useState({ cost_type: 'shipping' as typeof COST_TYPES[number], amount_lkr: '', notes: '' });
  const [addingCost, setAddingCost] = useState(false);
  const [finalizeConfirmOpen, setFinalizeConfirmOpen] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const { purchase: p, items: it, costs: co, received: re, cartons: ca } = await getPurchaseById(id);
      setPurchase(p);
      setItems(it);
      setCosts(co);
      setReceived(re);
      setCartons(ca);

      // Init receive form from items
      const rf: typeof receiveForm = {};
      for (const i of it) {
        rf[i.product_id] = { received: String(i.quantity_units), damaged: '0', notes: '' };
      }
      setReceiveForm(rf);
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  // ── Status actions ───────────────────────────────────────────────

  async function handleConfirm() {
    if (!purchase) return;
    setActionLoading(true);
    try {
      await confirmPurchase(purchase.id);
      showToast('Purchase confirmed');
      load();
    } catch (e: any) { showToast(e.message, false); } finally { setActionLoading(false); }
  }

  async function handleMarkInTransit() {
    if (!purchase) return;
    setActionLoading(true);
    try {
      await markInTransit(purchase.id);
      showToast('Marked as In Transit');
      load();
    } catch (e: any) { showToast(e.message, false); } finally { setActionLoading(false); }
  }

  async function handleReceive() {
    if (!purchase) return;
    const receiveItems: ReceiveItemInput[] = items.map((item) => {
      const rf = receiveForm[item.product_id] ?? { received: '0', damaged: '0', notes: '' };
      const product = item.products as any;
      return {
        product_id: item.product_id,
        ordered_units: item.quantity_units,
        received_units: parseInt(rf.received) || 0,
        damaged_units: parseInt(rf.damaged) || 0,
        pieces_per_carton: Number(product?.pieces_per_carton ?? 1),
        notes: rf.notes,
      };
    });

    setActionLoading(true);
    try {
      await receivePurchase(purchase.id, receiveItems);
      showToast('Purchase received — stock updated');
      load();
    } catch (e: any) { showToast(e.message, false); } finally { setActionLoading(false); }
  }

  // ── Costs ────────────────────────────────────────────────────────

  async function handleAddCost() {
    if (!purchase || !costForm.amount_lkr) return;
    const amount = parseFloat(costForm.amount_lkr);
    if (!amount || amount <= 0) { showToast('Enter a valid amount', false); return; }
    setAddingCost(true);
    try {
      await addPurchaseCost({
        purchase_id: purchase.id,
        cost_type: costForm.cost_type,
        amount_lkr: amount,
        notes: costForm.notes,
      });
      setCostForm({ cost_type: 'shipping', amount_lkr: '', notes: '' });
      load();
    } catch (e: any) { showToast(e.message, false); } finally { setAddingCost(false); }
  }

  async function handleDeleteCost(costId: string) {
    try {
      await deletePurchaseCost(costId);
      load();
    } catch (e: any) { showToast(e.message, false); }
  }

  // ── Finalize costing ─────────────────────────────────────────────

  async function handleFinalize() {
    if (!purchase) return;
    setActionLoading(true);
    try {
      await finalizeCostingAndClose(purchase.id, items, received, costs, purchase.exchange_rate);
      showToast('Purchase closed — cost prices updated');
      load();
    } catch (e: any) { showToast(e.message, false); } finally { setActionLoading(false); }
  }

  // ── Computed values ──────────────────────────────────────────────

  const totalAddlCosts = useMemo(() => costs.reduce((s, c) => s + Number(c.amount_lkr), 0), [costs]);
  const totalSellable = useMemo(
    () => received.reduce((s, r) => s + Math.max(0, r.received_units - r.damaged_units), 0),
    [received]
  );
  const estimatedCPPerUnit = useMemo(() => {
    if (!purchase || totalSellable === 0) return 0;
    return (Number(purchase.total_lkr) + totalAddlCosts) / totalSellable;
  }, [purchase, totalAddlCosts, totalSellable]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="p-6 text-center">
        <AlertCircle size={28} className="mx-auto text-red-400 mb-2" />
        <p className="text-sm text-gray-400">Purchase not found.</p>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[purchase.status];
  const StatusIcon = statusCfg.icon;
  const supplier = (purchase.suppliers as any);
  const isLocked = purchase.status === 'closed';

  // Step indicator
  const STEPS = ['draft', 'confirmed', 'in_transit', 'received', 'closed'];
  const stepIdx = STEPS.indexOf(purchase.status);

  return (
    <div className="pos-standard-page p-6 space-y-6 max-w-4xl mx-auto">
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

      {/* Back + header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/purchases')}
            className="p-2 bg-[#1d222a] border border-[#2b313a] text-gray-400 rounded-xl hover:text-white hover:bg-[#252a33] transition-all"
          >
            <ArrowLeft size={14} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white font-mono">{purchase.reference}</h1>
              <span className={cn('flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wide', statusCfg.cls)}>
                <StatusIcon size={10} />
                {statusCfg.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {supplier?.name ?? '—'} · Created {new Date(purchase.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Primary action button */}
        <div>
          {purchase.status === 'draft' && (
            <button
              onClick={handleConfirm}
              disabled={actionLoading}
              className="flex items-center gap-2 px-6 py-3.5 bg-[#f8fafc] text-black border border-[#f8fafc] rounded-2xl text-sm font-bold hover:bg-white transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Confirm Order
            </button>
          )}
          {purchase.status === 'confirmed' && (
            <button
              onClick={handleMarkInTransit}
              disabled={actionLoading}
              className="flex items-center gap-2 px-6 py-3.5 bg-[#f8fafc] text-black border border-[#f8fafc] rounded-2xl text-sm font-bold hover:bg-white transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <Truck size={14} />}
              Mark In Transit
            </button>
          )}
          {purchase.status === 'received' && (
            <button
              onClick={() => setFinalizeConfirmOpen(true)}
              disabled={actionLoading || costs.length === 0}
              className="flex items-center gap-2 px-6 py-3.5 bg-[#f8fafc] text-black border border-[#f8fafc] rounded-2xl text-sm font-bold hover:bg-white transition-all active:scale-[0.98] disabled:opacity-50"
              title={costs.length === 0 ? 'Add at least one cost first' : ''}
            >
              {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <Lock size={14} />}
              Finalize & Close
            </button>
          )}
        </div>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-0">
        {STEPS.map((step, i) => {
          const done = i <= stepIdx;
          const active = i === stepIdx;
          return (
            <React.Fragment key={step}>
              <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold capitalize transition-all', active ? statusCfg.cls : done ? 'text-gray-400' : 'text-gray-700')}>
                {done && !active && <CheckCircle2 size={9} />}
                {step.replace('_', ' ')}
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn('flex-1 h-px mx-1', i < stepIdx ? 'bg-primary/30' : 'bg-[#2b313a]')} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Summary card */}
      <div className="bg-[#1d222a] border border-[#2b313a] rounded-2xl p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Supplier', value: supplier?.name ?? '—' },
            { label: 'Country', value: supplier?.country ?? '—' },
            { label: 'Exchange Rate', value: `1 RMB = ${Number(purchase.exchange_rate).toFixed(2)} LKR`, mono: true },
            { label: 'Status', value: statusCfg.label },
          ].map((f) => (
            <div key={f.label}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600">{f.label}</p>
              <p className={cn('text-sm font-semibold text-white mt-1', f.mono && 'font-mono text-xs')}>{f.value}</p>
            </div>
          ))}
        </div>
        {purchase.notes && (
          <p className="mt-4 text-xs text-gray-500 border-t border-[#2b313a] pt-4">{purchase.notes}</p>
        )}
      </div>

      {/* Items table */}
      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#2b313a] flex items-center justify-between">
          <h2 className="text-xs font-bold text-white uppercase tracking-widest">Order Items</h2>
          <div className="flex gap-4 text-xs">
            <span className="text-gray-500">Total RMB: <span className="font-mono font-bold text-white">{fmtRmb(purchase.total_rmb)}</span></span>
            <span className="text-gray-500">Total LKR: <span className="font-mono font-bold text-primary">{fmt(purchase.total_lkr)}</span></span>
          </div>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#1d222a]">
              {['Product', 'Model', 'Qty (Units)', 'Cartons (Ref)', 'Unit Price (RMB)', 'Total LKR'].map((h) => (
                <th key={h} className="px-5 py-3 text-[9px] font-bold uppercase tracking-widest text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2b313a]">
            {items.map((item) => {
              const product = item.products as any;
              const cartonId = `${purchase.reference}-${product?.model ?? 'UNK'}`;
              const lineLkr = item.quantity_units * item.unit_price_rmb * Number(purchase.exchange_rate);
              return (
                <tr key={item.id} className="hover:bg-[#1d222a] transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="text-xs font-semibold text-white">{product?.name ?? item.product_id}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">ID: {cartonId}-*</p>
                  </td>
                  <td className="px-5 py-3.5 text-xs font-mono text-gray-400">{product?.model ?? '—'}</td>
                  <td className="px-5 py-3.5 text-xs font-mono text-white">{item.quantity_units.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-xs font-mono text-gray-500">{item.quantity_cartons}</td>
                  <td className="px-5 py-3.5 text-xs font-mono text-gray-300">{fmtRmb(item.unit_price_rmb)}</td>
                  <td className="px-5 py-3.5 text-xs font-mono text-white">{fmt(lineLkr)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── IN TRANSIT: Receive form ─────────────────────────────── */}
      {purchase.status === 'in_transit' && (
        <div className="bg-[#171c23] border border-amber-500/20 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#2b313a] bg-amber-500/5">
            <h2 className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2">
              <Truck size={13} /> Receive Confirmation
            </h2>
            <p className="text-[10px] text-gray-500 mt-0.5">Enter actual quantities received. Damaged units will be logged separately.</p>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_2fr] gap-3 mb-1">
              {['Product', 'Ordered', 'Received', 'Damaged', 'Notes'].map((h) => (
                <span key={h} className="text-[9px] font-bold uppercase tracking-widest text-gray-600">{h}</span>
              ))}
            </div>
            {items.map((item) => {
              const product = item.products as any;
              const rf = receiveForm[item.product_id] ?? { received: '', damaged: '0', notes: '' };
              const net = (parseInt(rf.received) || 0) - (parseInt(rf.damaged) || 0);
              const hasShortage = (parseInt(rf.received) || 0) < item.quantity_units;
              return (
                <div key={item.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_2fr] gap-3 items-start">
                  <div>
                    <p className="text-xs font-semibold text-white">{product?.name ?? '—'}</p>
                    <p className="text-[10px] text-gray-500">Ordered: {item.quantity_units} units</p>
                    {net > 0 && (
                      <p className={cn('text-[10px] mt-0.5', hasShortage ? 'text-amber-400' : 'text-green-400')}>
                        Net sellable: {net} units
                      </p>
                    )}
                  </div>
                  <div className="text-xs font-mono text-gray-500 pt-2">{item.quantity_units}</div>
                  <input
                    type="number"
                    min="0"
                    value={rf.received}
                    onChange={(e) =>
                      setReceiveForm((prev) => ({
                        ...prev,
                        [item.product_id]: { ...rf, received: e.target.value },
                      }))
                    }
                    className={cn(
                      'bg-[#1d222a] border text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none font-mono',
                      hasShortage ? 'border-amber-500/40 focus:border-amber-500/60' : 'border-[#2b313a] focus:border-primary/40'
                    )}
                  />
                  <input
                    type="number"
                    min="0"
                    value={rf.damaged}
                    onChange={(e) =>
                      setReceiveForm((prev) => ({
                        ...prev,
                        [item.product_id]: { ...rf, damaged: e.target.value },
                      }))
                    }
                    className="bg-[#1d222a] border border-red-500/20 text-red-400 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-red-500/40 font-mono"
                  />
                  <input
                    type="text"
                    value={rf.notes}
                    onChange={(e) =>
                      setReceiveForm((prev) => ({
                        ...prev,
                        [item.product_id]: { ...rf, notes: e.target.value },
                      }))
                    }
                    placeholder="Notes…"
                    className="bg-[#1d222a] border border-[#2b313a] text-gray-400 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary/40"
                  />
                </div>
              );
            })}
            <button
              onClick={handleReceive}
              disabled={actionLoading}
              className="w-full py-4 bg-[#f8fafc] text-black border border-[#f8fafc] rounded-2xl text-sm font-bold hover:bg-white transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <Package size={14} />}
              Confirm Receipt & Update Stock
            </button>
          </div>
        </div>
      )}
      {/* ── RECEIVED: Show receive summary ───────────────────────── */}
      {(purchase.status === 'received' || purchase.status === 'closed') && received.length > 0 && (
        <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#2b313a]">
            <h2 className="text-xs font-bold text-green-400 uppercase tracking-widest flex items-center gap-2">
              <Package size={13} /> Receive Summary
            </h2>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#1d222a]">
                {['Product', 'Ordered', 'Received', 'Damaged', 'Net Sellable', 'Variance'].map((h) => (
                  <th key={h} className="px-5 py-3 text-[9px] font-bold uppercase tracking-widest text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2b313a]">
              {received.map((r) => {
                const product = r.products as any;
                const net = Math.max(0, r.received_units - r.damaged_units);
                const variance = r.received_units - r.ordered_units;
                return (
                  <tr key={r.id} className="hover:bg-[#1d222a] transition-colors">
                    <td className="px-5 py-3.5 text-xs font-semibold text-white">{product?.name ?? r.product_id}</td>
                    <td className="px-5 py-3.5 text-xs font-mono text-gray-400">{r.ordered_units}</td>
                    <td className="px-5 py-3.5 text-xs font-mono text-white">{r.received_units}</td>
                    <td className="px-5 py-3.5 text-xs font-mono text-red-400">{r.damaged_units}</td>
                    <td className="px-5 py-3.5 text-xs font-mono text-green-400">{net}</td>
                    <td className="px-5 py-3.5">
                      <span className={cn('text-xs font-mono', variance < 0 ? 'text-red-400' : variance > 0 ? 'text-green-400' : 'text-gray-500')}>
                        {variance >= 0 ? '+' : ''}{variance}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── RECEIVED: Generated Cartons ─────────────────────────── */}
      {(purchase.status === 'received' || purchase.status === 'closed') && cartons.length > 0 && (
        <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#2b313a]">
            <h2 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Package size={13} /> Generated Cartons
            </h2>
            <p className="text-[10px] text-gray-500 mt-0.5">Tracking codes for each received carton.</p>
          </div>
          <div className="p-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {cartons.map((c) => (
              <div key={c.id} className="bg-[#1d222a] border border-[#2b313a] rounded-lg p-2 flex flex-col gap-1">
                <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">{(c.products as any)?.model || 'ITEM'}</p>
                <p className="text-xs font-mono font-bold text-white">{c.carton_code}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className={cn(
                    "text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-widest",
                    c.status === 'in_stock' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'
                  )}>
                    {c.status.replace('_', ' ')}
                  </span>
                  <span className="text-[8px] text-gray-600 font-mono">#{c.carton_index}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── RECEIVED: Add costs ──────────────────────────────────── */}
      {purchase.status === 'received' && (
        <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#2b313a]">
            <h2 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Calculator size={13} /> Additional Costs
            </h2>
            <p className="text-[10px] text-gray-500 mt-0.5">Add shipping, clearing, tax and other costs to calculate the final cost price.</p>
          </div>

          {/* Add cost form */}
          <div className="p-5 border-b border-[#2b313a]">
            <div className="grid grid-cols-[150px_1fr_2fr_auto] gap-3 items-end">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-1">Type</label>
                <select
                  value={costForm.cost_type}
                  onChange={(e) => setCostForm((p) => ({ ...p, cost_type: e.target.value as any }))}
                  className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-primary/40 capitalize"
                >
                  {COST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-1">Amount (LKR)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={costForm.amount_lkr}
                  onChange={(e) => setCostForm((p) => ({ ...p, amount_lkr: e.target.value }))}
                  placeholder="0.00"
                  className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-primary/40 font-mono"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-1">Notes</label>
                <input
                  type="text"
                  value={costForm.notes}
                  onChange={(e) => setCostForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Optional…"
                  className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-primary/40"
                />
              </div>
              <button
                onClick={handleAddCost}
                disabled={addingCost}
                className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {addingCost ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                Add
              </button>
            </div>
          </div>

          {/* Costs list */}
          {costs.length > 0 && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#1d222a]">
                  {['Type', 'Amount', 'Notes', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-[9px] font-bold uppercase tracking-widest text-gray-600 last:text-right">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b313a]">
                {costs.map((c) => (
                  <tr key={c.id} className="hover:bg-[#1d222a] transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-semibold text-white capitalize">{c.cost_type}</span>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-mono text-primary">{fmt(c.amount_lkr)}</td>
                    <td className="px-5 py-3.5 text-xs text-gray-500">{c.notes || '—'}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button onClick={() => handleDeleteCost(c.id)} className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Cost summary preview */}
          {costs.length > 0 && totalSellable > 0 && (
            <div className="p-5 border-t border-[#2b313a] bg-primary/5 space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Cost Preview</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-[#1d222a] rounded-xl p-3">
                  <p className="text-[9px] text-gray-600 uppercase tracking-widest">Purchase Cost (LKR)</p>
                  <p className="font-mono font-bold text-white mt-1">{fmt(purchase.total_lkr)}</p>
                </div>
                <div className="bg-[#1d222a] rounded-xl p-3">
                  <p className="text-[9px] text-gray-600 uppercase tracking-widest">Additional Costs</p>
                  <p className="font-mono font-bold text-amber-400 mt-1">{fmt(totalAddlCosts)}</p>
                </div>
                <div className="bg-[#1d222a] rounded-xl p-3">
                  <p className="text-[9px] text-gray-600 uppercase tracking-widest">Sellable Units</p>
                  <p className="font-mono font-bold text-green-400 mt-1">{totalSellable}</p>
                </div>
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
                  <p className="text-[9px] text-primary uppercase tracking-widest">Est. Cost / Unit</p>
                  <p className="font-mono font-bold text-primary mt-1">{fmt(estimatedCPPerUnit)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CLOSED: Cost breakdown ───────────────────────────────── */}
      {purchase.status === 'closed' && (
        <div className="bg-[#171c23] border border-[#f8fafc]/20 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#2b313a] bg-[#f8fafc]/5">
            <h2 className="text-xs font-bold text-[#f8fafc] uppercase tracking-widest flex items-center gap-2">
              <TrendingUp size={13} /> Final Cost Breakdown
            </h2>
          </div>
          <div className="p-5 space-y-4">
            {costs.length > 0 && (
              <div className="space-y-2">
                {costs.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 capitalize">{c.cost_type}{c.notes ? ` — ${c.notes}` : ''}</span>
                    <span className="font-mono text-gray-300">{fmt(c.amount_lkr)}</span>
                  </div>
                ))}
                <div className="border-t border-[#2b313a] pt-2 flex items-center justify-between text-xs">
                  <span className="font-bold text-white">Total Additional Costs</span>
                  <span className="font-mono font-bold text-amber-400">{fmt(totalAddlCosts)}</span>
                </div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#1d222a] rounded-xl p-3">
                <p className="text-[9px] text-gray-600 uppercase tracking-widest">Purchase LKR</p>
                <p className="font-mono font-bold text-white text-xs mt-1">{fmt(purchase.total_lkr)}</p>
              </div>
              <div className="bg-[#1d222a] rounded-xl p-3">
                <p className="text-[9px] text-gray-600 uppercase tracking-widest">Sellable Units</p>
                <p className="font-mono font-bold text-green-400 text-xs mt-1">{totalSellable}</p>
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
                <p className="text-[9px] text-primary uppercase tracking-widest">Cost / Unit</p>
                <p className="font-mono font-bold text-primary text-xs mt-1">{fmt(estimatedCPPerUnit)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-green-500/5 border border-green-500/20 rounded-xl">
              <CheckCircle2 size={13} className="text-green-400 shrink-0" />
              <p className="text-xs text-green-400">Purchase closed. Product cost prices and MSP have been updated.</p>
            </div>
          </div>
        </div>
      )}
      {/* ── Confirm Finalize ────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={finalizeConfirmOpen}
        onClose={() => setFinalizeConfirmOpen(false)}
        onConfirm={handleFinalize}
        title="Finalize Costing?"
        message="This will close the purchase, update product cost prices and MSP based on the added costs. This action cannot be undone."
        confirmText="Finalize & Close"
        variant="warning"
      />
    </div>
  );
};
