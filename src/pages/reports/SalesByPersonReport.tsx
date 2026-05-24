import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { type ReportPeriod, getReportDateRange, fmtCurrency, fmtDate } from '../../utils/reportUtils';
import { DateRangePicker } from './shared/DateRangePicker';
import { ExportBar } from './shared/ExportBar';
import { ReportKPICard } from './shared/ReportKPICard';
import { cn } from '../../lib/utils';
import { UserCheck, RefreshCw, TrendingUp } from 'lucide-react';

interface InvoiceRow {
  id: string;
  invoice_no: string;
  total: number;
  payment_status: string;
  created_at: string;
  salesperson_id: string | null;
  salesperson_name: string | null;
  salesperson: { id: string; name: string } | null;
  customers: { name: string } | null;
}

interface PersonSummary {
  id: string;
  name: string;
  invoiceCount: number;
  revenue: number;
  paid: number;
  partial: number;
  unpaid: number;
  invoices: InvoiceRow[];
}

export const SalesByPersonReport: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { from, to } = getReportDateRange(period, customFrom, customTo);
    let q = supabase
      .from('invoices')
      .select('id, invoice_no, total, payment_status, created_at, salesperson_id, salesperson_name, salesperson:salespeople(id, name), customers(name)');
    if (from) q = q.gte('created_at', from);
    if (to)   q = q.lte('created_at', to);
    q = q.order('created_at', { ascending: false });

    const { data } = await q;
    setInvoices((data ?? []) as unknown as InvoiceRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [period, customFrom, customTo]);

  // Group by salesperson relation (legacy name fallback for older invoices)
  const personMap = new Map<string, PersonSummary>();
  for (const inv of invoices) {
    const key = inv.salesperson?.id ?? inv.salesperson_id ?? inv.salesperson_name ?? 'Unassigned';
    const name = inv.salesperson?.name ?? inv.salesperson_name ?? 'Unassigned';
    if (!personMap.has(key)) {
      personMap.set(key, { id: key, name, invoiceCount: 0, revenue: 0, paid: 0, partial: 0, unpaid: 0, invoices: [] });
    }
    const g = personMap.get(key)!;
    g.invoiceCount++;
    g.revenue += Number(inv.total);
    if (inv.payment_status === 'paid')    g.paid++;
    else if (inv.payment_status === 'partial') g.partial++;
    else                                  g.unpaid++;
    g.invoices.push(inv);
  }

  const groups = Array.from(personMap.values()).sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = groups.reduce((s, g) => s + g.revenue, 0);
  const assignedRevenue = groups.filter(g => g.id !== 'Unassigned').reduce((s, g) => s + g.revenue, 0);

  const exportHeaders = ['Salesperson', 'Invoices', 'Revenue', 'Paid', 'Partial', 'Unpaid'];
  const exportRows = groups.map(g => [
    g.name, String(g.invoiceCount), fmtCurrency(g.revenue),
    String(g.paid), String(g.partial), String(g.unpaid),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Sales by Salesperson</h2>
        <div className="flex items-center gap-3">
          <button onClick={load} disabled={loading} className="flex items-center gap-2 bg-[#1d222a] border border-[#2b313a] text-xs text-gray-400 rounded-xl px-3 py-2.5 hover:text-white transition-colors">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
          <DateRangePicker value={period} onChange={setPeriod} customFrom={customFrom} customTo={customTo} onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }} />
          <ExportBar filename="Sales_By_Salesperson" headers={exportHeaders} rows={exportRows} />
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <ReportKPICard label="Total Revenue" value={totalRevenue} prefix="LKR " icon={TrendingUp} color="bg-green-600" />
        <ReportKPICard label="Assigned Revenue" value={assignedRevenue} prefix="LKR " icon={UserCheck} color="bg-blue-600" />
        <ReportKPICard label="Salespeople" value={groups.filter(g => g.id !== 'Unassigned').length} prefix="" icon={UserCheck} color="bg-purple-600" />
      </div>

      {/* Summary table */}
      <div className="bg-[#171c23] rounded-3xl border border-[#2b313a] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2b313a]">
          <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest">Performance by Salesperson</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2b313a]">
              {['Salesperson', 'Invoices', 'Paid', 'Partial', 'Unpaid', 'Revenue'].map(h => (
                <th key={h} className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest px-5 py-3 last:text-right">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500 text-sm">Loading...</td></tr>
            ) : groups.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500 text-sm">No invoices for this period.</td></tr>
            ) : groups.map(g => (
              <React.Fragment key={g.name}>
                <tr
                  className="border-b border-[#2b313a]/60 hover:bg-[#1d222a] transition-colors cursor-pointer"
                  onClick={() => setExpanded(expanded === g.id ? null : g.id)}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <UserCheck size={14} className={g.id === 'Unassigned' ? 'text-gray-600' : 'text-emerald-400'} />
                      <span className={cn('text-sm font-semibold', g.id === 'Unassigned' ? 'text-gray-500 italic' : 'text-white')}>{g.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-400 font-mono">{g.invoiceCount}</td>
                  <td className="px-5 py-3 text-sm text-green-400 font-mono">{g.paid}</td>
                  <td className="px-5 py-3 text-sm text-amber-400 font-mono">{g.partial}</td>
                  <td className="px-5 py-3 text-sm text-red-400 font-mono">{g.unpaid}</td>
                  <td className="px-5 py-3 text-sm font-bold font-mono text-right text-white">{fmtCurrency(g.revenue)}</td>
                </tr>
                {expanded === g.id && (
                  <tr className="bg-[#0d1016]">
                    <td colSpan={6} className="px-6 py-4">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[#2b313a]">
                            {['Date', 'Invoice', 'Customer', 'Status', 'Amount'].map(h => (
                              <th key={h} className="text-left text-[9px] font-bold text-gray-600 uppercase tracking-widest px-3 py-2 last:text-right">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {g.invoices.map(inv => (
                            <tr key={inv.id} className="border-b border-[#2b313a]/30">
                              <td className="px-3 py-2 text-xs text-gray-600">{fmtDate(inv.created_at)}</td>
                              <td className="px-3 py-2 text-xs font-bold text-gray-300 font-mono">{inv.invoice_no}</td>
                              <td className="px-3 py-2 text-xs text-gray-400">{inv.customers?.name ?? '—'}</td>
                              <td className="px-3 py-2">
                                <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-bold uppercase',
                                  inv.payment_status === 'paid'    ? 'bg-green-900/20 text-green-400' :
                                  inv.payment_status === 'partial' ? 'bg-amber-900/20 text-amber-400' :
                                                                     'bg-red-900/20 text-red-400'
                                )}>{inv.payment_status}</span>
                              </td>
                              <td className="px-3 py-2 text-xs font-bold font-mono text-right text-white">{fmtCurrency(Number(inv.total))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
