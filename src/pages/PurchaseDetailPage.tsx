import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, AlertCircle, Loader2, Package,
  Lock, ClipboardList, Calculator, Plus, Trash2,
  TrendingUp, XCircle, CheckCheck, Printer, X
} from 'lucide-react';
import { PurchaseBillPrint } from '../components/PurchaseBillPrint';
import {
  getPurchaseById,
  orderPurchase,
  cancelPurchase,
  receivePurchase,
  addPurchaseCost,
  deletePurchaseCost,
  updatePurchaseItems,
  finalizeCostingAndClose,
  getPendingApprovals,
  resolveDiscountApproval,
  updatePurchaseDiscount,
  type ReceiveItemInput,
} from '../services/purchaseService';
import { getProducts } from '../services/productService';
import type { Purchase, PurchaseItem, PurchaseCost, PurchaseReceive, Carton, PurchaseDiscountApproval, SupplierPayment, Product } from '../types';
import { supabase } from '../lib/supabase';
import { ConfirmModal } from '../components/ConfirmModal';
import { usePermissions } from '../utils/permissions';
import { cn } from '../lib/utils';

const fmt = (n: number) =>
  'LKR ' + Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const normalizePurchaseTotal = (p: Pick<Purchase, 'total_lkr' | 'total_rmb' | 'exchange_rate'>): number => {
  const rate = Number(p.exchange_rate ?? 0);
  const totalLkr = Number(p.total_lkr ?? 0);
  const totalRmb = Number(p.total_rmb ?? 0);
  if (rate > 0 && totalLkr > 0) return totalLkr / rate;
  if (totalLkr > 0) return totalLkr;
  return totalRmb;
};
const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  draft:      { label: 'Draft',      cls: 'text-gray-400 bg-gray-500/10 border border-gray-500/20',   icon: ClipboardList },
  ordered:    { label: 'Ordered',    cls: 'text-blue-400 bg-blue-500/10 border border-blue-500/20',   icon: CheckCircle2 },
  received:   { label: 'Received',   cls: 'text-green-400 bg-green-500/10 border border-green-500/20', icon: Package },
  completed:  { label: 'Completed',  cls: 'text-purple-400 bg-purple-500/10 border border-purple-500/20', icon: CheckCheck },
  cancelled:  { label: 'Cancelled',  cls: 'text-red-400 bg-red-500/10 border border-red-500/20', icon: XCircle },
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
  const [approvals, setApprovals] = useState<PurchaseDiscountApproval[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editItems, setEditItems] = useState<PurchaseItem[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editProducts, setEditProducts] = useState<Product[]>([]);
  const [editProductsLoading, setEditProductsLoading] = useState(false);

  const { can, roleLabel, role } = usePermissions();
  const isAdmin = role === 'admin';

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
  const [printOpen, setPrintOpen] = useState(false);

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
      setEditMode(false);
      setEditItems([]);
      setEditError(null);

      // Init receive form from items
      const rf: typeof receiveForm = {};
      for (const i of it) {
        rf[i.product_id] = { received: String(i.quantity_units), damaged: '0', notes: '' };
      }
      setReceiveForm(rf);

      const pendingApps = await getPendingApprovals(id);
      setApprovals(pendingApps);

      const { data: pmts } = await supabase
        .from('supplier_payments')
        .select('*')
        .eq('purchase_id', id)
        .order('paid_at', { ascending: false });
      setPayments((pmts ?? []) as SupplierPayment[]);
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  // ── Status actions ───────────────────────────────────────────────

  async function handleOrder() {
    if (!purchase) return;
    if (approvals.length > 0) { showToast('Cannot proceed: pending discount approval', false); return; }
    setActionLoading(true);
    try {
      await orderPurchase(purchase.id);
      showToast('Purchase ordered');
      load();
    } catch (e: any) { showToast(e.message, false); } finally { setActionLoading(false); }
  }

  async function handleCancel() {
    if (!purchase) return;
    const confirm = window.confirm('Are you sure you want to cancel this purchase?');
    if (!confirm) return;
    
    setActionLoading(true);
    try {
      await cancelPurchase(purchase.id);
      showToast('Purchase cancelled');
      load();
    } catch (e: any) { showToast(e.message, false); } finally { setActionLoading(false); }
  }

  async function handleReceive() {
    if (!purchase) return;
    if (approvals.length > 0) { showToast('Cannot proceed: pending discount approval', false); return; }
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
    if (approvals.length > 0) { showToast('Cannot proceed: pending discount approval', false); return; }
    setFinalizeConfirmOpen(false);
    setActionLoading(true);
    try {
      await finalizeCostingAndClose(purchase.id, items, received, costs, 1);
      showToast('Purchase completed — cost prices updated');
      load();
    } catch (e: any) { showToast(e.message, false); } finally { setActionLoading(false); }
  }

  async function handleResolveApproval(approvalId: string, status: 'approved' | 'rejected', amount: number) {
    try {
      await resolveDiscountApproval(approvalId, status, roleLabel);
      if (status === 'approved') {
        await updatePurchaseDiscount(purchase!.id, amount);
        showToast('Discount approved');
      } else {
        showToast('Discount rejected');
      }
      load();
    } catch (e: any) {
      showToast(e.message, false);
    }
  }

  async function loadEditProducts() {
    if (editProductsLoading || editProducts.length > 0) return;
    setEditProductsLoading(true);
    try {
      const list = await getProducts();
      setEditProducts(list);
    } catch (e: any) {
      showToast(e.message ?? 'Failed to load products', false);
    } finally {
      setEditProductsLoading(false);
    }
  }

  function startEditItems() {
    setEditItems(items.map((item) => ({ ...item })));
    setEditMode(true);
    setEditError(null);
    loadEditProducts();
  }

  function cancelEditItems() {
    setEditMode(false);
    setEditItems([]);
    setEditError(null);
  }

  function updateEditItem(itemId: string, updates: Partial<PurchaseItem>) {
    setEditItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...updates } : item)));
  }

  function addEditItemRow() {
    if (!purchase) return;
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setEditItems((prev) => ([
      ...prev,
      {
        id: tempId,
        purchase_id: purchase.id,
        product_id: '',
        quantity_units: 0,
        quantity_cartons: 0,
        unit_price_rmb: 0,
        discount_percent: 0,
        created_at: new Date().toISOString(),
      },
    ]));
  }

  function removeEditItemRow(itemId: string) {
    setEditItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  async function handleSaveItems() {
    if (!purchase) return;

    const cleaned = editItems.map((item) => ({
      product_id: item.product_id,
      quantity_units: Number(item.quantity_units) || 0,
      quantity_cartons: Number(item.quantity_cartons) || 0,
      unit_price_rmb: Number(item.unit_price_rmb) || 0,
      discount_percent: item.discount_percent ?? 0,
    }));

    const validItems = cleaned.filter((i) => i.product_id && i.quantity_units > 0 && i.unit_price_rmb > 0);
    if (validItems.length === 0) {
      setEditError('Add at least one item with product, quantity, and price.');
      return;
    }

    setEditSaving(true);
    setEditError(null);
    try {
      await updatePurchaseItems(purchase.id, validItems, purchase.exchange_rate || 1);
      showToast('Purchase items updated');
      setEditMode(false);
      setEditItems([]);
      load();
    } catch (e: any) {
      setEditError(e.message ?? 'Failed to update purchase items');
    } finally {
      setEditSaving(false);
    }
  }

  // ── Computed values ──────────────────────────────────────────────

  const totalAddlCosts = useMemo(() => costs.reduce((s, c) => s + Number(c.amount_lkr), 0), [costs]);
  const totalSellable = useMemo(
    () => received.reduce((s, r) => s + Math.max(0, r.received_units - r.damaged_units), 0),
    [received]
  );
  const editTotal = useMemo(
    () => editItems.reduce((s, i) => s + Number(i.quantity_units) * Number(i.unit_price_rmb), 0),
    [editItems]
  );
  const estimatedCPPerUnit = useMemo(() => {
    if (!purchase || totalSellable === 0) return 0;
    return (Number(purchase.total_rmb) + totalAddlCosts) / totalSellable;
  }, [purchase, totalAddlCosts, totalSellable]);
  const displayTotal = useMemo(() => (purchase ? normalizePurchaseTotal(purchase) : 0), [purchase]);

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

  // Step indicator
  const STEPS = ['draft', 'ordered', 'received', 'completed'];
  // (cancelled is not in the linear progression)
  const isCancelled = purchase.status === 'cancelled';
  const stepIdx = isCancelled ? -1 : STEPS.indexOf(purchase.status);

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
            {purchase.rep_name && (
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                  Rep: <span className="text-gray-300">{purchase.rep_name}</span>
                </div>
              )}
          </div>
        </div>

        {/* Primary action button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPrintOpen(true)}
            className="flex items-center gap-2 px-4 py-3 bg-[#1d222a] border border-[#2b313a] text-gray-300 rounded-2xl text-sm font-bold hover:text-white hover:bg-[#252a33] transition-all"
          >
            <Printer size={14} /> Print Bill
          </button>
          {purchase.status === 'draft' && (
            <button
              onClick={handleOrder}
              disabled={actionLoading}
              className="flex items-center gap-2 px-6 py-3.5 bg-[#f8fafc] text-black border border-[#f8fafc] rounded-2xl text-sm font-bold hover:bg-white transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Place Order
            </button>
          )}
          {purchase.status === 'ordered' && (
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="flex items-center gap-2 px-6 py-3.5 bg-red-500/10 text-red-500 border border-red-500/30 rounded-2xl text-sm font-bold hover:bg-red-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={14} />}
              Cancel Order
            </button>
          )}
          {purchase.status === 'received' && (
            <button
              onClick={() => setFinalizeConfirmOpen(true)}
              disabled={actionLoading}
              className="flex items-center gap-2 px-6 py-3.5 bg-[#f8fafc] text-black border border-[#f8fafc] rounded-2xl text-sm font-bold hover:bg-white transition-all active:scale-[0.98] disabled:opacity-50"
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
            { label: 'Total (LKR)', value: fmt(displayTotal), mono: true },
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
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-500">Total: <span className="font-mono font-bold text-primary">{fmt(editMode ? editTotal : displayTotal)}</span></span>
            {isAdmin && !editMode && (
              <button
                onClick={startEditItems}
                className="px-3 py-1.5 rounded-lg bg-[#1d222a] border border-[#2b313a] text-gray-400 hover:text-white hover:bg-[#252a33] transition-all text-[10px] font-bold"
              >
                Edit Items
              </button>
            )}
            {isAdmin && editMode && (
              <>
                <button
                  onClick={addEditItemRow}
                  className="px-3 py-1.5 rounded-lg bg-[#1d222a] border border-[#2b313a] text-gray-400 hover:text-white hover:bg-[#252a33] transition-all text-[10px] font-bold flex items-center gap-1"
                >
                  <Plus size={10} /> Add Item
                </button>
                <button
                  onClick={cancelEditItems}
                  className="px-3 py-1.5 rounded-lg bg-[#1d222a] border border-[#2b313a] text-gray-400 hover:text-white hover:bg-[#252a33] transition-all text-[10px] font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveItems}
                  disabled={editSaving}
                  className="px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all text-[10px] font-bold flex items-center gap-1"
                >
                  {editSaving ? <Loader2 size={10} className="animate-spin" /> : null}
                  Save Changes
                </button>
              </>
            )}
          </div>
        </div>
        {editMode && (
          <div className="px-5 py-2 border-b border-[#2b313a] space-y-1">
            {purchase.status !== 'draft' && (
              <p className="text-[10px] text-amber-400">Edits will not adjust stock or finalized costs already posted.</p>
            )}
            {editError && (
              <p className="text-[10px] text-red-400">{editError}</p>
            )}
          </div>
        )}
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#1d222a]">
              {['Product', 'Model', 'Qty (Units)', 'Cartons', 'Unit Price (LKR)', 'Total (LKR)'].map((h) => (
                <th key={h} className="px-5 py-3 text-[9px] font-bold uppercase tracking-widest text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2b313a]">
            {(editMode ? editItems : items).map((item) => {
              const product = item.products as any;
              const cartonId = `${purchase.reference}-${product?.model ?? 'UNK'}`;
              const lineLkr = item.quantity_units * item.unit_price_rmb;
              return (
                <tr key={item.id} className="hover:bg-[#1d222a] transition-colors">
                  <td className="px-5 py-3.5">
                    {editMode ? (
                      <div className="space-y-1">
                        <select
                          value={item.product_id}
                          onChange={(e) => updateEditItem(item.id, { product_id: e.target.value })}
                          disabled={editProductsLoading}
                          className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary/40"
                        >
                          <option value="">Select product…</option>
                          {editProducts.map((p) => (
                            <option key={p.id} value={p.id}>{p.item_code ? `${p.item_code} — ` : ''}{p.name}</option>
                          ))}
                        </select>
                        {editProductsLoading && (
                          <p className="text-[10px] text-gray-500">Loading products…</p>
                        )}
                      </div>
                    ) : (
                      <>
                        <p className="text-xs font-semibold text-white">{product?.name ?? item.product_id}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">ID: {cartonId}-*</p>
                      </>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-xs font-mono text-gray-400">{product?.model ?? '—'}</td>
                  <td className="px-5 py-3.5 text-xs font-mono text-white">
                    {editMode ? (
                      <input
                        type="number"
                        min="0"
                        value={item.quantity_units}
                        onChange={(e) => updateEditItem(item.id, { quantity_units: parseInt(e.target.value, 10) || 0 })}
                        className="bg-[#1d222a] border border-[#2b313a] text-gray-200 text-xs rounded-lg px-2 py-1 w-24 font-mono"
                      />
                    ) : (
                      item.quantity_units.toLocaleString()
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-xs font-mono text-gray-500">
                    {editMode ? (
                      <input
                        type="number"
                        min="0"
                        value={item.quantity_cartons}
                        onChange={(e) => updateEditItem(item.id, { quantity_cartons: parseInt(e.target.value, 10) || 0 })}
                        className="bg-[#1d222a] border border-[#2b313a] text-gray-200 text-xs rounded-lg px-2 py-1 w-20 font-mono"
                      />
                    ) : (
                      item.quantity_cartons
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-xs font-mono text-gray-300">
                    {editMode ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price_rmb}
                        onChange={(e) => updateEditItem(item.id, { unit_price_rmb: parseFloat(e.target.value) || 0 })}
                        className="bg-[#1d222a] border border-[#2b313a] text-gray-200 text-xs rounded-lg px-2 py-1 w-28 font-mono"
                      />
                    ) : (
                      fmt(item.unit_price_rmb)
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-xs font-mono text-white">
                    <div className="flex items-center gap-2">
                      <span>{fmt(lineLkr)}</span>
                      {editMode && (
                        <button
                          onClick={() => removeEditItemRow(item.id)}
                          className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {approvals.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-amber-400" size={24} />
            <div>
              <p className="text-amber-400 font-bold text-sm">Pending Manager Approval</p>
              <p className="text-amber-500/80 text-xs mt-0.5">
                {approvals[0].requested_by} requested a {approvals[0].discount_percent}% discount ({fmt(approvals[0].discount_amount || 0)}). This purchase is locked until approved.
              </p>
            </div>
          </div>
          {can('approve_discounts') && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleResolveApproval(approvals[0].id, 'rejected', approvals[0].discount_amount || 0)}
                className="px-4 py-2 bg-[#1d222a] border border-[#2b313a] text-red-400 hover:bg-red-500/10 rounded-xl text-xs font-bold transition-all"
              >
                Reject
              </button>
              <button
                onClick={() => handleResolveApproval(approvals[0].id, 'approved', approvals[0].discount_amount || 0)}
                className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 rounded-xl text-xs font-bold transition-all"
              >
                Approve Discount
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── ORDERED: Receive form ─────────────────────────────── */}
      {purchase.status === 'ordered' && (
        <div className="bg-[#171c23] border border-blue-500/20 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#2b313a] bg-blue-500/5">
            <h2 className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
              <Package size={13} /> Receive Confirmation
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
      {(purchase.status === 'received' || purchase.status === 'completed') && received.length > 0 && (
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
      {(purchase.status === 'received' || purchase.status === 'completed') && cartons.length > 0 && (
        <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#2b313a]">
            <h2 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Package size={13} /> Generated Cartons
            </h2>
            <p className="text-[10px] text-gray-500 mt-0.5">Tracking codes for each received carton.</p>
          </div>
          <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
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
                  <p className="font-mono font-bold text-white mt-1">{fmt(displayTotal)}</p>
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

      {/* ── COMPLETED: Cost breakdown ───────────────────────────────── */}
      {purchase.status === 'completed' && (
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
                <p className="font-mono font-bold text-white text-xs mt-1">{fmt(displayTotal)}</p>
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
              <p className="text-xs text-green-400">Purchase completed. Product cost prices have been updated.</p>
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
        message="This will complete the purchase and update product cost prices based on the added costs. This action cannot be undone."
        confirmText="Finalize & Close"
        variant="warning"
      />

      {/* Print Bill Modal */}
      {printOpen && purchase && (
        <>
          <div className="fixed inset-0 z-[140] bg-black/70 backdrop-blur-sm" onClick={() => setPrintOpen(false)} />
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 overflow-y-auto">
            <div className="relative w-full max-w-2xl">
              <button onClick={() => setPrintOpen(false)} className="no-print absolute -top-10 right-0 p-2 text-white hover:text-gray-300"><X size={18} /></button>
              <PurchaseBillPrint
                purchase={purchase}
                items={items}
                costs={costs}
                received={received}
                supplier={supplier as any}
                location={(purchase.locations as any) ?? undefined}
                payments={payments}
                onClose={() => setPrintOpen(false)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};
