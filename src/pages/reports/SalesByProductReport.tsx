import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { type ReportPeriod, getReportDateRange, fmtCurrency } from '../../utils/reportUtils';
import { ReportTable } from './shared/ReportTable';
import { DateRangePicker } from './shared/DateRangePicker';
import { ExportBar } from './shared/ExportBar';

export const SalesByProductReport: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { from, to } = getReportDateRange(period, customFrom, customTo);
      
      let query = supabase
        .from('invoice_items')
        .select('product_id, total, cartons, pieces, products(name, pieces_per_carton, cost_price)');

      if (from) query = query.gte('created_at', from);
      if (to) query = query.lte('created_at', to);

      const { data: items } = await query;

      const map: Record<string, any> = {};
      (items || []).forEach(item => {
        const id = item.product_id;
        const prod = item.products as any;
        const ppc = prod?.pieces_per_carton || 1;
        const totalPieces = item.cartons * ppc + item.pieces;
        const unitCost = prod?.cost_price || 0;

        if (!map[id]) {
          map[id] = { name: prod?.name || 'Unknown', totalSold: 0, revenue: 0, totalCost: 0 };
        }
        map[id].totalSold += totalPieces;
        map[id].revenue += Number(item.total);
        map[id].totalCost += unitCost * totalPieces;
      });

      const rows = Object.values(map).map((r: any) => ({
        ...r,
        profit: r.revenue - r.totalCost,
        profitMargin: r.revenue > 0 ? ((r.revenue - r.totalCost) / r.revenue) * 100 : 0,
      }));

      setData(rows.sort((a, b) => b.revenue - a.revenue));
    }
    load();
  }, [period, customFrom, customTo]);

  const headers = ['Product', 'Total Pieces Sold', 'Total Revenue', 'Total Cost of Goods', 'Total Profit', 'Profit Margin %'];
  const rows = data.map(r => [
    r.name, r.totalSold, fmtCurrency(r.revenue),
    fmtCurrency(r.totalCost), fmtCurrency(r.profit),
    `${r.profitMargin.toFixed(1)}%`
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Sales by Product Report</h2>
        <div className="flex items-center gap-3">
          <DateRangePicker value={period} onChange={setPeriod} customFrom={customFrom} customTo={customTo} onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }} />
          <ExportBar filename="Sales_By_Product" headers={headers} rows={rows} />
        </div>
      </div>

      <ReportTable
        columns={[
          { header: 'Product Name', accessor: 'name' },
          { header: 'Total Pieces Sold', accessor: 'totalSold', className: 'text-center' },
          { header: 'Total Revenue', accessor: (r) => fmtCurrency(r.revenue), className: 'text-right font-mono text-white' },
          { header: 'Total Cost of Goods', accessor: (r) => fmtCurrency(r.totalCost), className: 'text-right font-mono' },
          { header: 'Total Profit', accessor: (r) => (
            <span className={r.profit >= 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
              {fmtCurrency(r.profit)}
            </span>
          ), className: 'text-right' },
          { header: 'Profit Margin %', accessor: (r) => (
            <span className={r.profitMargin >= 0 ? 'text-green-400' : 'text-red-400'}>
              {r.profitMargin.toFixed(1)}%
            </span>
          ), className: 'text-right' },
        ]}
        data={data}
        emptyMessage="No product sales found for this period."
      />
    </div>
  );
};
