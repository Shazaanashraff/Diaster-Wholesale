import React, { useState, useEffect, useRef } from 'react';
import { TopBar } from '../components/TopBar';
import { Plus, Edit2, Trash2, MoreVertical, Package, Hash, Tag, Type, AlignLeft, Loader2, AlertTriangle } from 'lucide-react';
import { Modal } from '../components/Modal';
import type { Product } from '../types';
import { getProducts, createProduct, updateProduct, checkDuplicate } from '../services/productService';

export const ProductsPage: React.FC = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // ── Live data state ──
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Form submission state ──
  const [saving, setSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // ── Form refs ──
  const nameRef = useRef<HTMLInputElement>(null);
  const itemCodeRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<HTMLInputElement>(null);
  const wholesaleRef = useRef<HTMLInputElement>(null);
  const retailRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

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
    const item_code = itemCodeRef.current?.value.trim() || '';
    const model = modelRef.current?.value.trim() || '';
    const wholesale_price = parseFloat(wholesaleRef.current?.value || '0');
    const retail_price = parseFloat(retailRef.current?.value || '0');
    const description = descriptionRef.current?.value.trim() || '';

    if (!name || !item_code) return;

    try {
      setSaving(true);

      // ── Duplicate check (only when creating) ──
      if (!editingProduct) {
        const duplicates = await checkDuplicate(model, name);
        if (duplicates.length > 0) {
          setDuplicateWarning(
            `A product with name "${name}" and model "${model}" already exists (${duplicates[0].item_code}). Are you sure?`
          );
          // If warning is shown for the first time, stop and let user click again to confirm
          if (!duplicateWarning) {
            setSaving(false);
            return;
          }
        }
      }

      if (editingProduct) {
        // ── UPDATE ──
        const updated = await updateProduct(editingProduct.id, {
          name,
          item_code,
          model,
          wholesale_price,
          retail_price,
          description,
        });
        setProducts((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p))
        );
      } else {
        // ── CREATE ──
        const created = await createProduct({
          name,
          item_code,
          model,
          wholesale_price,
          retail_price,
          description,
          category: 'general',
          pieces_per_carton: 1,
        });
        setProducts((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      }

      closeModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Operation failed';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-accent">
      <TopBar />
      
      <div className="p-10">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-dark tracking-tight">Product Catalog</h1>
            <p className="text-gray-400 text-sm font-semibold mt-1">Add or update your digital goods and pricing.</p>
          </div>
          <button 
            onClick={() => { setIsAddModalOpen(true); setDuplicateWarning(null); }}
            className="flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-3xl font-bold text-sm shadow-xl shadow-orange-100 hover:bg-orange-600 transition-all active:scale-[0.98]"
          >
            <Plus size={22} strokeWidth={2.5} /> ADD NEW ITEM
          </button>
        </div>

        {/* ── Loading State ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 size={36} className="animate-spin text-primary" />
            <p className="text-sm font-semibold text-gray-400">Loading products...</p>
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
              onClick={fetchProducts}
              className="px-6 py-3 bg-primary text-white rounded-2xl font-bold text-sm hover:bg-orange-600 transition-all"
            >
              Try Again
            </button>
          </div>
        )}

        {/* ── Empty State ── */}
        {!loading && !error && products.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center border border-border/50">
              <Package size={28} className="text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-400">No products yet. Add your first item!</p>
          </div>
        )}

        {/* ── Product List ── */}
        {!loading && !error && products.length > 0 && (
          <div className="grid grid-cols-1 gap-6">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-[2rem] p-6 flex items-center justify-between hover:border-primary/20 transition-all duration-300 group shadow-sm border border-border/50">
                <div className="flex items-center gap-8">
                  <div>
                    <div className="flex items-center gap-4 mb-3">
                      <h3 className="text-xl font-bold text-dark">{product.name}</h3>
                      <span className="px-3 py-1 bg-accent border border-border text-[9px] font-bold text-gray-500 uppercase rounded-full tracking-widest">{product.category}</span>
                    </div>
                    <div className="flex items-center gap-6 text-gray-400">
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase font-bold tracking-widest text-gray-300">Item Code</span>
                        <p className="text-xs font-bold text-primary font-mono">{product.item_code}</p>
                      </div>
                      <div className="w-px h-6 bg-border"></div>
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase font-bold tracking-widest text-gray-300">Model</span>
                        <p className="text-xs font-bold text-dark">{product.model}</p>
                      </div>
                      <div className="w-px h-6 bg-border"></div>
                      <p className="text-xs font-semibold text-gray-400 max-w-sm line-clamp-1 italic">{product.description}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-16">
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5 leading-none">Wholesale</p>
                    <p className="text-xl font-bold text-dark tracking-tighter">LKR {product.wholesale_price.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-primary font-bold uppercase tracking-widest mb-1.5 leading-none">Retail</p>
                    <p className="text-2xl font-bold text-primary tracking-tighter">LKR {product.retail_price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => handleEdit(product)}
                      className="w-12 h-12 rounded-2xl bg-accent text-gray-400 hover:text-dark hover:bg-gray-200 transition-all flex items-center justify-center"
                    >
                      <Edit2 size={20} />
                    </button>
                    <button className="w-12 h-12 rounded-2xl bg-accent text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center">
                      <Trash2 size={20} />
                    </button>
                    <div className="w-px h-8 bg-border"></div>
                    <button className="w-12 h-12 rounded-2xl bg-white border border-border text-gray-400 hover:text-dark transition-all flex items-center justify-center shadow-sm">
                      <MoreVertical size={20} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ADD/EDIT MODAL */}
      <Modal 
        isOpen={isAddModalOpen || !!editingProduct}
        onClose={closeModal}
        title={editingProduct ? "Edit Product" : "Add New Product"}
      >
        <div className="space-y-6">
          {/* ── Duplicate Warning Banner ── */}
          {duplicateWarning && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
              <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-700">{duplicateWarning}</p>
                <p className="text-[11px] text-amber-500 mt-1">Click "ADD PRODUCT" again to confirm.</p>
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
              <input 
                ref={itemCodeRef}
                type="text" 
                defaultValue={editingProduct?.item_code || ''}
                placeholder="e.g. SOFT-PS-001" 
                className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
              <Package size={12} className="text-primary" /> Model / Version
            </label>
            <input 
              ref={modelRef}
              type="text" 
              defaultValue={editingProduct?.model || ''}
              placeholder="e.g. 2024 Pro Edition" 
              className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
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
                <Tag size={12} className="text-primary" /> Retail Price (LKR)
              </label>
              <input 
                ref={retailRef}
                type="number" 
                defaultValue={editingProduct?.retail_price || ''}
                placeholder="0.00" 
                className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
              <AlignLeft size={12} className="text-primary" /> Description
            </label>
            <textarea 
              ref={descriptionRef}
              defaultValue={editingProduct?.description || ''}
              placeholder="Brief overview of the digital product..." 
              rows={3}
              className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all resize-none"
            />
          </div>

          <div className="pt-4 grid grid-cols-2 gap-4">
            <button 
              onClick={closeModal}
              className="w-full py-4 rounded-2xl border-2 border-border/50 text-sm font-bold text-gray-400 hover:text-dark hover:border-dark/20 transition-all"
            >
              CANCEL
            </button>
            <button 
              onClick={handleSubmit}
              disabled={saving}
              className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-sm shadow-xl shadow-orange-100 hover:bg-orange-600 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {editingProduct ? "SAVE CHANGES" : "ADD PRODUCT"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
