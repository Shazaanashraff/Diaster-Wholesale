import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { cancelInvoice } from '../../services/posService';
import { type ReportPeriod, getReportDateRange, fmtCurrency, fmtDate } from '../../utils/reportUtils';
import { DateRangePicker } from './shared/DateRangePicker';
import { ExportBar } from './shared/ExportBar';
import { ReportKPICard } from './shared/ReportKPICard';
import { cn } from '../../lib/utils';
import { getCurrentRole } from '../../utils/permissions';
import { POSSaleReceipt, type SaleReceiptData } from '../../components/POSSaleReceipt';
import type { Product } from '../../types';
import { TrendingUp, RotateCcw, Wallet, CreditCard, Smartphone, Building2, RefreshCw, XCircle, Eye, Printer, X } from 'lucide-react';

interface PaymentRow { method: string; bank_name: string | null; amount: number; paid_at: string; reference: string | null }
interface InvoiceRow {
  id: string;
  invoice_no: string;
  subtotal: number;
  discount: number;
  total: number;
  mode: string | null;
  payment_status: string;
  created_at: string;
  salesperson_name: string | null;
  salesperson: { id: string; name: string } | null;
  customers: { name: string } | null;
}
interface TxRow { invoice_no: string; customer: string; salesperson: string; status: string; method: string; bank: string; amount: number; created_at: string }
interface DetailItem {
  cartons: number;
  pieces: number;
  unit_price: number;
  total: number;
  batch_id: string | null;
  products: {
    id: string; name: string; item_code: string; pieces_per_carton: number;
    wholesale_price: number; retail_price: number; model: string; category: string;
    created_at: string; updated_at: string;
  } | null;
}

const canCancelSales = () => { const r = getCurrentRole(); return r === 'admin' || r === 'accountant'; };

interface MethodGroup { method: string; total: number; count: number; byBank: { bank: string; total: number; count: number }[] }

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', card: 'Card', cheque: 'Cheque', online: 'Online',
  bank_transfer: 'Bank Transfer', credit: 'Credit',
};
const METHOD_ICONS: Record<string, React.ElementType> = {
  cash: Wallet, card: CreditCard, cheque: CreditCard, online: Smartphone,
  bank_transfer: Building2, credit: CreditCard,
};
const METHOD_COLORS: Record<string, string> = {
  cash: 'text-green-400', card: 'text-blue-400', cheque: 'text-amber-400',
  online: 'text-purple-400', bank_transfer: 'text-sky-400', credit: 'text-red-400',
};

export const DailySalesReport: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [creditInvoices, setCreditInvoices] = useState<InvoiceRow[]>([]);
  const [allInvoices, setAllInvoices] = useState<InvoiceRow[]>([]);
  const [cancelTarget, setCancelTarget] = useState<InvoiceRow | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const allowCancel = canCancelSales();

  // Invoice detail state
  const [detailInvoice, setDetailInvoice] = useState<InvoiceRow | null>(null);
  const [detailItems, setDetailItems] = useState<DetailItem[]>([]);
  const [detailPayments, setDetailPayments] = useState<PaymentRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [receiptData, setReceiptData] = useState<SaleReceiptData | null>(null);

  async function load() {
    setLoading(true);
    const { from, to } = getReportDateRange(period, customFrom, customTo);
    const [paymentsRes, invoicesRes] = await Promise.all([
      (() => {
        let q = supabase.from('payments').select('method, bank_name, amount, paid_at, reference');
        if (from) q = q.gte('paid_at', from);
        if (to)   q = q.lte('paid_at', to);
        return q;
      })(),
      (() => {
        let q = supabase
          .from('invoices')
          .select('id, invoice_no, subtotal, discount, total, mode, payment_status, created_at, salesperson_name, salesperson:salespeople(id, name), customers(name)');
        if (from) q = q.gte('created_at', from);
        if (to)   q = q.lte('created_at', to);
        return q.order('created_at', { ascending: false });
      })(),
    ]);
    setPayments((paymentsRes.data ?? []) as PaymentRow[]);
    const invs = (invoicesRes.data ?? []) as unknown as InvoiceRow[];
    setAllInvoices(invs);
    setCreditInvoices(invs.filter(i => i.payment_status === 'unpaid'));
    setLoading(false);
  }

  useEffect(() => { load(); }, [period, customFrom, customTo]);

  async function openDetail(inv: InvoiceRow) {
    setDetailInvoice(inv);
    setDetailItems([]);
    setDetailPayments([]);
    setDetailLoading(true);
    setReceiptData(null);
    const [itemsRes, paymentsRes] = await Promise.all([
      supabase
        .from('invoice_items')
        .select('cartons, pieces, unit_price, total, batch_id, products(id, name, item_code, pieces_per_carton, wholesale_price, retail_price, model, category, created_at, updated_at)')
        .eq('invoice_id', inv.id),
      supabase
        .from('payments')
        .select('method, bank_name, amount, paid_at, reference')
        .eq('invoice_id', inv.id)
        .gt('amount', 0),
    ]);
    setDetailItems((itemsRes.data ?? []) as unknown as DetailItem[]);
    setDetailPayments((paymentsRes.data ?? []) as PaymentRow[]);
    setDetailLoading(false);
  }

  function handlePrintReceipt() {
    if (!detailInvoice) return;
    const rd: SaleReceiptData = {
      invoiceNo: detailInvoice.invoice_no,
      cartSnapshot: detailItems
        .filter(item => item.products !== null)
        .map(item => ({
          product: item.products as Product,
          quantityCartons: item.cartons,
          quantityPieces: item.pieces,
          unitPrice: item.unit_price,
          batchId: item.batch_id ?? undefined,
        })),
      customerName: detailInvoice.customers?.name ?? 'Walk-in',
      salespersonName: detailInvoice.salesperson?.name ?? detailInvoice.salesperson_name ?? '—',
      paymentSplits: detailPayments.map(p => ({ method: p.method, amount: Number(p.amount) })),
      subtotal: Number(detailInvoice.subtotal),
      discount: Number(detailInvoice.discount),
      redeemedPoints: 0,
      total: Number(detailInvoice.total),
      isWholesale: detailInvoice.mode === 'wholesale',
      earnedPoints: 0,
      timestamp: new Date(detailInvoice.created_at),
    };
    setReceiptData(rd);
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelInvoice(cancelTarget.id);
      await load();
      setCancelTarget(null);
    } catch (e: any) {
      setCancelError(e.message);
    } finally {
      setCancelling(false);
    }
  }

  // Split into sales receipts and returns
  const salesPayments  = payments.filter(p => Number(p.amount) > 0 && !p.reference?.startsWith('RETURN-'));
  const returnPayments = payments.filter(p => Number(p.amount) < 0 || p.reference?.startsWith('RETURN-'));

  // Group sales by method
  const methodMap = new Map<string, MethodGroup>();
  for (const p of salesPayments) {
    const m = p.method ?? 'other';
    if (!methodMap.has(m)) methodMap.set(m, { method: m, total: 0, count: 0, byBank: [] });
    const g = methodMap.get(m)!;
    g.total += Number(p.amount);
    g.count++;
    if (m === 'online') {
      const bank = p.bank_name || 'Other';
      const bk = g.byBank.find(b => b.bank === bank);
      if (bk) { bk.total += Number(p.amount); bk.count++; }
      else g.byBank.push({ bank, total: Number(p.amount), count: 1 });
    }
  }

  const creditTotal = creditInvoices.reduce((s, i) => s + Number(i.total), 0);
  if (creditTotal > 0) {
    methodMap.set('credit', { method: 'credit', total: creditTotal, count: creditInvoices.length, byBank: [] });
  }

  const methodGroups = Array.from(methodMap.values()).sort((a, b) => {
    const order = ['cash', 'card', 'online', 'cheque', 'bank_transfer', 'credit'];
    return (order.indexOf(a.method) ?? 99) - (order.indexOf(b.method) ?? 99);
  });

  const grossSales = salesPayments.reduce((s, p) => s + Number(p.amount), 0);
  const returnsTotal = returnPayments.reduce((s, p) => s + Math.abs(Number(p.amount)), 0);
  const netSales = grossSales - returnsTotal;

  // Transaction rows for export
  const txRows: TxRow[] = allInvoices.map(inv => {
    return {
      invoice_no: inv.invoice_no,
      customer: inv.customers?.name ?? '—',
      salesperson: inv.salesperson?.name ?? inv.salesperson_name ?? '—',
      status: inv.payment_status,
      method: '—', bank: '—',
      amount: Number(inv.total),
      created_at: inv.created_at,
    };
  });
  const exportHeaders = ['Date', 'Invoice', 'Customer', 'Sold By', 'Status', 'Amount'];
  const exportRows = txRows.map(r => [fmtDate(r.created_at), r.invoice_no, r.customer, r.salesperson, r.status, fmtCurrency(r.amount)]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Sales Report</h2>
        <div className="flex items-center gap-3">
          <button onClick={load} disabled={loading} className="flex items-center gap-2 bg-[#1d222a] border border-[#2b313a] text-xs text-gray-400 rounded-xl px-3 py-2.5 hover:text-white transition-colors">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
          <DateRangePicker value={period} onChange={setPeriod} customFrom={customFrom} customTo={customTo} onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }} />
          <ExportBar filename="Sales_Report" headers={exportHeaders} rows={exportRows} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportKPICard label="Gross Sales" value={grossSales} prefix="LKR " icon={TrendingUp} color="bg-green-600" />
        <ReportKPICard label="Returns" value={returnsTotal} prefix="LKR " icon={RotateCcw} color="bg-red-600" />
        <ReportKPICard label="Net Sales" value={netSales} prefix="LKR " icon={TrendingUp} color="bg-blue-600" />
        <ReportKPICard label="Credit (Unpaid)" value={creditTotal} prefix="LKR " icon={CreditCard} color="bg-amber-600" />
      </div>

      {/* Payment Method Breakdown */}
      <div className="bg-[#171c23] rounded-3xl border border-[#2b313a] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2b313a]">
          <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest">Payment Method Breakdown</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2b313a]">
              <th className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest px-6 py-3">Method</th>
              <th className="text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest px-6 py-3">Transactions</th>
              <th className="text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest px-6 py-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500 text-sm">Loading...</td></tr>
            ) : methodGroups.length === 0 ? (
              <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500 text-sm">No sales for this period.</td></tr>
            ) : (
              <>
                {methodGroups.map(g => {
                  const Icon = METHOD_ICONS[g.method] ?? Wallet;
                  const color = METHOD_COLORS[g.method] ?? 'text-gray-400';
                  return (
                    <React.Fragment key={g.method}>
                      <tr className="border-b border-[#2b313a] hover:bg-[#1d222a] transition-colors">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <Icon size={14} className={color} />
                            <span className={cn('text-sm font-semibold', color)}>{METHOD_LABELS[g.method] ?? g.method}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right text-sm text-gray-400 font-mono">{g.count}</td>
                        <td className={cn('px-6 py-3 text-right text-sm font-bold font-mono', color)}>{fmtCurrency(g.total)}</td>
                      </tr>
                      {/* Online bank sub-rows */}
                      {g.byBank.map(bk => (
                        <tr key={bk.bank} className="border-b border-[#2b313a]/50 bg-[#12161d]">
                          <td className="px-6 py-2 pl-14">
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-1 rounded-full bg-purple-400/60" />
                              <span className="text-xs font-semibold text-gray-400">{bk.bank}</span>
                            </div>
                          </td>
                          <td className="px-6 py-2 text-right text-xs text-gray-500 font-mono">{bk.count}</td>
                          <td className="px-6 py-2 text-right text-xs font-bold font-mono text-purple-300">{fmtCurrency(bk.total)}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
                {/* Returns row */}
                {returnsTotal > 0 && (
                  <tr className="border-b border-[#2b313a] bg-[#12161d]">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <RotateCcw size={14} className="text-red-400" />
                        <span className="text-sm font-semibold text-red-400">Returns</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right text-sm text-gray-400 font-mono">{returnPayments.length}</td>
                    <td className="px-6 py-3 text-right text-sm font-bold font-mono text-red-400">({fmtCurrency(returnsTotal)})</td>
                  </tr>
                )}
                {/* Total row */}
                <tr className="bg-[#1d222a]">
                  <td className="px-6 py-4"><span className="text-sm font-bold text-white">NET TOTAL</span></td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-white font-mono">
                    {salesPayments.length + returnPayments.length}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-white font-mono">{fmtCurrency(netSales)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Invoice Transaction List */}
      <div className="bg-[#171c23] rounded-3xl border border-[#2b313a] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2b313a]">
          <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest">Invoices</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2b313a]">
                {['Date', 'Invoice', 'Customer', 'Sold By', 'Status', 'Amount', ''].map(h => (
                  <th key={h} className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-500 text-sm">Loading...</td></tr>
              ) : allInvoices.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-500 text-sm">No invoices for this period.</td></tr>
              ) : allInvoices.map(inv => (
                <tr key={inv.id} className={cn('border-b border-[#2b313a]/60 hover:bg-[#1d222a] transition-colors', inv.payment_status === 'cancelled' && 'opacity-50')}>
                  <td className="px-5 py-3 text-xs text-gray-500">{fmtDate(inv.created_at)}</td>
                  <td className="px-5 py-3 text-sm font-bold text-white font-mono">{inv.invoice_no}</td>
                  <td className="px-5 py-3 text-sm text-gray-300">{inv.customers?.name ?? '—'}</td>
                  <td className="px-5 py-3 text-sm text-gray-400">{inv.salesperson?.name ?? inv.salesperson_name ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                      inv.payment_status === 'paid'       ? 'bg-green-900/20 text-green-400' :
                      inv.payment_status === 'partial'    ? 'bg-amber-900/20 text-amber-400' :
                      inv.payment_status === 'cancelled'  ? 'bg-gray-900/20 text-gray-500'   :
                                                            'bg-red-900/20 text-red-400'
                    )}>{inv.payment_status}</span>
                  </td>
                  <td className="px-5 py-3 text-sm font-bold font-mono text-right text-white">{fmtCurrency(Number(inv.total))}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openDetail(inv)}
                        className="p-1 rounded text-gray-600 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                        title="View invoice"
                      >
                        <Eye size={13} />
                      </button>
                      {allowCancel && inv.payment_status !== 'cancelled' && (
                        <button
                          onClick={() => { setCancelTarget(inv); setCancelError(null); }}
                          className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Cancel sale"
                        >
                          <XCircle size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice detail modal */}
      {detailInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-[#2b313a] flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-sm font-bold text-white">{detailInvoice.invoice_no}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {fmtDate(detailInvoice.created_at)} · {detailInvoice.customers?.name ?? 'Walk-in'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!detailLoading && detailItems.length > 0 && (
                  <button
                    onClick={handlePrintReceipt}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/80 text-white text-xs font-bold hover:bg-blue-600 transition-colors"
                  >
                    <Printer size={12} />
                    Print Receipt
                  </button>
                )}
                <button
                  onClick={() => { setDetailInvoice(null); setReceiptData(null); }}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#2b313a] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {detailLoading ? (
                <div className="text-center text-gray-500 text-sm py-12">Loading invoice details…</div>
              ) : (
                <>
                  {/* Invoice meta */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Sold By</p>
                      <p className="text-sm text-white font-semibold mt-0.5">
                        {detailInvoice.salesperson?.name ?? detailInvoice.salesperson_name ?? '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Mode</p>
                      <p className="text-sm text-white font-semibold mt-0.5 capitalize">
                        {detailInvoice.mode ?? '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</p>
                      <span className={cn('inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                        detailInvoice.payment_status === 'paid'       ? 'bg-green-900/20 text-green-400' :
                        detailInvoice.payment_status === 'partial'    ? 'bg-amber-900/20 text-amber-400' :
                        detailInvoice.payment_status === 'cancelled'  ? 'bg-gray-900/20 text-gray-500'   :
                                                                         'bg-red-900/20 text-red-400'
                      )}>{detailInvoice.payment_status}</span>
                    </div>
                  </div>

                  {/* Line items */}
                  <div className="rounded-xl border border-[#2b313a] overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#2b313a] bg-[#12161d]">
                          <th className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4 py-2.5">Product</th>
                          <th className="text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4 py-2.5">Qty</th>
                          <th className="text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4 py-2.5">Unit Price</th>
                          <th className="text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4 py-2.5">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailItems.length === 0 ? (
                          <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500 text-xs">No items found</td></tr>
                        ) : detailItems.map((item, i) => {
                          const ppc = item.products?.pieces_per_carton || 1;
                          const totalPieces = item.cartons * ppc + item.pieces;
                          return (
                            <tr key={i} className="border-b border-[#2b313a]/60 hover:bg-[#1d222a] transition-colors">
                              <td className="px-4 py-2.5">
                                <p className="text-sm font-semibold text-white">{item.products?.name ?? '—'}</p>
                                <p className="text-[10px] text-gray-500 font-mono">{item.products?.item_code ?? ''}</p>
                              </td>
                              <td className="px-4 py-2.5 text-right text-xs text-gray-300 font-mono whitespace-nowrap">
                                {item.cartons > 0 && <span>{item.cartons} ctn</span>}
                                {item.cartons > 0 && item.pieces > 0 && <span className="mx-1 text-gray-600">+</span>}
                                {item.pieces > 0 && <span>{item.pieces} pcs</span>}
                                <span className="ml-1 text-gray-600">({totalPieces})</span>
                              </td>
                              <td className="px-4 py-2.5 text-right text-xs font-mono text-gray-300">{fmtCurrency(item.unit_price)}</td>
                              <td className="px-4 py-2.5 text-right text-sm font-bold font-mono text-white">{fmtCurrency(item.total)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals + Payments side by side */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-[#2b313a] p-4 space-y-2">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Summary</p>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Subtotal</span>
                        <span className="text-gray-300 font-mono">{fmtCurrency(Number(detailInvoice.subtotal))}</span>
                      </div>
                      {Number(detailInvoice.discount) > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Discount</span>
                          <span className="text-red-400 font-mono">− {fmtCurrency(Number(detailInvoice.discount))}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-bold border-t border-[#2b313a] pt-2 mt-1">
                        <span className="text-white">Total</span>
                        <span className="text-white font-mono">{fmtCurrency(Number(detailInvoice.total))}</span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#2b313a] p-4 space-y-2">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Payments</p>
                      {detailPayments.length === 0 ? (
                        <p className="text-xs text-gray-500">No payments recorded</p>
                      ) : detailPayments.map((p, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-gray-400 capitalize">{METHOD_LABELS[p.method] ?? p.method}</span>
                          <span className="text-gray-300 font-mono">{fmtCurrency(Number(p.amount))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Receipt print overlay */}
      {receiptData && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative">
            <button
              onClick={() => setReceiptData(null)}
              className="absolute -top-8 right-0 flex items-center gap-1 text-gray-400 hover:text-white text-xs transition-colors"
            >
              <X size={12} /> Close Preview
            </button>
            <POSSaleReceipt data={receiptData} onClose={() => setReceiptData(null)} />
          </div>
        </div>
      )}

      {/* Cancel confirm modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl p-6 w-[360px] space-y-4">
            <h3 className="text-sm font-bold text-white">Cancel Sale</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Cancel <span className="font-bold text-white">{cancelTarget.invoice_no}</span> for{' '}
              <span className="font-bold text-white">{cancelTarget.customers?.name ?? 'customer'}</span>?
              {' '}Any unpaid balance will be removed from the customer's account.
              Stock will not be automatically restored.
            </p>
            {cancelError && (
              <p className="text-xs text-red-400">{cancelError}</p>
            )}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setCancelTarget(null)}
                className="flex-1 py-2 rounded-xl bg-[#1d222a] border border-[#2b313a] text-gray-400 text-xs font-bold hover:text-white transition-colors"
              >
                Keep
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 py-2 rounded-xl bg-red-600/80 text-white text-xs font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {cancelling ? 'Cancelling…' : 'Cancel Sale'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
