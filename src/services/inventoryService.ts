import { supabase } from '../lib/supabase';
import type { ProductStock, StockAdjustment } from '../types';

export type StockLocation = 'store' | 'shop';

export interface StockLedgerEntry {
  id: string;
  product_id: string;
  item_code: string;
  product_name: string;
  quantity: number;
  action: string;
  location: StockLocation;
  reference: string;
  actor: string;
  created_at: string;
}

// ============================================================
// Inventory Service — queries against Supabase
// ============================================================

/**
 * Fetch all rows from the product_stock view, ordered by name (A-Z).
 */
export async function getInventory(): Promise<ProductStock[]> {
  const { data, error } = await supabase
    .from('product_stock')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('getInventory error:', error.message);
    throw new Error(error.message);
  }

  return data as ProductStock[];
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
    .select('*, shipments(reference)')
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
  type StockInRow = {
    id: string;
    product_id: string;
    cartons: number;
    loose_pieces: number;
    notes: string;
    received_at: string;
    products?: ProductJoin;
    shipments?: ShipmentJoin;
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
  };

  let stockBatchQuery = supabase
    .from('stock_batches')
    .select('id, product_id, cartons, loose_pieces, notes, received_at, products(name, item_code, pieces_per_carton), shipments(reference)')
    .order('received_at', { ascending: false })
    .limit(limit);

  let salesQuery = supabase
    .from('invoice_items')
    .select('id, product_id, cartons, pieces, created_at, products(name, item_code, pieces_per_carton), invoices(invoice_no, created_at)')
    .order('created_at', { ascending: false })
    .limit(limit);

  let adjustmentQuery = supabase
    .from('stock_adjustments')
    .select('id, product_id, adjustment_pieces, reason, adjusted_by, created_at, products(name, item_code)')
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
    const piecesPerCarton = Number(product?.pieces_per_carton ?? 1) || 1;
    const quantity = Number(row.cartons ?? 0) * piecesPerCarton + Number(row.loose_pieces ?? 0);
    return {
      id: `stock-${row.id}`,
      product_id: row.product_id,
      item_code: product?.item_code ?? '-',
      product_name: product?.name ?? 'Unknown Product',
      quantity,
      action: 'Stock In',
      location: 'store' as const,
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
    const reason = String(row.reason ?? '');
    let action = Number(row.adjustment_pieces) >= 0 ? 'Adjustment In' : 'Adjustment Out';
    let location: StockLocation = 'store';

    if (reason.startsWith('[TRANSFER-OUT STORE->SHOP]')) {
      action = 'Transfer Out';
      location = 'store';
    } else if (reason.startsWith('[TRANSFER-IN STORE->SHOP]')) {
      action = 'Transfer In';
      location = 'shop';
    } else if (reason.toLowerCase().includes('return')) {
      action = 'Sale Return';
      location = 'shop';
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
