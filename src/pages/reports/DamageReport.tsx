import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { type ReportPeriod, getReportDateRange, fmtDate } from '../../utils/reportUtils';
import { ReportTable } from './shared/ReportTable';
import { DateRangePicker } from './shared/DateRangePicker';
import { ExportBar } from './shared/ExportBar';
import { AlertCircle } from 'lucide-react';
import { ReportKPICard } from './shared/ReportKPICard';

export const DamageReport: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { from, to } = getReportDateRange(period);
      
      let query = supabase
        .from('stock_adjustments')
        .select('*, products(name)')
        .ilike('reason', '%damage%')
        .order('created_at', { ascending: false });

      if (from) query = query.gte('created_at', from);
      if (to) query = query.lte('created_at', to);

      const { data: res } = await query;
      setData(res || []);
      setLoading(false);
    }
    load();
  }, [period]);

  const totalDamaged = data.reduce((sum, r) => sum + Math.abs(r.adjustment_pieces), 0);
  const headers = ['Date', 'Product', 'Damaged Qty', 'Reason', 'User'];
  const rows = data.map(r => [
    fmtDate(r.created_at), (r.products as any)?.name, 
    Math.abs(r.adjustment_pieces), r.reason, r.adjusted_by
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Damage Report</h2>
        <div className="flex items-center gap-3">
          <DateRangePicker value={period} onChange={setPeriod} />
          <ExportBar filename="Damage_Report" headers={headers} rows={rows} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReportKPICard label="Total Damaged Pieces" value={totalDamaged} icon={AlertCircle} color="bg-red-600" />
      </div>

      <ReportTable
        columns={[
          { header: 'Date', accessor: (r) => fmtDate(r.created_at) },
          { header: 'Product', accessor: (r) => (r.products as any)?.name },
          { header: 'Qty Damaged', accessor: (r) => (
            <span className="text-red-400 font-bold">
              {Math.abs(r.adjustment_pieces)}
            </span>
          ), className: 'text-center' },
          { header: 'Reason', accessor: 'reason' },
          { header: 'Recorded By', accessor: 'adjusted_by' }
        ]}
        data={data}
        emptyMessage="No damage records found for this period."
      />
    </div>
  );
};
