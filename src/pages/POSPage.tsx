import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPosCustomers, createCustomer } from '../services/customerService';
import { getRolePin } from '../utils/permissions';
import { getPosShopCatalog, getAverageCostPerPiece } from '../services/inventoryService';
import {
  checkout, checkoutOffline, syncOfflineSales, getOfflinePendingCount,
  getCustomerLoyalty, computeRedemptionValue, checkCreditLimit,
} from '../services/posService';
import { getSalespeople, type Salesperson } from '../services/salespersonService';
import type { Product, Customer } from '../types';
import { Modal } from '../components/Modal';
import { POSSaleReceipt, type SaleReceiptData } from '../components/POSSaleReceipt';
import { SearchableSelect } from '../components/SearchableSelect';
import { computeStock } from '../utils/stockUtils';
import { AnimatedNumber } from '../components/AnimatedNumber';
import {
  Minus,
  Plus,
  Search,
  Code2,
  MonitorCheck,
  Gamepad2,
  Gift,
  Server,
  Globe,
  Trash2,
  LoaderCircle,
  X,
  PlusCircle,
  WifiOff,
  RefreshCw,
  Star,
  UserCheck,
} from 'lucide-react';
import type { PaymentSplit } from '../services/posService';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

export interface CartItem {
  product: Product;
  quantityCartons: number;
  quantityPieces: number;
  batchId?: string;
  unitPrice?: number;
  lineDiscount?: number;
}

const TILE_COLORS = [
  'bg-[#d7e5e8]',
  'bg-[#e2e8f0]',
  'bg-[#d4e8f8]',
  'bg-[#cbd5e1]',
  'bg-[#f1f5f9]',
  'bg-[#f8fafc]',
  'bg-[#e5e7eb]',
  'bg-[#cbe8df]',
];

const TILE_ICONS = [Code2, MonitorCheck, Gamepad2, Gift, Server, Globe, Code2, MonitorCheck];
const WALK_IN_CUSTOMER_ID = 'c1000000-0000-0000-0000-000000000001';

export const POSPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [productPage, setProductPage] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Pick<Customer, 'id' | 'name'>[]>([]);
  const realtimeRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const [stockPiecesByProduct, setStockPiecesByProduct] = useState<Record<string, number>>({});
  const [avgCostByProduct, setAvgCostByProduct] = useState<Record<string, number>>({});
  const [isInventoryEnforced, setIsInventoryEnforced] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [pieceQuantities, setPieceQuantities] = useState<Record<string, number>>({});

  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [btnPhase, setBtnPhase] = useState<'idle' | 'loading' | 'done'>('idle');

  // Transaction state — payment
  type PayMethod = PaymentSplit['method'] | 'credit';
  interface UISplit {
    id: string;
    method: PayMethod;
    amount: string;   // empty = auto-fill full total on submit
    bank_name: string;
    cheque_number: string;
    due_date: string;
  }
  const mkSplit = (method: PayMethod): UISplit => ({
    id: Math.random().toString(36).slice(2),
    method, amount: '', bank_name: '', cheque_number: '', due_date: '',
  });
  const [paymentSplits, setPaymentSplits] = useState<UISplit[]>([mkSplit('cash')]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [lastSaleReceipt, setLastSaleReceipt] = useState<SaleReceiptData | null>(null);
  const [isWholesale, setIsWholesale] = useState(true);

  // Discount & approval
  const [discountAmt, setDiscountAmt] = useState(0);
  const [pricingApproved, setPricingApproved] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalPin, setApprovalPin] = useState('');
  const [approvalError, setApprovalError] = useState('');

  const [availableBatches, setAvailableBatches] = useState<Record<string, any[]>>({});

  // Network + offline
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Loyalty
  const [customerLoyalty, setCustomerLoyalty] = useState<{ points: number } | null>(null);
  const [redeemPoints, setRedeemPoints] = useState(0);

  // Credit limit info
  const [creditLimitInfo, setCreditLimitInfo] = useState<{ available: number; limit: number } | null>(null);

  // Salesperson
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>('');
  const salespersonOptions = useMemo(
    () => salespeople.map((sp) => ({
      value: sp.id,
      label: sp.name,
      searchLabel: sp.name,
    })),
    [salespeople]
  );
  const selectedSalespersonName = useMemo(
    () => salespeople.find((sp) => sp.id === selectedSalesperson)?.name ?? '',
    [salespeople, selectedSalesperson]
  );

  // Inline new-customer form
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustType, setNewCustType] = useState<'wholesale' | 'retail'>('wholesale');
  const [newCustSaving, setNewCustSaving] = useState(false);

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

  // Network status
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      handleSync();
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    getOfflinePendingCount().then(setOfflinePendingCount);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  async function handleSync() {
    setIsSyncing(true);
    try {
      await syncOfflineSales(() => {});
      const count = await getOfflinePendingCount();
      setOfflinePendingCount(count);
    } catch { /* silent */ }
    setIsSyncing(false);
  }

  // Load customer loyalty when customer is selected
  useEffect(() => {
    if (!selectedCustomerId) {
      setCustomerLoyalty(null);
      setRedeemPoints(0);
      setCreditLimitInfo(null);
      return;
    }
    getCustomerLoyalty(selectedCustomerId).then(l => setCustomerLoyalty({ points: l.points }));
    checkCreditLimit(selectedCustomerId, 0, 0).then(r =>
      setCreditLimitInfo({ available: r.available, limit: r.limit })
    );
  }, [selectedCustomerId]);

  // ── Reusable data loader (initial + refresh) ──────────────────
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    const startedAt = Date.now();
    let active = true;

    try {
      const [catalog, fetchedCustomers, fetchedSalespeople] = await Promise.all([
        getPosShopCatalog().catch((e) => {
          console.error('getPosShopCatalog failed:', e);
          return { products: [] as Product[], inventory: [] };
        }),
        getPosCustomers().catch((e) => { console.error('getPosCustomers failed:', e); return []; }),
        getSalespeople().catch(() => [] as Salesperson[]),
      ]);
      const fetchedProducts = catalog.products;
      const fetchedInventory = catalog.inventory;

      if (!active) return;

      setProducts(fetchedProducts);
      setCustomers(fetchedCustomers);
      setSalespeople(fetchedSalespeople);

      if (fetchedInventory.length > 0) {
        const stockMap: Record<string, number> = {};
        for (const row of fetchedInventory) {
          stockMap[row.product_id] = computeStock(row).totalPieces;
        }

        setStockPiecesByProduct(stockMap);
        setIsInventoryEnforced(true);

        try {
          const costMap = await getAverageCostPerPiece(fetchedProducts.map((p) => p.id));
          if (!active) return;
          setAvgCostByProduct(costMap);
        } catch {
          // non-fatal — POS works without cost floor data
        }
      } else {
        setStockPiecesByProduct({});
        setAvgCostByProduct({});
        setIsInventoryEnforced(false);
      }

      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Error loading POS data', err);
    } finally {
      if (!active) return;
      if (!isRefresh) {
        const elapsed = Date.now() - startedAt;
        const delay = Math.max(0, 650 - elapsed);
        window.setTimeout(() => {
          setLoading(false);
        }, delay);
      } else {
        setRefreshing(false);
      }
    }
  }, []);

  // ── Initial load ──────────────────────────────────────────────
  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // ── Supabase Realtime: debounced refresh (avoids egress bursts) ───
  useEffect(() => {
    const scheduleRefresh = () => {
      if (realtimeRefreshTimer.current) clearTimeout(realtimeRefreshTimer.current);
      realtimeRefreshTimer.current = setTimeout(() => loadData(true), 800);
    };

    const channel = supabase
      .channel('pos-realtime-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_adjustments' }, scheduleRefresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'products' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_batches' }, scheduleRefresh)
      .subscribe();

    return () => {
      if (realtimeRefreshTimer.current) clearTimeout(realtimeRefreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  useEffect(() => {
    setCart((prev) =>
      prev.map((item) => ({
        ...item,
        unitPrice: isWholesale ? item.product.wholesale_price : item.product.retail_price,
      }))
    );
    setPricingApproved(false);
  }, [isWholesale]);

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

  const PAGE_SIZE = 6;

  const categoryProducts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return products.filter((p) => {
      const categoryMatch = selectedCategory === 'all' || p.category.toLowerCase() === selectedCategory.toLowerCase();
      const searchMatch = !q ||
        (p.name?.toLowerCase().includes(q)) ||
        (p.item_code?.toLowerCase().includes(q)) ||
        (p.sku?.toLowerCase().includes(q));
      return categoryMatch && searchMatch;
    });
  }, [selectedCategory, searchQuery, products]);

  // Reset to page 0 whenever the filtered list changes
  useEffect(() => { setProductPage(0); }, [selectedCategory, searchQuery]);

  const totalPages = Math.ceil(categoryProducts.length / PAGE_SIZE);
  const pagedProducts = categoryProducts.slice(productPage * PAGE_SIZE, (productPage + 1) * PAGE_SIZE);

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

  const updateQuantity = (productId: string, delta: number) => {
    setPieceQuantities((prev) => ({
      ...prev,
      [productId]: Math.max(0, (prev[productId] ?? 0) + delta),
    }));
    setPricingApproved(false);
  };

  const updateQuantityInput = (productId: string, value: string, maxAllowed?: number) => {
    const parsed = parseInt(value, 10);
    let nextQty = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
    if (typeof maxAllowed === 'number') {
      nextQty = Math.min(nextQty, Math.max(0, maxAllowed));
    }

    setPieceQuantities((prev) => ({
      ...prev,
      [productId]: nextQty,
    }));
    setPricingApproved(false);
  };

  const addToCart = (product: Product) => {
    const qtyUnits = pieceQuantities[product.id] || 0;

    if (qtyUnits === 0) return;

    if (exceedsAvailableStock(product, 0, qtyUnits)) {
      const piecesPerCarton = product.pieces_per_carton || 1;
      const availablePieces = stockPiecesByProduct[product.id] ?? 0;
      const availCartons = Math.floor(availablePieces / piecesPerCarton);
      const availLoose = availablePieces % piecesPerCarton;

      setValidationMessage(`Cannot add ${product.name}. Available: ${availCartons} packs, ${availLoose} units.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantityCartons: 0,
                quantityPieces: item.quantityPieces + qtyUnits,
              }
            : item
        );
      }
      return [
        ...prev,
        {
          product,
          quantityCartons: 0,
          quantityPieces: qtyUnits,
          unitPrice: isWholesale ? product.wholesale_price : product.retail_price,
        },
      ];
    });

    setPieceQuantities((prev) => ({ ...prev, [product.id]: 0 }));
    setPricingApproved(false);
    setValidationMessage(null);
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
    setPricingApproved(false);
  };

  const clearCart = () => {
    setCart([]);
    setValidationMessage(null);
    setPricingApproved(false);
  };

  const subtotal = cart.reduce((acc, item) => {
    const sellingPrice = Number(isWholesale ? item.product.wholesale_price : item.product.retail_price);
    const pricePerPiece = Number(item.unitPrice ?? sellingPrice);
    const effectivePrice = Math.max(0, pricePerPiece - (item.lineDiscount ?? 0));
    const ppc = item.product.pieces_per_carton || 1;
    const totalPieces = (item.quantityCartons || 0) * ppc + (item.quantityPieces || 0);
    return acc + effectivePrice * totalPieces;
  }, 0);

  const estimatedCostFloor = cart.reduce((acc, item) => {
    const ppc = item.product.pieces_per_carton || 1;
    const totalPieces = (item.quantityCartons || 0) * ppc + (item.quantityPieces || 0);
    const floorCost = Math.max(avgCostByProduct[item.product.id] ?? 0, item.product.cost_price ?? 0);
    return acc + floorCost * totalPieces;
  }, 0);

  const wholesaleFloor = cart.reduce((acc, item) => {
    const ppc = item.product.pieces_per_carton || 1;
    const totalPieces = (item.quantityCartons || 0) * ppc + (item.quantityPieces || 0);
    return acc + Number(item.product.wholesale_price ?? 0) * totalPieces;
  }, 0);

  const discount = pricingApproved ? discountAmt : 0;
  const maxRedeemable = customerLoyalty ? Math.min(customerLoyalty.points, Math.floor(subtotal - discount)) : 0;
  const safeRedeem = Math.min(redeemPoints, maxRedeemable);
  const redemptionValue = computeRedemptionValue(safeRedeem);
  const total = Math.max(0, subtotal - discount - redemptionValue);

  // Per-item pricing checks
  const hasBelowCostItem = cart.some(item => {
    const sellingPrice = Number(isWholesale ? item.product.wholesale_price : item.product.retail_price);
    const pricePerPiece = Number(item.unitPrice ?? sellingPrice);
    const effectivePrice = pricePerPiece - (item.lineDiscount ?? 0);
    const costFloor = Math.max(avgCostByProduct[item.product.id] ?? 0, item.product.cost_price ?? 0);
    return effectivePrice < costFloor;
  });
  const hasBelowSellingPriceItem = cart.some(item => {
    const sellingPrice = Number(isWholesale ? item.product.wholesale_price : item.product.retail_price);
    const pricePerPiece = Number(item.unitPrice ?? sellingPrice);
    const effectivePrice = pricePerPiece - (item.lineDiscount ?? 0);
    return effectivePrice < sellingPrice;
  });

  const isBelowCost = total < estimatedCostFloor || hasBelowCostItem;
  const hasBelowWholesaleItemPrice = cart.some(
    (item) => Number(item.unitPrice ?? item.product.wholesale_price) < Number(item.product.wholesale_price)
  );
  const isBelowWholesale = total < wholesaleFloor || hasBelowWholesaleItemPrice || hasBelowSellingPriceItem;
  const needsApproval = (discountAmt > 0 || isBelowWholesale) && !pricingApproved;
  const isFullCredit = paymentSplits.length === 1 && paymentSplits[0].method === 'credit';
  const nonCreditSplits = paymentSplits.filter(s => s.method !== 'credit');
  const hasCreditSplit = paymentSplits.some(s => s.method === 'credit');
  const enteredPaymentAmount = nonCreditSplits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  const autoFillSinglePayment =
    !hasCreditSplit
    && nonCreditSplits.length === 1
    && !nonCreditSplits[0].amount;
  const effectivePaymentAmount = autoFillSinglePayment ? total : enteredPaymentAmount;
  const creditAmount = Math.max(0, total - effectivePaymentAmount);
  const chequeValid = paymentSplits
    .filter(s => s.method === 'cheque')
    .every(s => !!s.cheque_number && !!s.bank_name && !!s.due_date);
  const splitPaymentValid = isFullCredit || !hasCreditSplit || enteredPaymentAmount > 0;
  const canProcessTransaction =
    cart.length > 0
    && !!selectedSalesperson
    && (!hasCreditSplit || !!selectedCustomerId)
    && btnPhase === 'idle'
    && !isBelowCost
    && !needsApproval
    && chequeValid
    && splitPaymentValid
    && (isFullCredit || paymentSplits.some(s => s.method !== 'credit'));

  function handleDiscountChange(val: string) {
    const num = parseFloat(val) || 0;
    setDiscountAmt(num);
    setPricingApproved(false);
  }

  function handleApproveDiscount() {
    const adminPin = getRolePin('admin');
    if (approvalPin === adminPin) {
      setPricingApproved(true);
      setApprovalModalOpen(false);
      setApprovalPin('');
      setApprovalError('');
    } else {
      setApprovalError('Incorrect admin PIN');
      setApprovalPin('');
    }
  }

  // ── Payment split helpers ──────────────────────────────────────────────────
  function updateSplit(id: string, field: string, val: string) {
    setPaymentSplits(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, [field]: val } : s);
      // When entering amount with exactly 2 splits, auto-fill the other as remainder
      if (field === 'amount' && updated.length === 2) {
        const entered = parseFloat(val) || 0;
        const other = updated.find(s => s.id !== id);
        if (other && other.method !== 'credit') {
          const remainder = Math.max(0, total - entered);
          return updated.map(s => s.id === other.id
            ? { ...s, amount: remainder > 0 ? remainder.toFixed(2) : '' }
            : s
          );
        }
      }
      return updated;
    });
  }
  function updateSplitMethod(id: string, method: PayMethod) {
    setPaymentSplits(prev => prev.map(s => s.id === id ? { ...s, method, bank_name: '', cheque_number: '', due_date: '' } : s));
  }
  function removeSplit(id: string) {
    setPaymentSplits(prev => prev.length > 1 ? prev.filter(s => s.id !== id) : prev);
  }
  function addSplit() {
    setPaymentSplits(prev => [...prev, mkSplit('cash')]);
  }

  function updateCartUnitPrice(index: number, value: string) {
    const parsed = Math.max(0, parseFloat(value) || 0);
    setCart((prev) =>
      prev.map((item, i) => (i === index ? { ...item, unitPrice: parsed } : item))
    );
    setPricingApproved(false);
  }

  function updateCartLineDiscount(index: number, value: string) {
    const parsed = Math.max(0, parseFloat(value) || 0);
    setCart((prev) =>
      prev.map((item, i) => (i === index ? { ...item, lineDiscount: parsed || undefined } : item))
    );
    setPricingApproved(false);
  }

  function updateCartQuantity(index: number, value: string) {
    const raw = parseInt(value, 10);
    const qty = isNaN(raw) || raw < 0 ? 0 : raw;
    setCart((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (isInventoryEnforced) {
          const available = stockPiecesByProduct[item.product.id] ?? 0;
          return { ...item, quantityPieces: Math.min(qty, available) };
        }
        return { ...item, quantityPieces: qty };
      })
    );
    setPricingApproved(false);
  }

  async function handleCreateCustomer() {
    if (!newCustName.trim()) return;
    setNewCustSaving(true);
    try {
      const created = await createCustomer({
        name: newCustName.trim(),
        phone: newCustPhone.trim(),
        email: '',
        address: '',
        type: newCustType,
        credit_limit: 0,
        is_active: true,
      } as any);
      setCustomers(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedCustomerId(created.id);
      setShowNewCustomer(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustType('wholesale');
    } catch (e) {
      console.error('Failed to create customer:', e);
    }
    setNewCustSaving(false);
  }

  const processTransaction = async () => {
    if (!canProcessTransaction) return;

    setBtnPhase('loading');

    try {
      // Build concrete payment splits; if only one non-credit method is selected, blank amount means full total.
      const rawSplits = paymentSplits.filter(s => s.method !== 'credit');
      let finalSplits: PaymentSplit[];
      if (!hasCreditSplit && rawSplits.length === 1 && !rawSplits[0].amount) {
        finalSplits = [{ method: rawSplits[0].method as PaymentSplit['method'], amount: total, bank_name: rawSplits[0].bank_name || undefined, cheque_number: rawSplits[0].cheque_number || undefined, due_date: rawSplits[0].due_date || undefined }];
      } else {
        finalSplits = rawSplits
          .map(s => ({ method: s.method as PaymentSplit['method'], amount: parseFloat(s.amount) || 0, bank_name: s.bank_name || undefined, cheque_number: s.cheque_number || undefined, due_date: s.due_date || undefined }))
          .filter(s => s.amount > 0);
      }

      if (!isOnline) {
        // Offline path: single-method only, no loyalty
        const offlineMethod = paymentSplits[0].method === 'credit' ? 'credit' : paymentSplits[0].method;
        const customerName = customers.find(c => c.id === selectedCustomerId)?.name ?? 'Walk-in';
        await checkoutOffline(cart, selectedCustomerId || WALK_IN_CUSTOMER_ID, customerName,
          isWholesale, subtotal, discount, total, offlineMethod, total);
        const count = await getOfflinePendingCount();
        setOfflinePendingCount(count);
        // Show success using same flow
        setValidationMessage(null);
        setBtnPhase('done');
        setTimeout(() => {
          setCart([]);
          setSelectedCustomerId('');
          setDiscountAmt(0);
          setRedeemPoints(0);
          setPricingApproved(false);
          setPaymentSplits([mkSplit('cash')]);
          setSelectedSalesperson('');
          setBtnPhase('idle');
        }, 1600);
        return;
      }

      const { invoiceNo, earnedPoints } = await checkout(
        cart,
        selectedCustomerId || WALK_IN_CUSTOMER_ID,
        isWholesale,
        subtotal,
        discount,
        total,
        finalSplits,
        safeRedeem > 0 ? { redeemPoints: safeRedeem } : undefined,
        selectedSalesperson || undefined
      );

      // Snapshot the receipt before clearing state
      const customerName = customers.find(c => c.id === selectedCustomerId)?.name ?? 'Walk-in';
      setLastSaleReceipt({
        invoiceNo,
        cartSnapshot: [...cart],
        customerName,
        salespersonName: selectedSalespersonName,
        paymentSplits: finalSplits.map(s => ({ method: s.method, amount: s.amount })),
        subtotal,
        discount,
        redeemedPoints: computeRedemptionValue(safeRedeem),
        total,
        isWholesale,
        earnedPoints: selectedCustomerId ? earnedPoints : 0,
        timestamp: new Date(),
      });

      // Refresh loyalty display
      if (earnedPoints > 0 || safeRedeem > 0) {
        getCustomerLoyalty(selectedCustomerId).then(l => setCustomerLoyalty({ points: l.points }));
      }

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
        setIsSuccessModalOpen(true);
        setBtnPhase('idle');
      }, 800);
    } catch (error) {
      console.error('Transaction Failed:', error);
      const message = error instanceof Error ? error.message : 'Transaction failed. See console for details.';
      setValidationMessage(message);
      setBtnPhase('idle');
    }
  };

  const resetAfterSuccess = () => {
    setIsSuccessModalOpen(false);
    setLastSaleReceipt(null);
    setCart([]);
    setSelectedCustomerId('');
    setDiscountAmt(0);
    setRedeemPoints(0);
    setPricingApproved(false);
    setValidationMessage(null);
    setPaymentSplits([mkSplit('cash')]);
    setSelectedSalesperson('');
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
                  placeholder="Search products or item codes..."
                />
            </label>
            <div className="pos-mode-toggle">
              <button type="button" className={cn(isWholesale && 'active')} onClick={() => setIsWholesale(true)}>
                Dealer
              </button>
              <button type="button" className={cn(!isWholesale && 'active')} onClick={() => setIsWholesale(false)}>
                Public
              </button>
              <button
                type="button"
                onClick={() => loadData(true)}
                disabled={refreshing}
                title={`Last refreshed: ${lastRefreshed.toLocaleTimeString()}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-900/20 border border-emerald-700/30 text-emerald-400 text-[14px] font-bold hover:bg-emerald-900/30 transition-all disabled:opacity-60"
              >
                <span className={cn('w-1.5 h-1.5 rounded-full bg-emerald-400', refreshing ? 'animate-pulse' : 'opacity-80')} />
                <RefreshCw size={11} className={cn(refreshing && 'animate-spin')} />
                {refreshing ? 'Syncing…' : 'LIVE'}
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
              key={`${selectedCategory}-${productPage}`}
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
              {pagedProducts.map((product) => {
                const qtyUnits = pieceQuantities[product.id] || 0;
                const piecesPerCarton = product.pieces_per_carton || 1;

                const selectedPieces = qtyUnits;
                const inCartPieces = getCartPiecesForProduct(product.id);
                const availablePieces = isInventoryEnforced ? (stockPiecesByProduct[product.id] ?? 0) : Number.MAX_SAFE_INTEGER;
                const remainingPieces = isInventoryEnforced ? Math.max(0, availablePieces - inCartPieces) : Number.MAX_SAFE_INTEGER;
                const availableCartons = isInventoryEnforced ? Math.floor(remainingPieces / piecesPerCarton) : 0;

                const canIncreasePieces = !isInventoryEnforced || (selectedPieces + 1) <= remainingPieces;
                const exceedsStock = isInventoryEnforced && selectedPieces > remainingPieces;
                const hasAmount = qtyUnits > 0;
                
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
                    <p>
                      {isInventoryEnforced
                        ? `Available ${remainingPieces} units • ${availableCartons} cartons`
                        : 'Inventory not enforced'}
                    </p>
                    <h4>{product.name}</h4>
                    <p className="text-[13px] text-gray-400">{product.item_code}</p>
                    <strong>LKR {(isWholesale ? product.wholesale_price : product.retail_price).toFixed(2)}</strong>
                    <p className="text-[14px] text-gray-500">Qty per carton: {piecesPerCarton}</p>
                  </div>

                  <div className="pos-qty-group">
                    <div className="pos-qty-row">
                      <span>QTY {qtyUnits}</span>
                      <div>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={qtyUnits}
                          onChange={(e) => updateQuantityInput(
                            product.id,
                            e.target.value,
                            isInventoryEnforced ? remainingPieces : undefined
                          )}
                          onFocus={(e) => e.target.select()}
                          className="w-16 bg-[#1d222a] border border-[#2b313a] text-[14px] text-gray-200 rounded px-1.5 py-0.5 outline-none focus:border-primary/40 font-mono"
                          aria-label={`Enter quantity for ${product.name}`}
                        />
                        <button type="button" onClick={() => updateQuantity(product.id, -1)} disabled={qtyUnits === 0}>
                          <Minus size={14} />
                        </button>
                        <button type="button" onClick={() => updateQuantity(product.id, 1)} disabled={!canIncreasePieces}>
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

          {/* Pagination */}
          <div className="flex items-center justify-between px-1 pt-3 pb-1">
            <button
              type="button"
              onClick={() => setProductPage(p => Math.max(0, p - 1))}
              disabled={productPage === 0}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border',
                productPage === 0
                  ? 'border-[#2b313a] text-gray-600 cursor-not-allowed opacity-40'
                  : 'border-[#2b313a] text-gray-300 hover:border-primary/40 hover:text-white'
              )}
            >
              <Minus size={12} /> Prev
            </button>
            <span className="text-[13px] text-gray-500 font-mono">
              {productPage + 1} / {Math.max(1, totalPages)}
              <span className="text-gray-600 ml-1.5">({categoryProducts.length})</span>
            </span>
            <button
              type="button"
              onClick={() => setProductPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={productPage >= totalPages - 1}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border',
                productPage >= totalPages - 1
                  ? 'border-[#2b313a] text-gray-600 cursor-not-allowed opacity-40'
                  : 'border-[#2b313a] text-gray-300 hover:border-primary/40 hover:text-white'
              )}
            >
              Next <Plus size={12} />
            </button>
          </div>
        </section>

        <aside className="pos-bill">
          {/* Offline banner */}
          {!isOnline && (
            <div style={{
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 10, padding: '8px 12px', margin: '0 0 8px 0',
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#f87171',
            }}>
              <WifiOff size={13} />
              <span style={{ flex: 1, fontWeight: 700 }}>Offline — sale will sync when connected</span>
              {offlinePendingCount > 0 && <span style={{ fontWeight: 700 }}>{offlinePendingCount} pending</span>}
            </div>
          )}
          {isOnline && offlinePendingCount > 0 && (
            <div style={{
              background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
              borderRadius: 10, padding: '8px 12px', margin: '0 0 8px 0',
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#fbbf24',
            }}>
              <span style={{ flex: 1, fontWeight: 700 }}>{offlinePendingCount} offline sale{offlinePendingCount > 1 ? 's' : ''} pending sync</span>
              <button type="button" onClick={handleSync} disabled={isSyncing}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fbbf24', padding: 0 }}>
                <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
              </button>
            </div>
          )}
          <div className="pos-bill-head">
            <div>
              <h2>Digital Goods POS</h2>
              <p>{customers.find((c) => c.id === selectedCustomerId)?.name ?? 'Direct Customer'}</p>
              {selectedSalesperson && (
                <p style={{ fontSize: 10, color: '#6ee7b7', fontWeight: 700, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <UserCheck size={10} /> Sold by {selectedSalespersonName}
                </p>
              )}
              <button
                type="button"
                onClick={() => navigate('/returns')}
                className="mt-2 text-[14px] font-bold uppercase tracking-wider text-primary hover:text-white transition-colors"
              >
                Open Returns
              </button>
            </div>
            {cart.length > 0 && (
              <button type="button" onClick={clearCart} className="pos-clear-btn">
                <Trash2 size={14} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <div className="pos-customer-select" style={{ flex: 1 }}>
              <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
                <option value="" disabled>Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setShowNewCustomer(v => !v)}
              title="New customer"
              style={{
                flexShrink: 0, width: 36, borderRadius: 10,
                background: showNewCustomer ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                border: showNewCustomer ? '1px solid rgba(99,102,241,0.4)' : '1px solid #2b313a',
                color: showNewCustomer ? '#818cf8' : '#6b7280',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 18, fontWeight: 300,
              }}
            >
              {showNewCustomer ? <X size={14} /> : <PlusCircle size={14} />}
            </button>
          </div>

          {/* Inline new-customer form */}
          {showNewCustomer && (
            <div style={{
              background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 12, padding: '12px 12px 10px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                New Customer
              </p>
              <input
                type="text"
                placeholder="Name *"
                value={newCustName}
                onChange={e => setNewCustName(e.target.value)}
                autoFocus
                style={{
                  background: '#1d222a', border: '1px solid #2b313a', borderRadius: 8,
                  padding: '7px 10px', color: '#f1f5f9', fontSize: 12, outline: 'none', width: '100%',
                }}
              />
              <input
                type="tel"
                placeholder="Phone (optional)"
                value={newCustPhone}
                onChange={e => setNewCustPhone(e.target.value)}
                style={{
                  background: '#1d222a', border: '1px solid #2b313a', borderRadius: 8,
                  padding: '7px 10px', color: '#f1f5f9', fontSize: 12, outline: 'none', width: '100%',
                }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                {(['wholesale', 'retail'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setNewCustType(t)}
                    style={{
                      flex: 1, padding: '5px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', textTransform: 'capitalize',
                      background: newCustType === t ? 'rgba(99,102,241,0.2)' : '#1d222a',
                      border: newCustType === t ? '1px solid rgba(99,102,241,0.4)' : '1px solid #2b313a',
                      color: newCustType === t ? '#818cf8' : '#6b7280',
                    }}
                  >{t}</button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleCreateCustomer}
                disabled={!newCustName.trim() || newCustSaving}
                style={{
                  background: newCustName.trim() ? '#6366f1' : '#2b313a',
                  border: 'none', borderRadius: 8, padding: '8px',
                  color: newCustName.trim() ? '#fff' : '#4b5563',
                  fontSize: 12, fontWeight: 700, cursor: newCustName.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                {newCustSaving ? 'Saving…' : 'Add & Select'}
              </button>
            </div>
          )}

          {/* Salesperson selector */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 6,
            background: selectedSalesperson ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${selectedSalesperson ? 'rgba(16,185,129,0.25)' : '#2b313a'}`,
            borderRadius: 10, padding: '8px 10px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserCheck size={13} style={{ color: selectedSalesperson ? '#6ee7b7' : '#6b7280', flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ color: '#9ca3af', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Salesperson</span>
                <span style={{ color: selectedSalesperson ? '#e5e7eb' : '#6b7280', fontSize: 11 }}>
                  {selectedSalespersonName || 'Assign a salesperson to this sale'}
                </span>
              </div>
            </div>

            {salespersonOptions.length > 0 ? (
              <SearchableSelect
                value={selectedSalesperson}
                onChange={setSelectedSalesperson}
                options={salespersonOptions}
                placeholder="Select salesperson"
                className="w-full"
              />
            ) : (
              <div style={{
                border: '1px dashed #2b313a', borderRadius: 10,
                padding: '10px 12px', color: '#6b7280', fontSize: 12,
                background: 'rgba(255,255,255,0.02)',
              }}>
                No active salespeople found. Add or activate one before taking this sale.
              </div>
            )}
          </div>

          {/* Loyalty points */}
          {customerLoyalty && customerLoyalty.points > 0 && !isOnline === false && (
            <div style={{
              background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)',
              borderRadius: 10, padding: '8px 12px', margin: '4px 0',
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 11,
            }}>
              <Star size={12} style={{ color: '#a78bfa', flexShrink: 0 }} />
              <span style={{ color: '#c4b5fd', flex: 1 }}>
                <strong>{customerLoyalty.points}</strong> loyalty pts available
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: '#7c3aed', fontSize: 10 }}>Redeem</span>
                <input
                  type="number"
                  min="0"
                  max={maxRedeemable}
                  value={redeemPoints || ''}
                  onChange={e => setRedeemPoints(Math.min(maxRedeemable, Math.max(0, parseInt(e.target.value) || 0)))}
                  placeholder="0"
                  style={{
                    width: 60, background: '#1d222a', border: '1px solid rgba(139,92,246,0.3)',
                    borderRadius: 6, padding: '3px 6px', color: '#c4b5fd',
                    fontSize: 11, fontFamily: 'monospace', outline: 'none', textAlign: 'right',
                  }}
                />
                <span style={{ color: '#6b7280', fontSize: 10 }}>= LKR {safeRedeem.toFixed(0)}</span>
              </div>
            </div>
          )}

          <div className="pos-cart-list custom-scrollbar">
            {cart.length === 0 && <p className="pos-cart-empty">No items yet</p>}
            <AnimatePresence>
              {cart.map((item, index) => {
                const ppc = item.product.pieces_per_carton || 1;
                const totalPieces = (item.quantityCartons || 0) * ppc + (item.quantityPieces || 0);
                const pricePerPiece = Number(
                  item.unitPrice ?? (isWholesale ? item.product.wholesale_price : item.product.retail_price)
                );

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
                        <p className="text-[14px] text-gray-400">{item.product.item_code}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[13px] text-gray-500 uppercase">Qty</span>
                          <input
                            type="number"
                            min="1"
                            value={item.quantityPieces || ''}
                            onChange={(e) => updateCartQuantity(index, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-16 bg-[#1d222a] border border-[#2b313a] text-[14px] text-gray-200 rounded px-1.5 py-0.5 outline-none focus:border-primary/40 font-mono"
                          />
                          <span className="text-[13px] text-gray-600">units</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="text-[13px] text-gray-500 uppercase">Sale price</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={pricePerPiece}
                            onChange={(e) => updateCartUnitPrice(index, e.target.value)}
                            className="w-20 bg-[#1d222a] border border-[#2b313a] text-[14px] text-gray-300 rounded px-1.5 py-0.5 outline-none focus:border-primary/40 font-mono"
                          />
                        </div>
                        {(() => {
                          const sellingPrice = Number(isWholesale ? item.product.wholesale_price : item.product.retail_price);
                          const costFloor = Math.max(avgCostByProduct[item.product.id] ?? 0, item.product.cost_price ?? 0);
                          const effectivePrice = pricePerPiece - (item.lineDiscount ?? 0);
                          const isBelowCostItem = effectivePrice < costFloor;
                          const isBelowSellingItem = effectivePrice < sellingPrice;
                          return (
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="text-[13px] text-gray-500 uppercase">Discount</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.lineDiscount || ''}
                                onChange={(e) => updateCartLineDiscount(index, e.target.value)}
                                placeholder="0"
                                className={`w-20 bg-[#1d222a] border text-[14px] rounded px-1.5 py-0.5 outline-none font-mono ${
                                  isBelowCostItem
                                    ? 'border-red-500/60 text-red-400'
                                    : isBelowSellingItem
                                    ? 'border-amber-500/60 text-amber-300'
                                    : 'border-[#2b313a] text-gray-300'
                                }`}
                              />
                              {(item.lineDiscount ?? 0) > 0 && (
                                <span className={`text-[13px] font-mono font-bold ${
                                  isBelowCostItem ? 'text-red-400' : isBelowSellingItem ? 'text-amber-400' : 'text-emerald-400'
                                }`}>
                                  {isBelowCostItem ? '✕ below cost' : isBelowSellingItem ? '⚠ needs auth' : `= ${effectivePrice.toFixed(0)}`}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        <div className="mt-1">
                          <select
                            value={item.batchId || ''}
                            onChange={(e) => {
                              const newCart = [...cart];
                              newCart[index].batchId = e.target.value || undefined;
                              setCart(newCart);
                            }}
                            className="bg-[#1d222a] border border-[#2b313a] text-[13px] text-gray-400 rounded px-1.5 py-0.5 outline-none focus:border-primary/40"
                          >
                            <option value="">Auto Allocate (Oldest Lot First)</option>
                            {(availableBatches[item.product.id] || []).map(b => (
                              <option key={b.id} value={b.id}>
                                Lot: {b.shipments?.reference || 'Direct Entry'} ({b.received_at ? new Date(b.received_at).toLocaleDateString() : '—'})
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
                {(discountAmt > 0 || isBelowWholesale) && !pricingApproved && (
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
                    Authorize
                  </button>
                )}
                {pricingApproved && (discountAmt > 0 || isBelowWholesale) && (
                  <span style={{ fontSize: 10, color: '#34d399', fontWeight: 700 }}>✓ Approved</span>
                )}
              </div>
            </div>
            {safeRedeem > 0 && (
              <div>
                <span style={{ color: '#a78bfa' }}>Loyalty ({safeRedeem} pts)</span>
                <strong style={{ color: '#a78bfa' }}>− LKR <AnimatedNumber value={redemptionValue} /></strong>
              </div>
            )}
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
                    {isBelowWholesale
                      ? `Total is below wholesale floor (LKR ${wholesaleFloor.toFixed(2)}). Admin authorisation required.`
                      : `Discount of LKR ${discountAmt.toFixed(2)} requires admin authorisation.`}
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

          {/* Credit limit info */}
          {(isFullCredit || hasCreditSplit || creditAmount > 0.01) && creditLimitInfo && (
            <div style={{
              background: creditLimitInfo.available >= creditAmount ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${creditLimitInfo.available >= creditAmount ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.3)'}`,
              borderRadius: 10, padding: '7px 12px', fontSize: 11,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ color: '#9ca3af' }}>Credit limit: <strong style={{ color: '#e5e7eb' }}>
                LKR {creditLimitInfo.limit.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </strong></span>
              <span style={{ color: creditLimitInfo.available >= creditAmount ? '#6ee7b7' : '#f87171', fontWeight: 700 }}>
                Available: LKR {creditLimitInfo.available.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {needsApproval && (
            <div className="pos-warning" style={{ background: 'rgba(251,191,36,0.08)', borderColor: 'rgba(251,191,36,0.3)', color: '#fbbf24' }}>
              Discount or below-wholesale pricing requires admin approval before checkout
            </div>
          )}

          {isBelowWholesale && (
            <div className="pos-warning" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}>
              ⚠ Below wholesale floor: LKR {wholesaleFloor.toFixed(2)}
            </div>
          )}

          {isBelowCost && (
            <div className="pos-warning">Below cost floor: LKR {estimatedCostFloor.toFixed(2)}</div>
          )}

          {validationMessage && <div className="pos-error">{validationMessage}</div>}
          {!splitPaymentValid && (
            <div className="pos-warning" style={{ background: 'rgba(251,191,36,0.08)', borderColor: 'rgba(251,191,36,0.3)', color: '#fbbf24' }}>
              Enter the cash, card, online, or cheque amount before putting the balance on credit.
            </div>
          )}

          {/* ── Payment ──────────────────────────────────────────── */}
          {(() => {
            const outstanding = Math.max(0, total - effectivePaymentAmount);
            const SL_BANKS = [
              'BOC – Bank of Ceylon', 'NSB – National Savings Bank', "People's Bank",
              'HNB – Hatton National Bank', 'Sampath Bank', 'Commercial Bank',
              'Seylan Bank', 'NDB – National Development Bank', 'DFCC Bank',
              'Pan Asia Bank', 'Union Bank', 'Amana Bank', 'MCB Bank', 'Other',
            ];
            const fieldStyle: React.CSSProperties = { background: '#0d1016', border: '1px solid #2b313a', borderRadius: 7, padding: '5px 8px', color: '#f1f5f9', fontSize: 11, outline: 'none', fontFamily: 'monospace', width: '100%' };

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

                {/* Section header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Payment Lines</span>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#9ca3af' }}>Due <strong style={{ color: '#f1f5f9' }}>LKR {total.toFixed(2)}</strong></span>
                </div>

                {/* Lines table */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {paymentSplits.map((split, idx) => {
                    const isCreditLine = split.method === 'credit';
                    const isSingleLine = paymentSplits.length === 1;
                    return (
                      <div key={split.id} style={{
                        background: '#12161d', border: '1px solid #2b313a',
                        borderRadius: 10, padding: '8px 10px',
                        display: 'flex', flexDirection: 'column', gap: 6,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 10, color: '#4b5563', fontFamily: 'monospace', minWidth: 12 }}>{idx + 1}</span>

                          <select
                            value={split.method}
                            onChange={e => updateSplitMethod(split.id, e.target.value as PayMethod)}
                            style={{
                              flex: '0 0 86px', background: '#1d222a', border: '1px solid #2b313a',
                              borderRadius: 7, padding: '5px 6px', color: '#d1d5db',
                              fontSize: 11, fontWeight: 600, outline: 'none', cursor: 'pointer',
                            }}
                          >
                            <option value="cash">Cash</option>
                            <option value="card">Card</option>
                            <option value="online">Online</option>
                            <option value="cheque">Cheque</option>
                            <option value="credit">Credit</option>
                          </select>

                          {isCreditLine ? (
                            <div style={{
                              flex: 1, background: '#1d222a', border: '1px solid #2b313a',
                              borderRadius: 7, padding: '5px 8px', color: '#9ca3af',
                              fontSize: 12, fontFamily: 'monospace', textAlign: 'right',
                            }}>
                              {outstanding > 0 ? outstanding.toFixed(2) : '0.00'}
                            </div>
                          ) : isSingleLine ? (
                            <div style={{
                              flex: 1, background: '#1d222a', border: '1px solid #2b313a',
                              borderRadius: 7, padding: '5px 8px', color: '#e5e7eb',
                              fontSize: 12, fontFamily: 'monospace', textAlign: 'right',
                            }}>
                              {total.toFixed(2)}
                            </div>
                          ) : (
                            <input
                              type="number" min="0" step="0.01"
                              placeholder="0.00"
                              value={split.amount}
                              onChange={e => updateSplit(split.id, 'amount', e.target.value)}
                              onFocus={e => e.target.select()}
                              style={{ flex: 1, ...fieldStyle, textAlign: 'right' }}
                            />
                          )}

                          {!isSingleLine && (
                            <button type="button" onClick={() => removeSplit(split.id)}
                              style={{ color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 0, padding: 2, flexShrink: 0 }}>
                              <X size={13} />
                            </button>
                          )}
                        </div>

                        {split.method === 'cheque' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 18 }}>
                            <input type="text" placeholder="Cheque number" value={split.cheque_number}
                              onChange={e => updateSplit(split.id, 'cheque_number', e.target.value)} style={fieldStyle} />
                            <select value={split.bank_name} onChange={e => updateSplit(split.id, 'bank_name', e.target.value)}
                              style={{ ...fieldStyle, color: split.bank_name ? '#e5e7eb' : '#6b7280', cursor: 'pointer' }}>
                              <option value="">Select bank…</option>
                              {SL_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                            <input type="date" value={split.due_date}
                              onChange={e => updateSplit(split.id, 'due_date', e.target.value)}
                              style={{ ...fieldStyle, color: split.due_date ? '#e5e7eb' : '#6b7280' }} />
                          </div>
                        )}

                        {split.method === 'online' && (
                          <div style={{ paddingLeft: 18 }}>
                            <select value={split.bank_name} onChange={e => updateSplit(split.id, 'bank_name', e.target.value)}
                              style={{ ...fieldStyle, color: split.bank_name ? '#e5e7eb' : '#6b7280', cursor: 'pointer' }}>
                              <option value="">Select bank…</option>
                              {SL_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add line */}
                <button type="button" onClick={addSplit}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    background: 'none', border: '1px dashed #2b313a', borderRadius: 8,
                    padding: '6px', color: '#4b5563', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <PlusCircle size={11} /> Add Payment Line
                </button>

                {/* Summary strip — only shown when there's something to communicate */}
                {(paymentSplits.length > 1 || outstanding > 0.01) && (
                  <div style={{ borderTop: '1px solid #1f242c', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {paymentSplits.length > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span style={{ color: '#6b7280' }}>Paid</span>
                        <span style={{ fontFamily: 'monospace', color: '#d1d5db' }}>LKR {effectivePaymentAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {outstanding > 0.01 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span style={{ color: '#9ca3af' }}>Balance on credit</span>
                        <span style={{ fontFamily: 'monospace', color: '#d1d5db' }}>LKR {outstanding.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          <button
            type="button"
            className="pos-submit relative overflow-hidden"
            onClick={processTransaction}
            disabled={!canProcessTransaction}
            style={{
              background: btnPhase === 'done' ? '#16a34a' : undefined,
              transition: 'background 0.3s ease',
              marginTop: 4,
              boxShadow: '0 -8px 16px #111315',
            }}
          >
            {/* invisible spacer — keeps the button's natural height */}
            <span className="invisible select-none" aria-hidden>Complete Sale</span>
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
                  Complete Sale
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

      <Modal isOpen={isSuccessModalOpen} onClose={resetAfterSuccess} title="Transaction Complete">
        <div style={{ maxHeight: '80vh', overflowY: 'auto', padding: '8px 0' }}>
          {lastSaleReceipt ? (
            <POSSaleReceipt data={lastSaleReceipt} onClose={resetAfterSuccess} />
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400">Payment Completed</p>
              <button
                type="button"
                onClick={resetAfterSuccess}
                className="mt-4 w-full h-[52px] bg-[#f8fafc] text-black border border-[#f8fafc] rounded-2xl font-bold text-sm hover:bg-white transition-all active:scale-[0.98]"
              >
                Back to POS
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
