import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { getProducts } from '../../services/productService';
import { getInventory } from '../../services/inventoryService';
import { computeStock } from '../../utils/stockUtils';
import { type ReportPeriod, getReportDateRange } from '../../utils/reportUtils';
import { DateRangePicker } from './shared/DateRangePicker';
import { Loader2, AlertCircle, ShoppingBag } from 'lucide-react';

export const SlowMovingReport: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { from, to } = getReportDateRange(period, customFrom, customTo);

      const [prods, itemsRes, stock] = await Promise.all([
        getProducts(),
        (() => {
          let q = supabase.from('invoice_items').select('product_id, cartons, pieces, products(pieces_per_carton)');
          if (from) q = q.gte('created_at', from);
          if (to)   q = q.lte('created_at', to);
          return q;
        })(),
        getInventory(),
      ]);

      const stockMap = new Map(stock.map(s => [s.product_id, computeStock(s).totalPieces]));

      const unitMap: Record<string, number> = {};
      for (const item of (itemsRes.data ?? [])) {
        const ppc = (item.products as any)?.pieces_per_carton || 1;
        unitMap[item.product_id] = (unitMap[item.product_id] ?? 0) + item.cartons * ppc + item.pieces;
      }

      const combined = prods.map(p => ({
        ...p,
        unitsSold: unitMap[p.id] ?? 0,
        stock: stockMap.get(p.id) || 0,
      })).filter(p => p.stock > 0).sort((a, b) => a.unitsSold - b.unitsSold);

      setData(combined);
      setLoading(false);
    }
    load();
  }, [period, customFrom, customTo]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
            <ShoppingBag size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white">Dead Stock & Slow Moving Analytics</h2>
            <p className="text-xs text-gray-500 truncate">Items with low or zero movement in the selected period that currently have stock.</p>
          </div>
        </div>
        <DateRangePicker value={period} onChange={setPeriod} customFrom={customFrom} customTo={customTo} onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }} />
      </div>

      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#1d222a]">
              {['Product', 'Model', 'Current Stock', 'Units Sold', 'Warning'].map(h => (
                <th key={h} className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2b313a]">
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center"><Loader2 className="animate-spin text-amber-500 mx-auto" /></td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-600 font-semibold">All items are moving well!</td></tr>
            ) : data.map((p) => (
              <tr key={p.id} className="hover:bg-[#1d222a] transition-colors">
                <td className="px-6 py-4">
                  <p className="text-sm font-semibold text-white">{p.name}</p>
                  <p className="text-[10px] text-gray-500">SKU: {p.sku || p.item_code}</p>
                </td>
                <td className="px-6 py-4 text-sm font-mono text-gray-400">{p.model}</td>
                <td className="px-6 py-4 text-sm font-mono text-white">{p.stock.toLocaleString()}</td>
                <td className="px-6 py-4 text-sm font-mono font-bold text-amber-500">{p.unitsSold}</td>
                <td className="px-6 py-4">
                  {p.unitsSold === 0 ? (
                    <span className="flex items-center gap-1.5 text-[9px] font-bold text-red-400 bg-red-400/10 px-2 py-1 rounded-full uppercase tracking-tight">
                      <AlertCircle size={10} /> Dead Stock
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[9px] font-bold text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full uppercase tracking-tight">
                      <AlertCircle size={10} /> Slow Moving
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
