import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Search, Filter, ArrowUpDown, ChevronRight, Loader2, AlertTriangle, Package, Check, ArrowRight, PanelRightClose, PanelRightOpen, X } from 'lucide-react';
import { usePermissions } from '../utils/permissions';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { ProductStock } from '../types';
import { getInventory, insertStockAdjustment, getMovementRates } from '../services/inventoryService';
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
  const [movementRates, setMovementRates] = useState<Record<string, { units30d: number; perDay: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Low-stock threshold ──
  const [threshold, setThreshold] = useState<number>(readThreshold);

  // ── Stock adjustment modal ──
  const [adjustRow, setAdjustRow] = useState<ProductStock | null>(null);
  const [adjType, setAdjType] = useState<'damage' | 'recount' | 'return' | 'other'>('recount');
  const [adjCartons, setAdjCartons] = useState('0');
  const [adjPieces, setAdjPieces] = useState('0');
  const [adjReason, setAdjReason] = useState('');
  const [adjSaving, setAdjSaving] = useState(false);
  const [adjError, setAdjError] = useState<string | null>(null);

  // ── Search & filter ──
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'cartons' | 'pieces' | 'margin'>('name');

  // ── Success toast ──
  const [toast, setToast] = useState<string | null>(null);

  const { can } = usePermissions();
  const [rightCollapsed, setRightCollapsed] = useState(false);

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
      const [data, rates] = await Promise.all([getInventory(), getMovementRates()]);
      setInventory(data);
      setMovementRates(rates);
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
    setAdjType('recount');
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

      const ppc = adjustRow.pieces_per_carton || 1;
      const totalPieceDelta = cartonDelta * ppc + pieceDelta;

      await insertStockAdjustment({
        product_id: adjustRow.product_id,
        adjustment_pieces: totalPieceDelta,
        reason: `[${adjType.toUpperCase()}] ${adjReason.trim()}`,
        adjusted_by: 'admin',
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

  const visibleInventory = inventory
    .filter(row => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || row.name.toLowerCase().includes(q) || row.item_code.toLowerCase().includes(q) || (row.model || '').toLowerCase().includes(q);
      const matchesFilter = !filterLowStock || computeStock(row).totalPieces < threshold;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (sortBy === 'cartons') return computeStock(b).availCartons - computeStock(a).availCartons;
      if (sortBy === 'pieces')  return computeStock(b).totalPieces  - computeStock(a).totalPieces;
      if (sortBy === 'margin')  return (b.retail_price - b.wholesale_price) - (a.retail_price - a.wholesale_price);
      return a.name.localeCompare(b.name);
    });

  const hasActiveFilters = filterLowStock || sortBy !== 'name' || searchQuery !== '';
  const clearFilters = () => { setFilterLowStock(false); setSortBy('name'); setSearchQuery(''); };

  return (
    <div className={cn("pos-page-grid", rightCollapsed && "right-collapsed")}>
      <section className="pos-main">
        <div className="pos-main-head">
          <label className="pos-search">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search stock..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </label>
          <div className="pos-mode-toggle">
            <button
              className={cn('flex items-center gap-2', (filterOpen || hasActiveFilters) && 'active')}
              onClick={() => setFilterOpen(p => !p)}
            >
              <Filter size={14} />
              Filter
              {hasActiveFilters && (
                <span className="w-4 h-4 rounded-full bg-white/20 text-[9px] font-black flex items-center justify-center">
                  {[filterLowStock, sortBy !== 'name', searchQuery !== ''].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Filter Panel ── */}
        {filterOpen && (
          <div className="mx-3 mb-3 rounded-2xl border border-[#2b313a] bg-[#13181f] overflow-hidden" style={{ animation: 'posFadeIn 180ms ease' }}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#2b313a]">
              <div className="flex items-center gap-4">
                {/* Stock level */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Stock</span>
                  <div className="flex gap-1">
                    {([
                      { key: false, label: 'All' },
                      { key: true,  label: 'Low Stock' },
                    ] as const).map(opt => (
                      <button
                        key={String(opt.key)}
                        onClick={() => setFilterLowStock(opt.key)}
                        className={cn(
                          'px-3 py-1 rounded-lg text-[11px] font-bold transition-all',
                          filterLowStock === opt.key
                            ? 'bg-[#f8fafc] text-[#111315]'
                            : 'bg-[#1d222a] text-gray-400 hover:text-white border border-[#2b313a]'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="w-px h-5 bg-[#2b313a]" />

                {/* Sort */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    <ArrowUpDown size={12} className="inline mr-1 -translate-y-px" />Sort
                  </span>
                  <div className="flex gap-1">
                    {([
                      { key: 'name',    label: 'Name' },
                      { key: 'cartons', label: 'Cartons' },
                      { key: 'pieces',  label: 'Pieces' },
                      { key: 'margin',  label: 'Margin' },
                    ] as const).map(s => (
                      <button
                        key={s.key}
                        onClick={() => setSortBy(s.key)}
                        className={cn(
                          'px-3 py-1 rounded-lg text-[11px] font-bold transition-all',
                          sortBy === s.key
                            ? 'bg-[#f8fafc] text-[#111315]'
                            : 'bg-[#1d222a] text-gray-400 hover:text-white border border-[#2b313a]'
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-gray-500">
                  {visibleInventory.length} of {inventory.length}
                </span>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-900/20 text-red-400 text-[11px] font-bold hover:bg-red-900/30 transition-all border border-red-900/30"
                  >
                    <X size={11} /> Clear
                  </button>
                )}
                <button onClick={() => setFilterOpen(false)} className="text-gray-600 hover:text-gray-300 transition-colors">
                  <X size={15} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Loading State ── */}
        {loading && (
          <div className="pos-product-grid px-3 overflow-y-auto pb-8 custom-scrollbar">
            <div className="pos-skeleton-products mt-2 w-full">
              <div className="w-full h-[400px] rounded-xl skeleton hover:bg-transparent border-0"></div>
            </div>
          </div>
        )}

        {/* ── Error State ── */}
        {error && !loading && (
          <div className="pos-product-grid px-3">
            <div className="flex flex-col items-center justify-center py-32 gap-4 w-full" style={{ animation: 'posFadeIn 380ms ease' }}>
              <div className="w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center border border-red-900/50">
                <AlertTriangle size={28} className="text-red-400" />
              </div>
              <p className="text-sm font-semibold text-red-400">{error}</p>
              <button 
                onClick={fetchInventory}
                className="px-6 py-3 bg-[#1d222a] text-white rounded-2xl font-bold text-sm border border-[#2b313a] hover:bg-[#2b313a] transition-all"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* ── Empty State ── */}
        {!loading && !error && inventory.length === 0 && (
          <div className="pos-product-grid px-3">
            <div className="flex flex-col items-center justify-center py-32 gap-4 w-full" style={{ animation: 'posFadeIn 380ms ease' }}>
              <div className="w-16 h-16 rounded-full bg-[#1d222a] flex items-center justify-center border border-[#2b313a]">
                <Package size={28} className="text-gray-500" />
              </div>
              <p className="text-sm font-semibold text-gray-500">No inventory data yet. Add products and stock batches first.</p>
            </div>
          </div>
        )}

        {/* ── Inventory Table ── */}
        {!loading && !error && inventory.length > 0 && (
          <div className="pos-product-grid px-3 overflow-y-auto pb-8 custom-scrollbar block">
            <div className="bg-[#171c23] rounded-2xl border border-[#2b313a] overflow-hidden w-full">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[1000px] text-left border-collapse" id="inventory-table">
                  <thead>
                    <tr className="bg-[#1d222a] border-b border-[#2b313a]">
                    <th className="px-8 py-6 text-[11px] font-bold text-gray-500 uppercase tracking-widest">Item Code</th>
                    <th className="px-8 py-6 text-[11px] font-bold text-gray-500 uppercase tracking-widest text-left">
                      <div className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                        Product Name <ArrowUpDown size={14} />
                      </div>
                    </th>
                    <th className="px-8 py-6 text-[11px] font-bold text-gray-500 uppercase tracking-widest text-left">Model</th>
                    <th className="px-8 py-6 text-[11px] font-bold text-gray-500 uppercase tracking-widest text-right">Cartons</th>
                    <th className="px-8 py-6 text-[11px] font-bold text-gray-500 uppercase tracking-widest text-right">Pieces</th>
                    <th className="px-8 py-6 text-[11px] font-bold text-gray-500 uppercase tracking-widest text-right">Wholesale</th>
                    <th className="px-8 py-6 text-[11px] font-bold text-gray-500 uppercase tracking-widest text-right">Retail</th>
                    <th className="px-8 py-6 text-[11px] font-bold text-gray-500 uppercase tracking-widest text-right">Margin</th>
                    <th className="px-8 py-6 text-[11px] font-bold text-gray-500 uppercase tracking-widest text-right">30d Sales</th>
                    <th className="px-8 py-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2b313a]">
                  <AnimatePresence>
                    {visibleInventory.map((row) => {
                      const stock = computeStock(row);
                      const isLowStock = stock.totalPieces < threshold;

                      return (
                        <motion.tr 
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          key={row.product_id} 
                          className={cn(
                            "hover:bg-[#1d222a] transition-colors group cursor-pointer border-b border-[#2b313a] last:border-0",
                            isLowStock && "bg-indigo-900/10 hover:bg-indigo-900/20"
                          )}
                        >
                        <td className="px-8 py-6 text-xs font-bold text-primary font-mono tracking-tighter uppercase">
                          {row.item_code}
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div>
                              <p className="text-sm font-bold text-white leading-tight">{row.name}</p>
                              <p className="text-[11px] text-gray-500 font-semibold uppercase mt-1 tracking-wider">{row.category}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-left">
                          <span className="text-xs font-bold text-gray-400">{row.model}</span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <span className={cn(
                            "text-sm font-bold",
                            isLowStock ? "text-indigo-400" : "text-white"
                          )}>
                            {stock.availCartons}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <span className={cn(
                            "text-sm font-bold",
                            isLowStock ? "text-indigo-400" : "text-white"
                          )}>
                            {stock.availLoose}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <span className="text-sm font-bold text-gray-300">LKR {row.wholesale_price.toFixed(2)}</span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <span className="text-sm font-bold text-primary">LKR {row.retail_price.toFixed(2)}</span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-sm font-bold text-primary">LKR {(row.retail_price - row.wholesale_price).toFixed(2)}</span>
                            <span className="text-[10px] font-semibold text-gray-500">
                              {row.wholesale_price > 0 ? Math.round(((row.retail_price - row.wholesale_price) / row.wholesale_price) * 100) : 0}%
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          {movementRates[row.product_id] ? (
                            <div className="flex flex-col items-end">
                              <span className="text-sm font-bold text-emerald-400">{movementRates[row.product_id].units30d}</span>
                              <span className="text-[10px] font-semibold text-gray-500">{movementRates[row.product_id].perDay}/day</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            {can('manage_inventory') && (
                              <button
                                onClick={(e) => { e.stopPropagation(); openAdjustModal(row); }}
                                className="px-4 py-2 rounded-xl text-[11px] font-bold text-gray-400 bg-[#1d222a] border border-[#2b313a] hover:text-white hover:bg-[#2b313a] transition-all opacity-0 group-hover:opacity-100"
                              >
                                Adjust
                              </button>
                            )}
                            <div className="p-3 rounded-2xl text-gray-500 bg-[#1d222a] border border-[#2b313a] hover:text-white hover:bg-[#2b313a] transition-all opacity-0 group-hover:opacity-100 inline-flex">
                              <ChevronRight size={18} />
                            </div>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            </div>
          </div>
        )}
      </section>

      <aside className="pos-bill">
        <button
          type="button"
          onClick={() => setRightCollapsed((prev) => !prev)}
          className="pos-bill-collapse-toggle"
          aria-label={rightCollapsed ? 'Expand right panel' : 'Collapse right panel'}
          title={rightCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {rightCollapsed ? <PanelRightOpen size={15} /> : <PanelRightClose size={15} />}
        </button>

        <div className="pos-bill-inner">
        <div className="pos-bill-head flex flex-col items-start gap-1 pb-6 border-b border-[#1f242c]">
          <h2 className="text-xl font-bold tracking-tight">Stock Control</h2>
          <p className="text-xs font-semibold text-gray-500">Configure global rules</p>
        </div>

        <div className="mt-6">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-3">Global Low Stock Threshold</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              value={threshold}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setThreshold(isNaN(val) ? 0 : val);
              }}
              className="flex-1 text-sm font-bold text-white bg-[#171c23] rounded-xl px-4 py-3 outline-none border border-[#2b313a] focus:border-primary/50 transition-all"
            />
            <button
              onClick={() => setToast(`Low stock threshold set to ${threshold} units`)}
              className="p-3 bg-[#1d222a] border border-[#2b313a] text-gray-300 rounded-xl hover:text-white hover:bg-[#2b313a] transition-all"
            >
              <Check size={18} />
            </button>
          </div>
          <p className="text-[10px] text-gray-500 font-medium mt-2">Any item dropping below this quantity will flag as low stock across the system.</p>
        </div>

        <div className="mt-8 border-t border-[#1f242c] pt-6">
          <div className="bg-indigo-900/10 border border-indigo-900/30 rounded-xl p-4">
            <h4 className="text-sm font-bold text-white mb-1"><AlertTriangle size={14} className="inline text-indigo-400 mr-2 -translate-y-0.5" />Action Required</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              You have {inventory.filter(i => computeStock(i).totalPieces < threshold).length} items currently sitting below your safe threshold of {threshold}.
            </p>
            <button
              onClick={() => { setFilterLowStock(true); document.getElementById('inventory-table')?.scrollIntoView({ behavior: 'smooth' }); }}
              className="mt-3 text-[11px] font-bold text-indigo-400 uppercase tracking-wider hover:text-indigo-300 transition-colors"
            >
              Review flagged stock <ArrowRight size={14} className="inline ml-1" />
            </button>
          </div>
        </div>

        <div className="mt-auto pt-6">
           <button type="button" className="pos-submit" onClick={() => fetchInventory()}>
             Refresh Inventory
           </button>
        </div>
        </div>
      </aside>

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

            {/* Adjustment type */}
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Adjustment Type</label>
              <div className="grid grid-cols-4 gap-2">
                {([
                  { key: 'recount',  label: 'Recount',  color: 'blue'   },
                  { key: 'damage',   label: 'Damage',   color: 'red'    },
                  { key: 'return',   label: 'Return',   color: 'green'  },
                  { key: 'other',    label: 'Other',    color: 'gray'   },
                ] as const).map(t => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setAdjType(t.key)}
                    className={cn(
                      'py-2 rounded-xl text-[11px] font-bold border transition-all',
                      adjType === t.key
                        ? t.key === 'damage'  ? 'bg-red-900/30 text-red-400 border-red-900/50'
                        : t.key === 'return'  ? 'bg-emerald-900/30 text-emerald-400 border-emerald-900/50'
                        : t.key === 'recount' ? 'bg-blue-900/30 text-blue-400 border-blue-900/50'
                        : 'bg-[#2b313a] text-white border-[#3a424f]'
                        : 'bg-[#1d222a] text-gray-500 border-[#2b313a] hover:text-gray-300'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {adjType === 'damage' && (
                <p className="text-[10px] text-red-400 font-semibold mt-2">Use a negative delta to remove damaged units from stock.</p>
              )}
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
                className="flex-1 px-6 py-3.5 bg-[#d7e5e8] text-[#1f2937] border border-[#c4d7db] rounded-2xl font-bold text-sm hover:bg-[#cbe0e4] transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjustSubmit}
                disabled={adjSaving}
                className="flex-1 h-[56px] bg-[#e6d3f0] text-[#312e81] border border-[#d7bde6] rounded-2xl font-bold text-sm hover:bg-[#dcc4ed] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center relative overflow-hidden active:scale-[0.98]"
              >
                <AnimatePresence mode="wait">
                  {adjSaving ? (
                    <motion.div key="spinner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute">
                      <Loader2 size={20} className="animate-spin" />
                    </motion.div>
                  ) : (
                    <motion.div key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute">
                      Save Adjustment
                    </motion.div>
                  )}
                </AnimatePresence>
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



