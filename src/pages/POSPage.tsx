import React, { useState, useMemo } from 'react';
import { 
  CATEGORIES, 
  PRODUCTS, 
} from '../data/mockData';
import type { Product } from '../data/mockData';
import { TopBar } from '../components/TopBar';
import { 
  Plus, 
  Minus, 
  ChevronRight,
  Calculator,
  Wallet,
  CreditCard,
  Table as TableIcon,
  CheckCircle2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Modal } from '../components/Modal';

interface CartItem {
  product: Product;
  quantity: number;
}

export const POSPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery] = useState('');
  
  const [productQuantities, setProductQuantities] = useState<Record<string, number>>(
    Object.fromEntries(PRODUCTS.map(p => [p.id, 0]))
  );

  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    return PRODUCTS.filter(p => {
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);



  const updateProductQuantity = (productId: string, delta: number) => {
    setProductQuantities(prev => ({
      ...prev,
      [productId]: Math.max(0, prev[productId] + delta)
    }));
  };

  const addToCart = (product: Product) => {
    const qty = productQuantities[product.id] || 0;
    if (qty === 0) return;

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + qty } 
            : item
        );
      }
      return [...prev, { product, quantity: qty }];
    });
    
    // Reset product quantity after adding to cart
    setProductQuantities(prev => ({ ...prev, [product.id]: 0 }));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.product.retail_price * item.quantity), 0);
  const discount = subtotal > 50 ? 5.50 : 0;
  const tax = subtotal * 0.1;
  const total = subtotal - discount + tax;

  return (
    <div className="flex bg-accent min-h-screen">
      {/* LEFT: Sidebar is already in LayoutWrapper, but we handle the center + right here */}
      
      {/* CENTER: TopBar + Menu */}
      <div className="flex-1 flex flex-col min-w-0 pr-[400px]">
        <TopBar />
        
        <div className="p-10">
          <h2 className="text-2xl font-bold text-dark mb-8 tracking-tight">Categories</h2>
        <div className="flex gap-6 mb-12 overflow-x-auto pb-4 custom-scrollbar">
          {CATEGORIES.map(cat => (
            <div 
              key={cat.id} 
              onClick={() => setSelectedCategory(cat.id)}
              className={cn("category-card min-w-[140px]", selectedCategory === cat.id && "active")}
            >
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
                selectedCategory === cat.id ? "bg-white text-primary shadow-sm" : "bg-accent text-gray-400"
              )}>
                <cat.icon size={28} strokeWidth={2.5} />
              </div>
              <p className={cn("text-sm font-bold tracking-tight", selectedCategory === cat.id ? "text-primary" : "text-dark")}>
                {cat.name}
              </p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-dark tracking-tight">Select Menu</h2>
          <p className="text-gray-400 text-sm font-bold">Showing {filteredProducts.length} Items</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
          {filteredProducts.map(product => {
            const qty = productQuantities[product.id] || 0;
            
            return (
              <div key={product.id} className="bg-white rounded-[1.5rem] p-4 shadow-sm border border-border/50 group hover:shadow-xl hover:shadow-orange-100/20 transition-all duration-500 flex flex-col">
                <div className="mb-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <h3 className="text-[15px] font-bold text-dark leading-tight group-hover:text-primary transition-colors">{product.name}</h3>
                      <div className="flex flex-col gap-0.5 mt-1.5">
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                           Model: {product.model}
                        </p>
                        <p className="text-[8px] text-primary font-bold tracking-widest">
                           {product.item_code}
                        </p>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-primary tracking-tight shrink-0">LKR {product.retail_price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2 py-1.5 px-2.5 bg-accent rounded-lg border border-border/50 w-fit">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{product.category}</span>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-dashed border-border mb-4">


                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                       <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Amount</p>
                       <span className="text-[9px] font-black text-primary">{qty} PCS</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => updateProductQuantity(product.id, -1)}
                        className="flex-1 py-1.5 rounded-lg bg-accent flex items-center justify-center text-gray-400 hover:text-dark transition-all"
                      >
                        <Minus size={12} strokeWidth={3} />
                      </button>
                      <button 
                        onClick={() => updateProductQuantity(product.id, 1)}
                        className="flex-1 py-1.5 rounded-lg bg-primary text-white flex items-center justify-center hover:bg-orange-600 transition-all shadow-lg shadow-orange-100"
                      >
                        <Plus size={12} strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => addToCart(product)}
                  disabled={qty === 0}
                  className={cn(
                    "w-full py-3 rounded-xl font-bold text-[11px] tracking-widest transition-all active:scale-[0.98]",
                    qty === 0 
                      ? "bg-accent text-gray-300 pointer-events-none" 
                      : "bg-primary text-white hover:bg-orange-600 shadow-xl shadow-orange-100"
                  )}
                >
                  ADD TO CART
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>

    {/* RIGHT BILL PANEL */}
      <div className="w-[400px] bg-white p-8 flex flex-col items-stretch h-screen fixed right-0 top-0 overflow-y-auto custom-scrollbar shadow-2xl border-l border-border/50">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-dark tracking-tight">Bill Details</h2>
          <p className="text-sm font-bold text-gray-300">#546234</p>
        </div>

        <div className="space-y-2 mb-10">
          <p className="text-xs font-semibold text-dark tracking-tight">Customer Name</p>
          <input 
            type="text" 
            placeholder="Customer Name" 
            className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all"
          />
        </div>

        {/* Cart items */}
        <div className="flex-1 space-y-8 mb-10">
          {cart.map((item, i) => (
            <div key={i} className="flex justify-between items-start animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-dark leading-tight">{item.product.name}</h4>
                <div className="flex gap-x-4 gap-y-1 flex-wrap pt-0.5">
                  <p className="text-[10px] font-bold text-gray-400">Item Code: <span className="text-dark ml-1">{item.product.item_code}</span></p>
                  <p className="text-[10px] font-bold text-gray-400">Qty: <span className="text-dark ml-1">{item.quantity} PCS</span></p>
                </div>
              </div>
              <p className="text-sm font-bold text-primary tracking-tight">LKR {(item.product.retail_price * item.quantity).toFixed(2)}</p>
            </div>
          ))}
          
          {cart.length === 0 && (
            <div className="h-64 flex flex-col items-center justify-center text-gray-300 space-y-4">
              <Calculator size={48} strokeWidth={1.5} className="opacity-30" />
              <p className="text-sm font-bold">No items in bill yet</p>
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="pt-8 border-t-2 border-dashed border-border flex flex-col gap-4 mb-10">
          <div className="flex justify-between items-center text-sm font-bold text-gray-400">
            <span>Item</span>
            <span className="text-dark">{cart.length} (Items)</span>
          </div>
          <div className="flex justify-between items-center text-sm font-bold text-gray-400">
            <span>Subtotal</span>
            <span className="text-dark">LKR {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-sm font-bold text-gray-400">
            <span>Discount</span>
            <span className="text-primary">- LKR {discount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-sm font-bold text-gray-400">
            <span>Tax (10%)</span>
            <span className="text-dark">LKR {tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center pt-4">
            <span className="text-xl font-bold text-dark tracking-tight">Total</span>
            <span className="text-2xl font-bold text-primary tracking-tighter">LKR {total.toFixed(2)}</span>
          </div>
        </div>

        <div className="space-y-4 mb-10">
          <p className="text-xs font-semibold text-dark tracking-tight">Select Table</p>
          <div 
            onClick={() => setIsTableModalOpen(true)}
            className="w-full bg-accent border-2 border-transparent hover:border-border rounded-2xl py-4 px-6 flex items-center justify-between cursor-pointer transition-all"
          >
            <div className="flex items-center gap-3">
              <TableIcon size={18} className={cn("text-gray-400", selectedTable && "text-primary")} />
              <span className={cn("text-sm font-bold text-gray-400", selectedTable && "text-dark")}>
                {selectedTable ? `Table - ${selectedTable}` : "Select Table"}
              </span>
            </div>
            <ChevronRight size={18} className="text-gray-300" />
          </div>
        </div>

        <div className="space-y-4 mb-12">
          <p className="text-xs font-semibold text-dark tracking-tight">Select Payment</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-orange-50 border-2 border-primary rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm shadow-orange-100">
                <Wallet size={24} />
              </div>
              <p className="text-[11px] font-bold text-primary uppercase">Pay with Cash</p>
            </div>
            <div className="p-4 bg-white border-2 border-border rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary/30 transition-all">
              <div className="w-12 h-12 bg-accent rounded-2xl flex items-center justify-center text-gray-400">
                <CreditCard size={24} />
              </div>
              <p className="text-[11px] font-bold text-gray-400 uppercase">Pay with Card</p>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setIsSuccessModalOpen(true)}
          disabled={cart.length === 0}
          className={cn(
            "w-full py-5 rounded-2xl font-bold text-sm tracking-widest transition-all active:scale-[0.98]",
            cart.length === 0 
              ? "bg-gray-100 text-gray-300 cursor-not-allowed" 
              : "bg-primary text-white shadow-2xl shadow-orange-100 hover:bg-orange-600"
          )}
        >
          PROCESS TRANSACTION
        </button>
      </div>
    {/* TABLE MODAL */}
    <Modal 
      isOpen={isTableModalOpen}
      onClose={() => setIsTableModalOpen(false)}
      title="Select Seating Table"
    >
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(t => (
          <button 
            key={t}
            onClick={() => {
              setSelectedTable(t.toString());
              setIsTableModalOpen(false);
            }}
            className={cn(
              "aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all group",
              selectedTable === t.toString() 
                ? "bg-orange-50 border-primary text-primary" 
                : "bg-white border-border/50 hover:border-primary/20 text-gray-400"
            )}
          >
            <TableIcon size={20} strokeWidth={2.5} />
            <span className="text-sm font-bold">{t}</span>
          </button>
        ))}
      </div>
    </Modal>

    {/* SUCCESS MODAL */}
    <Modal 
      isOpen={isSuccessModalOpen}
      onClose={() => {
        setIsSuccessModalOpen(false);
        setCart([]);
        setSelectedTable(null);
      } }
      title="Transaction Success"
    >
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <div className="w-24 h-24 bg-orange-50 text-primary rounded-full flex items-center justify-center mb-8 shadow-inner shadow-orange-100">
          <CheckCircle2 size={48} strokeWidth={2.5} />
        </div>
        <h2 className="text-2xl font-bold text-dark tracking-tight mb-2">Payment Completed!</h2>
        <p className="text-sm font-semibold text-gray-400 mb-8 px-10">The digital keys/licenses will be delivered to the customer shortly.</p>
        
        <div className="w-full bg-accent/50 rounded-2xl p-6 border border-border/50 mb-10">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Total Amount Received</p>
          <h3 className="text-3xl font-bold text-primary tracking-tighter">LKR {total.toFixed(2)}</h3>
        </div>

        <button 
          onClick={() => {
            setIsSuccessModalOpen(false);
            setCart([]);
            setSelectedTable(null);
          }}
          className="w-full py-5 bg-dark text-white rounded-2xl font-bold text-sm tracking-widest hover:bg-black transition-all"
        >
          BACK TO DASHBOARD
        </button>
      </div>
    </Modal>
  </div>
  );
};

