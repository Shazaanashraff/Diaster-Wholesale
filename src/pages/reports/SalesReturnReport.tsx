import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import { type ReportPeriod, getReportDateRange, fmtCurrency, fmtDate } from '../../utils/reportUtils';
import { ReportTable } from './shared/ReportTable';
import { DateRangePicker } from './shared/DateRangePicker';
import { ExportBar } from './shared/ExportBar';
import { RotateCcw, DollarSign } from 'lucide-react';
import { ReportKPICard } from './shared/ReportKPICard';

export const SalesReturnReport: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { from, to } = getReportDateRange(period);
      
      let query = supabase
        .from('returns')
        .select('*, products(name), invoices(invoice_no)')
        .order('created_at', { ascending: false });

      if (from) query = query.gte('created_at', from);
      if (to) query = query.lte('created_at', to);

      const { data: res } = await query;
      setData(res || []);
      setLoading(false);
    }
    load();
  }, [period]);

  const totalRefunded = data.reduce((sum, r) => sum + Number(r.refund_amount), 0);
  const headers = ['Date', 'Invoice', 'Product', 'Qty Returned', 'Refund Amount', 'Reason'];
  const rows = data.map(r => [
    fmtDate(r.created_at), (r.invoices as any)?.invoice_no, (r.products as any)?.name,
    `${r.cartons} Ctn, ${r.pieces} Pcs`, fmtCurrency(r.refund_amount), r.reason
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Sales Return Report</h2>
        <div className="flex items-center gap-3">
          <DateRangePicker value={period} onChange={setPeriod} />
          <ExportBar filename="Sales_Returns" headers={headers} rows={rows} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReportKPICard label="Total Returns" value={data.length} icon={RotateCcw} color="bg-orange-600" />
        <ReportKPICard label="Total Refunded" value={totalRefunded} prefix="LKR " icon={DollarSign} color="bg-red-600" />
      </div>

      <ReportTable
        columns={[
          { header: 'Date', accessor: (r) => fmtDate(r.created_at) },
          { header: 'Invoice', accessor: (r) => (r.invoices as any)?.invoice_no },
          { header: 'Product', accessor: (r) => (r.products as any)?.name },
          { header: 'Qty', accessor: (r) => `${r.cartons}C ${r.pieces}P`, className: 'text-center' },
          { header: 'Refund', accessor: (r) => fmtCurrency(r.refund_amount), className: 'text-right font-mono' },
          { header: 'Reason', accessor: 'reason' }
        ]}
        data={data}
        emptyMessage="No sales returns recorded for this period."
      />
    </div>
  );
};


