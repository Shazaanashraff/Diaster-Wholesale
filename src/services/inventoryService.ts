import { supabase } from '../lib/supabase';
import type { ProductStock, StockAdjustment } from '../types';

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
