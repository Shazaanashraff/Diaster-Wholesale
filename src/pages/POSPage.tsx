import React, { useState, useMemo, useEffect } from 'react';
import { getProducts } from '../services/productService';
import { getCustomers } from '../services/customerService';
import { getInventory, getAverageCostPerPiece } from '../services/inventoryService';
import { checkout } from '../services/posService';
import type { Product, Customer } from '../types';
import { Modal } from '../components/Modal';
import { computeStock } from '../utils/stockUtils';
import { AnimatedNumber } from '../components/AnimatedNumber';
import {
  Minus,
  Plus,
  Search,
  Coffee,
  Soup,
  Wine,
  CupSoda,
  UtensilsCrossed,
  CakeSlice,
  Fish,
  Wallet,
  CreditCard,
  QrCode,
  Trash2,
  LoaderCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export interface CartItem {
  product: Product;
  quantityCartons: number;
  quantityPieces: number;
}

type PayMethod = 'cash' | 'creditCard' | 'ewallet';

const TILE_COLORS = [
  'bg-[#d7e5e8]',
  'bg-[#e6d3f0]',
  'bg-[#d4e8f8]',
  'bg-[#d9dcf6]',
  'bg-[#f2c8de]',
  'bg-[#ece7ec]',
  'bg-[#f0d0db]',
  'bg-[#cbe8df]',
];

const TILE_ICONS = [Coffee, Soup, Fish, UtensilsCrossed, CakeSlice, CupSoda, Wine, Coffee];

export const POSPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const [stockPiecesByProduct, setStockPiecesByProduct] = useState<Record<string, number>>({});
  const [avgCostByProduct, setAvgCostByProduct] = useState<Record<string, number>>({});
  const [isInventoryEnforced, setIsInventoryEnforced] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartonQuantities, setCartonQuantities] = useState<Record<string, number>>({});
  const [pieceQuantities, setPieceQuantities] = useState<Record<string, number>>({});

  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>('cash');
  const [selectedOrderType, setSelectedOrderType] = useState<string>('Dine-in');
  const [isOrderTypeModalOpen, setIsOrderTypeModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isWholesale, setIsWholesale] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadData() {
      const startedAt = Date.now();

      try {
        const [fetchedProducts, fetchedCustomers, fetchedInventory] = await Promise.all([
          getProducts(),
          getCustomers(),
          getInventory(),
        ]);

        if (!active) return;

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
          if (!active) return;
          setAvgCostByProduct(costMap);
        } else {
          setStockPiecesByProduct({});
          setAvgCostByProduct({});
          setIsInventoryEnforced(false);
        }
      } catch (err) {
        console.error('Error loading POS data', err);
        if (!active) return;
        setProducts([]);
        setStockPiecesByProduct({});
        setAvgCostByProduct({});
        setIsInventoryEnforced(false);
      } finally {
        if (!active) return;
        const elapsed = Date.now() - startedAt;
        const delay = Math.max(0, 650 - elapsed);
        window.setTimeout(() => {
          if (!active) return;
          setLoading(false);
        }, delay);
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, []);

  const categoryTiles = useMemo(() => {
    const byCategory = new Map<string, { count: number; products: Product[] }>();

    for (const product of products) {
      const key = product.category.toLowerCase();
      const existing = byCategory.get(key);
      if (existing) {
        existing.count += 1;
        existing.products.push(product);
      } else {
        byCategory.set(key, { count: 1, products: [product] });
      }
    }

    const items = Array.from(byCategory.entries()).map(([key, value]) => ({
      id: key,
      title: key.replace(/[_-]/g, ' '),
      items: value.count,
    }));

    return [{ id: 'all', title: 'All menu', items: products.length }, ...items].slice(0, 8);
  }, [products]);

  const categoryProducts = useMemo(() => {
    return products.filter((p) => {
      return selectedCategory === 'all' || p.category.toLowerCase() === selectedCategory.toLowerCase();
    });
  }, [selectedCategory, products]);

  const getCartPiecesForProduct = (productId: string): number => {
    return cart
      .filter((item) => item.product.id === productId)
      .reduce(
        (acc, item) => acc + item.quantityCartons * (item.product.pieces_per_carton || 1) + item.quantityPieces,
        0
      );
  };

  const exceedsAvailableStock = (product: Product, pendingCartons: number, pendingPieces: number): boolean => {
    if (!isInventoryEnforced) return false;

    const piecesPerCarton = product.pieces_per_carton || 1;
    const pendingTotalPieces = pendingCartons * piecesPerCarton + pendingPieces;
    const inCartPieces = getCartPiecesForProduct(product.id);
    const availablePieces = stockPiecesByProduct[product.id] ?? 0;

    return inCartPieces + pendingTotalPieces > availablePieces;
  };

  const updateQuantity = (productId: string, type: 'cartons' | 'pieces', delta: number) => {
    if (type === 'cartons') {
      setCartonQuantities((prev) => ({
        ...prev,
        [productId]: Math.max(0, (prev[productId] ?? 0) + delta),
      }));
    } else {
      setPieceQuantities((prev) => ({
        ...prev,
        [productId]: Math.max(0, (prev[productId] ?? 0) + delta),
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

      setValidationMessage(`Cannot add ${product.name}. Available: ${availCartons} CTN, ${availLoose} PCS.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantityCartons: item.quantityCartons + qtyCartons,
                quantityPieces: item.quantityPieces + qtyPieces,
              }
            : item
        );
      }
      return [...prev, { product, quantityCartons: qtyCartons, quantityPieces: qtyPieces }];
    });

    setCartonQuantities((prev) => ({ ...prev, [product.id]: 0 }));
    setPieceQuantities((prev) => ({ ...prev, [product.id]: 0 }));
    setValidationMessage(null);
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
    setValidationMessage(null);
  };

  const subtotal = cart.reduce((acc, item) => {
    const pricePerPiece = isWholesale ? item.product.wholesale_price : item.product.retail_price;
    const totalPieces = item.quantityCartons * item.product.pieces_per_carton + item.quantityPieces;
    return acc + pricePerPiece * totalPieces;
  }, 0);

  const estimatedCostFloor = cart.reduce((acc, item) => {
    const totalPieces = item.quantityCartons * item.product.pieces_per_carton + item.quantityPieces;
    const avgCost = avgCostByProduct[item.product.id] ?? 0;
    return acc + avgCost * totalPieces;
  }, 0);

  const discount = subtotal > 50 ? 5.5 : 0;
  const tax = subtotal * 0.1;
  const total = subtotal - discount + tax;
  const isBelowCost = subtotal - discount < estimatedCostFloor;
  const canProcessTransaction = cart.length > 0 && !!selectedCustomerId && !isProcessing;

  const processTransaction = async () => {
    if (!canProcessTransaction) return;

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
        paymentMethod === 'cash' ? 'cash' : 'bank_transfer'
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

  const resetAfterSuccess = () => {
    setIsSuccessModalOpen(false);
    setCart([]);
    setSelectedCustomerId('');
    setValidationMessage(null);
  };

  if (loading) {
    return (
      <div className="pos-page-grid">
        <div className="pos-skeleton-main">
          <div className="pos-skeleton-search skeleton" />
          <div className="pos-skeleton-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="pos-skeleton-tile skeleton" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
          <div className="pos-skeleton-products">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="pos-skeleton-card skeleton" style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
        </div>
        <div className="pos-skeleton-panel" />
      </div>
    );
  }

  return (
    <div className="pos-page-grid">
      <section className="pos-main">
          <div className="pos-main-head">
            <label className="pos-search">
              <Search size={18} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
              />
            </label>
            <div className="pos-mode-toggle">
              <button type="button" className={cn(isWholesale && 'active')} onClick={() => setIsWholesale(true)}>
                Wholesale
              </button>
              <button type="button" className={cn(!isWholesale && 'active')} onClick={() => setIsWholesale(false)}>
                Retail
              </button>
            </div>
          </div>

          <div className="pos-tile-grid">
            {categoryTiles.map((tile, idx) => {
              const Icon = TILE_ICONS[idx % TILE_ICONS.length];
              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => setSelectedCategory(tile.id)}
                  className={cn(
                    'pos-tile',
                    TILE_COLORS[idx % TILE_COLORS.length],
                    selectedCategory === tile.id && 'active'
                  )}
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  <Icon size={18} />
                  <h3>{tile.title}</h3>
                  <p>{tile.items} items</p>
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.div 
              key={selectedCategory}
              className="pos-product-grid"
              initial="hidden"
              animate="show"
              exit="exit"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.04 } },
                exit: { transition: { staggerChildren: 0.03, staggerDirection: -1 } }
              }}
            >
              {categoryProducts.slice(0, 12).map((product) => {
                const qtyCartons = cartonQuantities[product.id] || 0;
                const qtyPieces = pieceQuantities[product.id] || 0;
                const piecesPerCarton = product.pieces_per_carton || 1;

                const selectedPieces = qtyCartons * piecesPerCarton + qtyPieces;
                const inCartPieces = getCartPiecesForProduct(product.id);
                const availablePieces = isInventoryEnforced ? (stockPiecesByProduct[product.id] ?? 0) : Number.MAX_SAFE_INTEGER;
                const remainingPieces = isInventoryEnforced ? Math.max(0, availablePieces - inCartPieces) : Number.MAX_SAFE_INTEGER;

                const canIncreaseCartons = !isInventoryEnforced || (selectedPieces + piecesPerCarton) <= remainingPieces;
                const canIncreasePieces = !isInventoryEnforced || (selectedPieces + 1) <= remainingPieces;
                const exceedsStock = isInventoryEnforced && selectedPieces > remainingPieces;
                const hasAmount = qtyCartons > 0 || qtyPieces > 0;
                
                const isSearchMatch = searchQuery === '' || product.name.toLowerCase().includes(searchQuery.toLowerCase());

                return (
                  <motion.article 
                    key={product.id} 
                    variants={{
                      hidden: { opacity: 0, y: 8 },
                      show: { opacity: 1, y: 0, transition: { duration: 0.16 } },
                      exit: { opacity: 0, y: 8, transition: { duration: 0.16 } }
                    }}
                    className={cn(
                      'pos-product-card transition-all duration-300', 
                      !isSearchMatch && 'opacity-20 scale-95 pointer-events-none'
                    )}
                  >
                  <div className="pos-product-top">
                    <p>Orders to Kitchen</p>
                    <h4>{product.name}</h4>
                    <strong>LKR {(isWholesale ? product.wholesale_price : product.retail_price).toFixed(2)}</strong>
                  </div>

                  <div className="pos-qty-group">
                    <div className="pos-qty-row">
                      <span>CTN {qtyCartons}</span>
                      <div>
                        <button type="button" onClick={() => updateQuantity(product.id, 'cartons', -1)} disabled={qtyCartons === 0}>
                          <Minus size={14} />
                        </button>
                        <button type="button" onClick={() => updateQuantity(product.id, 'cartons', 1)} disabled={!canIncreaseCartons}>
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="pos-qty-row">
                      <span>PCS {qtyPieces}</span>
                      <div>
                        <button type="button" onClick={() => updateQuantity(product.id, 'pieces', -1)} disabled={qtyPieces === 0}>
                          <Minus size={14} />
                        </button>
                        <button type="button" onClick={() => updateQuantity(product.id, 'pieces', 1)} disabled={!canIncreasePieces}>
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={cn('pos-add-btn', (!hasAmount || exceedsStock) && 'disabled')}
                    onClick={() => addToCart(product)}
                    disabled={!hasAmount || exceedsStock}
                  >
                    Add
                  </button>
                  </motion.article>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </section>

        <aside className="pos-bill">
          <div className="pos-bill-head">
            <div>
              <h2>Table 5</h2>
              <p>{customers.find((c) => c.id === selectedCustomerId)?.name ?? 'Walk-in'}</p>
            </div>
            {cart.length > 0 && (
              <button type="button" onClick={clearCart} className="pos-clear-btn">
                <Trash2 size={14} />
              </button>
            )}
          </div>

          <div className="pos-customer-select">
            <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
              <option value="" disabled>
                Select customer
              </option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="pos-cart-list custom-scrollbar">
            {cart.length === 0 && <p className="pos-cart-empty">No items yet</p>}
            <AnimatePresence>
              {cart.map((item, index) => {
                const pricePerPiece = isWholesale ? item.product.wholesale_price : item.product.retail_price;
                const totalPieces = item.quantityCartons * item.product.pieces_per_carton + item.quantityPieces;

                return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, height: 0, marginTop: 0, marginBottom: 0, overflow: 'hidden' }}
                    transition={{ duration: 0.2 }}
                    key={`${item.product.id}-${index}`} 
                    className="pos-cart-item" 
                  >
                    <button
                      type="button"
                      className="pos-cart-delete"
                      aria-label={`Remove ${item.product.name} from cart`}
                      onClick={() => removeFromCart(index)}
                    >
                      <Trash2 size={16} />
                    </button>
                    <div className="pos-cart-item-front">
                      <span>{index + 1}</span>
                      <div>
                        <h4>{item.product.name}</h4>
                        <p>
                          {item.quantityCartons} CTN x {item.quantityPieces} PCS
                        </p>
                      </div>
                      <strong>LKR {(pricePerPiece * totalPieces).toFixed(2)}</strong>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          <div className="pos-bill-total">
            <div>
              <span>Subtotal</span>
              <strong>LKR <AnimatedNumber value={subtotal} /></strong>
            </div>
            <div>
              <span>Tax 10%</span>
              <strong>LKR <AnimatedNumber value={tax} /></strong>
            </div>
            <div>
              <span>Discount</span>
              <strong>- LKR <AnimatedNumber value={discount} /></strong>
            </div>
            <div className="total">
              <span>Total</span>
              <strong>LKR <AnimatedNumber value={total} /></strong>
            </div>
          </div>

          {isBelowCost && (
            <div className="pos-warning">Below cost floor: LKR {estimatedCostFloor.toFixed(2)}</div>
          )}

          {validationMessage && <div className="pos-error">{validationMessage}</div>}

          <button className="pos-order-type" type="button" onClick={() => setIsOrderTypeModalOpen(true)}>
            {selectedOrderType}
          </button>

          <div className="pos-pay-grid">
            <button type="button" className={cn(paymentMethod === 'cash' && 'active')} onClick={() => setPaymentMethod('cash')}>
              <Wallet size={16} />
              Cash
            </button>
            <button
              type="button"
              className={cn(paymentMethod === 'creditCard' && 'active')}
              onClick={() => setPaymentMethod('creditCard')}
            >
              <CreditCard size={16} />
              Card
            </button>
            <button type="button" className={cn(paymentMethod === 'ewallet' && 'active')} onClick={() => setPaymentMethod('ewallet')}>
              <QrCode size={16} />
              E-wallet
            </button>
          </div>

          <button type="button" className="pos-submit" onClick={processTransaction} disabled={!canProcessTransaction}>
            {isProcessing ? (
              <span className="pos-processing-state">
                <LoaderCircle size={16} className="animate-spin" />
                Processing
              </span>
            ) : (
              'Place Order'
            )}
          </button>

          {isProcessing && (
            <div className="pos-processing-overlay">
              <div className="pos-processing-bar" />
              <p>Syncing order and updating stock...</p>
            </div>
          )}
        </aside>

      <Modal isOpen={isOrderTypeModalOpen} onClose={() => setIsOrderTypeModalOpen(false)} title="Order Type">
        <div className="grid grid-cols-2 gap-3">
          {['Dine-in', 'Pickup', 'Delivery', 'Courier'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setSelectedOrderType(type);
                setIsOrderTypeModalOpen(false);
              }}
              className={cn(
                'py-4 rounded-xl border text-sm font-semibold transition-colors',
                selectedOrderType === type ? 'bg-violet-100 border-violet-300 text-violet-700' : 'bg-white border-slate-200'
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </Modal>

      <Modal isOpen={isSuccessModalOpen} onClose={resetAfterSuccess} title="Transaction Success">
        <div className="text-center py-6 space-y-4">
          <h3 className="text-2xl font-bold text-slate-900">Payment Completed</h3>
          <p className="text-sm text-slate-500">Total received: LKR {total.toFixed(2)}</p>
          <button
            type="button"
            onClick={resetAfterSuccess}
            className="w-full py-3 rounded-xl bg-slate-900 text-white font-semibold"
          >
            Back to POS
          </button>
        </div>
      </Modal>
    </div>
  );
};
