import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { getProducts } from '../../services/productService';
import { type ReportPeriod, getReportDateRange } from '../../utils/reportUtils';
import { DateRangePicker } from './shared/DateRangePicker';
import { Loader2, TrendingUp } from 'lucide-react';

export const FastMovingReport: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { from, to } = getReportDateRange(period, customFrom, customTo);

      const [prods, itemsRes] = await Promise.all([
        getProducts(),
        (() => {
          let q = supabase.from('invoice_items').select('product_id, cartons, pieces, products(pieces_per_carton)');
          if (from) q = q.gte('created_at', from);
          if (to)   q = q.lte('created_at', to);
          return q;
        })(),
      ]);

      const days = from && to ? Math.max(1, (new Date(to).getTime() - new Date(from).getTime()) / 86400000) : 30;
      const unitMap: Record<string, number> = {};
      for (const item of (itemsRes.data ?? [])) {
        const ppc = (item.products as any)?.pieces_per_carton || 1;
        const units = item.cartons * ppc + item.pieces;
        unitMap[item.product_id] = (unitMap[item.product_id] ?? 0) + units;
      }

      const combined = prods.map(p => ({
        ...p,
        unitsSold: unitMap[p.id] ?? 0,
        perDay: (unitMap[p.id] ?? 0) / days,
      })).filter(p => p.unitsSold > 0).sort((a, b) => b.unitsSold - a.unitsSold);

      setData(combined);
      setLoading(false);
    }
    load();
  }, [period, customFrom, customTo]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
            <TrendingUp size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white">Top Performance Analytics</h2>
            <p className="text-xs text-gray-500 truncate">Products with the highest sales volume in the selected period.</p>
          </div>
        </div>
        <DateRangePicker value={period} onChange={setPeriod} customFrom={customFrom} customTo={customTo} onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }} />
      </div>

      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#1d222a]">
              {['Product', 'Model', 'Units Sold', 'Sales / Day', 'Performance'].map(h => (
                <th key={h} className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2b313a]">
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center"><Loader2 className="animate-spin text-primary mx-auto" /></td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-600 font-semibold">No fast moving items detected for this period.</td></tr>
            ) : data.map((p, i) => (
              <tr key={p.id} className="hover:bg-[#1d222a] transition-colors">
                <td className="px-6 py-4">
                  <p className="text-sm font-semibold text-white">{p.name}</p>
                  <p className="text-[10px] text-gray-500">SKU: {p.sku || p.item_code}</p>
                </td>
                <td className="px-6 py-4 text-sm font-mono text-gray-400">{p.model}</td>
                <td className="px-6 py-4 text-sm font-mono font-bold text-primary">{p.unitsSold.toLocaleString()}</td>
                <td className="px-6 py-4 text-sm font-mono text-gray-400">{p.perDay.toFixed(2)}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[#2b313a] rounded-full overflow-hidden min-w-[60px]">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.min(100, (p.unitsSold / (data[0]?.unitsSold || 1)) * 100)}%` }}
                      />
                    </div>
                    {i < 3 && <span className="text-[8px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded uppercase">Top Seller</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
