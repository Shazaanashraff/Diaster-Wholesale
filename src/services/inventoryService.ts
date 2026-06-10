import { supabase } from '../lib/supabase';
import type { Product, ProductStock, StockAdjustment } from '../types';

/** Columns for stock views — avoids select('*') egress. */
export const SHOP_STOCK_COLUMNS =
  'product_id, item_code, name, model, category, wholesale_price, retail_price, pieces_per_carton, reorder_level, cartons_in, pieces_in, cartons_sold, pieces_sold, carton_adj, piece_adj' as const;

export const PRODUCT_STOCK_COLUMNS = SHOP_STOCK_COLUMNS;

function mapShopStockRowToProduct(r: ProductStock): Product {
  return {
    id: r.product_id,
    item_code: r.item_code,
    name: r.name,
    model: r.model ?? '',
    category: r.category ?? 'general',
    wholesale_price: Number(r.wholesale_price ?? 0),
    retail_price: Number(r.retail_price ?? 0),
    pieces_per_carton: r.pieces_per_carton ?? 1,
    reorder_level: r.reorder_level ?? 0,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as Product;
}

export type StockLocation = 'store' | 'shop';

export interface InventoryByLocationRow {
  product_id: string;
  item_code: string;
  name: string;
  pieces_per_carton: number;
  location_id: string | null;
  location_name: string | null;
  location_type: 'warehouse' | 'shop' | null;
  total_units: number;
}

export interface StockLedgerEntry {
  id: string;
  product_id: string;
  item_code: string;
  product_name: string;
  quantity: number;
  action: string;
  location: string;
  reference: string;
  actor: string;
  created_at: string;
}

// ============================================================
// Inventory Service — queries against Supabase
// ============================================================

/**
 * Fetch all rows from the product_stock view, ordered by name (A-Z).
 * Returns TOTAL stock across all locations (warehouse + shop).
 * Used by admin/accountant Inventory page.
 */
export async function getInventory(): Promise<ProductStock[]> {
  const { data, error } = await supabase
    .from('product_stock')
    .select(PRODUCT_STOCK_COLUMNS)
    .order('name', { ascending: true });

  if (error) {
    console.error('getInventory error:', error.message);
    throw new Error(error.message);
  }

  return data as ProductStock[];
}

/**
 * Fetch stock split by location from product_stock_by_location.
 * Used by Inventory page for location-wise filtering.
 */
export async function getInventoryByLocation(): Promise<InventoryByLocationRow[]> {
  const { data, error } = await supabase
    .from('product_stock_by_location')
    .select('product_id, item_code, name, pieces_per_carton, location_id, location_name, location_type, total_units')
    .order('location_name', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('getInventoryByLocation error:', error.message);
    throw new Error(error.message);
  }

  return (data ?? []) as InventoryByLocationRow[];
}

/**
 * Single shop_stock fetch for POS — products + inventory rows (one round trip).
 */
export async function getPosShopCatalog(): Promise<{
  products: Product[];
  inventory: ProductStock[];
}> {
  const { data, error } = await supabase
    .from('shop_stock')
    .select(SHOP_STOCK_COLUMNS)
    .order('name', { ascending: true });

  if (error) {
    console.error('getPosShopCatalog error:', error.message);
    throw new Error(error.message);
  }

  const inventory = (data ?? []) as ProductStock[];
  const products = inventory
    .filter((r) => Number(r.cartons_in) > 0 || Number(r.pieces_in) > 0)
    .map(mapShopStockRowToProduct);

  return { products, inventory };
}

/**
 * Fetch stock from the shop_stock view — only products physically in the shop.
 * Used by POS cashier. Stock only appears here after a Warehouse→Shop transfer.
 */
export async function getShopInventory(): Promise<ProductStock[]> {
  const { inventory } = await getPosShopCatalog();
  return inventory;
}

/**
 * Insert a stock adjustment row.
 * Accepts carton and piece deltas (can be negative for reductions).
 */
export async function insertStockAdjustment(
  data: Omit<StockAdjustment, 'id' | 'created_at'>
): Promise<StockAdjustment> {
  const { data: row, error } = await supabase
    .from('stock_adjustments')
    .insert(data)
    .select()
    .single();

  if (error) {
    console.error('insertStockAdjustment error:', error.message);
    throw new Error(error.message);
  }

  return row as StockAdjustment;
}

/**
 * Fetch movement rates (units sold in last 30 days) keyed by product_id.
 */
export async function getMovementRates(): Promise<Record<string, { units30d: number; perDay: number }>> {
  const { data, error } = await supabase
    .from('product_movement_30d')
    .select('product_id, units_sold_30d, units_per_day');

  if (error) {
    console.warn('getMovementRates:', error.message);
    return {};
  }

  const result: Record<string, { units30d: number; perDay: number }> = {};
  for (const row of data ?? []) {
    result[row.product_id] = {
      units30d: Number(row.units_sold_30d),
      perDay: Number(row.units_per_day),
    };
  }
  return result;
}

/**
 * Fetch weighted average cost per piece for a product list.
 * This is used by POS to prevent discounting below cost.
 */
export async function getAverageCostPerPiece(
  productIds: string[]
): Promise<Record<string, number>> {
  if (productIds.length === 0) return {};

  const { data, error } = await supabase
    .from('stock_batches')
    .select(`
      product_id,
      cartons,
      loose_pieces,
      cost_per_piece,
      products!inner ( pieces_per_carton )
    `)
    .in('product_id', productIds);

  if (error) {
    console.error('getAverageCostPerPiece error:', error.message);
    throw new Error(error.message);
  }

  const totals: Record<string, { pieces: number; cost: number }> = {};

  for (const row of (data ?? []) as Array<{
    product_id: string;
    cartons: number;
    loose_pieces: number;
    cost_per_piece: number;
    products?: { pieces_per_carton?: number } | Array<{ pieces_per_carton?: number }>;
  }>) {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    const piecesPerCarton = Number(product?.pieces_per_carton ?? 1) || 1;
    const batchPieces = Number(row.cartons ?? 0) * piecesPerCarton + Number(row.loose_pieces ?? 0);
    const batchCost = batchPieces * Number(row.cost_per_piece ?? 0);

    if (!totals[row.product_id]) {
      totals[row.product_id] = { pieces: 0, cost: 0 };
    }

    totals[row.product_id].pieces += batchPieces;
    totals[row.product_id].cost += batchCost;
  }

  const averages: Record<string, number> = {};
  for (const [productId, total] of Object.entries(totals)) {
    averages[productId] = total.pieces > 0 ? total.cost / total.pieces : 0;
  }

  return averages;
}

/**
 * Fetch all available stock batches for a list of products.
 * Ordered by received_at (FIFO).
 */
export async function getBatchesForProducts(productIds: string[]): Promise<any[]> {
  if (productIds.length === 0) return [];
  const { data, error } = await supabase
    .from('stock_batches')
    .select('id, product_id, cartons, loose_pieces, cost_per_piece, notes, received_at, shipments(reference)')
    .in('product_id', productIds)
    .gt('cartons', 0)
    .order('received_at', { ascending: true });
  
  if (error) throw new Error(error.message);
  return data;
}

export async function transferStoreToShop(data: {
  product_id: string;
  units: number;
  note?: string;
  transferred_by: string;
}): Promise<void> {
  const units = Math.max(0, Math.floor(data.units));
  if (units <= 0) {
    throw new Error('Transfer quantity must be greater than zero.');
  }

  const suffix = data.note?.trim() ? ` ${data.note.trim()}` : '';
  const rows = [
    {
      product_id: data.product_id,
      adjustment_pieces: -units,
      reason: `[TRANSFER-OUT STORE->SHOP]${suffix}`,
      adjusted_by: data.transferred_by,
    },
    {
      product_id: data.product_id,
      adjustment_pieces: units,
      reason: `[TRANSFER-IN STORE->SHOP]${suffix}`,
      adjusted_by: data.transferred_by,
    },
  ];

  const { error } = await supabase.from('stock_adjustments').insert(rows);
  if (error) {
    throw new Error(error.message);
  }
}

export async function getStockLedger(productId?: string, limit = 200): Promise<StockLedgerEntry[]> {
  type ProductJoin = { name?: string; item_code?: string; pieces_per_carton?: number } | Array<{ name?: string; item_code?: string; pieces_per_carton?: number }>;
  type ShipmentJoin = { reference?: string } | Array<{ reference?: string }>;
  type InvoiceJoin = { invoice_no?: string; created_at?: string } | Array<{ invoice_no?: string; created_at?: string }>;
  type LocationJoin = { name?: string; type?: string } | Array<{ name?: string; type?: string }>;
  type StockInRow = {
    id: string;
    product_id: string;
    cartons: number;
    loose_pieces: number;
    notes: string;
    received_at: string;
    products?: ProductJoin;
    shipments?: ShipmentJoin;
    locations?: LocationJoin;
  };
  type SalesRow = {
    id: string;
    product_id: string;
    cartons: number;
    pieces: number;
    created_at: string;
    products?: ProductJoin;
    invoices?: InvoiceJoin;
  };
  type AdjustmentRow = {
    id: string;
    product_id: string;
    adjustment_pieces: number;
    reason: string;
    adjusted_by: string;
    created_at: string;
    products?: ProductJoin;
    locations?: LocationJoin;
  };

  let stockBatchQuery = supabase
    .from('stock_batches')
    .select('id, product_id, cartons, loose_pieces, notes, received_at, products(name, item_code, pieces_per_carton), shipments(reference), locations(name, type)')
    .order('received_at', { ascending: false })
    .limit(limit);

  let salesQuery = supabase
    .from('invoice_items')
    .select('id, product_id, cartons, pieces, created_at, products(name, item_code, pieces_per_carton), invoices(invoice_no, created_at)')
    .order('created_at', { ascending: false })
    .limit(limit);

  let adjustmentQuery = supabase
    .from('stock_adjustments')
    .select('id, product_id, adjustment_pieces, reason, adjusted_by, created_at, products(name, item_code), locations(name, type)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (productId) {
    stockBatchQuery = stockBatchQuery.eq('product_id', productId);
    salesQuery = salesQuery.eq('product_id', productId);
    adjustmentQuery = adjustmentQuery.eq('product_id', productId);
  }

  const [
    { data: stockInRows, error: stockInError },
    { data: salesRows, error: salesError },
    { data: adjustmentRows, error: adjustmentError },
  ] = await Promise.all([stockBatchQuery, salesQuery, adjustmentQuery]);

  if (stockInError) throw new Error(stockInError.message);
  if (salesError) throw new Error(salesError.message);
  if (adjustmentError) throw new Error(adjustmentError.message);

  const stockInLedger = ((stockInRows ?? []) as StockInRow[]).map((row) => {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    const shipment = Array.isArray(row.shipments) ? row.shipments[0] : row.shipments;
    const locationObj = Array.isArray(row.locations) ? row.locations[0] : row.locations;
    const piecesPerCarton = Number(product?.pieces_per_carton ?? 1) || 1;
    const quantity = Number(row.cartons ?? 0) * piecesPerCarton + Number(row.loose_pieces ?? 0);
    return {
      id: `stock-${row.id}`,
      product_id: row.product_id,
      item_code: product?.item_code ?? '-',
      product_name: product?.name ?? 'Unknown Product',
      quantity,
      action: 'Stock In',
      location: locationObj?.name ?? 'Store',
      reference: shipment?.reference ?? row.notes ?? '',
      actor: 'procurement',
      created_at: row.received_at,
    };
  });

  const salesLedger = ((salesRows ?? []) as SalesRow[]).map((row) => {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    const invoice = Array.isArray(row.invoices) ? row.invoices[0] : row.invoices;
    const piecesPerCarton = Number(product?.pieces_per_carton ?? 1) || 1;
    const quantity = -1 * (Number(row.cartons ?? 0) * piecesPerCarton + Number(row.pieces ?? 0));
    return {
      id: `sale-${row.id}`,
      product_id: row.product_id,
      item_code: product?.item_code ?? '-',
      product_name: product?.name ?? 'Unknown Product',
      quantity,
      action: 'Sale',
      location: 'shop' as const,
      reference: invoice?.invoice_no ?? '',
      actor: 'pos',
      created_at: invoice?.created_at ?? row.created_at,
    };
  });

  const adjustmentLedger = ((adjustmentRows ?? []) as AdjustmentRow[]).map((row) => {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    const locationObj = Array.isArray(row.locations) ? row.locations[0] : row.locations;
    const reason = String(row.reason ?? '');
    let action = Number(row.adjustment_pieces) >= 0 ? 'Adjustment In' : 'Adjustment Out';
    let location = locationObj?.name ?? '—';

    if (reason.startsWith('[CANCEL]')) {
      action = 'Invoice Cancelled';
      location = locationObj?.name ?? 'Main Shop';
    } else if (reason.startsWith('[TRANSFER-OUT STORE->SHOP]') || /^Transfer out:/i.test(reason)) {
      action = 'Transfer Out';
      location = locationObj?.name ?? 'Main Warehouse';
    } else if (reason.startsWith('[TRANSFER-IN STORE->SHOP]') || /^Transfer in:/i.test(reason)) {
      action = 'Transfer In';
      location = locationObj?.name ?? 'Main Shop';
    } else if (reason.toLowerCase().includes('return')) {
      action = 'Sale Return';
      location = locationObj?.name ?? 'Main Shop';
    }

    return {
      id: `adj-${row.id}`,
      product_id: row.product_id,
      item_code: product?.item_code ?? '-',
      product_name: product?.name ?? 'Unknown Product',
      quantity: Number(row.adjustment_pieces ?? 0),
      action,
      location,
      reference: reason,
      actor: row.adjusted_by || 'system',
      created_at: row.created_at,
    };
  });

  return [...stockInLedger, ...salesLedger, ...adjustmentLedger]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}
