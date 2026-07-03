import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { type ReportPeriod, getReportDateRange, fmtCurrency, fmtDate } from '../../utils/reportUtils';
import { ReportTable } from './shared/ReportTable';
import { DateRangePicker } from './shared/DateRangePicker';
import { ExportBar } from './shared/ExportBar';
import { RotateCcw, DollarSign } from 'lucide-react';
import { ReportKPICard } from './shared/ReportKPICard';

interface ReturnRow {
  id: string;
  created_at: string;
  invoice_no: string;
  product_name: string;
  return_cartons: number;
  return_pieces: number;
  refund_amount: number;
  reason: string;
  return_type: string;
}

export const SalesReturnReport: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<ReturnRow[]>([]);

  useEffect(() => {
    async function load() {
      const { from, to } = getReportDateRange(period, customFrom, customTo);

      let query = supabase
        .from('sales_returns')
        .select(`
          id, reason, return_type, refund_amount, created_at,
          invoices!original_invoice_id(invoice_no),
          sales_return_items(product_name, return_cartons, return_pieces)
        `)
        .order('created_at', { ascending: false });

      if (from) query = query.gte('created_at', from);
      if (to) query = query.lte('created_at', to);

      const { data: res } = await query;
      if (!res) { setData([]); return; }

      // Flatten: one row per return item
      const rows: ReturnRow[] = [];
      for (const ret of res as any[]) {
        const inv = Array.isArray(ret.invoices) ? ret.invoices[0] : ret.invoices;
        const items: any[] = ret.sales_return_items ?? [];
        if (items.length === 0) {
          rows.push({
            id: ret.id,
            created_at: ret.created_at,
            invoice_no: inv?.invoice_no ?? '—',
            product_name: '—',
            return_cartons: 0,
            return_pieces: 0,
            refund_amount: Number(ret.refund_amount ?? 0),
            reason: ret.reason ?? '',
            return_type: ret.return_type ?? '',
          });
        } else {
          for (const item of items) {
            rows.push({
              id: ret.id,
              created_at: ret.created_at,
              invoice_no: inv?.invoice_no ?? '—',
              product_name: item.product_name ?? '—',
              return_cartons: Number(item.return_cartons ?? 0),
              return_pieces: Number(item.return_pieces ?? 0),
              refund_amount: Number(ret.refund_amount ?? 0),
              reason: ret.reason ?? '',
              return_type: ret.return_type ?? '',
            });
          }
        }
      }
      setData(rows);
    }
    load();
  }, [period, customFrom, customTo]);

  // KPIs are based on unique returns (not flattened item rows)
  const uniqueReturnIds = new Set(data.map(r => r.id));
  const totalRefunded = [...uniqueReturnIds].reduce((sum, id) => {
    const first = data.find(r => r.id === id);
    return sum + (first?.refund_amount ?? 0);
  }, 0);

  const headers = ['Date', 'Invoice', 'Product', 'Qty Returned', 'Refund Amount', 'Reason', 'Type'];
  const rows = data.map(r => [
    fmtDate(r.created_at), r.invoice_no, r.product_name,
    `${r.return_cartons} Ctn, ${r.return_pieces} Pcs`,
    fmtCurrency(r.refund_amount), r.reason, r.return_type,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Sales Return Report</h2>
        <div className="flex items-center gap-3">
          <DateRangePicker value={period} onChange={setPeriod} customFrom={customFrom} customTo={customTo} onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }} />
          <ExportBar filename="Sales_Returns" headers={headers} rows={rows} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReportKPICard label="Total Returns" value={uniqueReturnIds.size} icon={RotateCcw} color="bg-orange-600" />
        <ReportKPICard label="Total Refunded" value={totalRefunded} prefix="LKR " icon={DollarSign} color="bg-red-600" />
      </div>

      <ReportTable
        columns={[
          { header: 'Date', accessor: (r) => fmtDate(r.created_at) },
          { header: 'Invoice', accessor: 'invoice_no' },
          { header: 'Product', accessor: 'product_name' },
          { header: 'Qty', accessor: (r) => `${r.return_cartons}C ${r.return_pieces}P`, className: 'text-center' },
          { header: 'Refund', accessor: (r) => fmtCurrency(r.refund_amount), className: 'text-right font-mono' },
          { header: 'Reason', accessor: 'reason' },
          { header: 'Type', accessor: 'return_type' },
        ]}
        data={data}
        emptyMessage="No sales returns recorded for this period."
      />
    </div>
  );
};
