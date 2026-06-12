import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { usePermissions } from '../utils/permissions';
import { cn } from '../lib/utils';
import {
  Search, RotateCcw, ChevronDown, ChevronUp, RefreshCw,
  AlertCircle, CheckCircle2, XCircle, ArrowLeftRight,
  Trash2, Loader2, Plus, X,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface InvoiceRow {
  id: string;
  invoice_no: string;
  customer_name: string;
  customer_id: string;
  total: number;
  created_at: string;
  payment_status: string;
  items: InvoiceItemRow[];
}

interface InvoiceItemRow {
  id: string;
  product_id: string;
  product_name: string;
  item_code: string;
  cartons: number;
  pieces: number;
  unit_price: number;
  total: number;
  pieces_per_carton: number;
}

interface SelectedReturnItem {
  invoice_item_id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  max_cartons: number;
  max_pieces: number;
  pieces_per_carton: number;
  return_cartons: number;
  return_pieces: number;
}

interface ReplacementItem {
  id: string;
  product_id: string;
  product_name: string;
  cartons: number;
  pieces: number;
  unit_price: number;
  pieces_per_carton: number;
}

interface SalesReturn {
  id: string;
  return_number: string;
  original_invoice_id: string;
  original_invoice_no: string;
  customer_name: string;
  return_type: 'Return' | 'Exchange';
  reason: string;
  status: 'Pending' | 'Completed' | 'Cancelled';
  resolution_type: string | null;
  refund_amount: number;
  exchange_invoice_no: string | null;
  exchange_difference: number | null;
  settlement_type: string | null;
  returned_by: string;
  created_at: string;
}

const RETURN_REASONS = ['Damaged', 'Defective', 'Wrong Item', 'Customer Changed Mind', 'Other'];

const STATUS_CONFIG = {
  Pending:   { color: 'text-amber-400',  badge: 'bg-amber-500/10 border border-amber-500/20 text-amber-400',   icon: AlertCircle },
  Completed: { color: 'text-green-400',  badge: 'bg-green-500/10 border border-green-500/20 text-green-400',   icon: CheckCircle2 },
  Cancelled: { color: 'text-gray-500',   badge: 'bg-gray-500/10 border border-gray-500/20 text-gray-500',      icon: XCircle },
};

const fmt = (n: number) =>
  'LKR ' + Math.abs(n).toLocaleString('en-LK', { minimumFractionDigits: 2 });

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function restoreStock(productId: string, cartons: number, pieces: number, piecesPerCarton: number, _reason: string) {
  const totalPieces = cartons * (piecesPerCarton || 1) + pieces;
  if (totalPieces <= 0) return;
  // Use restore_stock_to_batch so stock_batches is updated (same as cancelInvoice).
  // This makes rollback via deduct_stock_fifo correct.
  const { error } = await supabase.rpc('restore_stock_to_batch', {
    p_batch_id: null,
    p_product_id: productId,
    p_units: totalPieces,
  });
  if (error) throw new Error(`Stock restore failed: ${error.message}`);
}

async function deductStock(productId: string, totalPieces: number) {
  if (totalPieces <= 0) return;
  const { error } = await supabase.rpc('deduct_stock_fifo', {
    p_product_id: productId,
    p_units: totalPieces,
  });
  if (error) throw new Error(`Stock deduction failed: ${error.message}`);
}

// ─── Main Component ────────────────────────────────────────────────────────────

export const ReturnsPage: React.FC = () => {
  const { role } = usePermissions();
  const isAdmin = role === 'admin' || role === 'accountant';

  const [tab, setTab] = useState<'new' | 'history'>('new');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Step 1
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);

  // Step 2
  const [returnItems, setReturnItems] = useState<SelectedReturnItem[]>([]);
  const [returnType, setReturnType] = useState<'Return' | 'Exchange'>('Return');
  const [reason, setReason] = useState(RETURN_REASONS[0]);
  const [replacements, setReplacements] = useState<ReplacementItem[]>([]);
  const [settlementMethod, setSettlementMethod] = useState('cash');
  const [settlementBank, setSettlementBank] = useState('');
  const [products, setProducts] = useState<Array<{ id: string; name: string; pieces_per_carton: number; wholesale_price: number }>>([]);
  const [productSearch, setProductSearch] = useState('');

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<{ returnNumber: string; exchangeInvoiceNo?: string } | null>(null);

  // History
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [undoing, setUndoing] = useState<string | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Invoice search ──────────────────────────────────────────────────────

  const searchInvoices = useCallback(async () => {
    setSearchLoading(true);

    let q = supabase
      .from('invoices')
      .select(`
        id, invoice_no, total, payment_status, created_at, customer_id,
        customers(name),
        invoice_items(
          id, product_id, cartons, pieces, unit_price, total,
          products(name, item_code, pieces_per_carton)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(60);

    if (searchDate) {
      q = q.gte('created_at', `${searchDate}T00:00:00`).lte('created_at', `${searchDate}T23:59:59`);
    } else {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (isAdmin ? 30 : 10));
      q = q.gte('created_at', cutoff.toISOString());
    }

    if (searchTerm.trim()) q = q.ilike('invoice_no', `%${searchTerm.trim()}%`);

    const { data, error } = await q;
    if (!error && data) {
      const rows: InvoiceRow[] = (data as any[]).map(inv => {
        const customer = Array.isArray(inv.customers) ? inv.customers[0] : inv.customers;
        const items: InvoiceItemRow[] = (inv.invoice_items ?? [])
          .filter((ii: any) => Number(ii.unit_price ?? 0) >= 0)
          .map((ii: any) => {
            const prod = Array.isArray(ii.products) ? ii.products[0] : ii.products;
            return {
              id: ii.id, product_id: ii.product_id,
              product_name: prod?.name ?? 'Unknown',
              item_code: prod?.item_code ?? '—',
              cartons: Number(ii.cartons ?? 0),
              pieces: Number(ii.pieces ?? 0),
              unit_price: Number(ii.unit_price ?? 0),
              total: Number(ii.total ?? 0),
              pieces_per_carton: Number(prod?.pieces_per_carton ?? 1) || 1,
            };
          });
        return {
          id: inv.id, invoice_no: inv.invoice_no,
          customer_id: inv.customer_id,
          customer_name: customer?.name ?? 'Unknown',
          total: Number(inv.total ?? 0),
          created_at: inv.created_at,
          payment_status: inv.payment_status,
          items,
        };
      });

      const ids = rows.map(r => r.id);
      if (ids.length > 0) {
        const { data: existing } = await supabase
          .from('sales_returns')
          .select('original_invoice_id')
          .in('original_invoice_id', ids)
          .neq('status', 'Cancelled');
        const returned = new Set((existing ?? []).map((r: any) => r.original_invoice_id));
        setInvoices(rows.filter(r => r.payment_status === 'cancelled' || !returned.has(r.id)));
      } else {
        setInvoices(rows);
      }
    }
    setSearchLoading(false);
  }, [searchTerm, searchDate, isAdmin]);

  useEffect(() => {
    const t = setTimeout(searchInvoices, 400);
    return () => clearTimeout(t);
  }, [searchInvoices]);

  useEffect(() => {
    if (returnType !== 'Exchange') return;
    supabase.from('products').select('id, name, pieces_per_carton, wholesale_price')
      .limit(500)
      .then(({ data }) => setProducts((data ?? []) as any[]));
  }, [returnType]);

  // ─── History ──────────────────────────────────────────────────────────────

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    const { data, error } = await supabase
      .from('sales_returns')
      .select(`
        id, return_number, original_invoice_id, return_type, reason,
        status, resolution_type, refund_amount, exchange_invoice_no,
        exchange_difference, settlement_type, returned_by, created_at,
        invoices!original_invoice_id(invoice_no, customers(name))
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setReturns((data as any[]).map(r => {
        const inv = Array.isArray(r.invoices) ? r.invoices[0] : r.invoices;
        const cust = Array.isArray(inv?.customers) ? inv?.customers[0] : inv?.customers;
        return {
          ...r,
          original_invoice_no: inv?.invoice_no ?? '—',
          customer_name: cust?.name ?? 'Unknown',
          refund_amount: Number(r.refund_amount ?? 0),
          exchange_difference: r.exchange_difference != null ? Number(r.exchange_difference) : null,
        };
      }));
    }
    setHistoryLoading(false);
  }, []);

  useEffect(() => { if (tab === 'history') loadHistory(); }, [tab, loadHistory]);

  // ─── Item helpers ─────────────────────────────────────────────────────────

  function selectInvoice(inv: InvoiceRow) {
    setSelectedInvoice(inv); setReturnItems([]); setReplacements([]); setStep(2);
  }

  function addReturnItem(ii: InvoiceItemRow) {
    if (returnItems.find(r => r.invoice_item_id === ii.id)) return;
    setReturnItems(prev => [...prev, {
      invoice_item_id: ii.id, product_id: ii.product_id,
      product_name: ii.product_name, unit_price: ii.unit_price,
      max_cartons: ii.cartons, max_pieces: ii.pieces,
      pieces_per_carton: ii.pieces_per_carton,
      return_cartons: ii.cartons, return_pieces: ii.pieces,
    }]);
  }

  function updateReturnItem(id: string, field: 'return_cartons' | 'return_pieces', val: number) {
    setReturnItems(prev => prev.map(r => {
      if (r.invoice_item_id !== id) return r;
      const max = field === 'return_cartons' ? r.max_cartons : r.max_pieces;
      return { ...r, [field]: Math.max(0, Math.min(val, max)) };
    }));
  }

  function addReplacement(prod: typeof products[0]) {
    setReplacements(prev => [...prev, {
      id: Math.random().toString(36).slice(2),
      product_id: prod.id, product_name: prod.name,
      cartons: 1, pieces: 0,
      unit_price: Number(prod.wholesale_price),
      pieces_per_carton: prod.pieces_per_carton || 1,
    }]);
    setProductSearch('');
  }

  function updateReplacement(id: string, field: string, val: number | string) {
    setReplacements(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  }

  // ─── Computed ─────────────────────────────────────────────────────────────

  const returnedValue = returnItems.reduce((s, r) =>
    s + r.unit_price * (r.return_cartons * r.pieces_per_carton + r.return_pieces), 0);
  const replacementValue = replacements.reduce((s, r) =>
    s + r.unit_price * (r.cartons * r.pieces_per_carton + r.pieces), 0);
  const exchangeDiff = replacementValue - returnedValue;
  const settlementType = Math.abs(exchangeDiff) < 0.01 ? 'EvenExchange'
    : exchangeDiff > 0 ? 'UpgradePayment' : 'CashRefund';

  const filteredProducts = productSearch.length > 1
    ? products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))
    : [];

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function submitReturn() {
    if (!selectedInvoice || returnItems.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);

    const returnNumber = `RET-${Date.now().toString(36).toUpperCase()}`;
    const isDamageReturn = returnType === 'Return' && reason === 'Damaged';
    const isCashRefundReturn = returnType === 'Return' && !isDamageReturn;
    const refundAmount = isCashRefundReturn ? returnedValue : 0;
    let exchangeInvoiceId: string | null = null;
    let exchangeInvoiceNo: string | null = null;

    try {
      if (!selectedInvoice.customer_id) {
        throw new Error('This invoice has no customer assigned. Exchanges require a customer record.');
      }

      if (returnType === 'Exchange') {
        // Track completed steps for rollback on failure
        const restoredProducts: Array<{ product_id: string; pieces: number }> = [];
        const deductedProducts: Array<{ product_id: string; pieces: number }> = [];

        try {
          for (const r of returnItems) {
            const pieces = r.return_cartons * r.pieces_per_carton + r.return_pieces;
            await restoreStock(r.product_id, r.return_cartons, r.return_pieces, r.pieces_per_carton,
              `Exchange return for ${selectedInvoice.invoice_no}`);
            restoredProducts.push({ product_id: r.product_id, pieces });
          }

          exchangeInvoiceNo = `EXC-${Date.now().toString(36).toUpperCase()}`;
          const absDiff = Math.abs(exchangeDiff);
          const isPaid = absDiff < 0.01 || !!settlementMethod;

          const { data: excInv, error: excInvErr } = await supabase
            .from('invoices')
            .insert({
              invoice_no: exchangeInvoiceNo,
              customer_id: selectedInvoice.customer_id,
              mode: 'wholesale',
              subtotal: absDiff,
              discount: 0,
              total: absDiff,
              payment_status: isPaid ? 'paid' : 'unpaid',
              notes: `Exchange for ${selectedInvoice.invoice_no}`,
            })
            .select('id').single();

          if (excInvErr || !excInv) throw new Error(excInvErr?.message ?? 'Failed to create exchange invoice');
          exchangeInvoiceId = excInv.id;

          for (const r of replacements) {
            const ppc = r.pieces_per_carton || 1;
            const itemTotal = r.unit_price * (r.cartons * ppc + r.pieces);
            const { error: itemErr } = await supabase.from('invoice_items').insert({
              invoice_id: exchangeInvoiceId,
              product_id: r.product_id,
              cartons: r.cartons, pieces: r.pieces,
              unit_price: r.unit_price, total: itemTotal,
            });
            if (itemErr) throw new Error(itemErr.message);
            await deductStock(r.product_id, r.cartons * ppc + r.pieces);
            deductedProducts.push({ product_id: r.product_id, pieces: r.cartons * ppc + r.pieces });
          }

          // Insert returned items as credit lines (negative) for full audit trail
          for (const r of returnItems) {
            const ppc = r.pieces_per_carton || 1;
            const creditTotal = -(r.unit_price * (r.return_cartons * ppc + r.return_pieces));
            await supabase.from('invoice_items').insert({
              invoice_id: exchangeInvoiceId,
              product_id: r.product_id,
              cartons: r.return_cartons,
              pieces: r.return_pieces,
              unit_price: -r.unit_price,
              total: creditTotal,
            });
          }

          if (absDiff >= 0.01) {
            const { error: payErr } = await supabase.from('payments').insert({
              invoice_id: exchangeInvoiceId,
              customer_id: selectedInvoice.customer_id,
              amount: exchangeDiff,
              method: settlementMethod,
              bank_name: settlementMethod === 'bank_transfer' ? settlementBank || null : null,
              reference: exchangeInvoiceNo,
              paid_at: new Date().toISOString(),
            });
            if (payErr) throw new Error(payErr.message);
          }
        } catch (exchangeErr: any) {
          // Rollback: delete exchange invoice (cascades to items), reverse stock
          let rollbackNote = '';
          if (exchangeInvoiceId) {
            const { error: delErr } = await supabase.from('invoices').delete().eq('id', exchangeInvoiceId);
            if (delErr) rollbackNote = ` (invoice cleanup failed: ${delErr.message})`;
          }
          for (const { product_id, pieces } of restoredProducts) {
            await deductStock(product_id, pieces);
          }
          for (const { product_id, pieces } of deductedProducts) {
            await restoreStock(product_id, 0, pieces, 1, 'Exchange rollback');
          }
          throw new Error(`Exchange failed and was rolled back: ${exchangeErr.message}${rollbackNote}`);
        }
      } else if (isCashRefundReturn) {
        for (const r of returnItems) {
          await restoreStock(
            r.product_id,
            r.return_cartons,
            r.return_pieces,
            r.pieces_per_carton,
            `Cash return for ${selectedInvoice.invoice_no}`
          );
        }

        await supabase.from('payments').insert({
          invoice_id: selectedInvoice.id,
          customer_id: selectedInvoice.customer_id,
          amount: -Math.abs(returnedValue),
          method: 'cash',
          reference: `RETURN-${selectedInvoice.invoice_no}`,
          paid_at: new Date().toISOString(),
        });
      }

      const { data: retRow, error: retErr } = await supabase
        .from('sales_returns')
        .insert({
          return_number: returnNumber,
          original_invoice_id: selectedInvoice.id,
          exchange_invoice_id: exchangeInvoiceId,
          exchange_invoice_no: exchangeInvoiceNo,
          return_type: returnType,
          reason,
          status: returnType === 'Exchange' || isCashRefundReturn ? 'Completed' : 'Pending',
          settlement_type:
            returnType === 'Exchange'
              ? settlementType
              : isCashRefundReturn
                ? 'CashRefund'
                : null,
          exchange_difference: returnType === 'Exchange' ? exchangeDiff : null,
          refund_amount: refundAmount,
          returned_by: role.replace('_', ' '),
          workflow_snapshot: {
            original_invoice_id: selectedInvoice.id,
            returned_items: returnItems,
            replacement_items: replacements,
            exchange_invoice_id: exchangeInvoiceId,
            return_mode: isDamageReturn ? 'damage' : 'cash_refund',
          },
        })
        .select('id').single();

      if (retErr || !retRow) throw new Error(retErr?.message ?? 'Failed to create return record');

      const returnItemRows = returnItems.map(r => {
        const ppc = r.pieces_per_carton || 1;
        return {
          return_id: retRow.id,
          invoice_item_id: r.invoice_item_id,
          product_id: r.product_id,
          product_name: r.product_name,
          return_cartons: r.return_cartons,
          return_pieces: r.return_pieces,
          unit_price: r.unit_price,
          total: r.unit_price * (r.return_cartons * ppc + r.return_pieces),
        };
      });

      const { error: itemsErr } = await supabase.from('sales_return_items').insert(returnItemRows);
      if (itemsErr) throw new Error(itemsErr.message);

      setSubmitResult({ returnNumber, exchangeInvoiceNo: exchangeInvoiceNo ?? undefined });
      setStep(3);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Return failed');
    }
    setSubmitting(false);
  }

  function resetForm() {
    setStep(1); setSelectedInvoice(null); setReturnItems([]);
    setReplacements([]); setReturnType('Return'); setReason(RETURN_REASONS[0]);
    setSubmitResult(null); setSubmitError(null); setSearchTerm(''); setSearchDate('');
  }

  // ─── Complete ─────────────────────────────────────────────────────────────

  async function completeReturn(ret: SalesReturn, resolution: 'Repaired' | 'Replaced') {
    setCompleting(ret.id);
    try {
      const { data: items } = await supabase
        .from('sales_return_items')
        .select('product_id, return_cartons, return_pieces, unit_price')
        .eq('return_id', ret.id);

      let replacementLoss = 0;

      for (const item of (items ?? []) as any[]) {
        if (resolution === 'Replaced') {
          const { data: prod } = await supabase
            .from('products').select('pieces_per_carton').eq('id', item.product_id).single();
          const ppc = Number((prod as any)?.pieces_per_carton ?? 1) || 1;
          const units = item.return_cartons * ppc + item.return_pieces;
          if (units > 0) await deductStock(item.product_id, units);
          replacementLoss += units * Number(item.unit_price ?? 0);
        }
      }

      await supabase.from('sales_returns').update({
        status: 'Completed',
        resolution_type: resolution,
        settlement_type: resolution === 'Replaced' ? 'DamageReplacement' : 'DamageRepaired',
        exchange_difference: resolution === 'Replaced' ? -Math.abs(replacementLoss) : null,
        updated_at: new Date().toISOString(),
      }).eq('id', ret.id);

      showToast(`Return marked as ${resolution}`);
      loadHistory();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to complete return', false);
    }
    setCompleting(null);
  }

  // ─── Undo ─────────────────────────────────────────────────────────────────

  async function undoReturn(ret: SalesReturn) {
    if (!confirm('Are you sure you want to undo/cancel this return?')) return;
    setUndoing(ret.id);
    try {
      if (ret.status === 'Pending') {
        await supabase.from('sales_returns').update({
          status: 'Cancelled', cancelled_at: new Date().toISOString(),
          cancelled_by: role, cancel_reason: 'Manually cancelled',
        }).eq('id', ret.id);

      } else if (ret.return_type === 'Exchange') {
        if (ret.exchange_invoice_no) {
          const { data: excInv } = await supabase
            .from('invoices').select('id').eq('invoice_no', ret.exchange_invoice_no).single();
          if (excInv) await supabase.from('invoices').delete().eq('id', (excInv as any).id);
        }
        const { data: retItems } = await supabase
          .from('sales_return_items')
          .select('product_id, return_cartons, return_pieces')
          .eq('return_id', ret.id);
        for (const item of (retItems ?? []) as Array<{ product_id: string; return_cartons: number; return_pieces: number }>) {
          const { data: prod } = await supabase
            .from('products').select('pieces_per_carton').eq('id', item.product_id).single();
          const ppc = Number((prod as { pieces_per_carton?: number } | null)?.pieces_per_carton ?? 1) || 1;
          const units = item.return_cartons * ppc + item.return_pieces;
          if (units > 0) await deductStock(item.product_id, units);
        }
        await supabase.from('sales_returns').update({
          status: 'Cancelled', cancelled_at: new Date().toISOString(),
          cancelled_by: role, cancel_reason: 'Undone',
        }).eq('id', ret.id);

      } else if (ret.resolution_type === 'Replaced') {
        const { data: retItems } = await supabase
          .from('sales_return_items')
          .select('product_id, return_cartons, return_pieces')
          .eq('return_id', ret.id);
        for (const item of (retItems ?? []) as any[]) {
          const { data: prod } = await supabase
            .from('products').select('pieces_per_carton').eq('id', item.product_id).single();
          const ppc = Number((prod as any)?.pieces_per_carton ?? 1) || 1;
          const units = item.return_cartons * ppc + item.return_pieces;
          await supabase.from('stock_adjustments').insert({
            product_id: item.product_id,
            adjustment_pieces: units,
            reason: `Undo replaced return ${ret.return_number}`,
            adjusted_by: role,
          });
        }
        await supabase.from('sales_returns').update({
          status: 'Cancelled', cancelled_at: new Date().toISOString(),
          cancelled_by: role, cancel_reason: 'Undone',
        }).eq('id', ret.id);

      } else if (ret.resolution_type === 'Repaired') {
        await supabase.from('sales_returns').update({
          status: 'Cancelled', cancelled_at: new Date().toISOString(),
          cancelled_by: role, cancel_reason: 'Undone',
        }).eq('id', ret.id);
      }

      showToast('Return cancelled');
      loadHistory();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to undo return', false);
    }
    setUndoing(null);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

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
          <h1 className="text-xl font-bold text-white">Returns & Exchanges</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isAdmin ? 'Viewing last 30 days' : 'Viewing last 10 days'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'history' && (
            <button onClick={loadHistory} disabled={historyLoading}
              className="p-2 bg-[#1d222a] border border-[#2b313a] text-gray-400 rounded-xl hover:text-white transition-all">
              <RefreshCw size={13} className={historyLoading ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[#1d222a] border border-[#2b313a] rounded-xl p-1">
        {(['new', 'history'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); if (t === 'new') resetForm(); }}
            className={cn('flex-1 py-2 text-[14px] font-bold uppercase tracking-widest rounded-lg transition-all',
              tab === t ? 'bg-[#f8fafc] text-black' : 'text-gray-500 hover:text-gray-300')}>
            {t === 'new' ? 'New Return' : 'History'}
          </button>
        ))}
      </div>

      {/* ── NEW RETURN ── */}
      {tab === 'new' && (
        <div className="space-y-4">

          {/* Step 1: invoice search */}
          {step === 1 && (
            <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#2b313a] bg-[#1d222a]">
                <p className="text-[14px] font-bold uppercase tracking-widest text-gray-500">Select Invoice</p>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <input type="text" placeholder="Search invoice number…"
                      value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                      className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-sm rounded-xl py-2.5 pl-9 pr-9 focus:outline-none focus:border-primary/40" />
                    {searchLoading
                      ? <RefreshCw size={12} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-500" />
                      : searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X size={12} /></button>}
                  </div>
                  <input type="date"
                    value={searchDate} onChange={e => setSearchDate(e.target.value)}
                    className="bg-[#1d222a] border border-[#2b313a] text-gray-300 text-sm rounded-xl py-2.5 px-3 focus:outline-none focus:border-primary/40 w-40" />
                  {searchDate && (
                    <button onClick={() => setSearchDate('')} className="text-gray-500 hover:text-white px-2">
                      <X size={13} />
                    </button>
                  )}
                </div>
                <div className="space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar">
                  {invoices.length === 0 && !searchLoading && (
                    <p className="text-center text-sm text-gray-600 py-10">No returnable invoices found</p>
                  )}
                  {invoices.map(inv => {
                    const isCancelled = inv.payment_status === 'cancelled';
                    return (
                    <button key={inv.id}
                      onClick={() => !isCancelled && selectInvoice(inv)}
                      disabled={isCancelled}
                      className={`w-full text-left border rounded-xl px-4 py-3.5 transition-colors ${
                        isCancelled
                          ? 'bg-[#1a1e25] border-[#2b313a] opacity-50 cursor-not-allowed'
                          : 'bg-[#1d222a] hover:bg-[#22282f] border-[#2b313a] cursor-pointer'
                      }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-white font-mono">{inv.invoice_no}</p>
                          <p className="text-[13px] text-gray-500 mt-0.5">{inv.customer_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold font-mono text-white">{fmt(inv.total)}</p>
                          <div className="flex items-center gap-1.5 justify-end mt-0.5">
                            {isCancelled && <span className="text-[13px] uppercase tracking-wider text-red-500 font-bold">Cancelled</span>}
                            <p className="text-[13px] text-gray-600">{new Date(inv.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                      <p className="text-[13px] text-gray-600 mt-1">{inv.items.length} item{inv.items.length !== 1 ? 's' : ''}</p>
                    </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && selectedInvoice && (
            <div className="space-y-4">
              {/* Invoice bar */}
              <div className="bg-[#1d222a] border border-[#2b313a] rounded-2xl px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-[14px] text-gray-500 font-bold uppercase tracking-widest">Invoice</p>
                  <p className="text-sm font-bold text-white font-mono mt-0.5">{selectedInvoice.invoice_no}</p>
                  <p className="text-[13px] text-gray-500">{selectedInvoice.customer_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-white font-mono">{fmt(selectedInvoice.total)}</p>
                  <button onClick={() => { setStep(1); setSelectedInvoice(null); setReturnItems([]); }}
                    className="text-[13px] text-primary hover:text-white transition-colors mt-1">← Change</button>
                </div>
              </div>

              {/* Return type */}
              <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl p-5">
                <p className="text-[14px] font-bold text-gray-500 uppercase tracking-widest mb-3">Return Type</p>
                <div className="flex gap-1 bg-[#1d222a] border border-[#2b313a] rounded-xl p-1">
                  {(['Return', 'Exchange'] as const).map(t => (
                    <button key={t} onClick={() => setReturnType(t)}
                      className={cn('flex-1 py-2 text-[14px] font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1.5',
                        returnType === t ? 'bg-[#f8fafc] text-black' : 'text-gray-500 hover:text-gray-300')}>
                      {t === 'Exchange' ? <ArrowLeftRight size={11} /> : <RotateCcw size={11} />}
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason */}
              <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl p-5">
                <p className="text-[14px] font-bold text-gray-500 uppercase tracking-widest mb-3">Reason</p>
                <div className="flex flex-wrap gap-2">
                  {RETURN_REASONS.map(r => (
                    <button key={r} onClick={() => setReason(r)}
                      className={cn('px-3 py-1.5 rounded-xl text-[14px] font-bold border transition-all',
                        reason === r
                          ? 'bg-primary/15 border-primary/30 text-primary'
                          : 'bg-[#1d222a] border-[#2b313a] text-gray-500 hover:text-gray-300')}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items to return */}
              <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#2b313a] bg-[#1d222a] flex items-center justify-between">
                  <p className="text-[14px] font-bold uppercase tracking-widest text-gray-500">Items to Return</p>
                  <span className="text-[14px] text-gray-500">{returnItems.length} selected</span>
                </div>
                <div className="p-4 border-b border-[#2b313a]">
                  <select onChange={e => {
                      const item = selectedInvoice.items.find(ii => ii.id === e.target.value);
                      if (item) addReturnItem(item);
                      e.target.value = '';
                    }} defaultValue=""
                    className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-sm rounded-xl px-4 py-2.5 outline-none focus:border-primary/40">
                    <option value="" disabled>+ Select item to return</option>
                    {selectedInvoice.items.filter(ii => !returnItems.find(r => r.invoice_item_id === ii.id)).map(ii => (
                      <option key={ii.id} value={ii.id}>
                        {ii.product_name} — {ii.cartons}c {ii.pieces}p @ {fmt(ii.unit_price)}
                      </option>
                    ))}
                  </select>
                </div>
                {returnItems.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-gray-600">No items selected yet</p>
                ) : (
                  <div className="divide-y divide-[#2b313a]">
                    {returnItems.map(r => (
                      <div key={r.invoice_item_id} className="flex items-center gap-3 px-5 py-3.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{r.product_name}</p>
                          <p className="text-[13px] text-gray-500 mt-0.5">{fmt(r.unit_price)} / unit</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <span className="text-[14px] text-gray-500">C</span>
                            <input type="number" min={0} max={r.max_cartons} value={r.return_cartons}
                              onChange={e => updateReturnItem(r.invoice_item_id, 'return_cartons', parseInt(e.target.value) || 0)}
                              className="w-12 bg-[#1d222a] border border-[#2b313a] text-sm text-white rounded-lg px-2 py-1.5 outline-none text-center font-mono focus:border-primary/40" />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[14px] text-gray-500">P</span>
                            <input type="number" min={0} max={r.max_pieces} value={r.return_pieces}
                              onChange={e => updateReturnItem(r.invoice_item_id, 'return_pieces', parseInt(e.target.value) || 0)}
                              className="w-12 bg-[#1d222a] border border-[#2b313a] text-sm text-white rounded-lg px-2 py-1.5 outline-none text-center font-mono focus:border-primary/40" />
                          </div>
                        </div>
                        <span className="text-sm font-bold font-mono text-amber-400 w-24 text-right shrink-0">
                          {fmt(r.unit_price * (r.return_cartons * r.pieces_per_carton + r.return_pieces))}
                        </span>
                        <button onClick={() => setReturnItems(prev => prev.filter(x => x.invoice_item_id !== r.invoice_item_id))}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <div className="flex justify-end px-5 py-3 bg-[#1d222a]">
                      <span className="text-sm font-bold text-white font-mono">Return Value: {fmt(returnedValue)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Exchange replacements */}
              {returnType === 'Exchange' && (
                <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#2b313a] bg-[#1d222a]">
                    <p className="text-[14px] font-bold uppercase tracking-widest text-gray-500">Replacement Items</p>
                  </div>
                  <div className="p-4 border-b border-[#2b313a] relative">
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                      <input type="text" placeholder="Search product to replace…"
                        value={productSearch} onChange={e => setProductSearch(e.target.value)}
                        className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-sm rounded-xl py-2.5 pl-9 pr-4 focus:outline-none focus:border-primary/40" />
                    </div>
                    {filteredProducts.length > 0 && (
                      <div className="absolute left-4 right-4 top-full mt-1 bg-[#1d222a] border border-[#2b313a] rounded-xl overflow-hidden z-20 max-h-48 overflow-y-auto shadow-xl">
                        {filteredProducts.map(p => (
                          <button key={p.id} onClick={() => addReplacement(p)}
                            className="w-full text-left px-4 py-2.5 hover:bg-[#22282f] text-sm text-gray-300 flex items-center justify-between transition-colors">
                            <span>{p.name}</span>
                            <span className="text-gray-500 font-mono">{fmt(p.wholesale_price)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {replacements.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-gray-600">No replacements added</p>
                  ) : (
                    <>
                      <div className="divide-y divide-[#2b313a]">
                        {replacements.map(r => (
                          <div key={r.id} className="flex items-center gap-3 px-5 py-3.5">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{r.product_name}</p>
                              <input type="number" min="0.01" step="0.01" value={r.unit_price}
                                onChange={e => updateReplacement(r.id, 'unit_price', parseFloat(e.target.value) || 0)}
                                className="mt-1 w-24 bg-[#1d222a] border border-[#2b313a] text-[13px] text-gray-300 rounded-lg px-2 py-1 outline-none font-mono focus:border-primary/40" />
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <span className="text-[14px] text-gray-500">C</span>
                                <input type="number" min={0} value={r.cartons}
                                  onChange={e => updateReplacement(r.id, 'cartons', parseInt(e.target.value) || 0)}
                                  className="w-12 bg-[#1d222a] border border-[#2b313a] text-sm text-white rounded-lg px-2 py-1.5 outline-none text-center font-mono focus:border-primary/40" />
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[14px] text-gray-500">P</span>
                                <input type="number" min={0} value={r.pieces}
                                  onChange={e => updateReplacement(r.id, 'pieces', parseInt(e.target.value) || 0)}
                                  className="w-12 bg-[#1d222a] border border-[#2b313a] text-sm text-white rounded-lg px-2 py-1.5 outline-none text-center font-mono focus:border-primary/40" />
                              </div>
                            </div>
                            <span className="text-sm font-bold font-mono text-blue-400 w-24 text-right shrink-0">
                              {fmt(r.unit_price * (r.cartons * r.pieces_per_carton + r.pieces))}
                            </span>
                            <button onClick={() => setReplacements(prev => prev.filter(x => x.id !== r.id))}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                      {/* Settlement summary */}
                      <div className="px-5 py-4 border-t border-[#2b313a] bg-[#1d222a] space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Return value</span>
                          <span className="font-mono text-amber-400">{fmt(returnedValue)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Replacement value</span>
                          <span className="font-mono text-blue-400">{fmt(replacementValue)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold pt-2 border-t border-[#2b313a]">
                          <span className={cn(exchangeDiff === 0 ? 'text-gray-400' : exchangeDiff > 0 ? 'text-white' : 'text-green-400')}>
                            {settlementType === 'EvenExchange' ? 'Even Exchange' : exchangeDiff > 0 ? 'Customer pays extra' : 'Refund to customer'}
                          </span>
                          {Math.abs(exchangeDiff) >= 0.01 && (
                            <span className={cn('font-mono', exchangeDiff > 0 ? 'text-red-400' : 'text-green-400')}>
                              {exchangeDiff > 0 ? '+' : '−'}{fmt(Math.abs(exchangeDiff))}
                            </span>
                          )}
                        </div>
                        {Math.abs(exchangeDiff) >= 0.01 && (
                          <div className="pt-1">
                            <p className="text-[14px] text-gray-500 uppercase tracking-widest font-bold mb-2">
                              {exchangeDiff > 0 ? 'Payment method' : 'Refund method'}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {['cash', 'card', 'bank_transfer'].map(m => (
                                <button key={m} onClick={() => setSettlementMethod(m)}
                                  className={cn('px-3 py-1.5 rounded-xl text-[14px] font-bold border transition-all capitalize',
                                    settlementMethod === m
                                      ? 'bg-primary/15 border-primary/30 text-primary'
                                      : 'bg-[#22282f] border-[#2b313a] text-gray-500 hover:text-gray-300')}>
                                  {m.replace('_', ' ')}
                                </button>
                              ))}
                            </div>
                            {settlementMethod === 'bank_transfer' && (
                              <input
                                type="text"
                                value={settlementBank}
                                onChange={e => setSettlementBank(e.target.value)}
                                placeholder="Bank name (e.g. Commercial Bank)"
                                className="mt-2 w-full bg-[#1d222a] border border-[#2b313a] rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-primary/50"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {submitError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                  <AlertCircle size={13} /> {submitError}
                </div>
              )}

              <button onClick={submitReturn}
                disabled={submitting || returnItems.length === 0}
                className="w-full h-[52px] bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                {returnType === 'Exchange' ? 'Process Exchange' : 'Submit Return'}
              </button>
            </div>
          )}

          {/* Step 3: success */}
          {step === 3 && submitResult && (
            <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl p-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 size={24} className="text-green-400" />
              </div>
              <h3 className="text-lg font-bold text-white">
                {returnType === 'Exchange' ? 'Exchange Processed' : 'Return Submitted'}
              </h3>
              <p className="text-sm text-gray-400">
                Return: <span className="font-mono font-bold text-white">{submitResult.returnNumber}</span>
              </p>
              {submitResult.exchangeInvoiceNo && (
                <p className="text-sm text-gray-400">
                  Exchange invoice: <span className="font-mono font-bold text-blue-400">{submitResult.exchangeInvoiceNo}</span>
                </p>
              )}
              {returnType === 'Return' && reason === 'Damaged' && (
                <p className="text-sm text-gray-500 max-w-xs mx-auto">
                  Status: Pending — resolve via Return History once the item is inspected.
                </p>
              )}
              {returnType === 'Return' && reason !== 'Damaged' && (
                <p className="text-sm text-gray-500 max-w-xs mx-auto">
                  Status: Completed — stock restored and cash refund recorded.
                </p>
              )}
              <button onClick={resetForm}
                className="mt-4 px-6 py-2.5 bg-[#1d222a] border border-[#2b313a] rounded-xl text-sm font-bold text-gray-300 hover:text-white hover:bg-[#22282f] transition-colors">
                New Return
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY ── */}
      {tab === 'history' && (
        <div className="space-y-3">
          {historyLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-primary" />
            </div>
          )}
          {!historyLoading && returns.length === 0 && (
            <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl py-16 text-center text-sm text-gray-600">
              No returns found
            </div>
          )}
          {!historyLoading && returns.map(ret => {
            const cfg = STATUS_CONFIG[ret.status] ?? STATUS_CONFIG.Cancelled;
            const StatusIcon = cfg.icon;
            const isExpanded = expandedId === ret.id;
            return (
              <div key={ret.id} className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
                <button onClick={() => setExpandedId(isExpanded ? null : ret.id)}
                  className="w-full flex items-center px-5 py-4 gap-4 hover:bg-[#1d222a] transition-colors text-left">
                  <StatusIcon size={15} className={cfg.color} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white font-mono">{ret.return_number}</span>
                      <span className={cn('px-2 py-0.5 rounded-full text-[13px] font-bold uppercase', cfg.badge)}>
                        {ret.status}
                      </span>
                      <span className={cn('px-2 py-0.5 rounded-full text-[13px] font-bold uppercase border',
                        ret.return_type === 'Exchange'
                          ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                          : 'bg-amber-500/10 border-amber-500/20 text-amber-400')}>
                        {ret.return_type}
                      </span>
                    </div>
                    <p className="text-[13px] text-gray-500 mt-0.5 truncate">
                      {ret.original_invoice_no} · {ret.customer_name} · {ret.reason}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn(
                      'text-sm font-bold font-mono',
                      ret.settlement_type === 'DamageReplacement' && ret.exchange_difference != null
                        ? 'text-red-400'
                        : 'text-amber-400'
                    )}>
                      {ret.settlement_type === 'DamageReplacement' && ret.exchange_difference != null
                        ? `Loss ${fmt(Math.abs(ret.exchange_difference))}`
                        : fmt(ret.refund_amount)}
                    </p>
                    <p className="text-[13px] text-gray-600">{new Date(ret.created_at).toLocaleDateString()}</p>
                  </div>
                  {isExpanded ? <ChevronUp size={13} className="text-gray-500 shrink-0" /> : <ChevronDown size={13} className="text-gray-500 shrink-0" />}
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-[#2b313a] pt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Invoice', value: ret.original_invoice_no, cls: 'text-white font-mono' },
                        { label: 'Processed By', value: ret.returned_by, cls: 'text-white capitalize' },
                        ret.exchange_invoice_no
                          ? { label: 'Exchange Invoice', value: ret.exchange_invoice_no, cls: 'text-blue-400 font-mono' }
                          : null,
                        ret.resolution_type
                          ? { label: 'Resolution', value: ret.resolution_type, cls: 'text-green-400' }
                          : null,
                        ret.settlement_type
                          ? { label: 'Settlement', value: ret.settlement_type, cls: 'text-blue-400' }
                          : null,
                        ret.settlement_type === 'DamageReplacement' && ret.exchange_difference != null
                          ? { label: 'Replacement Loss', value: fmt(Math.abs(ret.exchange_difference)), cls: 'text-red-400 font-mono' }
                          : null,
                      ].filter(Boolean).map((f: any) => (
                        <div key={f.label}>
                          <p className="text-[14px] font-bold uppercase tracking-widest text-gray-600">{f.label}</p>
                          <p className={cn('text-sm mt-0.5', f.cls)}>{f.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {ret.status === 'Pending' && ret.return_type === 'Return' && (
                        <>
                          <button onClick={() => completeReturn(ret, 'Repaired')} disabled={completing === ret.id}
                            className="flex-1 py-2.5 rounded-xl text-[14px] font-bold bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/15 transition-all flex items-center justify-center gap-1.5 min-w-[100px]">
                            {completing === ret.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                            Repaired
                          </button>
                          <button onClick={() => completeReturn(ret, 'Replaced')} disabled={completing === ret.id}
                            className="flex-1 py-2.5 rounded-xl text-[14px] font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/15 transition-all flex items-center justify-center gap-1.5 min-w-[100px]">
                            {completing === ret.id ? <Loader2 size={11} className="animate-spin" /> : <ArrowLeftRight size={11} />}
                            Replaced
                          </button>
                        </>
                      )}
                      {(ret.status === 'Pending' || (ret.status === 'Completed' && isAdmin)) && (
                        <button onClick={() => undoReturn(ret)} disabled={undoing === ret.id}
                          className="flex-1 py-2.5 rounded-xl text-[14px] font-bold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15 transition-all flex items-center justify-center gap-1.5 min-w-[80px]">
                          {undoing === ret.id ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                          {ret.status === 'Pending' ? 'Cancel' : 'Undo'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
