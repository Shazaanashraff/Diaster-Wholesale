import React, { useState, useEffect } from 'react';
import { getProducts } from '../../services/productService';
import { getMovementRates, getInventory } from '../../services/inventoryService';
import { computeStock } from '../../utils/stockUtils';
import type { Product } from '../../types';
import { Loader2, AlertCircle, ShoppingBag } from 'lucide-react';
import { cn } from '../../lib/utils';

export const SlowMovingReport: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [prods, rates, stock] = await Promise.all([
        getProducts(), 
        getMovementRates(),
        getInventory()
      ]);
      
      const stockMap = new Map(stock.map(s => [s.product_id, computeStock(s).totalPieces]));

      const combined = prods.map(p => ({
        ...p,
        units30d: rates[p.id]?.units30d || 0,
        stock: stockMap.get(p.id) || 0
      }))
      .filter(p => p.stock > 0)
      .sort((a, b) => a.units30d - b.units30d); // Lowest movement first

      setData(combined);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-500">
          <ShoppingBag size={24} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Dead Stock & Slow Moving Analytics</h2>
          <p className="text-sm text-gray-500">Items with low or zero movement in the last 30 days that currently have stock.</p>
        </div>
      </div>

      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#1d222a]">
              {['Product', 'Model', 'Current Stock', 'Units (30d)', 'Warning'].map(h => (
                <th key={h} className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2b313a]">
            {data.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-600 font-semibold">All items are moving well!</td></tr>
            ) : data.map((p) => (
              <tr key={p.id} className="hover:bg-[#1d222a] transition-colors">
                <td className="px-6 py-4">
                  <p className="text-sm font-semibold text-white">{p.name}</p>
                  <p className="text-[10px] text-gray-500">SKU: {p.sku || p.item_code}</p>
                </td>
                <td className="px-6 py-4 text-sm font-mono text-gray-400">{p.model}</td>
                <td className="px-6 py-4 text-sm font-mono text-white">{p.stock.toLocaleString()}</td>
                <td className="px-6 py-4 text-sm font-mono font-bold text-amber-500">{p.units30d}</td>
                <td className="px-6 py-4">
                  {p.units30d === 0 ? (
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
