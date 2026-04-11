import React, { useState } from 'react';
import { PRODUCTS } from '../data/mockData';
import { TopBar } from '../components/TopBar';
import { Plus, Edit2, Trash2, MoreVertical, Package, Hash, Tag, Type, AlignLeft } from 'lucide-react';
import { Modal } from '../components/Modal';

export const ProductsPage: React.FC = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const handleEdit = (product: any) => {
    setEditingProduct(product);
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
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-3xl font-bold text-sm shadow-xl shadow-orange-100 hover:bg-orange-600 transition-all active:scale-[0.98]"
          >
            <Plus size={22} strokeWidth={2.5} /> ADD NEW ITEM
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {PRODUCTS.map((product) => (
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
      </div>

      {/* ADD/EDIT MODAL */}
      <Modal 
        isOpen={isAddModalOpen || !!editingProduct}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingProduct(null);
        }}
        title={editingProduct ? "Edit Product" : "Add New Product"}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                <Type size={12} className="text-primary" /> Product Name
              </label>
              <input 
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
              defaultValue={editingProduct?.description || ''}
              placeholder="Brief overview of the digital product..." 
              rows={3}
              className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all resize-none"
            />
          </div>

          <div className="pt-4 grid grid-cols-2 gap-4">
            <button 
              onClick={() => {
                setIsAddModalOpen(false);
                setEditingProduct(null);
              }}
              className="w-full py-4 rounded-2xl border-2 border-border/50 text-sm font-bold text-gray-400 hover:text-dark hover:border-dark/20 transition-all"
            >
              CANCEL
            </button>
            <button className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-sm shadow-xl shadow-orange-100 hover:bg-orange-600 transition-all active:scale-[0.98]">
              {editingProduct ? "SAVE CHANGES" : "ADD PRODUCT"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
