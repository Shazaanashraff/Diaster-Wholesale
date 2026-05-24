import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../components/Modal';
import type { Product } from '../types';
import { getProducts, createProduct, updateProduct, checkDuplicate, archiveProduct, deleteProduct, getProductLinkCounts, clearProductStockAdjustments } from '../services/productService';
import { insertStockAdjustment } from '../services/inventoryService';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Plus, Edit2, Trash2, MoreVertical, Package, Hash, Tag, Type, AlignLeft, Loader2, AlertTriangle, RefreshCw, X, ArrowUpDown } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { usePermissions } from '../utils/permissions';

export const ProductsPage: React.FC = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // ── Live data state ──
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Confirm delete ──
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<Product | null>(null);
  const [hardDeleteError, setHardDeleteError] = useState<string | null>(null);
  const [hardDeleteLoading, setHardDeleteLoading] = useState(false);

  // ── Form submission state ──
  const [saving, setSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Form refs ──
  const nameRef = useRef<HTMLInputElement>(null);
  const wholesaleRef = useRef<HTMLInputElement>(null);
  const retailRef = useRef<HTMLInputElement>(null);
  const costPriceRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const piecesPerCartonRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);

  // ── Search & filter ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'wholesale' | 'retail'>('name');

  const { role } = usePermissions();
  const isAdmin = role === 'admin';

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(searchQuery), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const visibleProducts = useMemo(() => products
    .filter(p => {
      const q = searchDebounced.toLowerCase();
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.item_code.toLowerCase().includes(q);
      const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'wholesale') return a.wholesale_price - b.wholesale_price;
      if (sortBy === 'retail')    return a.retail_price   - b.retail_price;
      return a.name.localeCompare(b.name);
    }), [products, searchDebounced, filterCategory, sortBy]);

  const hasActiveFilters = filterCategory !== 'all' || sortBy !== 'name' || searchQuery !== '';
  const clearFilters = () => { setFilterCategory('all'); setSortBy('name'); setSearchQuery(''); };

  // ── Fetch products on mount ──
  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      setLoading(true);
      setError(null);
      const data = await getProducts();
      setProducts(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load products';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setDuplicateWarning(null);
  };

  const closeModal = () => {
    setIsAddModalOpen(false);
    setEditingProduct(null);
    setDuplicateWarning(null);
  };

  const handleSubmit = async () => {
    const name = nameRef.current?.value.trim() || '';
    const wholesale_price = parseFloat(wholesaleRef.current?.value || '0');
    const retail_price = parseFloat(retailRef.current?.value || '0');
    const cost_price = parseFloat(costPriceRef.current?.value || '0') || 0;
    const description = descriptionRef.current?.value.trim() || '';
    const pieces_per_carton = parseInt(piecesPerCartonRef.current?.value || '1') || 1;
    const quantity = Math.max(0, parseInt(quantityRef.current?.value || '0', 10) || 0);

    if (!name) return;

    let createdProduct: Product | null = null;

    try {
      setSaving(true);

      if (editingProduct) {
        // ── UPDATE ──
        const updated = await updateProduct(editingProduct.id, {
          name,
          model: '',
          wholesale_price,
          retail_price,
          cost_price,
          description,
          pieces_per_carton,
        });
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } else {
        // ── Duplicate check ──
        const duplicates = await checkDuplicate(name);
        if (duplicates.length > 0) {
          setDuplicateWarning(
            `"${name}" already exists as ${duplicates[0].item_code}. Click Save again to confirm.`
          );
          if (!duplicateWarning) { setSaving(false); return; }
        }

        const newProduct = await createProduct({
          name,
          model: '',
          wholesale_price,
          retail_price,
          cost_price,
          description,
          category: 'general',
          pieces_per_carton,
        });
        createdProduct = newProduct;

        if (quantity > 0) {
          await insertStockAdjustment({
            product_id: newProduct.id,
            adjustment_pieces: quantity,
            reason: '[CREATE] Initial quantity at product creation',
            adjusted_by: 'admin',
          });
        }

        setProducts((prev) => [...prev, newProduct].sort((a, b) => a.name.localeCompare(b.name)));
      }

      closeModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Operation failed';
      if (!createdProduct) {
        setError(message);
        return;
      }

      const created = createdProduct;
      setProducts((prev) =>
        prev.some((p) => p.id === created.id)
          ? prev
          : [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      closeModal();
      setError(`Product saved, but quantity was not saved: ${message}`);
      return;
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRequest = (product: Product) => {
    setDeleteTarget(product);
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setSaving(true);
      setDeleteError(null);
      await archiveProduct(deleteTarget.id);
      setProducts(prev => prev.filter(p => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: any) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to archive product');
    } finally {
      setSaving(false);
    }
  };

  const handleHardDeleteRequest = (product: Product) => {
    setHardDeleteTarget(product);
    setHardDeleteError(null);
  };

  const handleHardDelete = async () => {
    if (!hardDeleteTarget) return;
    try {
      setHardDeleteLoading(true);
      setHardDeleteError(null);

      // Clear stock adjustments before delete (they reference the product)
      const counts = await getProductLinkCounts(hardDeleteTarget.id);
      if ((counts.stock_adjustments ?? 0) > 0) {
        await clearProductStockAdjustments(hardDeleteTarget.id);
      }

      // Delete the product; stock_batches and other linked records with ON DELETE CASCADE will be removed automatically
      await deleteProduct(hardDeleteTarget.id);
      setProducts(prev => prev.filter(p => p.id !== hardDeleteTarget.id));
      setHardDeleteTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Hard delete failed';
      setHardDeleteError(message);
    } finally {
      setHardDeleteLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-transparent">
      <section className="pos-main flex-1 border-r-0 max-w-full">
        <div className="pos-main-head w-full max-w-7xl mx-auto px-3">
          <label className="pos-search">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search catalog..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </label>
          <div className="pos-mode-toggle">
            <button
              onClick={() => fetchProducts()}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#1d222a] rounded-lg transition-colors border border-transparent hover:border-[#2b313a] text-gray-400 hover:text-white"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <div className="w-[1px] h-4 bg-[#2b313a] mx-1" />
            <button
              onClick={() => setFilterOpen(p => !p)}
              className={`flex items-center gap-2 ${(filterOpen || hasActiveFilters) ? 'active' : ''}`}
            >
              <Filter size={14} />
              Filter
              {hasActiveFilters && (
                <span className="w-4 h-4 rounded-full bg-white/20 text-[9px] font-black flex items-center justify-center">
                  {[filterCategory !== 'all', sortBy !== 'name', searchQuery !== ''].filter(Boolean).length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setIsAddModalOpen(true); setDuplicateWarning(null); }}
              className="active flex items-center gap-2 text-[#111315] ml-2 hover:opacity-80 transition-opacity whitespace-nowrap"
            >
              <Plus size={16} strokeWidth={3} />
              <span className="text-xs font-bold uppercase tracking-widest">New</span>
            </button>
          </div>
        </div>

        {/* ── Filter Panel ── */}
        {filterOpen && (
          <div className="mx-3 mb-3 rounded-2xl border border-[#2b313a] bg-[#13181f] overflow-hidden" style={{ animation: 'posFadeIn 180ms ease' }}>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-[#2b313a]">
              <div className="flex flex-wrap items-center gap-4">

                {/* Category chips */}
                {categories.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Category</span>
                    <div className="flex flex-wrap gap-1">
                      {categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setFilterCategory(cat)}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                            filterCategory === cat
                              ? 'bg-[#f8fafc] text-[#111315]'
                              : 'bg-[#1d222a] text-gray-400 hover:text-white border border-[#2b313a]'
                          }`}
                        >
                          {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {categories.length > 1 && <div className="w-px h-5 bg-[#2b313a]" />}

                {/* Sort */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    <ArrowUpDown size={12} className="inline mr-1 -translate-y-px" />Sort
                  </span>
                  <div className="flex gap-1">
                    {([
                      { key: 'name',      label: 'Name' },
                      { key: 'wholesale', label: 'Wholesale ↑' },
                      { key: 'retail',    label: 'Selling ↑' },
                    ] as const).map(s => (
                      <button
                        key={s.key}
                        onClick={() => setSortBy(s.key)}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                          sortBy === s.key
                            ? 'bg-[#f8fafc] text-[#111315]'
                            : 'bg-[#1d222a] text-gray-400 hover:text-white border border-[#2b313a]'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-gray-500">
                  {visibleProducts.length} of {products.length}
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
          <div className="pos-product-grid px-3 overflow-y-auto pb-8 custom-scrollbar block">
            <div className="grid grid-cols-1 gap-4 w-full mt-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-32 rounded-xl skeleton hover:bg-transparent border-0" style={{ animationDelay: `${i * 100}ms` }} />
              ))}
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
                onClick={fetchProducts}
                className="px-6 py-3 bg-[#1d222a] text-white rounded-2xl font-bold text-sm border border-[#2b313a] hover:bg-[#2b313a] transition-all"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* ── Empty State ── */}
        {!loading && !error && products.length === 0 && (
          <div className="pos-product-grid px-3">
            <div className="flex flex-col items-center justify-center py-32 gap-4 w-full" style={{ animation: 'posFadeIn 380ms ease' }}>
              <div className="w-16 h-16 rounded-full bg-[#1d222a] flex items-center justify-center border border-[#2b313a]">
                <Package size={28} className="text-gray-500" />
              </div>
              <p className="text-sm font-semibold text-gray-500">No products yet. Add your first item!</p>
            </div>
          </div>
        )}

        {/* ── Product List ── */}
        {!loading && !error && products.length > 0 && (
          <div className="px-3 overflow-y-auto pb-8 custom-scrollbar">
            <div className="grid grid-cols-1 gap-6 w-full mt-2 max-w-7xl mx-auto">
              <AnimatePresence>
                {visibleProducts.map((product) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0, overflow: 'hidden' }}
                    transition={{ duration: 0.2 }}
                    key={product.id} 
                    className="bg-[#171c23] rounded-[2rem] p-6 flex flex-row items-center justify-between hover:border-primary/50 transition-all duration-300 group border border-[#2b313a]"
                  >
                    <div className="flex items-center gap-8">
                      <div>
                        <div className="flex items-center gap-4 mb-3">
                          <h3 className="text-xl font-bold text-white">{product.name}</h3>
                          <span className="px-3 py-1 bg-[#1d222a] border border-[#2b313a] text-[9px] font-bold text-gray-400 uppercase rounded-full tracking-widest">{product.category}</span>
                        </div>
                        <div className="flex items-center gap-6 text-gray-500">
                          <div className="flex flex-col">
                            <span className="text-[9px] uppercase font-bold tracking-widest text-gray-600">Item Code</span>
                            <p className="text-xs font-bold text-primary font-mono">{product.item_code}</p>
                          </div>
                          <div className="w-px h-6 bg-[#2b313a]"></div>
                          <div className="flex flex-col">
                            <span className="text-[9px] uppercase font-bold tracking-widest text-gray-600">Qty / Carton</span>
                            <p className="text-xs font-bold text-gray-300">{product.pieces_per_carton || 1}</p>
                          </div>
                          <div className="w-px h-6 bg-[#2b313a]"></div>
                          <p className="text-xs font-semibold text-gray-500 max-w-sm line-clamp-1 italic">
                            {product.description || 'No description'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-10">
                      {(product.cost_price ?? 0) > 0 && (
                        <div className="text-right">
                          <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest mb-1.5 leading-none">Cost Price</p>
                          <p className="text-sm font-bold text-amber-400 font-mono">LKR {product.cost_price!.toFixed(2)}</p>
                        </div>
                      )}
                      <div className="text-right">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1.5 leading-none">Wholesale</p>
                        <p className="text-xl font-bold text-gray-300 tracking-tighter">LKR {product.wholesale_price.toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-primary font-bold uppercase tracking-widest mb-1.5 leading-none">Selling</p>
                        <p className="text-2xl font-bold text-primary tracking-tighter">LKR {product.retail_price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => handleEdit(product)}
                          className="w-12 h-12 rounded-2xl bg-[#1d222a] text-gray-400 hover:text-white hover:bg-[#2b313a] transition-all flex items-center justify-center border border-[#2b313a]"
                        >
                          <Edit2 size={20} />
                        </button>
                        <button 
                          onClick={() => handleDeleteRequest(product)}
                          className="w-12 h-12 rounded-2xl bg-[#1d222a] text-gray-400 hover:text-red-400 hover:bg-red-900/30 transition-all flex items-center justify-center border border-[#2b313a]">
                          <Trash2 size={20} />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleHardDeleteRequest(product)}
                            className="w-12 h-12 rounded-2xl bg-[#1d222a] text-red-500 hover:text-red-300 hover:bg-red-900/40 transition-all flex items-center justify-center border border-red-900/40"
                            title="Hard delete product"
                          >
                            <AlertTriangle size={20} />
                          </button>
                        )}
                        <div className="w-px h-8 bg-[#2b313a]"></div>
                        <button onClick={() => handleEdit(product)} className="w-12 h-12 rounded-2xl bg-[#1d222a] border border-[#2b313a] text-gray-400 hover:text-white transition-all flex items-center justify-center" title="More options">
                          <MoreVertical size={20} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </section>

      {/* ADD/EDIT MODAL */}
      <Modal 
        isOpen={isAddModalOpen || !!editingProduct}
        onClose={closeModal}
        title={editingProduct ? "Edit Product" : "Add New Product"}
      >
        <div className="space-y-6">
          {/* ── Duplicate Warning Banner ── */}
          {duplicateWarning && (
            <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl">
              <AlertTriangle size={18} className="text-indigo-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-indigo-700">{duplicateWarning}</p>
                <p className="text-[11px] text-indigo-500 mt-1">Click "ADD PRODUCT" again to confirm.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                <Type size={12} className="text-primary" /> Product Name
              </label>
              <input 
                ref={nameRef}
                type="text" 
                defaultValue={editingProduct?.name || ''}
                placeholder="e.g. Photoshop License" 
                className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                <Hash size={12} className="text-primary" /> Item Code
              </label>
              <div className="w-full bg-accent border-2 border-transparent rounded-2xl py-4 px-6 text-sm font-semibold font-mono text-gray-500">
                {editingProduct?.item_code || 'Auto-generated on save'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                <Tag size={12} className="text-primary" /> Wholesale Price (LKR)
              </label>
              <input
                ref={wholesaleRef}
                type="number"
                defaultValue={editingProduct?.wholesale_price || ''}
                placeholder="0.00"
                className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                <Tag size={12} className="text-primary" /> Selling Price (LKR)
              </label>
              <input
                ref={retailRef}
                type="number"
                defaultValue={editingProduct?.retail_price || ''}
                placeholder="0.00"
                className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                <Tag size={12} className="text-primary" /> Cost Price (LKR)
              </label>
              <input
                ref={costPriceRef}
                type="number"
                defaultValue={editingProduct?.cost_price || ''}
                placeholder="0.00"
                className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                <Package size={12} className="text-primary" /> Qty per Carton
              </label>
              <input
                ref={piecesPerCartonRef}
                type="number"
                min="1"
                defaultValue={editingProduct?.pieces_per_carton || 1}
                placeholder="1"
                className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all font-mono"
              />
            </div>
            {!editingProduct && (
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                  <Hash size={12} className="text-primary" /> Qty (pieces)
                </label>
                <input
                  ref={quantityRef}
                  type="number"
                  min="0"
                  defaultValue={0}
                  placeholder="0"
                  className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all font-mono"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
              <AlignLeft size={12} className="text-primary" /> Description
            </label>
            <textarea 
              ref={descriptionRef}
              defaultValue={editingProduct?.description || ''}
              placeholder="Optional notes..." 
              rows={3}
              className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all resize-none"
            />
          </div>

          <div className="pt-4 grid grid-cols-2 gap-4">
            <button 
              onClick={closeModal}
              className="w-full py-4 rounded-2xl border border-[#2b313a] bg-[#1d222a] text-sm font-bold text-gray-400 hover:text-white hover:bg-[#252a33] transition-all"
            >
              CANCEL
            </button>
            <button 
              onClick={handleSubmit}
              disabled={saving}
              className="w-full h-[56px] bg-[#f8fafc] text-black border border-[#f8fafc] rounded-2xl font-bold text-sm hover:bg-white transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center relative overflow-hidden"
            >
              <AnimatePresence mode="wait">
                {saving ? (
                  <motion.div key="spinner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute">
                    <Loader2 size={20} className="animate-spin" />
                  </motion.div>
                ) : (
                  <motion.div key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute">
                    {editingProduct ? "SAVE CHANGES" : "ADD PRODUCT"}
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Confirm Archive ────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setDeleteError(null); }}
        onConfirm={handleDelete}
        title="Archive Product"
        message={`Are you sure you want to archive "${deleteTarget?.name}"? It will be hidden from the catalog and POS, but historical records will remain.`}
        confirmText="Archive Product"
        variant="warning"
        isLoading={saving}
        error={deleteError}
      />

      <ConfirmModal
        isOpen={!!hardDeleteTarget}
        onClose={() => { setHardDeleteTarget(null); setHardDeleteError(null); }}
        onConfirm={handleHardDelete}
        title="Hard Delete Product"
        message={`Permanently delete "${hardDeleteTarget?.name}". This cannot be undone. If only stock adjustments are linked, they will be cleared automatically.`}
        confirmText="Hard Delete"
        variant="danger"
        isLoading={hardDeleteLoading}
        error={hardDeleteError}
      />
    </div>
  );
};
