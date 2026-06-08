import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { type ReportPeriod, getReportDateRange, fmtCurrency, fmtDate } from '../../utils/reportUtils';
import { DateRangePicker } from './shared/DateRangePicker';
import { ExportBar } from './shared/ExportBar';
import { cn } from '../../lib/utils';
import { Search } from 'lucide-react';

interface InvRow {
  id: string; invoice_no: string; mode: string | null; payment_status: string;
  subtotal: number; discount: number; total: number; created_at: string;
  customers: { name: string } | null;
  salesperson: { name: string } | null;
  salesperson_name: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  paid:      'bg-green-900/20 text-green-400',
  partial:   'bg-amber-900/20 text-amber-400',
  unpaid:    'bg-red-900/20 text-red-400',
  cancelled: 'bg-gray-900/20 text-gray-500',
};

export const InvoiceReport: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<InvRow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { from, to } = getReportDateRange(period, customFrom, customTo);
      let q = supabase
        .from('invoices')
        .select('id, invoice_no, mode, payment_status, subtotal, discount, total, created_at, customers(name), salesperson:salespeople(name), salesperson_name')
        .order('created_at', { ascending: false });
      if (from) q = q.gte('created_at', from);
      if (to)   q = q.lte('created_at', to);
      const { data: rows } = await q;
      setData((rows ?? []) as unknown as InvRow[]);
      setLoading(false);
    }
    load();
  }, [period, customFrom, customTo]);

  const filtered = data.filter(r => {
    const matchSearch = !search ||
      r.invoice_no.toLowerCase().includes(search.toLowerCase()) ||
      (r.customers?.name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.payment_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const exportHeaders = ['Date', 'Invoice', 'Customer', 'Sold By', 'Mode', 'Status', 'Subtotal', 'Discount', 'Total'];
  const exportRows = filtered.map(r => [
    fmtDate(r.created_at), r.invoice_no, r.customers?.name ?? '—',
    r.salesperson?.name ?? r.salesperson_name ?? '—',
    r.mode ?? '—', r.payment_status, fmtCurrency(r.subtotal), fmtCurrency(r.discount), fmtCurrency(r.total),
  ]);

  const grandTotal = filtered.reduce((s, r) => s + Number(r.total), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Invoice Report</h2>
        <div className="flex items-center gap-3">
          <DateRangePicker value={period} onChange={setPeriod} customFrom={customFrom} customTo={customTo} onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }} />
          <ExportBar filename="Invoice_Report" headers={exportHeaders} rows={exportRows} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search invoice or customer…"
            className="w-full pl-8 pr-3 py-2 bg-[#1d222a] border border-[#2b313a] rounded-xl text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-[#3b414a]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-[#1d222a] border border-[#2b313a] rounded-xl text-xs text-gray-300 px-3 py-2 focus:outline-none"
        >
          <option value="all">All Status</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="unpaid">Unpaid</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <span className="text-xs text-gray-500 ml-auto">
          {filtered.length} invoice{filtered.length !== 1 ? 's' : ''} · Total {fmtCurrency(grandTotal)}
        </span>
      </div>

      <div className="bg-[#171c23] rounded-2xl border border-[#2b313a] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2b313a] bg-[#1d222a]">
                {['Date', 'Invoice', 'Customer', 'Sold By', 'Mode', 'Status', 'Subtotal', 'Discount', 'Total'].map(h => (
                  <th key={h} className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2b313a]">
              {loading ? (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-gray-500 text-sm">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-gray-500 text-sm">No invoices found.</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className={cn('hover:bg-[#1d222a] transition-colors', r.payment_status === 'cancelled' && 'opacity-50')}>
                  <td className="px-5 py-3 text-xs text-gray-500">{fmtDate(r.created_at)}</td>
                  <td className="px-5 py-3 text-sm font-bold font-mono text-white">{r.invoice_no}</td>
                  <td className="px-5 py-3 text-sm text-gray-300">{r.customers?.name ?? '—'}</td>
                  <td className="px-5 py-3 text-xs text-gray-400">{r.salesperson?.name ?? r.salesperson_name ?? '—'}</td>
                  <td className="px-5 py-3 text-xs text-gray-400 capitalize">{r.mode ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', STATUS_COLORS[r.payment_status] ?? 'bg-gray-900/20 text-gray-400')}>
                      {r.payment_status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs font-mono text-gray-400 text-right">{fmtCurrency(Number(r.subtotal))}</td>
                  <td className="px-5 py-3 text-xs font-mono text-red-400 text-right">{Number(r.discount) > 0 ? `− ${fmtCurrency(Number(r.discount))}` : '—'}</td>
                  <td className="px-5 py-3 text-sm font-bold font-mono text-white text-right">{fmtCurrency(Number(r.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
