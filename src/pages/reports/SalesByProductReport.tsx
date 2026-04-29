import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { type ReportPeriod, getReportDateRange, fmtCurrency } from '../../utils/reportUtils';
import { ReportTable } from './shared/ReportTable';
import { DateRangePicker } from './shared/DateRangePicker';
import { ExportBar } from './shared/ExportBar';

export const SalesByProductReport: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { from, to } = getReportDateRange(period);
      
      let query = supabase
        .from('invoice_items')
        .select('product_id, total, cartons, pieces, products(name, pieces_per_carton)');

      if (from) query = query.gte('created_at', from);
      if (to) query = query.lte('created_at', to);

      const { data: items } = await query;

      const map: Record<string, any> = {};
      (items || []).forEach(item => {
        const id = item.product_id;
        const ppc = (item.products as any)?.pieces_per_carton || 1;
        const totalPieces = item.cartons * ppc + item.pieces;
        
        if (!map[id]) {
          map[id] = { name: (item.products as any)?.name || 'Unknown', totalSold: 0, revenue: 0 };
        }
        map[id].totalSold += totalPieces;
        map[id].revenue += Number(item.total);
      });

      setData(Object.values(map).sort((a, b) => b.revenue - a.revenue));
    }
    load();
  }, [period]);

  const headers = ['Product', 'Total Pieces Sold', 'Total Revenue'];
  const rows = data.map(r => [r.name, r.totalSold, fmtCurrency(r.revenue)]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Sales by Product Report</h2>
        <div className="flex items-center gap-3">
          <DateRangePicker value={period} onChange={setPeriod} />
          <ExportBar filename="Sales_By_Product" headers={headers} rows={rows} />
        </div>
      </div>

      <ReportTable
        columns={[
          { header: 'Product Name', accessor: 'name' },
          { header: 'Total Pieces Sold', accessor: 'totalSold', className: 'text-center' },
          { header: 'Total Revenue', accessor: (r) => fmtCurrency(r.revenue), className: 'text-right font-mono text-white' }
        ]}
        data={data}
        emptyMessage="No product sales found for this period."
      />
    </div>
  );
};
