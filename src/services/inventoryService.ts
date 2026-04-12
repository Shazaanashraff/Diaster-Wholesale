import { supabase } from '../lib/supabase';
import type { ProductStock, ComputedStock } from '../types';

// ============================================================
// Inventory Service — reads from the product_stock VIEW
// ============================================================

/**
 * Fetch all rows from the product_stock view, ordered by name.
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
 * Compute human-friendly stock numbers from a ProductStock row.
 *
 * availCartons = floor(available_pieces / pieces_per_carton)
 * availPieces  = available_pieces % pieces_per_carton
 * totalPieces  = available_pieces  (for low-stock highlighting)
 */
export function computeStock(row: ProductStock): ComputedStock {
  const total = row.available_pieces;
  const ppc = row.pieces_per_carton || 1; // guard against 0

  return {
    availCartons: Math.floor(total / ppc),
    availPieces: total % ppc,
    totalPieces: total,
  };
}
