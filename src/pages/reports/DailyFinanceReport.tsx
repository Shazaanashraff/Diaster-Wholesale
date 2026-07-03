import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { type ReportPeriod, getReportDateRange, fmtCurrency, fmtDate } from '../../utils/reportUtils';
import { DateRangePicker } from './shared/DateRangePicker';
import { ExportBar } from './shared/ExportBar';
import { getCurrentRole } from '../../utils/permissions';
import { cn } from '../../lib/utils';
import {
  TrendingUp, TrendingDown, Wallet, CreditCard, Smartphone,
  Building2, RefreshCw, DollarSign, PlusCircle, Calculator,
} from 'lucide-react';

const OPENING_BALANCE_KEY = 'dw_day_opening_balance';

const fmt = (n: number) =>
  'LKR ' + Math.abs(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', card: 'Card', cheque: 'Cheque',
  online: 'Online', bank_transfer: 'Bank Transfer', credit: 'Credit',
};
const METHOD_COLORS: Record<string, string> = {
  cash: 'text-green-400', card: 'text-blue-400', cheque: 'text-amber-400',
  online: 'text-purple-400', bank_transfer: 'text-sky-400', credit: 'text-red-400',
};
const METHOD_ICONS: Record<string, React.ElementType> = {
  cash: Wallet, card: CreditCard, cheque: CreditCard,
  online: Smartphone, bank_transfer: Building2, credit: CreditCard,
};

interface PaymentRow   { method: string; bank_name: string | null; amount: number; paid_at: string; reference: string | null; payment_type?: string }
interface ExpenseRow   { id: string; category: string; description: string; amount: number; method: string; created_at: string }
interface OtherIncRow  { id: string; source_type: string; amount: number; method: string; notes: string; created_at: string }
interface CreditInvoiceRow { id: string; total: number }

interface MethodIncome { method: string; total: number }

interface DailyFinanceReportProps {
  // When provided the component runs in controlled mode — no internal date picker is shown
  period?: ReportPeriod;
  customFrom?: string;
  customTo?: string;
  onPeriodChange?: (p: ReportPeriod) => void;
  onCustomChange?: (from: string, to: string) => void;
}

export const DailyFinanceReport: React.FC<DailyFinanceReportProps> = ({
  period: propPeriod,
  customFrom: propFrom,
  customTo: propTo,
  onPeriodChange,
  onCustomChange,
}) => {
  const controlled = propPeriod !== undefined;
  const canExportCsv = getCurrentRole() !== 'pos_operator';
  const [internalPeriod, setInternalPeriod] = useState<ReportPeriod>('today');
  const [internalFrom, setInternalFrom] = useState('');
  const [internalTo, setInternalTo] = useState('');

  const period     = controlled ? propPeriod!         : internalPeriod;
  const customFrom = controlled ? (propFrom  ?? '')   : internalFrom;
  const customTo   = controlled ? (propTo    ?? '')   : internalTo;
  const setPeriod     = controlled ? (onPeriodChange  ?? (() => {})) : setInternalPeriod;
  const setCustom     = controlled
    ? (onCustomChange ?? (() => {}))
    : (f: string, t: string) => { setInternalFrom(f); setInternalTo(t); };
  const [loading, setLoading]   = useState(true);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [otherInc, setOtherInc] = useState<OtherIncRow[]>([]);
  const [creditInvoices, setCreditInvoices] = useState<CreditInvoiceRow[]>([]);

  const [openingBalance, setOpeningBalance] = useState<number>(() => {
    const stored = localStorage.getItem(OPENING_BALANCE_KEY);
    return stored ? Number(stored) : 15000;
  });
  const [openingInput, setOpeningInput] = useState<string>(() => {
    const stored = localStorage.getItem(OPENING_BALANCE_KEY);
    return stored ?? '15000';
  });

  const handleOpeningBlur = () => {
    const val = parseFloat(openingInput);
    const safe = isNaN(val) || val < 0 ? 0 : val;
    setOpeningBalance(safe);
    setOpeningInput(String(safe));
    localStorage.setItem(OPENING_BALANCE_KEY, String(safe));
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = getReportDateRange(period, customFrom, customTo);
    const [pRes, eRes, oRes, invRes] = await Promise.all([
      (() => { let q = supabase.from('payments').select('method, bank_name, amount, paid_at, reference, payment_type'); if (from) q = q.gte('paid_at', from); if (to) q = q.lte('paid_at', to); return q; })(),
      (() => { let q = supabase.from('expenses').select('id, category, description, amount, method, created_at').order('created_at', { ascending: false }); if (from) q = q.gte('created_at', from); if (to) q = q.lte('created_at', to); return q; })(),
      (() => { let q = supabase.from('other_income').select('id, source_type, amount, method, notes, created_at').order('created_at', { ascending: false }); if (from) q = q.gte('created_at', from); if (to) q = q.lte('created_at', to); return q; })(),
      (() => { let q = supabase.from('invoices').select('id, total').eq('payment_status', 'unpaid'); if (from) q = q.gte('created_at', from); if (to) q = q.lte('created_at', to); return q; })(),
    ]);
    setPayments((pRes.data ?? []) as PaymentRow[]);
    setExpenses((eRes.data ?? []) as ExpenseRow[]);
    setOtherInc((oRes.data ?? []) as OtherIncRow[]);
    setCreditInvoices((invRes.data ?? []) as CreditInvoiceRow[]);
    setLoading(false);
  }, [period, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);

  const salesPayments = payments.filter(p => Number(p.amount) > 0 && !p.reference?.startsWith('RETURN-') && p.payment_type !== 'credit_settlement');
  const returnPayments = payments.filter(p => Number(p.amount) < 0 || p.reference?.startsWith('RETURN-'));

  // Group sales income by method
  const salesByMethod = new Map<string, number>();
  for (const p of salesPayments) {
    const m = p.method ?? 'other';
    salesByMethod.set(m, (salesByMethod.get(m) ?? 0) + Number(p.amount));
  }
  const creditTotal = creditInvoices.reduce((s, i) => s + Number(i.total), 0);
  if (creditTotal > 0) salesByMethod.set('credit', creditTotal);

  const salesMethodRows: MethodIncome[] = Array.from(salesByMethod.entries()).map(([method, total]) => ({ method, total }));

  const paidSalesTotal = salesPayments.reduce((s, p) => s + Number(p.amount), 0);
  const totalSales     = paidSalesTotal + creditTotal;
  const totalReturns   = returnPayments.reduce((s, p) => s + Math.abs(Number(p.amount)), 0);
  const totalOtherInc  = otherInc.reduce((s, r) => s + Number(r.amount), 0);
  const totalIncome    = totalSales - totalReturns + totalOtherInc;
  const totalExpenses  = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const netBalance     = totalIncome - totalExpenses;

  // Cash reconciliation (cash-method only)
  const salesCash    = salesByMethod.get('cash') ?? 0;
  const cashOtherInc = otherInc.filter(r => r.method === 'cash').reduce((s, r) => s + Number(r.amount), 0);
  const cashExpenses = expenses.filter(e => e.method === 'cash').reduce((s, e) => s + Number(e.amount), 0);
  const finalCash    = openingBalance + salesCash + cashOtherInc - cashExpenses;
  const resultVsOpening = finalCash - openingBalance;

  // Group expenses by category
  const expByCat = new Map<string, number>();
  for (const e of expenses) expByCat.set(e.category, (expByCat.get(e.category) ?? 0) + Number(e.amount));

  // Export
  const exportHeaders = ['Date', 'Type', 'Description', 'Method', 'Amount'];
  const exportRows: (string | number)[][] = [
    ...salesPayments.map(p => [fmtDate(p.paid_at), 'Sales Receipt', METHOD_LABELS[p.method] ?? p.method, p.bank_name ?? '', fmtCurrency(Number(p.amount))]),
    ...otherInc.map(r => [fmtDate(r.created_at), 'Other Income', r.notes, r.method, fmtCurrency(Number(r.amount))]),
    ...expenses.map(e => [fmtDate(e.created_at), 'Expense', e.description, e.method, `-${fmtCurrency(Number(e.amount))}`]),
  ];

  const KPI = ({ label, value, color, icon: Icon, sub }: { label: string; value: number; color: string; icon: React.ElementType; sub?: string }) => (
    <div className="bg-[#171c23] rounded-2xl border border-[#2b313a] p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
        <Icon size={14} className={color} />
      </div>
      <p className={cn('text-xl font-bold font-mono', color)}>{fmt(value)}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-1">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Daily Finance Report</h2>
        <div className="flex items-center gap-3">
          {!controlled && (
            <DateRangePicker value={period} onChange={setPeriod} customFrom={customFrom} customTo={customTo} onCustomChange={setCustom} />
          )}
          <button onClick={load} disabled={loading} className="flex items-center gap-2 bg-[#1d222a] border border-[#2b313a] text-xs text-gray-400 rounded-xl px-3 py-2.5 hover:text-white transition-colors">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
          <ExportBar filename="Daily_Finance_Report" headers={exportHeaders} rows={exportRows} showCsv={canExportCsv} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Sales Income" value={totalSales} color="text-green-400" icon={TrendingUp} sub={`${salesPayments.length} receipts · ${creditInvoices.length} credit`} />
        <KPI label="Other Income" value={totalOtherInc} color="text-sky-400" icon={PlusCircle} sub={`${otherInc.length} entries`} />
        <KPI label="Total Expenses" value={totalExpenses} color="text-red-400" icon={TrendingDown} sub={`${expenses.length} entries`} />
        <KPI label="Net Balance" value={netBalance} color={netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'} icon={DollarSign} sub="Income − Expenses" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income — Sales by Method */}
        <div className="bg-[#171c23] rounded-3xl border border-[#2b313a] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#2b313a] flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest">Sales Income by Method</h3>
            <span className="text-sm font-bold font-mono text-green-400">{fmt(totalSales)}</span>
          </div>
          <table className="w-full">
            <tbody>
              {loading ? (
                <tr><td colSpan={2} className="px-6 py-6 text-center text-gray-500 text-sm">Loading…</td></tr>
              ) : salesMethodRows.length === 0 ? (
                <tr><td colSpan={2} className="px-6 py-6 text-center text-gray-500 text-sm">No sales receipts for this date.</td></tr>
              ) : salesMethodRows.map(r => {
                const Icon = METHOD_ICONS[r.method] ?? Wallet;
                const color = METHOD_COLORS[r.method] ?? 'text-gray-400';
                return (
                  <tr key={r.method} className="border-b border-[#2b313a]/60 hover:bg-[#1d222a] transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <Icon size={14} className={color} />
                        <span className={cn('text-sm font-semibold', color)}>{METHOD_LABELS[r.method] ?? r.method}</span>
                      </div>
                    </td>
                    <td className={cn('px-6 py-3 text-right text-sm font-bold font-mono', color)}>{fmt(r.total)}</td>
                  </tr>
                );
              })}
              {totalReturns > 0 && (
                <tr className="border-b border-[#2b313a]/60 bg-[#12161d]">
                  <td className="px-6 py-3 text-sm font-semibold text-red-400">Returns</td>
                  <td className="px-6 py-3 text-right text-sm font-bold font-mono text-red-400">({fmt(totalReturns)})</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Other Income */}
        <div className="bg-[#171c23] rounded-3xl border border-[#2b313a] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#2b313a] flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest">Other Income</h3>
            <span className="text-sm font-bold font-mono text-sky-400">{fmt(totalOtherInc)}</span>
          </div>
          {loading ? (
            <p className="px-6 py-6 text-center text-gray-500 text-sm">Loading…</p>
          ) : otherInc.length === 0 ? (
            <p className="px-6 py-6 text-center text-gray-500 text-sm">No other income for this date.</p>
          ) : (
            <table className="w-full">
              <tbody>
                {otherInc.map(r => (
                  <tr key={r.id} className="border-b border-[#2b313a]/60 hover:bg-[#1d222a] transition-colors">
                    <td className="px-6 py-3">
                      <p className="text-sm font-semibold text-white capitalize">{r.source_type.replace('_', ' ')}</p>
                      {r.notes && <p className="text-[11px] text-gray-500 truncate max-w-[180px]">{r.notes}</p>}
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-bold font-mono text-sky-400">{fmt(Number(r.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Expenses by Category */}
        <div className="bg-[#171c23] rounded-3xl border border-[#2b313a] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#2b313a] flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest">Expenses by Category</h3>
            <span className="text-sm font-bold font-mono text-red-400">{fmt(totalExpenses)}</span>
          </div>
          {loading ? (
            <p className="px-6 py-6 text-center text-gray-500 text-sm">Loading…</p>
          ) : expByCat.size === 0 ? (
            <p className="px-6 py-6 text-center text-gray-500 text-sm">No expenses for this date.</p>
          ) : (
            <table className="w-full">
              <tbody>
                {Array.from(expByCat.entries()).map(([cat, total]) => (
                  <tr key={cat} className="border-b border-[#2b313a]/60 hover:bg-[#1d222a] transition-colors">
                    <td className="px-6 py-3 text-sm font-semibold text-white capitalize">{cat}</td>
                    <td className="px-6 py-3 text-right text-sm font-bold font-mono text-red-400">{fmt(total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Expense Detail */}
        <div className="bg-[#171c23] rounded-3xl border border-[#2b313a] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#2b313a]">
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest">Expense Details</h3>
          </div>
          {loading ? (
            <p className="px-6 py-6 text-center text-gray-500 text-sm">Loading…</p>
          ) : expenses.length === 0 ? (
            <p className="px-6 py-6 text-center text-gray-500 text-sm">No expenses for this date.</p>
          ) : (
            <div className="divide-y divide-[#2b313a]/60">
              {expenses.map(e => (
                <div key={e.id} className="flex items-center justify-between px-6 py-3 hover:bg-[#1d222a] transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-white capitalize">{e.category}</p>
                    {e.description && <p className="text-[11px] text-gray-500 truncate max-w-[200px]">{e.description}</p>}
                    <p className="text-[10px] text-gray-600 uppercase mt-0.5">{e.method}</p>
                  </div>
                  <span className="text-sm font-bold font-mono text-red-400">{fmt(Number(e.amount))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Net Balance Summary */}
      <div className={cn(
        'rounded-2xl border p-5 flex items-center justify-between',
        netBalance >= 0
          ? 'bg-emerald-900/10 border-emerald-700/30'
          : 'bg-red-900/10 border-red-700/30'
      )}>
        <div>
          <p className="text-sm font-bold text-white">Day End Net Balance</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Sales (incl. credit) {fmt(totalSales)} + Other {fmt(totalOtherInc)} − Returns {fmt(totalReturns)} − Expenses {fmt(totalExpenses)}
          </p>
        </div>
        <span className={cn('text-2xl font-bold font-mono', netBalance >= 0 ? 'text-emerald-400' : 'text-red-400')}>
          {netBalance >= 0 ? '+' : '-'}{fmt(netBalance)}
        </span>
      </div>

      {/* Cash Reconciliation */}
      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2b313a] flex items-center gap-2">
          <Calculator size={14} className="text-amber-400" />
          <h3 className="text-sm font-bold text-white">Cash Reconciliation</h3>
        </div>

        {/* Opening balance input */}
        <div className="px-6 py-4 border-b border-[#2b313a] flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Opening Balance (Petty Cash)</p>
            <p className="text-[10px] text-gray-600 mt-0.5">Starting cash in drawer</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-mono">LKR</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={openingInput}
              onChange={e => setOpeningInput(e.target.value)}
              onBlur={handleOpeningBlur}
              className="w-36 bg-[#1d222a] border border-[#2b313a] text-amber-400 font-mono font-bold text-sm rounded-xl px-3 py-2 text-right focus:outline-none focus:border-amber-500/40"
            />
          </div>
        </div>

        {/* Formula rows */}
        <div className="px-6 py-4 space-y-2">
          {[
            { label: 'Opening Balance',  value: openingBalance,  color: 'text-amber-400',   sign: '' },
            { label: 'Sales Cash',        value: salesCash,       color: 'text-green-400',   sign: '+' },
            { label: 'Other Income (Cash)', value: cashOtherInc,  color: 'text-sky-400',     sign: '+' },
            { label: 'Expenses (Cash)',   value: cashExpenses,    color: 'text-red-400',     sign: '−' },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{row.label}</span>
              <div className="flex items-center gap-2">
                {row.sign && <span className="text-xs text-gray-600 font-mono w-3 text-center">{row.sign}</span>}
                <span className={cn('text-xs font-bold font-mono', row.color)}>{fmt(row.value)}</span>
              </div>
            </div>
          ))}

          <div className="border-t border-[#2b313a] pt-3 mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">Final Cash</span>
              <span className={cn('text-sm font-bold font-mono', finalCash >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {fmt(finalCash)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-gray-400">Result vs Opening</span>
                <span className="text-[10px] text-gray-600 ml-2">(Final Cash − Opening)</span>
              </div>
              <span className={cn('text-xs font-bold font-mono', resultVsOpening === 0 ? 'text-gray-400' : resultVsOpening > 0 ? 'text-emerald-400' : 'text-red-400')}>
                {resultVsOpening > 0 ? '+' : ''}{fmt(resultVsOpening)}
                {resultVsOpening < 0 ? ' (shortage)' : resultVsOpening > 0 ? ' (surplus)' : ' (balanced)'}
              </span>
            </div>
          </div>

          {/* Formula string */}
          <div className="mt-3 p-3 bg-[#1d222a] border border-[#2b313a] rounded-xl">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Formula Check</p>
            <p className="text-[10px] text-gray-500 font-mono">
              Final Cash = Opening + Sales Cash + Other Income − Expenses
            </p>
            <p className="text-[10px] text-gray-400 font-mono mt-0.5">
              {fmt(openingBalance)} + {fmt(salesCash)} + {fmt(cashOtherInc)} − {fmt(cashExpenses)} = <span className={cn('font-bold', finalCash >= 0 ? 'text-emerald-400' : 'text-red-400')}>{fmt(finalCash)}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
