import React, { useState, useMemo, useEffect } from 'react';
import { getProducts } from '../services/productService';
import { getCustomers } from '../services/customerService';
import { getRolePin } from '../utils/permissions';
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
  batchId?: string;
}

type PayMethod = 'cash' | 'creditCard' | 'ewallet' | 'credit';

const TILE_COLORS = [
  'bg-[#d7e5e8]',
  'bg-[#dbeafe]',
  'bg-[#d4e8f8]',
  'bg-[#d9dcf6]',
  'bg-[#f0e7f5]',
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
  const [btnPhase, setBtnPhase] = useState<'idle' | 'loading' | 'done'>('idle');

  // Discount & approval
  const [discountAmt, setDiscountAmt] = useState(0);
  const [discountApproved, setDiscountApproved] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalPin, setApprovalPin] = useState('');
  const [approvalError, setApprovalError] = useState('');

  const [availableBatches, setAvailableBatches] = useState<Record<string, any[]>>({});

  useEffect(() => {
    const cartProductIds = [...new Set(cart.map(i => i.product.id))];
    if (cartProductIds.length === 0) {
      setAvailableBatches({});
      return;
    }
    
    import('../services/inventoryService').then(({ getBatchesForProducts }) => {
      getBatchesForProducts(cartProductIds).then(batches => {
        const batchMap: Record<string, any[]> = {};
        for (const b of batches) {
          if (!batchMap[b.product_id]) batchMap[b.product_id] = [];
          batchMap[b.product_id].push(b);
        }
        setAvailableBatches(batchMap);
      });
    });
  }, [cart.length]);

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
    const q = searchQuery.toLowerCase();
    return products.filter((p) => {
      const categoryMatch = selectedCategory === 'all' || p.category.toLowerCase() === selectedCategory.toLowerCase();
      const searchMatch = !q || 
        (p.name?.toLowerCase().includes(q)) || 
        (p.item_code?.toLowerCase().includes(q)) || 
        (p.model?.toLowerCase().includes(q)) ||
        (p.sku?.toLowerCase().includes(q));
      return categoryMatch && searchMatch;
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
    const pricePerPiece = isWholesale ? (item.product.wholesale_price || 0) : (item.product.retail_price || 0);
    const ppc = item.product.pieces_per_carton || 1;
    const totalPieces = (item.quantityCartons || 0) * ppc + (item.quantityPieces || 0);
    return acc + pricePerPiece * totalPieces;
  }, 0);

  const estimatedCostFloor = cart.reduce((acc, item) => {
    const ppc = item.product.pieces_per_carton || 1;
    const totalPieces = (item.quantityCartons || 0) * ppc + (item.quantityPieces || 0);
    const avgCost = avgCostByProduct[item.product.id] ?? 0;
    return acc + avgCost * totalPieces;
  }, 0);

  const mspFloor = cart.reduce((acc, item) => {
    const ppc = item.product.pieces_per_carton || 1;
    const totalPieces = (item.quantityCartons || 0) * ppc + (item.quantityPieces || 0);
    const msp = item.product.msp ?? 0;
    return acc + msp * totalPieces;
  }, 0);

  const discount = discountApproved ? discountAmt : 0;
  const total = subtotal - discount;
  const isBelowCost = total < estimatedCostFloor;
  const isBelowMSP = mspFloor > 0 && total < mspFloor;
  const needsApproval = discountAmt > 0 && !discountApproved;
  const canProcessTransaction =
    cart.length > 0
    && !!selectedCustomerId
    && btnPhase === 'idle'
    && !isBelowCost
    && !isBelowMSP
    && !needsApproval;

  function handleDiscountChange(val: string) {
    const num = parseFloat(val) || 0;
    setDiscountAmt(num);
    setDiscountApproved(false);
  }

  function handleApproveDiscount() {
    const adminPin = getRolePin('admin');
    if (approvalPin === adminPin) {
      setDiscountApproved(true);
      setApprovalModalOpen(false);
      setApprovalPin('');
      setApprovalError('');
    } else {
      setApprovalError('Incorrect admin PIN');
      setApprovalPin('');
    }
  }

  const processTransaction = async () => {
    if (!canProcessTransaction) return;

    setBtnPhase('loading');

    try {
      await checkout(
        cart,
        selectedCustomerId,
        isWholesale,
        subtotal,
        discount,
        total,
        paymentMethod === 'credit'
          ? 'credit'
          : paymentMethod === 'cash'
            ? 'cash'
            : 'bank_transfer'
      );

      if (isInventoryEnforced) {
        setStockPiecesByProduct((prev) => {
          const next = { ...prev };
          for (const item of cart) {
            const pieces = item.quantityCartons * (item.product.pieces_per_carton || 1) + item.quantityPieces;
            next[item.product.id] = Math.max(0, (next[item.product.id] ?? 0) - pieces);
          }
          return next;
        });
      }

      setValidationMessage(null);
      setBtnPhase('done');
      setTimeout(() => {
        setCart([]);
        setSelectedCustomerId('');
        setBtnPhase('idle');
      }, 1600);
    } catch (error) {
      console.error('Transaction Failed:', error);
      const message = error instanceof Error ? error.message : 'Transaction failed. See console for details.';
      setValidationMessage(message);
      setBtnPhase('idle');
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
              className="pos-product-grid mt-3"
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
                
                // Search match is now handled in categoryProducts useMemo
                const isSearchMatch = true;

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
              <h2>POS System</h2>
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
                const ppc = item.product.pieces_per_carton || 1;
                const totalPieces = (item.quantityCartons || 0) * ppc + (item.quantityPieces || 0);
                const pricePerPiece = isWholesale ? (item.product.wholesale_price || 0) : (item.product.retail_price || 0);

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
                        <p className="text-[10px] text-gray-500">
                          {item.quantityCartons} CTN x {item.quantityPieces} PCS
                        </p>
                        <div className="mt-1">
                          <select
                            value={item.batchId || ''}
                            onChange={(e) => {
                              const newCart = [...cart];
                              newCart[index].batchId = e.target.value || undefined;
                              setCart(newCart);
                            }}
                            className="bg-[#1d222a] border border-[#2b313a] text-[9px] text-gray-400 rounded px-1.5 py-0.5 outline-none focus:border-primary/40"
                          >
                            <option value="">FIFO (Oldest First)</option>
                            {(availableBatches[item.product.id] || []).map(b => (
                              <option key={b.id} value={b.id}>
                                Batch: {b.shipments?.reference || 'Direct'} ({b.received_at ? new Date(b.received_at).toLocaleDateString() : '—'})
                              </option>
                            ))}
                          </select>
                        </div>
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
            <div style={{ alignItems: 'center' }}>
              <span>Discount</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountAmt || ''}
                  onChange={e => handleDiscountChange(e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: 80, background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8, padding: '3px 8px',
                    color: '#f1f5f9', fontSize: 12, fontFamily: 'monospace',
                    outline: 'none',
                  }}
                />
                {discountAmt > 0 && !discountApproved && (
                  <button
                    type="button"
                    onClick={() => { setApprovalModalOpen(true); setApprovalError(''); setApprovalPin(''); }}
                    style={{
                      fontSize: 10, fontWeight: 700, padding: '3px 8px',
                      borderRadius: 6, cursor: 'pointer',
                      background: 'rgba(251,191,36,0.15)',
                      border: '1px solid rgba(251,191,36,0.3)',
                      color: '#fbbf24',
                    }}
                  >
                    Approve
                  </button>
                )}
                {discountApproved && discountAmt > 0 && (
                  <span style={{ fontSize: 10, color: '#34d399', fontWeight: 700 }}>✓ Approved</span>
                )}
              </div>
            </div>
            <div className="total">
              <span>Total</span>
              <strong>LKR <AnimatedNumber value={total} /></strong>
            </div>
          </div>

          {/* Discount approval modal */}
          {approvalModalOpen && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                background: '#171c23', border: '1px solid #2b313a',
                borderRadius: 20, padding: 28, width: 320,
                display: 'flex', flexDirection: 'column', gap: 16,
              }}>
                <div>
                  <p style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Admin Approval Required</p>
                  <p style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
                    Discount of LKR {discountAmt.toFixed(2)} requires admin authorisation.
                  </p>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>
                    Admin PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={approvalPin}
                    onChange={e => { setApprovalPin(e.target.value); setApprovalError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleApproveDiscount()}
                    placeholder="••••"
                    autoFocus
                    style={{
                      width: '100%', background: '#1d222a',
                      border: approvalError ? '1px solid #ef4444' : '1px solid #2b313a',
                      borderRadius: 12, padding: '10px 14px',
                      color: '#f1f5f9', fontSize: 18, letterSpacing: '0.3em',
                      outline: 'none', textAlign: 'center',
                    }}
                  />
                  {approvalError && (
                    <p style={{ color: '#f87171', fontSize: 11, marginTop: 6, textAlign: 'center' }}>{approvalError}</p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => { setApprovalModalOpen(false); setApprovalPin(''); setApprovalError(''); }}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 12,
                      background: '#1d222a', border: '1px solid #2b313a',
                      color: '#9ca3af', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApproveDiscount}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 12,
                      background: '#7c3aed', border: 'none',
                      color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    Approve
                  </button>
                </div>
              </div>
            </div>
          )}

          {needsApproval && (
            <div className="pos-warning" style={{ background: 'rgba(251,191,36,0.08)', borderColor: 'rgba(251,191,36,0.3)', color: '#fbbf24' }}>
              Discount requires admin approval before checkout
            </div>
          )}

          {isBelowMSP && (
            <div className="pos-warning" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}>
              ❌ Below MSP — minimum total: LKR {mspFloor.toFixed(2)}
            </div>
          )}

          {!isBelowMSP && isBelowCost && (
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
            <button type="button" className={cn(paymentMethod === 'credit' && 'active')} onClick={() => setPaymentMethod('credit')}>
              <CreditCard size={16} />
              Credit
            </button>
          </div>

          <button
            type="button"
            className="pos-submit relative overflow-hidden"
            onClick={processTransaction}
            disabled={!canProcessTransaction}
            style={{
              background: btnPhase === 'done' ? '#16a34a' : undefined,
              transition: 'background 0.3s ease',
            }}
          >
            {/* invisible spacer — keeps the button's natural height */}
            <span className="invisible select-none" aria-hidden>Place Order</span>
            <AnimatePresence mode="wait">
              {btnPhase === 'idle' && (
                <motion.span
                  key="label"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  Place Order
                </motion.span>
              )}
              {btnPhase === 'loading' && (
                <motion.span
                  key="loading"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 flex items-center justify-center gap-2"
                >
                  <LoaderCircle size={16} className="animate-spin" />
                  Processing
                </motion.span>
              )}
              {btnPhase === 'done' && (
                <motion.span
                  key="done"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <polyline
                      points="3,11 8.5,16.5 19,5"
                      stroke="white"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="30"
                      strokeDashoffset="30"
                      style={{ animation: 'pos-check-draw 0.35s cubic-bezier(0.4,0,0.2,1) 0.05s forwards' }}
                    />
                  </svg>
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          <style>{`
            @keyframes pos-check-draw { to { stroke-dashoffset: 0; } }
          `}</style>
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
                selectedOrderType === type
                  ? 'bg-[#f8fafc] border-[#f8fafc] text-[#0f172a]'
                  : 'bg-[#1d222a] border-[#2b313a] text-gray-400 hover:text-white hover:bg-[#252a33]'
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
            className="w-full py-3 rounded-xl bg-[#f8fafc] text-[#0f172a] border border-[#f8fafc] font-semibold hover:bg-[#e2e8f0] transition-colors"
          >
            Back to POS
          </button>
        </div>
      </Modal>
    </div>
  );
};
