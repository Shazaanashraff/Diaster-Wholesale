import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { Wallet, CreditCard, Smartphone, RotateCcw, TrendingDown, RefreshCw, AlertCircle, ChevronRight, Building2 } from 'lucide-react';

const fmt = (n: number) =>
  'LKR ' + Math.abs(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', hour12: true });

function dayRange(date: string) {
  const start = `${date}T00:00:00`;
  const end   = `${date}T23:59:59`;
  return { start, end };
}

interface MethodTotal { method: string; total: number; count: number }
interface BankTotal   { bank_name: string; total: number; count: number }
interface PartialInv  { id: string; invoice_no: string; customer_name: string; total: number; created_at: string }
interface ExpenseRow  { id: string; category: string; description: string; amount: number; method: string; created_at: string }
interface ReturnRow   { id: string; reference: string; amount: number; paid_at: string }

interface CashierData {
  byMethod:  MethodTotal[];
  byBank:    BankTotal[];
  partials:  PartialInv[];
  expenses:  ExpenseRow[];
  returns:   ReturnRow[];
}

const METHOD_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  cash:          { label: 'Cash',          icon: Wallet,      color: 'text-green-400'  },
  card:          { label: 'Card',          icon: CreditCard,  color: 'text-blue-400'   },
  online:        { label: 'Online',        icon: Smartphone,  color: 'text-purple-400' },
  bank_transfer: { label: 'Bank Transfer', icon: Building2,   color: 'text-sky-400'    },
  cheque:        { label: 'Cheque',        icon: CreditCard,  color: 'text-amber-400'  },
};

export const CashierPage: React.FC = () => {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate]     = useState(today);
  const [data, setData]     = useState<CashierData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { start, end } = dayRange(date);

      const [paymentsRes, partialsRes, expensesRes] = await Promise.all([
        supabase
          .from('payments')
          .select('id, amount, method, bank_name, reference, paid_at')
          .gte('paid_at', start)
          .lte('paid_at', end),
        supabase
          .from('invoices')
          .select('id, invoice_no, total, created_at, customers(name)')
          .eq('payment_status', 'partial')
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at', { ascending: false }),
        supabase
          .from('expenses')
          .select('id, category, description, amount, method, created_at')
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at', { ascending: false }),
      ]);

      if (paymentsRes.error) throw new Error(paymentsRes.error.message);
      if (partialsRes.error) throw new Error(partialsRes.error.message);
      if (expensesRes.error) throw new Error(expensesRes.error.message);

      const allPayments = paymentsRes.data ?? [];

      // Separate returns (negative amount or RETURN- reference) from sales
      const salesPayments  = allPayments.filter(p => Number(p.amount) > 0 && !p.reference?.startsWith('RETURN-'));
      const returnPayments = allPayments.filter(p => Number(p.amount) < 0 || p.reference?.startsWith('RETURN-'));

      // Aggregate sales by method
      const methodMap = new Map<string, MethodTotal>();
      for (const p of salesPayments) {
        const m = p.method ?? 'other';
        const ex = methodMap.get(m) ?? { method: m, total: 0, count: 0 };
        ex.total += Number(p.amount);
        ex.count += 1;
        methodMap.set(m, ex);
      }

      // Aggregate online by bank_name
      const bankMap = new Map<string, BankTotal>();
      for (const p of salesPayments.filter(p => p.method === 'online')) {
        const b = p.bank_name || 'Unknown Bank';
        const ex = bankMap.get(b) ?? { bank_name: b, total: 0, count: 0 };
        ex.total += Number(p.amount);
        ex.count += 1;
        bankMap.set(b, ex);
      }

      const partials: PartialInv[] = (partialsRes.data ?? []).map((inv: any) => ({
        id: inv.id,
        invoice_no: inv.invoice_no,
        customer_name: inv.customers?.name ?? 'Unknown',
        total: Number(inv.total),
        created_at: inv.created_at,
      }));

      const returns: ReturnRow[] = returnPayments.map(p => ({
        id: p.id,
        reference: p.reference ?? '—',
        amount: Math.abs(Number(p.amount)),
        paid_at: p.paid_at,
      }));

      setData({
        byMethod: Array.from(methodMap.values()).sort((a, b) => b.total - a.total),
        byBank:   Array.from(bankMap.values()).sort((a, b) => b.total - a.total),
        partials,
        expenses: expensesRes.data as ExpenseRow[],
        returns,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const salesTotal    = data?.byMethod.reduce((s, m) => s + m.total, 0) ?? 0;
  const returnsTotal  = data?.returns.reduce((s, r) => s + r.amount, 0) ?? 0;
  const expensesTotal = data?.expenses.reduce((s, e) => s + e.amount, 0) ?? 0;
  const netCash       = salesTotal - returnsTotal - expensesTotal;

  return (
    <div className="p-8 space-y-8 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Cashier Summary</h1>
          <p className="text-sm text-gray-400 mt-0.5">Daily cash drawer overview</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            max={today}
            onChange={e => setDate(e.target.value)}
            className="bg-accent border border-border text-sm text-white rounded-xl px-4 py-2.5 outline-none focus:border-primary/40 font-mono"
          />
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 bg-accent border border-border text-sm text-gray-300 rounded-xl px-4 py-2.5 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-900/20 border border-red-700/30 rounded-2xl px-5 py-4 text-red-400 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* KPI Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total Sales" value={salesTotal} color="text-green-400" icon={TrendingDown} positive />
        <KPICard label="Returns" value={returnsTotal} color="text-red-400" icon={RotateCcw} />
        <KPICard label="Expenses" value={expensesTotal} color="text-amber-400" icon={TrendingDown} />
        <KPICard
          label="Net Cash"
          value={netCash}
          color={netCash >= 0 ? 'text-emerald-400' : 'text-red-400'}
          icon={Wallet}
          positive={netCash >= 0}
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
          <RefreshCw size={16} className="animate-spin mr-2" /> Loading...
        </div>
      )}

      {!loading && data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Sales by Method */}
          <section className="bg-accent rounded-3xl border border-border p-6 space-y-4">
            <h2 className="text-sm font-bold text-gray-300 uppercase tracking-widest">Sales by Payment Method</h2>
            {data.byMethod.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">No sales recorded for this date.</p>
            ) : (
              <div className="space-y-2">
                {data.byMethod.map(m => {
                  const meta = METHOD_META[m.method] ?? { label: m.method, icon: Wallet, color: 'text-gray-400' };
                  const Icon = meta.icon;
                  return (
                    <div key={m.method} className="flex items-center justify-between bg-[#12161d] rounded-2xl px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Icon size={16} className={meta.color} />
                        <span className="text-sm font-semibold text-white">{meta.label}</span>
                        <span className="text-[11px] text-gray-500 font-mono">{m.count} txn{m.count !== 1 ? 's' : ''}</span>
                      </div>
                      <span className={cn('text-sm font-bold font-mono', meta.color)}>{fmt(m.total)}</span>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between px-5 py-3 border-t border-border mt-2">
                  <span className="text-sm font-bold text-white">Total</span>
                  <span className="text-sm font-bold font-mono text-white">{fmt(salesTotal)}</span>
                </div>
              </div>
            )}
          </section>

          {/* Online — Bank Breakdown */}
          <section className="bg-accent rounded-3xl border border-border p-6 space-y-4">
            <h2 className="text-sm font-bold text-gray-300 uppercase tracking-widest">Online — Bank Breakdown</h2>
            {data.byBank.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">No online payments for this date.</p>
            ) : (
              <div className="space-y-2">
                {data.byBank.map(b => (
                  <div key={b.bank_name} className="flex items-center justify-between bg-[#12161d] rounded-2xl px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Building2 size={15} className="text-purple-400" />
                      <span className="text-sm font-semibold text-white">{b.bank_name}</span>
                      <span className="text-[11px] text-gray-500 font-mono">{b.count} txn{b.count !== 1 ? 's' : ''}</span>
                    </div>
                    <span className="text-sm font-bold font-mono text-purple-400">{fmt(b.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Returns */}
          <section className="bg-accent rounded-3xl border border-border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-300 uppercase tracking-widest">Returns</h2>
              {returnsTotal > 0 && (
                <span className="text-xs font-bold font-mono text-red-400">{fmt(returnsTotal)}</span>
              )}
            </div>
            {data.returns.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">No returns for this date.</p>
            ) : (
              <div className="space-y-2">
                {data.returns.map(r => (
                  <div key={r.id} className="flex items-center justify-between bg-[#12161d] rounded-2xl px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <RotateCcw size={14} className="text-red-400" />
                      <span className="text-sm font-semibold text-white font-mono">{r.reference}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[11px] text-gray-500">{fmtTime(r.paid_at)}</span>
                      <span className="text-sm font-bold font-mono text-red-400">{fmt(r.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Partial Payments */}
          <section className="bg-accent rounded-3xl border border-border p-6 space-y-4">
            <h2 className="text-sm font-bold text-gray-300 uppercase tracking-widest">
              Partial Payments
              {data.partials.length > 0 && (
                <span className="ml-2 bg-amber-900/30 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {data.partials.length}
                </span>
              )}
            </h2>
            {data.partials.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">No partial invoices for this date.</p>
            ) : (
              <div className="space-y-2">
                {data.partials.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between bg-[#12161d] rounded-2xl px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <ChevronRight size={14} className="text-amber-400" />
                      <div>
                        <p className="text-sm font-semibold text-white font-mono">{inv.invoice_no}</p>
                        <p className="text-[11px] text-gray-500">{inv.customer_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[11px] text-gray-500">{fmtTime(inv.created_at)}</span>
                      <span className="text-sm font-bold font-mono text-amber-400">{fmt(inv.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Expenses */}
          <section className="bg-accent rounded-3xl border border-border p-6 space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-300 uppercase tracking-widest">Expenses</h2>
              {expensesTotal > 0 && (
                <span className="text-xs font-bold font-mono text-amber-400">{fmt(expensesTotal)}</span>
              )}
            </div>
            {data.expenses.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">No expenses recorded for this date.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {data.expenses.map(e => (
                  <div key={e.id} className="flex items-center justify-between bg-[#12161d] rounded-2xl px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <TrendingDown size={14} className="text-amber-400" />
                      <div>
                        <p className="text-sm font-semibold text-white capitalize">{e.category}</p>
                        {e.description && <p className="text-[11px] text-gray-500 truncate max-w-[160px]">{e.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[11px] text-gray-500 uppercase">{e.method}</span>
                      <span className="text-sm font-bold font-mono text-amber-400">{fmt(e.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      )}
    </div>
  );
};

const KPICard: React.FC<{
  label: string;
  value: number;
  color: string;
  icon: React.ElementType;
  positive?: boolean;
}> = ({ label, value, color, icon: Icon, positive }) => (
  <div className="bg-accent rounded-3xl border border-border p-5 space-y-3">
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
      <Icon size={14} className={color} />
    </div>
    <p className={cn('text-xl font-bold font-mono tracking-tight', color)}>
      {positive ? '' : ''}{fmt(value)}
    </p>
  </div>
);
