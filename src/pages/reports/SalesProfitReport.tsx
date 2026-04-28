import React, { useState, useEffect } from 'react';
import { getSalesProfitReport } from '../../services/reportService';
import { type ReportPeriod, getReportDateRange, fmtCurrency } from '../../utils/reportUtils';
import { ReportTable } from './shared/ReportTable';
import { DateRangePicker } from './shared/DateRangePicker';
import { ExportBar } from './shared/ExportBar';

export const SalesProfitReport: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { from, to } = getReportDateRange(period);
      const res = await getSalesProfitReport(from || undefined, to || undefined);
      setData(res);
      setLoading(false);
    }
    load();
  }, [period]);

  const headers = ['Invoice', 'Product', 'Qty', 'Selling Price', 'Cost Price', 'Total Revenue', 'Total Cost', 'Profit'];
  const rows = data.map(r => [
    r.invoice_no, r.product, r.quantity, 
    fmtCurrency(r.selling_price), fmtCurrency(r.cost_price),
    fmtCurrency(r.total_revenue), fmtCurrency(r.total_cost),
    fmtCurrency(r.profit)
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Sales Profit Report</h2>
        <div className="flex items-center gap-3">
          <DateRangePicker value={period} onChange={setPeriod} />
          <ExportBar filename="Sales_Profit_Report" headers={headers} rows={rows} />
        </div>
      </div>

      <ReportTable
        columns={[
          { header: 'Invoice', accessor: 'invoice_no' },
          { header: 'Product', accessor: 'product' },
          { header: 'Qty', accessor: 'quantity', className: 'text-center' },
          { header: 'Selling Price', accessor: (r) => fmtCurrency(r.selling_price), className: 'text-right' },
          { header: 'Cost Price', accessor: (r) => fmtCurrency(r.cost_price), className: 'text-right' },
          { header: 'Profit', accessor: (r) => (
            <span className={r.profit >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
              {fmtCurrency(r.profit)}
            </span>
          ), className: 'text-right' }
        ]}
        data={data}
        emptyMessage="No sales profit data found for this period."
      />
    </div>
  );
};
