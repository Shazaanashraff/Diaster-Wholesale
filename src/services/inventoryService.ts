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
