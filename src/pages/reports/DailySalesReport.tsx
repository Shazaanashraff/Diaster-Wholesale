import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { cancelInvoice } from '../../services/posService';
import { type ReportPeriod, getReportDateRange, fmtCurrency, fmtDate } from '../../utils/reportUtils';
import { DateRangePicker } from './shared/DateRangePicker';
import { ExportBar } from './shared/ExportBar';
import { ReportKPICard } from './shared/ReportKPICard';
import { cn } from '../../lib/utils';
import { getCurrentRole } from '../../utils/permissions';
import { TrendingUp, RotateCcw, Wallet, CreditCard, Smartphone, Building2, RefreshCw, XCircle } from 'lucide-react';

interface PaymentRow { method: string; bank_name: string | null; amount: number; paid_at: string }
interface InvoiceRow { id: string; invoice_no: string; total: number; payment_status: string; created_at: string; salesperson_name: string | null; customers: { name: string } | null }
interface TxRow { invoice_no: string; customer: string; salesperson: string; status: string; method: string; bank: string; amount: number; created_at: string }

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

  async function load() {
    setLoading(true);
    const { from, to } = getReportDateRange(period, customFrom, customTo);
    const [paymentsRes, invoicesRes] = await Promise.all([
      (() => {
        let q = supabase.from('payments').select('method, bank_name, amount, paid_at');
        if (from) q = q.gte('paid_at', from);
        if (to)   q = q.lte('paid_at', to);
        return q;
      })(),
      (() => {
        let q = supabase.from('invoices').select('id, invoice_no, total, payment_status, created_at, salesperson_name, customers(name)');
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
  const salesPayments = payments.filter(p => Number(p.amount) > 0);
  const returnPayments = payments.filter(p => Number(p.amount) < 0);

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
      salesperson: inv.salesperson_name ?? '—',
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
                {['Date', 'Invoice', 'Customer', 'Sold By', 'Status', 'Amount', ...(allowCancel ? [''] : [])].map(h => (
                  <th key={h} className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={allowCancel ? 7 : 6} className="px-5 py-8 text-center text-gray-500 text-sm">Loading...</td></tr>
              ) : allInvoices.length === 0 ? (
                <tr><td colSpan={allowCancel ? 7 : 6} className="px-5 py-8 text-center text-gray-500 text-sm">No invoices for this period.</td></tr>
              ) : allInvoices.map(inv => (
                <tr key={inv.id} className={cn('border-b border-[#2b313a]/60 hover:bg-[#1d222a] transition-colors', inv.payment_status === 'cancelled' && 'opacity-50')}>
                  <td className="px-5 py-3 text-xs text-gray-500">{fmtDate(inv.created_at)}</td>
                  <td className="px-5 py-3 text-sm font-bold text-white font-mono">{inv.invoice_no}</td>
                  <td className="px-5 py-3 text-sm text-gray-300">{inv.customers?.name ?? '—'}</td>
                  <td className="px-5 py-3 text-sm text-gray-400">{inv.salesperson_name ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                      inv.payment_status === 'paid'       ? 'bg-green-900/20 text-green-400' :
                      inv.payment_status === 'partial'    ? 'bg-amber-900/20 text-amber-400' :
                      inv.payment_status === 'cancelled'  ? 'bg-gray-900/20 text-gray-500'   :
                                                            'bg-red-900/20 text-red-400'
                    )}>{inv.payment_status}</span>
                  </td>
                  <td className="px-5 py-3 text-sm font-bold font-mono text-right text-white">{fmtCurrency(Number(inv.total))}</td>
                  {allowCancel && (
                    <td className="px-5 py-3 text-right">
                      {inv.payment_status !== 'cancelled' && (
                        <button
                          onClick={() => { setCancelTarget(inv); setCancelError(null); }}
                          className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Cancel sale"
                        >
                          <XCircle size={13} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
