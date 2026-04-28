import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { type ReportPeriod, getReportDateRange, fmtDate } from '../../utils/reportUtils';
import { ReportTable } from './shared/ReportTable';
import { DateRangePicker } from './shared/DateRangePicker';
import { ExportBar } from './shared/ExportBar';
import { Settings } from 'lucide-react';
import { ReportKPICard } from './shared/ReportKPICard';

export const InventoryAdjustmentReport: React.FC = () => {
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
        .order('created_at', { ascending: false });

      if (from) query = query.gte('created_at', from);
      if (to) query = query.lte('created_at', to);

      const { data: res } = await query;
      setData(res || []);
      setLoading(false);
    }
    load();
  }, [period]);

  const headers = ['Date', 'Product', 'Adjustment', 'Reason', 'User'];
  const rows = data.map(r => [
    fmtDate(r.created_at), (r.products as any)?.name || 'Unknown', 
    r.adjustment_pieces, r.reason, r.adjusted_by
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Inventory Adjustment Report</h2>
        <div className="flex items-center gap-3">
          <DateRangePicker value={period} onChange={setPeriod} />
          <ExportBar filename="Stock_Adjustments" headers={headers} rows={rows} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReportKPICard label="Total Adjustments" value={data.length} icon={Settings} color="bg-gray-600" />
      </div>

      <ReportTable
        columns={[
          { header: 'Date', accessor: (r) => fmtDate(r.created_at) },
          { header: 'Product', accessor: (r) => (r.products as any)?.name },
          { header: 'Qty Change', accessor: (r) => (
            <span className={r.adjustment_pieces >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
              {r.adjustment_pieces > 0 ? `+${r.adjustment_pieces}` : r.adjustment_pieces}
            </span>
          ), className: 'text-center' },
          { header: 'Reason', accessor: 'reason' },
          { header: 'User', accessor: 'adjusted_by' }
        ]}
        data={data}
        emptyMessage="No stock adjustments found for this period."
      />
    </div>
  );
};
