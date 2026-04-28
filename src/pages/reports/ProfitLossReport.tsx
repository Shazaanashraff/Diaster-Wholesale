import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, PieChart, Activity } from 'lucide-react';
import { getProfitAndLoss } from '../../services/reportService';
import { type ReportPeriod, getReportDateRange, fmtCurrency } from '../../utils/reportUtils';
import { ReportKPICard } from './shared/ReportKPICard';
import { DateRangePicker } from './shared/DateRangePicker';
import { ExportBar } from './shared/ExportBar';
import { ReportTable } from './shared/ReportTable';
import { ReportSkeleton } from './shared/ReportSkeleton';

export const ProfitLossReport: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { from, to } = getReportDateRange(period);
      const res = await getProfitAndLoss(from || undefined, to || undefined);
      setData(res);
      setLoading(false);
    }
    load();
  }, [period]);

  if (loading) return <ReportSkeleton kpis={4} rows={5} />;

  const rows = [
    ['Total Revenue', fmtCurrency(data.revenue)],
    ['Cost of Goods Sold (COGS)', fmtCurrency(data.cogs)],
    ['Gross Profit', fmtCurrency(data.grossProfit)],
    ['Operating Expenses', fmtCurrency(data.expenses)],
    ['Net Profit', fmtCurrency(data.netProfit)],
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Profit & Loss Report</h2>
        <div className="flex items-center gap-3">
          <DateRangePicker value={period} onChange={setPeriod} />
          <ExportBar filename="Profit_Loss_Report" headers={['Item', 'Amount']} rows={rows} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportKPICard label="Revenue" value={data.revenue} prefix="LKR " icon={DollarSign} color="bg-blue-600" />
        <ReportKPICard label="Gross Profit" value={data.grossProfit} prefix="LKR " icon={TrendingUp} color="bg-green-600" />
        <ReportKPICard label="Expenses" value={data.expenses} prefix="LKR " icon={Activity} color="bg-red-600" />
        <ReportKPICard label="Net Profit" value={data.netProfit} prefix="LKR " icon={PieChart} color="bg-purple-600" />
      </div>

      <ReportTable
        columns={[
          { header: 'Financial Item', accessor: (r: any) => <span className="font-medium text-white">{r[0]}</span> },
          { header: 'Amount', accessor: (r: any) => r[1], className: 'text-right font-mono' }
        ]}
        data={rows}
      />
    </div>
  );
};
