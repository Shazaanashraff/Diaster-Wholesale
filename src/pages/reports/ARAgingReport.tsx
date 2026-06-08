import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { fmtCurrency, fmtDate } from '../../utils/reportUtils';
import { ReportTable } from './shared/ReportTable';
import { ExportBar } from './shared/ExportBar';
import { ReportKPICard } from './shared/ReportKPICard';
import { CreditCard, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AgingRow {
  customerName: string; invoiceCount: number;
  bucket0_30: number; bucket31_60: number; bucket61_90: number; bucket90plus: number; total: number;
}

const bucketColor = (val: number, bucket: string) => {
  if (val === 0) return 'text-gray-600';
  if (bucket === '90plus') return 'text-red-400 font-bold';
  if (bucket === '61_90')  return 'text-orange-400';
  if (bucket === '31_60')  return 'text-amber-400';
  return 'text-yellow-300';
};

export const ARAgingReport: React.FC = () => {
  const [rows, setRows] = useState<AgingRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('invoices')
        .select('total, created_at, customer_id, customers(name), payments(amount)')
        .in('payment_status', ['unpaid', 'partial']);

      const map: Record<string, AgingRow> = {};
      const now = Date.now();

      for (const inv of (data ?? []) as any[]) {
        const cid = inv.customer_id ?? 'unknown';
        const name = inv.customers?.name ?? 'Walk-in';
        const paid = (inv.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
        const outstanding = Math.max(0, Number(inv.total) - paid);
        if (outstanding <= 0) continue;

        const ageDays = Math.floor((now - new Date(inv.created_at).getTime()) / 86_400_000);

        if (!map[cid]) map[cid] = { customerName: name, invoiceCount: 0, bucket0_30: 0, bucket31_60: 0, bucket61_90: 0, bucket90plus: 0, total: 0 };
        map[cid].invoiceCount++;
        map[cid].total += outstanding;
        if      (ageDays <= 30) map[cid].bucket0_30   += outstanding;
        else if (ageDays <= 60) map[cid].bucket31_60  += outstanding;
        else if (ageDays <= 90) map[cid].bucket61_90  += outstanding;
        else                    map[cid].bucket90plus += outstanding;
      }
      setRows(Object.values(map).sort((a, b) => b.total - a.total));
      setLoading(false);
    }
    load();
  }, []);

  const totalOutstanding = rows.reduce((s, r) => s + r.total, 0);
  const overdue90        = rows.reduce((s, r) => s + r.bucket90plus, 0);

  const exportHeaders = ['Customer', 'Invoices', '0-30 days', '31-60 days', '61-90 days', '90+ days', 'Total'];
  const exportRows = rows.map(r => [r.customerName, r.invoiceCount, fmtCurrency(r.bucket0_30), fmtCurrency(r.bucket31_60), fmtCurrency(r.bucket61_90), fmtCurrency(r.bucket90plus), fmtCurrency(r.total)]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">AR Aging</h2>
        <ExportBar filename="AR_Aging" headers={exportHeaders} rows={exportRows} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ReportKPICard label="Total Receivable" value={totalOutstanding} prefix="LKR " icon={CreditCard} color="bg-red-600" />
        <ReportKPICard label="Overdue 90+ Days" value={overdue90} prefix="LKR " icon={Clock} color="bg-rose-700" />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
        <span className="text-yellow-300">■ 0–30 days</span>
        <span className="text-amber-400">■ 31–60 days</span>
        <span className="text-orange-400">■ 61–90 days</span>
        <span className="text-red-400">■ 90+ days (critical)</span>
      </div>

      <ReportTable
        columns={[
          { header: 'Customer',    accessor: (r: AgingRow) => <span className="font-semibold text-white">{r.customerName}</span> },
          { header: 'Invoices',    accessor: (r: AgingRow) => r.invoiceCount, className: 'text-center' },
          { header: '0–30 days',   accessor: (r: AgingRow) => <span className={cn('font-mono', bucketColor(r.bucket0_30, '0_30'))}>{r.bucket0_30 > 0 ? fmtCurrency(r.bucket0_30) : '—'}</span>, className: 'text-right' },
          { header: '31–60 days',  accessor: (r: AgingRow) => <span className={cn('font-mono', bucketColor(r.bucket31_60, '31_60'))}>{r.bucket31_60 > 0 ? fmtCurrency(r.bucket31_60) : '—'}</span>, className: 'text-right' },
          { header: '61–90 days',  accessor: (r: AgingRow) => <span className={cn('font-mono', bucketColor(r.bucket61_90, '61_90'))}>{r.bucket61_90 > 0 ? fmtCurrency(r.bucket61_90) : '—'}</span>, className: 'text-right' },
          { header: '90+ days',    accessor: (r: AgingRow) => <span className={cn('font-mono', bucketColor(r.bucket90plus, '90plus'))}>{r.bucket90plus > 0 ? fmtCurrency(r.bucket90plus) : '—'}</span>, className: 'text-right' },
          { header: 'Total',       accessor: (r: AgingRow) => <span className="font-bold font-mono text-white">{fmtCurrency(r.total)}</span>, className: 'text-right' },
        ]}
        data={rows}
        emptyMessage="No outstanding receivables found."
      />
    </div>
  );
};
