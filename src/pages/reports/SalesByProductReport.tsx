import React, { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { type ReportPeriod, getReportDateRange, fmtCurrency, signedSaleUnits } from '../../utils/reportUtils';
import { ReportTable } from './shared/ReportTable';
import { DateRangePicker } from './shared/DateRangePicker';
import { ExportBar } from './shared/ExportBar';

export const SalesByProductReport: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [allData, setAllData] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      const { from, to } = getReportDateRange(period, customFrom, customTo);
      
      let query = supabase
        .from('invoice_items')
        .select('product_id, total, cartons, pieces, unit_price, products(name, pieces_per_carton, cost_price), invoices(payment_status, subtotal, discount)');

      if (from) query = query.gte('created_at', from);
      if (to) query = query.lte('created_at', to);

      const { data: items } = await query;

      const map: Record<string, any> = {};
      (items || []).forEach(item => {
        const inv = item.invoices as any;
        if (!inv || inv.payment_status === 'cancelled') return;

        const id = item.product_id;
        const prod = item.products as any;
        const ppc = prod?.pieces_per_carton || 1;
        const unitCost = prod?.cost_price || 0;

        // Sign the quantity off unit_price so an exchange/return credit line
        // subtracts from pieces sold and cost of goods instead of inflating
        // both (a sold-then-exchanged item nets to zero).
        const totalPieces = signedSaleUnits(item.cartons * ppc + item.pieces, item.unit_price);

        // Allocate the bill-level discount proportionally across line items
        const discountRatio = inv.subtotal > 0 ? Number(inv.discount) / Number(inv.subtotal) : 0;
        const netRevenue = Number(item.total) * (1 - discountRatio);

        if (!map[id]) {
          map[id] = { name: prod?.name || 'Unknown', totalSold: 0, revenue: 0, totalCost: 0 };
        }
        map[id].totalSold += totalPieces;
        map[id].revenue += netRevenue;
        map[id].totalCost += unitCost * totalPieces;
      });

      const rows = Object.values(map).map((r: any) => ({
        ...r,
        profit: r.revenue - r.totalCost,
        profitMargin: r.revenue > 0 ? ((r.revenue - r.totalCost) / r.revenue) * 100 : 0,
      }));

      setAllData(rows.sort((a, b) => b.revenue - a.revenue));
    }
    load();
  }, [period, customFrom, customTo]);

  const data = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? allData.filter(r => String(r.name).toLowerCase().includes(q)) : allData;
  }, [allData, search]);

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

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search product..."
          className="w-full pl-9 pr-3 py-2.5 bg-[#1d222a] border border-[#2b313a] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#3d4652]"
        />
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
