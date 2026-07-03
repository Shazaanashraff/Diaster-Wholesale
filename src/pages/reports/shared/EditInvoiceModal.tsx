import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { editInvoiceAtomic, type EditInvoiceItem, type EditInvoicePayment } from '../../../services/salesService';
import type { Salesperson } from '../../../services/salespersonService';
import { cn } from '../../../lib/utils';
import {
  X, Plus, Trash2, AlertCircle, AlertTriangle, Lock,
  Search, Loader2,
} from 'lucide-react';

const fmt = (n: number) =>
  'LKR ' + Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Types ─────────────────────────────────────────────────────────────────────

interface InvoiceRow {
  id: string;
  invoice_no: string;
  mode: string | null;
  subtotal: number;
  discount: number;
  total: number;
  payment_status: string;
  notes: string | null;
  salesperson: { id: string; name: string } | null;
  customers: { name: string } | null;
}

interface DetailItem {
  cartons: number;
  pieces: number;
  unit_price: number;
  total: number;
  batch_id: string | null;
  products: {
    id: string; name: string; item_code: string;
    pieces_per_carton: number; wholesale_price: number;
    retail_price: number; cost_price: number;
  } | null;
}

interface DetailPayment {
  method: string;
  bank_name: string | null;
  amount: number;
  paid_at: string;
  reference: string | null;
  cheque_number?: string | null;
  due_date?: string | null;
  cheque_status?: string | null;
}

interface EditItem {
  product_id: string;
  product_name: string;
  item_code: string;
  ppc: number;
  cartons: number;
  pieces: number;
  unit_price: number;
  cost_price: number;
  wholesale_price: number;
  retail_price: number;
  total: number;
}

interface EditPayment {
  method: string;
  amount: string;
  bank_name: string;
  cheque_number: string;
  due_date: string;
  locked: boolean;
}

interface SearchProduct {
  id: string;
  name: string;
  item_code: string;
  pieces_per_carton: number;
  wholesale_price: number;
  retail_price: number;
  cost_price: number;
  stock_pieces: number;
}

const PAYMENT_METHODS = ['cash', 'card', 'online', 'bank_transfer', 'cheque'] as const;
const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', card: 'Card', online: 'Online',
  bank_transfer: 'Bank Transfer', cheque: 'Cheque',
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  invoice: InvoiceRow;
  salespeople: Salesperson[];
  onClose: () => void;
  onSaved: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const EditInvoiceModal: React.FC<Props> = ({ invoice, salespeople, onClose, onSaved }) => {
  const isRetail = invoice.mode === 'retail';
  const [loadingData, setLoadingData]   = useState(true);
  const [editItems, setEditItems]       = useState<EditItem[]>([]);
  const [editPayments, setEditPayments] = useState<EditPayment[]>([]);
  const [editDiscount, setEditDiscount] = useState(String(invoice.discount ?? 0));
  const [editSpId, setEditSpId]         = useState(invoice.salesperson?.id ?? '');
  const [editNotes, setEditNotes]       = useState(invoice.notes ?? '');
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // Product search
  const [productSearch, setProductSearch]     = useState('');
  const [searchResults, setSearchResults]     = useState<SearchProduct[]>([]);
  const [searchLoading, setSearchLoading]     = useState(false);
  const [showSearchDrop, setShowSearchDrop]   = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Load current invoice items & payments on mount ──────────────────────
  useEffect(() => {
    async function load() {
      const [itemsRes, paymentsRes] = await Promise.all([
        supabase
          .from('invoice_items')
          .select('cartons, pieces, unit_price, total, batch_id, products(id, name, item_code, pieces_per_carton, wholesale_price, retail_price, cost_price)')
          .eq('invoice_id', invoice.id),
        supabase
          .from('payments')
          .select('method, bank_name, amount, paid_at, reference, cheque_number, due_date, cheque_status')
          .eq('invoice_id', invoice.id)
          .gt('amount', 0),
      ]);

      const items: DetailItem[] = (itemsRes.data ?? []) as unknown as DetailItem[];
      const payments: DetailPayment[] = (paymentsRes.data ?? []) as unknown as DetailPayment[];

      setEditItems(items.map(it => ({
        product_id:      it.products?.id ?? '',
        product_name:    it.products?.name ?? '—',
        item_code:       it.products?.item_code ?? '',
        ppc:             it.products?.pieces_per_carton ?? 1,
        cartons:         it.cartons,
        pieces:          it.pieces,
        unit_price:      it.unit_price,
        cost_price:      it.products?.cost_price ?? 0,
        wholesale_price: it.products?.wholesale_price ?? 0,
        retail_price:    it.products?.retail_price ?? 0,
        total:           it.total,
      })));

      setEditPayments(payments.map(p => ({
        method:         p.method,
        amount:         String(p.amount),
        bank_name:      p.bank_name ?? '',
        cheque_number:  p.cheque_number ?? '',
        due_date:       p.due_date ?? '',
        locked:         p.cheque_status === 'processing' || p.cheque_status === 'completed',
      })));

      setLoadingData(false);
    }
    load();
  }, [invoice.id]);

  // ── Close search dropdown on outside click ───────────────────────────────
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowSearchDrop(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // ── Product search ────────────────────────────────────────────────────────
  const runSearch = useCallback(async (q: string) => {
    if (q.length < 1) { setSearchResults([]); setShowSearchDrop(false); return; }
    setSearchLoading(true);
    const { data } = await supabase
      .from('products')
      .select('id, name, item_code, pieces_per_carton, wholesale_price, retail_price, cost_price')
      .or(`name.ilike.%${q}%,item_code.ilike.%${q}%`)
      .limit(10);

    if (!data) { setSearchLoading(false); return; }

    // Get stock for matching products
    const ids = data.map(p => p.id);
    const { data: stockRows } = await supabase
      .from('product_branch_stock')
      .select('product_id, cartons_in, pieces_in, cartons_sold, pieces_sold, carton_adj, piece_adj')
      .in('product_id', ids);

    const stockMap: Record<string, number> = {};
    for (const row of stockRows ?? []) {
      const ppc = data.find(p => p.id === row.product_id)?.pieces_per_carton ?? 1;
      const units =
        (row.cartons_in * ppc + row.pieces_in) -
        (row.cartons_sold * ppc + row.pieces_sold) +
        (row.carton_adj * ppc + row.piece_adj);
      stockMap[row.product_id] = (stockMap[row.product_id] ?? 0) + units;
    }

    const results: SearchProduct[] = data
      .map(p => ({ ...p, stock_pieces: stockMap[p.id] ?? 0 }))
      .filter(p => p.stock_pieces > 0);

    setSearchResults(results);
    setShowSearchDrop(results.length > 0);
    setSearchLoading(false);
  }, []);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setProductSearch(q);
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => runSearch(q), 300);
  }

  function addProduct(p: SearchProduct) {
    if (editItems.some(it => it.product_id === p.id)) {
      setError(`${p.name} is already in the invoice — adjust its quantity instead.`);
      return;
    }
    const ppc = Math.max(p.pieces_per_carton, 1);
    const defaultPrice = isRetail ? p.retail_price : p.wholesale_price;
    setEditItems(prev => [...prev, {
      product_id:      p.id,
      product_name:    p.name,
      item_code:       p.item_code,
      ppc,
      cartons:         0,
      pieces:          1,
      unit_price:      defaultPrice,
      cost_price:      p.cost_price,
      wholesale_price: p.wholesale_price,
      retail_price:    p.retail_price,
      total:           defaultPrice * 1,
    }]);
    setProductSearch('');
    setSearchResults([]);
    setShowSearchDrop(false);
  }

  // ── Item field change helpers ─────────────────────────────────────────────
  function updateItem(idx: number, field: 'cartons' | 'pieces' | 'unit_price', raw: string) {
    setEditItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const val = field === 'unit_price' ? parseFloat(raw) || 0 : parseInt(raw) || 0;
      const next = { ...it, [field]: val };
      const units = next.cartons * next.ppc + next.pieces;
      next.total  = parseFloat((next.unit_price * units).toFixed(2));
      return next;
    }));
  }

  function removeItem(idx: number) {
    setEditItems(prev => prev.filter((_, i) => i !== idx));
  }

  // ── Payment helpers ───────────────────────────────────────────────────────
  function updatePayment(idx: number, field: keyof Omit<EditPayment, 'locked'>, value: string) {
    setEditPayments(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }

  function removePayment(idx: number) {
    setEditPayments(prev => prev.filter((_, i) => i !== idx));
  }

  function addPayment() {
    setEditPayments(prev => [...prev, { method: 'cash', amount: '', bank_name: '', cheque_number: '', due_date: '', locked: false }]);
  }

  // ── Computed values ───────────────────────────────────────────────────────
  const discount       = parseFloat(editDiscount) || 0;
  const subtotal       = editItems.reduce((s, it) => s + it.total, 0);
  const total          = Math.max(0, subtotal - discount);
  const costFloor     = editItems.reduce((s, it) => s + it.cost_price * (it.cartons * it.ppc + it.pieces), 0);
  const standardFloor = editItems.reduce((s, it) => {
    const p = isRetail ? it.retail_price : it.wholesale_price;
    return s + p * (it.cartons * it.ppc + it.pieces);
  }, 0);
  const isBelowCost     = total < costFloor - 0.01;
  const isBelowStandard = !isBelowCost && total < standardFloor - 0.01;
  const hasZeroQtyItem   = editItems.some(it => it.cartons === 0 && it.pieces === 0);
  const totalPaid        = editPayments.filter(p => !p.locked).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
                         + editPayments.filter(p => p.locked).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const newOutstanding   = Math.max(0, total - totalPaid);
  const newStatus        = totalPaid >= total - 0.01 ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';
  const canSave = !isBelowCost && !hasZeroQtyItem && editItems.length > 0 && !saving;

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const items: EditInvoiceItem[] = editItems.map(it => ({
        product_id: it.product_id,
        cartons:    it.cartons,
        pieces:     it.pieces,
        unit_price: it.unit_price,
        total:      it.total,
      }));
      const payments: EditInvoicePayment[] = editPayments
        .filter(p => !p.locked && parseFloat(p.amount) > 0)
        .map(p => ({
          method:         p.method,
          amount:         parseFloat(p.amount),
          bank_name:      p.bank_name || undefined,
          cheque_number:  p.cheque_number || undefined,
          due_date:       p.due_date || undefined,
        }));

      await editInvoiceAtomic({
        invoiceId:     invoice.id,
        salespersonId: editSpId || null,
        notes:         editNotes.trim(),
        discount,
        items,
        payments,
        adjustedBy:    sessionStorage.getItem('user_role') ?? 'admin',
      });

      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl" style={{ animation: 'posFadeIn 180ms ease' }}>

        {/* ── Modal header ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2b313a] shrink-0">
          <div>
            <h3 className="text-sm font-bold text-white">Edit Invoice — {invoice.invoice_no}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{invoice.customers?.name ?? 'Walk-in'} · {isRetail ? 'Retail' : 'Wholesale'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#2b313a] transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* ── Body ──────────────────────────────────────────────────── */}
        {loadingData ? (
          <div className="flex items-center justify-center py-16 text-gray-500 text-sm gap-2">
            <Loader2 size={16} className="animate-spin" /> Loading invoice data…
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 p-6 space-y-6">

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />{error}
              </div>
            )}

            {/* ── Section 1: Header fields ──────────────────────────── */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Salesperson</label>
                <select
                  value={editSpId}
                  onChange={e => setEditSpId(e.target.value)}
                  className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40"
                >
                  <option value="">— None —</option>
                  {salespeople.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Notes</label>
                <input
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Invoice notes…"
                  className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40"
                />
              </div>
            </div>

            {/* ── Section 2: Line items ─────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Line Items</p>
              </div>
              <div className="rounded-xl border border-[#2b313a] overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#1d222a] border-b border-[#2b313a]">
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-gray-500">Product</th>
                      <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-gray-500 w-20">Ctn</th>
                      <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-gray-500 w-20">Pcs</th>
                      <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-gray-500 w-28">Unit Price</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-gray-500 w-28">Total</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-gray-500 w-24">Cost ref</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2b313a]/60">
                    {editItems.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-4 text-center text-gray-600 text-xs">No items — add at least one product.</td></tr>
                    )}
                    {editItems.map((it, i) => {
                      const zeroQty = it.cartons === 0 && it.pieces === 0;
                      return (
                        <tr key={i} className={cn('hover:bg-[#1d222a] transition-colors', zeroQty && 'bg-red-500/5')}>
                          <td className="px-3 py-2">
                            <p className={cn('font-semibold', zeroQty ? 'text-red-400' : 'text-white')}>{it.product_name}</p>
                            <p className="text-[10px] text-gray-600 font-mono">{it.item_code}</p>
                            {zeroQty && <p className="text-[10px] text-red-400 mt-0.5">Qty cannot be zero</p>}
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number" min="0" value={it.cartons}
                              onChange={e => updateItem(i, 'cartons', e.target.value)}
                              className="w-full text-center bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary/40 font-mono"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number" min="0" value={it.pieces}
                              onChange={e => updateItem(i, 'pieces', e.target.value)}
                              className="w-full text-center bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary/40 font-mono"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number" min="0" step="0.01" value={it.unit_price}
                              onChange={e => updateItem(i, 'unit_price', e.target.value)}
                              className="w-full text-center bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary/40 font-mono"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-bold font-mono text-white">{fmt(it.total)}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-600 text-[10px]">
                            {fmt(it.cost_price * (it.cartons * it.ppc + it.pieces))}
                          </td>
                          <td className="px-2 py-2 text-right">
                            <button onClick={() => removeItem(i)} className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                              <Trash2 size={11} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add product search */}
              <div ref={searchRef} className="relative mt-2">
                <div className="flex items-center gap-2 bg-[#1d222a] border border-[#2b313a] rounded-xl px-3 py-2 focus-within:border-primary/40">
                  <Search size={12} className="text-gray-500 shrink-0" />
                  <input
                    value={productSearch}
                    onChange={handleSearchChange}
                    onFocus={() => searchResults.length > 0 && setShowSearchDrop(true)}
                    placeholder="Search product by name or code to add…"
                    className="flex-1 bg-transparent text-gray-300 text-xs focus:outline-none placeholder-gray-600"
                  />
                  {searchLoading && <Loader2 size={12} className="animate-spin text-gray-500" />}
                </div>
                {showSearchDrop && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-[#1d222a] border border-[#2b313a] rounded-xl shadow-xl overflow-hidden">
                    {searchResults.map(p => {
                      const ppc = Math.max(p.pieces_per_carton, 1);
                      const ctns = Math.floor(p.stock_pieces / ppc);
                      const pcs  = p.stock_pieces % ppc;
                      return (
                        <button
                          key={p.id}
                          onClick={() => addProduct(p)}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#2b313a] transition-colors text-left"
                        >
                          <div>
                            <p className="text-xs font-semibold text-white">{p.name}</p>
                            <p className="text-[10px] text-gray-500 font-mono">{p.item_code}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-green-400 font-mono">
                              {ctns > 0 && `${ctns}c `}{pcs > 0 && `${pcs}p`} in stock
                            </p>
                            <p className="text-[10px] text-gray-500 font-mono">{fmt(isRetail ? p.retail_price : p.wholesale_price)}/pc</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Section 3: Pricing summary ────────────────────────── */}
            <div className="bg-[#1d222a] border border-[#2b313a] rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-mono text-gray-300">{fmt(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Discount</span>
                <input
                  type="number" min="0" step="0.01" value={editDiscount}
                  onChange={e => setEditDiscount(e.target.value)}
                  className="w-32 text-right bg-[#171c23] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-primary/40 font-mono"
                />
              </div>
              <div className="flex items-center justify-between border-t border-[#2b313a] pt-2">
                <span className="text-sm font-bold text-white">Total</span>
                <span className="text-sm font-bold font-mono text-white">{fmt(total)}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-600">Cost floor (minimum)</span>
                <span className="font-mono text-gray-600">{fmt(costFloor)}</span>
              </div>

              {isBelowCost && (
                <div className="flex items-center gap-2 mt-2 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                  <AlertCircle size={12} className="shrink-0" />
                  Below cost price — cannot save. Minimum: {fmt(costFloor)}
                </div>
              )}
              {isBelowStandard && (
                <div className="flex items-center gap-2 mt-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
                  <AlertTriangle size={12} className="shrink-0" />
                  Below standard {isRetail ? 'retail' : 'wholesale'} price ({fmt(standardFloor)}) — proceed with caution.
                </div>
              )}
            </div>

            {/* ── Section 4: Payments ───────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Payments</p>
                <button onClick={addPayment} className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 font-bold transition-colors">
                  <Plus size={11} /> Add
                </button>
              </div>
              <div className="space-y-2">
                {editPayments.length === 0 && (
                  <p className="text-xs text-gray-600 text-center py-3">No payments — invoice will be unpaid.</p>
                )}
                {editPayments.map((p, i) => (
                  <div key={i} className={cn('flex items-start gap-2 p-3 rounded-xl border', p.locked ? 'bg-[#12161d] border-[#2b313a]/50 opacity-70' : 'bg-[#1d222a] border-[#2b313a]')}>
                    {p.locked && (
                      <Lock size={12} className="text-gray-600 mt-2 shrink-0" aria-label="Settled cheque — cannot edit" />
                    )}
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      {/* Method */}
                      <div>
                        <label className="block text-[10px] text-gray-600 mb-0.5">Method</label>
                        <select
                          value={p.method}
                          onChange={e => updatePayment(i, 'method', e.target.value)}
                          disabled={p.locked}
                          className="w-full bg-[#171c23] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none disabled:opacity-50"
                        >
                          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
                        </select>
                      </div>
                      {/* Amount */}
                      <div>
                        <label className="block text-[10px] text-gray-600 mb-0.5">Amount</label>
                        <input
                          type="number" min="0" step="0.01" value={p.amount}
                          onChange={e => updatePayment(i, 'amount', e.target.value)}
                          disabled={p.locked}
                          placeholder="0.00"
                          className="w-full bg-[#171c23] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none font-mono disabled:opacity-50"
                        />
                      </div>
                      {/* Conditional fields */}
                      {(p.method === 'bank_transfer' || p.method === 'online') && (
                        <div className="col-span-2">
                          <label className="block text-[10px] text-gray-600 mb-0.5">
                            {p.method === 'online' ? 'Platform / Bank' : 'Bank Name'}
                          </label>
                          <input
                            value={p.bank_name}
                            onChange={e => updatePayment(i, 'bank_name', e.target.value)}
                            disabled={p.locked}
                            placeholder="e.g. Commercial Bank"
                            className="w-full bg-[#171c23] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none disabled:opacity-50"
                          />
                        </div>
                      )}
                      {p.method === 'cheque' && (
                        <>
                          <div>
                            <label className="block text-[10px] text-gray-600 mb-0.5">Bank</label>
                            <input
                              value={p.bank_name}
                              onChange={e => updatePayment(i, 'bank_name', e.target.value)}
                              disabled={p.locked}
                              placeholder="Bank name"
                              className="w-full bg-[#171c23] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none disabled:opacity-50"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-600 mb-0.5">Cheque No.</label>
                            <input
                              value={p.cheque_number}
                              onChange={e => updatePayment(i, 'cheque_number', e.target.value)}
                              disabled={p.locked}
                              placeholder="e.g. 00123456"
                              className="w-full bg-[#171c23] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none font-mono disabled:opacity-50"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[10px] text-gray-600 mb-0.5">Due Date</label>
                            <input
                              type="date" value={p.due_date}
                              onChange={e => updatePayment(i, 'due_date', e.target.value)}
                              disabled={p.locked}
                              className="w-full bg-[#171c23] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none disabled:opacity-50"
                            />
                          </div>
                        </>
                      )}
                    </div>
                    {!p.locked && (
                      <button onClick={() => removePayment(i)} className="p-1.5 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors mt-4 shrink-0">
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Payment summary */}
              <div className="mt-3 flex items-center justify-between text-xs px-1">
                <div className="flex items-center gap-4">
                  <span className="text-gray-500">Total Paid: <span className="text-white font-mono">{fmt(totalPaid)}</span></span>
                  <span className="text-gray-500">Outstanding: <span className={cn('font-mono', newOutstanding > 0 ? 'text-amber-400' : 'text-green-400')}>{fmt(newOutstanding)}</span></span>
                </div>
                <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                  newStatus === 'paid'    ? 'bg-green-900/20 text-green-400' :
                  newStatus === 'partial' ? 'bg-amber-900/20 text-amber-400' :
                                           'bg-red-900/20 text-red-400'
                )}>{newStatus}</span>
              </div>
            </div>

          </div>
        )}

        {/* ── Footer ────────────────────────────────────────────────── */}
        {!loadingData && (
          <div className="flex gap-3 px-6 py-4 border-t border-[#2b313a] shrink-0">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-[#1d222a] border border-[#2b313a] text-gray-400 rounded-xl text-xs font-bold hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 py-2.5 bg-amber-600/80 text-white rounded-xl text-xs font-bold hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              Save Changes
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
