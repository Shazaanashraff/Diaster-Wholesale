import React, { useState, useEffect } from 'react';
import { getProducts } from '../../services/productService';
import { getMovementRates } from '../../services/inventoryService';
import { Loader2, TrendingUp } from 'lucide-react';

export const FastMovingReport: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [prods, rates] = await Promise.all([getProducts(), getMovementRates()]);
      const combined = prods.map(p => ({
        ...p,
        units30d: rates[p.id]?.units30d || 0,
        perDay: rates[p.id]?.perDay || 0
      })).sort((a, b) => b.units30d - a.units30d).filter(p => p.units30d > 0);
      setData(combined);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
          <TrendingUp size={24} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Top Performance Analytics</h2>
          <p className="text-sm text-gray-500">Products with the highest sales volume in the last 30 days.</p>
        </div>
      </div>

      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#1d222a]">
              {['Product', 'Model', 'Units (30d)', 'Sales / Day', 'Performance'].map(h => (
                <th key={h} className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2b313a]">
            {data.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-600 font-semibold">No fast moving items detected yet.</td></tr>
            ) : data.map((p, i) => (
              <tr key={p.id} className="hover:bg-[#1d222a] transition-colors">
                <td className="px-6 py-4">
                  <p className="text-sm font-semibold text-white">{p.name}</p>
                  <p className="text-[10px] text-gray-500">SKU: {p.sku || p.item_code}</p>
                </td>
                <td className="px-6 py-4 text-sm font-mono text-gray-400">{p.model}</td>
                <td className="px-6 py-4 text-sm font-mono font-bold text-primary">{p.units30d.toLocaleString()}</td>
                <td className="px-6 py-4 text-sm font-mono text-gray-400">{p.perDay.toFixed(2)}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[#2b313a] rounded-full overflow-hidden min-w-[60px]">
                      <div 
                        className="h-full bg-primary" 
                        style={{ width: `${Math.min(100, (p.units30d / (data[0]?.units30d || 1)) * 100)}%` }}
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
