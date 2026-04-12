import React, { useState, useEffect } from 'react';
import { TopBar } from '../components/TopBar';
import { Search, Filter, ArrowUpDown, ChevronRight, Loader2, AlertTriangle, Package } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ProductStock } from '../types';
import { getInventory, computeStock } from '../services/inventoryService';

export const InventoryPage: React.FC = () => {
  const [inventory, setInventory] = useState<ProductStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInventory();
  }, []);

  async function fetchInventory() {
    try {
      setLoading(true);
      setError(null);
      const data = await getInventory();
      setInventory(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load inventory';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-accent">
      <TopBar />
      
      <div className="p-10">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-dark tracking-tight">Inventory</h1>
            <p className="text-gray-400 text-sm font-semibold mt-1">Manage and track your digital product inventory.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} strokeWidth={2.5} />
              <input 
                type="text" 
                placeholder="Search stock..." 
                className="bg-white border-2 border-transparent focus:border-primary/20 rounded-2xl py-3 pl-12 pr-6 text-sm font-medium outline-none transition-all w-72 shadow-sm"
              />
            </div>
            <button className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-border/50 rounded-2xl text-sm font-bold text-dark hover:border-primary/20 transition-all shadow-sm">
              <Filter size={18} strokeWidth={2.5} /> Filter
            </button>
          </div>
        </div>

        {/* ── Loading State ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 size={36} className="animate-spin text-primary" />
            <p className="text-sm font-semibold text-gray-400">Loading inventory...</p>
          </div>
        )}

        {/* ── Error State ── */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle size={28} className="text-red-400" />
            </div>
            <p className="text-sm font-semibold text-red-400">{error}</p>
            <button 
              onClick={fetchInventory}
              className="px-6 py-3 bg-primary text-white rounded-2xl font-bold text-sm hover:bg-orange-600 transition-all"
            >
              Try Again
            </button>
          </div>
        )}

        {/* ── Empty State ── */}
        {!loading && !error && inventory.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center border border-border/50">
              <Package size={28} className="text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-400">No inventory data yet. Add products and stock batches first.</p>
          </div>
        )}

        {/* ── Inventory Table ── */}
        {!loading && !error && inventory.length > 0 && (
          <div className="bg-white rounded-[2.5rem] border border-border/50 overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-border/50">
                  <th className="px-8 py-6 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Item Code</th>
                  <th className="px-8 py-6 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-left">
                    <div className="flex items-center gap-2 cursor-pointer hover:text-dark">
                      Product Name <ArrowUpDown size={14} />
                    </div>
                  </th>
                  <th className="px-8 py-6 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-left">Model</th>
                  <th className="px-8 py-6 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-right">Cartons</th>
                  <th className="px-8 py-6 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-right">Pieces</th>
                  <th className="px-8 py-6 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-right">Wholesale</th>
                  <th className="px-8 py-6 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-right">Retail</th>
                  <th className="px-8 py-6 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-right">Margin</th>
                  <th className="px-8 py-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {inventory.map((row) => {
                  const stock = computeStock(row);
                  const isLowStock = stock.totalPieces < 10;

                  return (
                    <tr 
                      key={row.product_id} 
                      className={cn(
                        "hover:bg-accent/50 transition-colors group cursor-pointer border-b border-border/50 last:border-0",
                        isLowStock && "bg-amber-50/60 hover:bg-amber-50"
                      )}
                    >
                      <td className="px-8 py-6 text-xs font-bold text-primary font-mono tracking-tighter uppercase">
                        {row.item_code}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-sm font-bold text-dark leading-tight">{row.name}</p>
                            <p className="text-[11px] text-gray-400 font-semibold uppercase mt-1 tracking-wider">{row.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-left">
                        <span className="text-xs font-bold text-gray-400">{row.model}</span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <span className={cn(
                          "text-sm font-bold",
                          isLowStock ? "text-amber-600" : "text-dark"
                        )}>
                          {stock.availCartons}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <span className={cn(
                          "text-sm font-bold",
                          isLowStock ? "text-amber-600" : "text-dark"
                        )}>
                          {stock.availPieces}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <span className="text-sm font-bold text-dark">LKR {row.wholesale_price.toFixed(2)}</span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <span className="text-sm font-bold text-primary">LKR {row.retail_price.toFixed(2)}</span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-bold text-primary">LKR {(row.retail_price - row.wholesale_price).toFixed(2)}</span>
                          <span className="text-[10px] font-semibold text-gray-300">
                            {row.wholesale_price > 0 ? Math.round(((row.retail_price - row.wholesale_price) / row.wholesale_price) * 100) : 0}%
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="p-3 rounded-2xl text-gray-200 bg-accent hover:text-primary hover:bg-orange-50 transition-all opacity-0 group-hover:opacity-100 inline-flex">
                          <ChevronRight size={18} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
