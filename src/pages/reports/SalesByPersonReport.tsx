import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { type ReportPeriod, getReportDateRange, fmtCurrency, fmtDate } from '../../utils/reportUtils';
import { DateRangePicker } from './shared/DateRangePicker';
import { ExportBar } from './shared/ExportBar';
import { ReportKPICard } from './shared/ReportKPICard';
import { cn } from '../../lib/utils';
import { UserCheck, RefreshCw, TrendingUp } from 'lucide-react';

interface ItemRow {
  unit_price: number;
  total: number;
  cartons: number;
  pieces: number;
  products: { pieces_per_carton: number; cost_price: number } | null;
  invoices: {
    id: string;
    invoice_no: string;
    total: number;
    payment_status: string;
    mode: string;
    created_at: string;
    salesperson_id: string | null;
    salesperson_name: string | null;
    salesperson: { id: string; name: string } | null;
    customers: { name: string } | null;
  } | null;
}

interface InvoiceSummary {
  id: string;
  invoice_no: string;
  total: number;
  profit: number;
  payment_status: string;
  mode: string;
  created_at: string;
  customer_name: string;
}

interface PersonSummary {
  id: string;
  name: string;
  invoiceCount: number;
  revenue: number;
  profit: number;
  paid: number;
  partial: number;
  unpaid: number;
  invoices: InvoiceSummary[];
}

export const SalesByPersonReport: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<PersonSummary[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { from, to } = getReportDateRange(period, customFrom, customTo);

    let q = supabase
      .from('invoice_items')
      .select('unit_price, total, cartons, pieces, products(pieces_per_carton, cost_price), invoices(id, invoice_no, total, payment_status, mode, created_at, salesperson_id, salesperson_name, salesperson:salespeople(id, name), customers(name))');
    if (from) q = q.gte('created_at', from);
    if (to)   q = q.lte('created_at', to);

    const { data } = await q;
    const items = (data ?? []) as unknown as ItemRow[];

    // Aggregate per invoice then per salesperson
    const invoiceMap = new Map<string, { summary: InvoiceSummary; personKey: string; personName: string }>();

    for (const item of items) {
      const inv = item.invoices;
      if (!inv) continue;

      const prod = item.products;
      const ppc = prod?.pieces_per_carton || 1;
      const units = item.cartons * ppc + item.pieces;
      const unitCost = prod?.cost_price || 0;
      const itemProfit = Number(item.total) - unitCost * units;

      const personKey = inv.salesperson?.id ?? inv.salesperson_id ?? inv.salesperson_name ?? 'Unassigned';
      const personName = inv.salesperson?.name ?? inv.salesperson_name ?? 'Unassigned';

      if (!invoiceMap.has(inv.id)) {
        invoiceMap.set(inv.id, {
          summary: {
            id: inv.id,
            invoice_no: inv.invoice_no,
            total: Number(inv.total),
            profit: 0,
            payment_status: inv.payment_status,
            mode: inv.mode,
            created_at: inv.created_at,
            customer_name: inv.customers?.name ?? '—',
          },
          personKey,
          personName,
        });
      }
      invoiceMap.get(inv.id)!.summary.profit += itemProfit;
    }

    const personMap = new Map<string, PersonSummary>();
    for (const { summary, personKey, personName } of invoiceMap.values()) {
      if (!personMap.has(personKey)) {
        personMap.set(personKey, { id: personKey, name: personName, invoiceCount: 0, revenue: 0, profit: 0, paid: 0, partial: 0, unpaid: 0, invoices: [] });
      }
      const g = personMap.get(personKey)!;
      g.invoiceCount++;
      g.revenue += summary.total;
      g.profit  += summary.profit;
      if (summary.payment_status === 'paid')         g.paid++;
      else if (summary.payment_status === 'partial') g.partial++;
      else                                           g.unpaid++;
      g.invoices.push(summary);
    }

    const sorted = Array.from(personMap.values()).sort((a, b) => b.revenue - a.revenue);
    sorted.forEach(g => g.invoices.sort((a, b) => b.created_at.localeCompare(a.created_at)));
    setGroups(sorted);
    setLoading(false);
  }

  useEffect(() => { load(); }, [period, customFrom, customTo]);

  const totalRevenue    = groups.reduce((s, g) => s + g.revenue, 0);
  const totalProfit     = groups.reduce((s, g) => s + g.profit,  0);
  const assignedRevenue = groups.filter(g => g.id !== 'Unassigned').reduce((s, g) => s + g.revenue, 0);

  const exportHeaders = ['Salesperson', 'Invoices', 'Revenue', 'Profit', 'Paid', 'Partial', 'Unpaid'];
  const exportRows = groups.map(g => [
    g.name, String(g.invoiceCount), fmtCurrency(g.revenue), fmtCurrency(g.profit),
    String(g.paid), String(g.partial), String(g.unpaid),
  ]);

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportKPICard label="Total Revenue"    value={totalRevenue}    prefix="LKR " icon={TrendingUp} color="bg-green-600"   />
        <ReportKPICard label="Total Profit"     value={totalProfit}     prefix="LKR " icon={TrendingUp} color="bg-emerald-600" />
        <ReportKPICard label="Assigned Revenue" value={assignedRevenue} prefix="LKR " icon={UserCheck}  color="bg-blue-600"    />
        <ReportKPICard label="Salespeople"      value={groups.filter(g => g.id !== 'Unassigned').length} prefix="" icon={UserCheck} color="bg-purple-600" />
      </div>

      <div className="bg-[#171c23] rounded-3xl border border-[#2b313a] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2b313a]">
          <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest">Performance by Salesperson</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2b313a]">
              {['Salesperson', 'Invoices', 'Paid', 'Partial', 'Unpaid', 'Revenue', 'Profit'].map(h => (
                <th key={h} className={cn(
                  'text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest px-5 py-3',
                  (h === 'Revenue' || h === 'Profit') && 'text-right'
                )}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-500 text-sm">Loading...</td></tr>
            ) : groups.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-500 text-sm">No invoices for this period.</td></tr>
            ) : groups.map(g => (
              <React.Fragment key={g.id}>
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
                  <td className={cn('px-5 py-3 text-sm font-bold font-mono text-right', g.profit >= 0 ? 'text-green-400' : 'text-red-400')}>
                    {fmtCurrency(g.profit)}
                  </td>
                </tr>
                {expanded === g.id && (
                  <tr className="bg-[#0d1016]">
                    <td colSpan={7} className="px-6 py-4">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[#2b313a]">
                            {['Date', 'Invoice', 'Customer', 'Mode', 'Status', 'Amount', 'Profit'].map(h => (
                              <th key={h} className={cn(
                                'text-left text-[9px] font-bold text-gray-600 uppercase tracking-widest px-3 py-2',
                                (h === 'Amount' || h === 'Profit') && 'text-right'
                              )}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {g.invoices.map(inv => (
                            <tr key={inv.id} className="border-b border-[#2b313a]/30">
                              <td className="px-3 py-2 text-xs text-gray-600">{fmtDate(inv.created_at)}</td>
                              <td className="px-3 py-2 text-xs font-bold text-gray-300 font-mono">{inv.invoice_no}</td>
                              <td className="px-3 py-2 text-xs text-gray-400">{inv.customer_name}</td>
                              <td className="px-3 py-2">
                                <span className={cn(
                                  'px-2 py-0.5 rounded-full text-[9px] font-bold uppercase',
                                  inv.mode === 'retail' ? 'bg-blue-900/20 text-blue-400' : 'bg-orange-900/20 text-orange-400'
                                )}>{inv.mode}</span>
                              </td>
                              <td className="px-3 py-2">
                                <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-bold uppercase',
                                  inv.payment_status === 'paid'    ? 'bg-green-900/20 text-green-400' :
                                  inv.payment_status === 'partial' ? 'bg-amber-900/20 text-amber-400' :
                                                                     'bg-red-900/20 text-red-400'
                                )}>{inv.payment_status}</span>
                              </td>
                              <td className="px-3 py-2 text-xs font-bold font-mono text-right text-white">{fmtCurrency(inv.total)}</td>
                              <td className={cn('px-3 py-2 text-xs font-bold font-mono text-right', inv.profit >= 0 ? 'text-green-400' : 'text-red-400')}>
                                {fmtCurrency(inv.profit)}
                              </td>
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
