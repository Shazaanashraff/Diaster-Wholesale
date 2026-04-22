import React, { useState, useMemo, useEffect } from 'react';
import { CATEGORIES } from '../data/mockData';
// Ensure no redundant Type Product from mockData
import type { Product, Customer } from '../types';
import { getProducts } from '../services/productService';
import { getCustomers } from '../services/customerService';
import { getInventory, getAverageCostPerPiece } from '../services/inventoryService';
import { checkout } from '../services/posService';
import { TopBar } from '../components/TopBar';
import { 
  Plus, 
  Minus, 
  ChevronRight,
  Calculator,
  Wallet,
  CreditCard,
  Table as TableIcon,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Modal } from '../components/Modal';
import { computeStock } from '../utils/stockUtils';

export interface CartItem {
  product: Product;
  quantityCartons: number;
  quantityPieces: number;
}

export const POSPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [stockPiecesByProduct, setStockPiecesByProduct] = useState<Record<string, number>>({});
  const [avgCostByProduct, setAvgCostByProduct] = useState<Record<string, number>>({});
  const [isInventoryEnforced, setIsInventoryEnforced] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  
  const [cartonQuantities, setCartonQuantities] = useState<Record<string, number>>({});
  const [pieceQuantities, setPieceQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    async function loadData() {
      try {
        const [fetchedProducts, fetchedCustomers, fetchedInventory] = await Promise.all([
          getProducts(),
          getCustomers(),
          getInventory(),
        ]);

        setProducts(fetchedProducts);
        
        setCustomers(fetchedCustomers);

        if (fetchedInventory.length > 0) {
          const stockMap: Record<string, number> = {};
          for (const row of fetchedInventory) {
            stockMap[row.product_id] = computeStock(row).totalPieces;
          }

          setStockPiecesByProduct(stockMap);
          setIsInventoryEnforced(true);

          const costMap = await getAverageCostPerPiece(fetchedProducts.map((p) => p.id));
          setAvgCostByProduct(costMap);
        } else {
          setStockPiecesByProduct({});
          setAvgCostByProduct({});
          setIsInventoryEnforced(false);
        }
      } catch (err) {
        console.error("Error loading POS data", err);
        setProducts([]);
        setStockPiecesByProduct({});
        setAvgCostByProduct({});
        setIsInventoryEnforced(false);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [isWholesale, setIsWholesale] = useState(true);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = selectedCategory === 'all' || p.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery, products]);

  const getCartPiecesForProduct = (productId: string): number => {
    return cart
      .filter((item) => item.product.id === productId)
      .reduce(
        (acc, item) => acc + item.quantityCartons * (item.product.pieces_per_carton || 1) + item.quantityPieces,
        0
      );
  };

  const exceedsAvailableStock = (
    product: Product,
    pendingCartons: number,
    pendingPieces: number
  ): boolean => {
    if (!isInventoryEnforced) return false;

    const piecesPerCarton = product.pieces_per_carton || 1;
    const pendingTotalPieces = pendingCartons * piecesPerCarton + pendingPieces;
    const inCartPieces = getCartPiecesForProduct(product.id);
    const availablePieces = stockPiecesByProduct[product.id] ?? 0;

    return inCartPieces + pendingTotalPieces > availablePieces;
  };


  const updateQuantity = (productId: string, type: 'cartons' | 'pieces', delta: number) => {
    if (type === 'cartons') {
      setCartonQuantities(prev => ({
        ...prev,
        [productId]: Math.max(0, (prev[productId] ?? 0) + delta)
      }));
    } else {
      setPieceQuantities(prev => ({
        ...prev,
        [productId]: Math.max(0, (prev[productId] ?? 0) + delta)
      }));
    }
  };

  const addToCart = (product: Product) => {
    const qtyCartons = cartonQuantities[product.id] || 0;
    const qtyPieces = pieceQuantities[product.id] || 0;
    if (qtyCartons === 0 && qtyPieces === 0) return;

    if (exceedsAvailableStock(product, qtyCartons, qtyPieces)) {
      const piecesPerCarton = product.pieces_per_carton || 1;
      const availablePieces = stockPiecesByProduct[product.id] ?? 0;
      const availCartons = Math.floor(availablePieces / piecesPerCarton);
      const availLoose = availablePieces % piecesPerCarton;

      setValidationMessage(
        `Cannot add ${product.name}. Available stock: ${availCartons} CTN, ${availLoose} PCS.`
      );
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantityCartons: item.quantityCartons + qtyCartons, quantityPieces: item.quantityPieces + qtyPieces } 
            : item
        );
      }
      return [...prev, { product, quantityCartons: qtyCartons, quantityPieces: qtyPieces }];
    });
    
    // Reset product quantity after adding to cart
    setCartonQuantities(prev => ({ ...prev, [product.id]: 0 }));
    setPieceQuantities(prev => ({ ...prev, [product.id]: 0 }));
    setValidationMessage(null);
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };
  
  const clearCart = () => {
    setCart([]);
    setValidationMessage(null);
  };

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'creditCard'>('cash');
  const [isProcessing, setIsProcessing] = useState(false);

  const subtotal = cart.reduce((acc, item) => {
    const pricePerPiece = isWholesale ? item.product.wholesale_price : item.product.retail_price;
    const totalPieces = (item.quantityCartons * item.product.pieces_per_carton) + item.quantityPieces;
    return acc + (pricePerPiece * totalPieces);
  }, 0);

  const estimatedCostFloor = cart.reduce((acc, item) => {
    const totalPieces = (item.quantityCartons * item.product.pieces_per_carton) + item.quantityPieces;
    const avgCost = avgCostByProduct[item.product.id] ?? 0;
    return acc + (avgCost * totalPieces);
  }, 0);

  const discount = subtotal > 50 ? 5.50 : 0;
  const tax = subtotal * 0.1;
  const total = subtotal - discount + tax;
  const isBelowCost = subtotal - discount < estimatedCostFloor;
  const canProcessTransaction = cart.length > 0 && !!selectedCustomerId && !isProcessing && !isBelowCost;

  const processTransaction = async () => {
    if (cart.length === 0 || !selectedCustomerId) {
      alert('Please add items and select a customer.');
      return;
    }

    if (isBelowCost) {
      setValidationMessage(
        `Cannot process sale below cost. Minimum allowed before tax: LKR ${estimatedCostFloor.toFixed(2)}.`
      );
      return;
    }

    setIsProcessing(true);
    try {
      await checkout(
        cart,
        selectedCustomerId,
        isWholesale,
        subtotal,
        discount,
        tax,
        total,
        paymentMethod === 'cash' ? 'cash' : 'bank_transfer' // map creditCard to bank_transfer or something
      );

      if (isInventoryEnforced) {
        setStockPiecesByProduct((prev) => {
          const next = { ...prev };
          for (const item of cart) {
            const pieces = item.quantityCartons * (item.product.pieces_per_carton || 1) + item.quantityPieces;
            const current = next[item.product.id] ?? 0;
            next[item.product.id] = Math.max(0, current - pieces);
          }
          return next;
        });
      }

      setValidationMessage(null);
      setIsSuccessModalOpen(true);
    } catch (error) {
      console.error('Transaction Failed:', error);
      const message = error instanceof Error ? error.message : 'Transaction failed. See console for details.';
      setValidationMessage(message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-center">Loading POS...</div>;
  }

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
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-dark tracking-tight">Select Menu</h2>
            <div className="flex bg-accent rounded-xl p-1 border border-border/50">
              <button 
                onClick={() => setIsWholesale(true)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  isWholesale ? "bg-white text-primary shadow-sm" : "text-gray-400 hover:text-dark"
                )}
              >
                Wholesale
              </button>
              <button 
                onClick={() => setIsWholesale(false)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  !isWholesale ? "bg-white text-primary shadow-sm" : "text-gray-400 hover:text-dark"
                )}
              >
                Retail
              </button>
            </div>
          </div>
          <p className="text-gray-400 text-sm font-bold">Showing {filteredProducts.length} Items</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-2 gap-5">
          {filteredProducts.map(product => {
            const piecesPerCarton = product.pieces_per_carton || 1;
            const qtyCartons = cartonQuantities[product.id] || 0;
            const qtyPieces = pieceQuantities[product.id] || 0;
            const hasAmount = qtyCartons > 0 || qtyPieces > 0;
            const inCartPieces = getCartPiecesForProduct(product.id);
            const availablePieces = isInventoryEnforced ? (stockPiecesByProduct[product.id] ?? 0) : Number.MAX_SAFE_INTEGER;
            const remainingPieces = isInventoryEnforced ? Math.max(0, availablePieces - inCartPieces) : Number.MAX_SAFE_INTEGER;
            const remainingCartons = Math.floor(remainingPieces / piecesPerCarton);
            const remainingLoose = remainingPieces % piecesPerCarton;
            const selectedPieces = qtyCartons * piecesPerCarton + qtyPieces;
            const exceedsStock = isInventoryEnforced && selectedPieces > remainingPieces;
            const canIncreaseCartons = !isInventoryEnforced || ((qtyCartons + 1) * piecesPerCarton + qtyPieces) <= remainingPieces;
            const canIncreasePieces = !isInventoryEnforced || (qtyCartons * piecesPerCarton + qtyPieces + 1) <= remainingPieces;
            
            return (
              <div key={product.id} className="bg-white rounded-[1.25rem] p-4 shadow-sm border border-border/50 group flex flex-col justify-between hover:shadow-xl hover:shadow-violet-100/20 transition-all duration-500 min-h-[250px]">
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[14px] font-bold text-dark leading-tight group-hover:text-primary transition-colors truncate">{product.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider truncate">
                           Mod: {product.model}
                        </p>
                        <p className="text-[9px] text-primary font-bold tracking-widest truncate">
                           {product.item_code}
                        </p>
                      </div>
                    </div>
                    <p className="text-[14px] font-bold text-primary tracking-tight shrink-0 whitespace-nowrap">LKR {(isWholesale ? product.wholesale_price : product.retail_price).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2 py-1 px-2.5 bg-accent rounded-lg border border-border/50 w-fit">
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{product.category}</span>
                  </div>
                  {isInventoryEnforced && (
                    <p className="mt-2 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                      Stock: <span className="text-dark">{remainingCartons} CTN, {remainingLoose} PCS</span>
                    </p>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-dashed border-border flex flex-col gap-2">
                  <div className="flex justify-between items-center bg-gray-50 p-1.5 rounded-lg -mx-1 -mt-1">
                    <div className="flex flex-col gap-0.5 ml-1">
                       <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest leading-none">Cartons</p>
                       <span className="text-[10px] font-black text-primary leading-none">{qtyCartons}</span>
                    </div>
                    <div className="flex items-center gap-1 w-[75px]">
                      <button 
                        onClick={() => updateQuantity(product.id, 'cartons', -1)}
                        disabled={qtyCartons === 0}
                        className={cn(
                          "flex-1 py-1 rounded bg-white border border-border/50 flex items-center justify-center transition-all",
                          qtyCartons === 0 ? "text-gray-300 cursor-not-allowed" : "text-gray-400 hover:text-dark"
                        )}
                      >
                        <Minus size={12} strokeWidth={3} />
                      </button>
                      <button 
                        onClick={() => updateQuantity(product.id, 'cartons', 1)}
                        disabled={!canIncreaseCartons}
                        className={cn(
                          "flex-1 py-1 rounded flex items-center justify-center transition-all shadow-sm",
                          canIncreaseCartons ? "bg-primary text-white hover:bg-violet-600" : "bg-gray-200 text-gray-400 cursor-not-allowed"
                        )}
                      >
                        <Plus size={12} strokeWidth={3} />
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-gray-50 p-1.5 rounded-lg -mx-1">
                    <div className="flex flex-col gap-0.5 ml-1">
                       <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest leading-none">Pieces</p>
                       <span className="text-[10px] font-black text-primary leading-none">{qtyPieces}</span>
                    </div>
                    <div className="flex items-center gap-1 w-[75px]">
                      <button 
                        onClick={() => updateQuantity(product.id, 'pieces', -1)}
                        disabled={qtyPieces === 0}
                        className={cn(
                          "flex-1 py-1 rounded bg-white border border-border/50 flex items-center justify-center transition-all",
                          qtyPieces === 0 ? "text-gray-300 cursor-not-allowed" : "text-gray-400 hover:text-dark"
                        )}
                      >
                        <Minus size={12} strokeWidth={3} />
                      </button>
                      <button 
                        onClick={() => updateQuantity(product.id, 'pieces', 1)}
                        disabled={!canIncreasePieces}
                        className={cn(
                          "flex-1 py-1 rounded flex items-center justify-center transition-all shadow-sm",
                          canIncreasePieces ? "bg-primary text-white hover:bg-violet-600" : "bg-gray-200 text-gray-400 cursor-not-allowed"
                        )}
                      >
                        <Plus size={12} strokeWidth={3} />
                      </button>
                    </div>
                  </div>

                  {exceedsStock && (
                    <p className="text-[10px] font-semibold text-red-500 px-1">
                      Quantity exceeds available stock.
                    </p>
                  )}

                  <button 
                    onClick={() => addToCart(product)}
                    disabled={!hasAmount || exceedsStock}
                    className={cn(
                      "w-full py-2.5 rounded-xl font-bold text-[10px] tracking-widest transition-all active:scale-[0.98] mt-1",
                      (!hasAmount || exceedsStock) 
                        ? "bg-accent text-gray-300 pointer-events-none" 
                        : "bg-primary text-white hover:bg-violet-600 shadow-xl shadow-violet-100"
                    )}
                  >
                    ADD TO CART
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>

    {/* RIGHT BILL PANEL */}
      <div className="w-[400px] bg-white p-8 flex flex-col items-stretch h-screen fixed right-0 top-0 overflow-y-auto custom-scrollbar shadow-2xl border-l border-border/50">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-dark tracking-tight">Bill Details</h2>
            <p className="text-sm font-bold text-gray-300">#546234</p>
          </div>
          {cart.length > 0 && (
            <button 
              onClick={clearCart}
              className="px-3 py-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1.5 uppercase"
            >
              <Trash2 size={12} />
              Clear
            </button>
          )}
        </div>

        <div className="space-y-2 mb-10">
          <p className="text-xs font-semibold text-dark tracking-tight">Customer</p>
          <select 
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all appearance-none cursor-pointer"
          >
            <option value="" disabled>Select Customer</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Cart items */}
        <div className="flex-1 space-y-8 mb-10">
          {cart.map((item, i) => {
            const pricePerPiece = isWholesale ? item.product.wholesale_price : item.product.retail_price;
            const totalPieces = (item.quantityCartons * item.product.pieces_per_carton) + item.quantityPieces;
            
            return (
              <div key={i} className="flex justify-between items-start animate-in fade-in slide-in-from-right-4 duration-300 group">
                <div className="space-y-1 flex-1 pr-4">
                  <h4 className="text-sm font-bold text-dark leading-tight">{item.product.name}</h4>
                  <div className="flex gap-x-4 gap-y-1 flex-wrap pt-0.5">
                    <p className="text-[10px] font-bold text-gray-400">Item Code: <span className="text-dark ml-1">{item.product.item_code}</span></p>
                    <p className="text-[10px] font-bold text-gray-400">Qty: <span className="text-dark ml-1">{item.quantityCartons} CTN, {item.quantityPieces} PCS</span></p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <p className="text-sm font-bold text-primary tracking-tight">LKR {(pricePerPiece * totalPieces).toFixed(2)}</p>
                  <button 
                    onClick={() => removeFromCart(i)}
                    className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
          
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

          {isBelowCost && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-[11px] font-bold text-red-600 uppercase tracking-wider">
                Below Cost Not Allowed
              </p>
              <p className="text-xs font-semibold text-red-500 mt-1">
                Minimum sale value before tax: LKR {estimatedCostFloor.toFixed(2)}
              </p>
            </div>
          )}
        </div>

        {validationMessage && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="text-xs font-semibold text-red-600">{validationMessage}</p>
          </div>
        )}

        <div className="space-y-4 mb-10">
          <p className="text-xs font-semibold text-dark tracking-tight">Order Type</p>
          <div 
            onClick={() => setIsTableModalOpen(true)}
            className="w-full bg-accent border-2 border-transparent hover:border-border rounded-2xl py-4 px-6 flex items-center justify-between cursor-pointer transition-all"
          >
            <div className="flex items-center gap-3">
              <TableIcon size={18} className={cn("text-gray-400", selectedTable && "text-primary")} />
              <span className={cn("text-sm font-bold text-gray-400", selectedTable && "text-dark")}>
                {selectedTable ? `Order - ${selectedTable}` : "Select Order Type"}
              </span>
            </div>
            <ChevronRight size={18} className="text-gray-300" />
          </div>
        </div>

        <div className="space-y-4 mb-12">
          <p className="text-xs font-semibold text-dark tracking-tight">Select Payment</p>
          <div className="grid grid-cols-2 gap-4">
            <div 
              onClick={() => setPaymentMethod('cash')}
              className={cn("p-4 border-2 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all", paymentMethod === 'cash' ? "bg-violet-50 border-primary" : "bg-white border-border hover:border-primary/30")}
            >
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm", paymentMethod === 'cash' ? "bg-white text-primary shadow-violet-100" : "bg-accent text-gray-400")}>
                <Wallet size={24} />
              </div>
              <p className={cn("text-[11px] font-bold uppercase", paymentMethod === 'cash' ? "text-primary": "text-gray-400")}>Pay with Cash</p>
            </div>
            <div 
              onClick={() => setPaymentMethod('creditCard')}
              className={cn("p-4 border-2 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all", paymentMethod === 'creditCard' ? "bg-violet-50 border-primary" : "bg-white border-border hover:border-primary/30")}
            >
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm", paymentMethod === 'creditCard' ? "bg-white text-primary shadow-violet-100" : "bg-accent text-gray-400")}>
                <CreditCard size={24} />
              </div>
              <p className={cn("text-[11px] font-bold uppercase", paymentMethod === 'creditCard' ? "text-primary": "text-gray-400")}>Pay with Card</p>
            </div>
          </div>
        </div>

        <button 
          onClick={processTransaction}
          disabled={!canProcessTransaction}
          className={cn(
            "w-full py-5 rounded-2xl font-bold text-sm tracking-widest transition-all active:scale-[0.98]",
            !canProcessTransaction
              ? "bg-gray-100 text-gray-300 cursor-not-allowed" 
              : "bg-primary text-white shadow-2xl shadow-violet-100 hover:bg-violet-600"
          )}
        >
          {isProcessing ? 'PROCESSING...' : 'PROCESS TRANSACTION'}
        </button>
      </div>
    {/* ORDER TYPE MODAL */}
    <Modal 
      isOpen={isTableModalOpen}
      onClose={() => setIsTableModalOpen(false)}
      title="Select Order Type"
    >
      <div className="grid grid-cols-2 gap-4">
        {['Pickup', 'Delivery', 'Courier', 'Will Call'].map(t => (
          <button 
            key={t}
            onClick={() => {
              setSelectedTable(t.toString());
              setIsTableModalOpen(false);
            }}
            className={cn(
              "py-8 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all group",
              selectedTable === t.toString() 
                ? "bg-violet-50 border-primary text-primary" 
                : "bg-white border-border/50 hover:border-primary/20 text-gray-400"
            )}
          >
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
        setSelectedCustomerId('');
        setValidationMessage(null);
      } }
      title="Transaction Success"
    >
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <div className="w-24 h-24 bg-violet-50 text-primary rounded-full flex items-center justify-center mb-8 shadow-inner shadow-violet-100">
          <CheckCircle2 size={48} strokeWidth={2.5} />
        </div>
        <h2 className="text-2xl font-bold text-dark tracking-tight mb-2">Payment Completed!</h2>
        <p className="text-sm font-semibold text-gray-400 mb-8 px-10">The order has been successfully processed.</p>
        
        <div className="w-full bg-accent/50 rounded-2xl p-6 border border-border/50 mb-10">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Total Amount Received</p>
          <h3 className="text-3xl font-bold text-primary tracking-tighter">LKR {total.toFixed(2)}</h3>
        </div>

        <button 
          onClick={() => {
            setIsSuccessModalOpen(false);
            setCart([]);
            setSelectedTable(null);
            setSelectedCustomerId('');
            setValidationMessage(null);
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

