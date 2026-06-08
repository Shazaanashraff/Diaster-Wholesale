import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { type ReportPeriod, getReportDateRange, fmtCurrency } from '../../utils/reportUtils';
import { ReportTable } from './shared/ReportTable';
import { DateRangePicker } from './shared/DateRangePicker';
import { ExportBar } from './shared/ExportBar';
import { ReportKPICard } from './shared/ReportKPICard';
import { ShoppingBag, Users } from 'lucide-react';

interface ModeRow { mode: string; count: number; subtotal: number; discount: number; total: number; avgInvoice: number }

export const WholesaleRetailReport: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [rows, setRows] = useState<ModeRow[]>([]);

  useEffect(() => {
    async function load() {
      const { from, to } = getReportDateRange(period, customFrom, customTo);
      let q = supabase
        .from('invoices')
        .select('mode, subtotal, discount, total')
        .neq('payment_status', 'cancelled');
      if (from) q = q.gte('created_at', from);
      if (to)   q = q.lte('created_at', to);
      const { data } = await q;

      const map: Record<string, ModeRow> = {};
      for (const inv of data ?? []) {
        const key = inv.mode ?? 'retail';
        if (!map[key]) map[key] = { mode: key, count: 0, subtotal: 0, discount: 0, total: 0, avgInvoice: 0 };
        map[key].count++;
        map[key].subtotal  += Number(inv.subtotal);
        map[key].discount  += Number(inv.discount);
        map[key].total     += Number(inv.total);
      }
      const result = Object.values(map).map(r => ({ ...r, avgInvoice: r.count > 0 ? r.total / r.count : 0 }));
      result.sort((a, b) => b.total - a.total);
      setRows(result);
    }
    load();
  }, [period, customFrom, customTo]);

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const grandCount = rows.reduce((s, r) => s + r.count, 0);

  const exportHeaders = ['Mode', 'Invoices', 'Subtotal', 'Discount', 'Total', 'Avg Invoice'];
  const exportRows = rows.map(r => [r.mode, r.count, fmtCurrency(r.subtotal), fmtCurrency(r.discount), fmtCurrency(r.total), fmtCurrency(r.avgInvoice)]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Wholesale vs Retail</h2>
        <div className="flex items-center gap-3">
          <DateRangePicker value={period} onChange={setPeriod} customFrom={customFrom} customTo={customTo} onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }} />
          <ExportBar filename="Wholesale_Retail" headers={exportHeaders} rows={exportRows} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ReportKPICard label="Total Revenue" value={grandTotal} prefix="LKR " icon={ShoppingBag} color="bg-blue-600" />
        <ReportKPICard label="Total Invoices" value={grandCount} icon={Users} color="bg-purple-600" />
      </div>

      <ReportTable
        columns={[
          { header: 'Mode',        accessor: (r: ModeRow) => <span className="capitalize font-bold text-white">{r.mode}</span> },
          { header: 'Invoices',    accessor: (r: ModeRow) => r.count, className: 'text-center' },
          { header: 'Subtotal',    accessor: (r: ModeRow) => fmtCurrency(r.subtotal), className: 'text-right font-mono' },
          { header: 'Discount',    accessor: (r: ModeRow) => fmtCurrency(r.discount), className: 'text-right font-mono text-red-400' },
          { header: 'Net Total',   accessor: (r: ModeRow) => fmtCurrency(r.total), className: 'text-right font-mono text-white font-bold' },
          { header: 'Avg Invoice', accessor: (r: ModeRow) => fmtCurrency(r.avgInvoice), className: 'text-right font-mono text-gray-400' },
        ]}
        data={rows}
        emptyMessage="No invoices found for this period."
      />
    </div>
  );
};
