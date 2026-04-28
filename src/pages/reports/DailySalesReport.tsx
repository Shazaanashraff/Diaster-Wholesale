import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { getDailySalesReport } from '../../services/reportService';
import { type ReportPeriod, getReportDateRange, fmtCurrency, fmtDate } from '../../utils/reportUtils';
import { ReportTable } from './shared/ReportTable';
import { DateRangePicker } from './shared/DateRangePicker';
import { ExportBar } from './shared/ExportBar';
import { ShoppingBag, TrendingUp } from 'lucide-react';
import { ReportKPICard } from './shared/ReportKPICard';

export const DailySalesReport: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('today');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({ totalSales: 0, transactions: 0, data: [] });

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { from, to } = getReportDateRange(period);
      const res = await getDailySalesReport(from || undefined, to || undefined);
      setData(res);
      setLoading(false);
    }
    load();
  }, [period]);

  const headers = ['Date', 'Invoice No', 'Status', 'Total'];
  const rows = (data.data || []).map((r: any) => [
    fmtDate(r.created_at), r.invoice_no, r.payment_status, fmtCurrency(r.total)
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Daily Sales Report</h2>
        <div className="flex items-center gap-3">
          <DateRangePicker value={period} onChange={setPeriod} />
          <ExportBar filename="Daily_Sales_Report" headers={headers} rows={rows} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ReportKPICard label="Total Revenue" value={data.totalSales} prefix="LKR " icon={TrendingUp} color="bg-green-600" />
        <ReportKPICard label="Transactions" value={data.transactions} icon={ShoppingBag} color="bg-blue-600" />
      </div>

      <ReportTable
        columns={[
          { header: 'Date', accessor: (r) => fmtDate(r.created_at) },
          { header: 'Invoice', accessor: 'invoice_no' },
          { header: 'Status', accessor: (r) => (
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", 
              r.payment_status === 'paid' ? "bg-green-900/20 text-green-400" : 
              r.payment_status === 'partial' ? "bg-blue-900/20 text-blue-400" : "bg-red-900/20 text-red-400"
            )}>
              {r.payment_status}
            </span>
          )},
          { header: 'Amount', accessor: (r) => fmtCurrency(r.total), className: 'text-right font-mono' }
        ]}
        data={data.data || []}
        emptyMessage="No sales transactions recorded for this period."
      />
    </div>
  );
};


