import React, { useState, useEffect } from 'react';
import { TopBar } from '../components/TopBar';
import { Modal } from '../components/Modal';
import { Search, Filter, ArrowUpDown, ChevronRight, Loader2, AlertTriangle, Package, SlidersHorizontal, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ProductStock } from '../types';
import { getInventory, insertStockAdjustment } from '../services/inventoryService';
import { computeStock } from '../utils/stockUtils';

// ── localStorage key for low-stock threshold ──
const THRESHOLD_KEY = 'lowStockThreshold';
const DEFAULT_THRESHOLD = 10;

function readThreshold(): number {
  const stored = localStorage.getItem(THRESHOLD_KEY);
  if (stored === null) return DEFAULT_THRESHOLD;
  const parsed = parseInt(stored, 10);
  return isNaN(parsed) ? DEFAULT_THRESHOLD : parsed;
}

export const InventoryPage: React.FC = () => {
  const [inventory, setInventory] = useState<ProductStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Low-stock threshold ──
  const [threshold, setThreshold] = useState<number>(readThreshold);

  // ── Stock adjustment modal ──
  const [adjustRow, setAdjustRow] = useState<ProductStock | null>(null);
  const [adjCartons, setAdjCartons] = useState('0');
  const [adjPieces, setAdjPieces] = useState('0');
  const [adjReason, setAdjReason] = useState('');
  const [adjSaving, setAdjSaving] = useState(false);
  const [adjError, setAdjError] = useState<string | null>(null);

  // ── Success toast ──
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetchInventory();
  }, []);

  // Persist threshold to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(THRESHOLD_KEY, String(threshold));
  }, [threshold]);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

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

  // ── Open adjustment modal for a specific row ──
  function openAdjustModal(row: ProductStock) {
    setAdjustRow(row);
    setAdjCartons('0');
    setAdjPieces('0');
    setAdjReason('');
    setAdjError(null);
  }

  function closeAdjustModal() {
    setAdjustRow(null);
    setAdjError(null);
  }

  // ── Submit stock adjustment ──
  async function handleAdjustSubmit() {
    if (!adjustRow) return;

    const cartonDelta = parseInt(adjCartons, 10);
    const pieceDelta = parseInt(adjPieces, 10);

    if (isNaN(cartonDelta) || isNaN(pieceDelta)) {
      setAdjError('Please enter valid numbers.');
      return;
    }
    if (cartonDelta === 0 && pieceDelta === 0) {
      setAdjError('At least one delta must be non-zero.');
      return;
    }
    if (!adjReason.trim()) {
      setAdjError('Please enter a reason for this adjustment.');
      return;
    }

    try {
      setAdjSaving(true);
      setAdjError(null);

      await insertStockAdjustment({
        product_id: adjustRow.product_id,
        adjustment_cartons: cartonDelta,
        adjustment_pieces: pieceDelta,
        reason: adjReason.trim(),
        adjusted_by: 'admin', // TODO: replace with auth user
      });

      closeAdjustModal();
      setToast(`Stock adjusted for ${adjustRow.name}`);
      await fetchInventory(); // reload live data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save adjustment';
      setAdjError(message);
    } finally {
      setAdjSaving(false);
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
            {/* ── Low-stock threshold control ── */}
            <div className="flex items-center gap-2 px-4 py-3 bg-white border-2 border-border/50 rounded-2xl shadow-sm">
              <SlidersHorizontal size={16} strokeWidth={2.5} className="text-amber-500" />
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Low Stock</span>
              <input
                type="number"
                min={0}
                value={threshold}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setThreshold(isNaN(val) ? 0 : val);
                }}
                className="w-14 text-center text-sm font-bold text-dark bg-accent rounded-xl py-1 outline-none border border-border/50 focus:border-primary/30 transition-all"
              />
            </div>

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
                  const isLowStock = stock.totalPieces < threshold;

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
                          {stock.availLoose}
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
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={(e) => { e.stopPropagation(); openAdjustModal(row); }}
                            className="px-4 py-2 rounded-xl text-[11px] font-bold text-gray-400 bg-accent hover:text-primary hover:bg-orange-50 transition-all opacity-0 group-hover:opacity-100"
                          >
                            Adjust
                          </button>
                          <div className="p-3 rounded-2xl text-gray-200 bg-accent hover:text-primary hover:bg-orange-50 transition-all opacity-0 group-hover:opacity-100 inline-flex">
                            <ChevronRight size={18} />
                          </div>
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

      {/* ── Stock Adjustment Modal ── */}
      <Modal
        isOpen={adjustRow !== null}
        onClose={closeAdjustModal}
        title={adjustRow ? `Adjust Stock — ${adjustRow.name}` : 'Adjust Stock'}
      >
        {adjustRow && (
          <div className="flex flex-col gap-6">
            {/* Current stock summary */}
            <div className="flex items-center gap-4 p-4 bg-accent rounded-2xl border border-border/50">
              <div className="flex-1 text-center">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Current Cartons</p>
                <p className="text-lg font-bold text-dark mt-1">{computeStock(adjustRow).availCartons}</p>
              </div>
              <div className="w-px h-10 bg-border/50" />
              <div className="flex-1 text-center">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Loose Pieces</p>
                <p className="text-lg font-bold text-dark mt-1">{computeStock(adjustRow).availLoose}</p>
              </div>
              <div className="w-px h-10 bg-border/50" />
              <div className="flex-1 text-center">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Pieces</p>
                <p className="text-lg font-bold text-primary mt-1">{computeStock(adjustRow).totalPieces}</p>
              </div>
            </div>

            {/* Delta inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                  Carton Delta
                </label>
                <input
                  type="number"
                  value={adjCartons}
                  onChange={(e) => setAdjCartons(e.target.value)}
                  placeholder="e.g. -2 or +5"
                  className="w-full px-4 py-3 bg-accent border border-border/50 rounded-2xl text-sm font-bold text-dark outline-none focus:border-primary/30 transition-all"
                />
                <p className="text-[10px] text-gray-300 font-semibold mt-1">Negative to remove, positive to add</p>
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                  Piece Delta
                </label>
                <input
                  type="number"
                  value={adjPieces}
                  onChange={(e) => setAdjPieces(e.target.value)}
                  placeholder="e.g. -10 or +3"
                  className="w-full px-4 py-3 bg-accent border border-border/50 rounded-2xl text-sm font-bold text-dark outline-none focus:border-primary/30 transition-all"
                />
                <p className="text-[10px] text-gray-300 font-semibold mt-1">Negative to remove, positive to add</p>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                Reason
              </label>
              <textarea
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value)}
                placeholder="e.g. Damaged goods, stock recount, returned items..."
                rows={3}
                className="w-full px-4 py-3 bg-accent border border-border/50 rounded-2xl text-sm font-medium text-dark outline-none focus:border-primary/30 transition-all resize-none"
              />
            </div>

            {/* Error message */}
            {adjError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 rounded-2xl border border-red-100">
                <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
                <p className="text-xs font-semibold text-red-500">{adjError}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={closeAdjustModal}
                disabled={adjSaving}
                className="flex-1 px-6 py-3.5 bg-accent text-dark rounded-2xl font-bold text-sm hover:bg-gray-100 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjustSubmit}
                disabled={adjSaving}
                className="flex-1 px-6 py-3.5 bg-primary text-white rounded-2xl font-bold text-sm hover:bg-orange-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {adjSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Adjustment'
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Success Toast ── */}
      {toast && (
        <div className="fixed bottom-8 right-8 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center gap-3 px-6 py-4 bg-dark text-white rounded-2xl shadow-2xl border border-white/10">
            <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <Check size={14} strokeWidth={3} />
            </div>
            <p className="text-sm font-bold">{toast}</p>
          </div>
        </div>
      )}
    </div>
  );
};
