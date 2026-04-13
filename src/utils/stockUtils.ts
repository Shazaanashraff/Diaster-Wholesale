import type { ProductStock, ComputedStock } from '../types';

// ============================================================
// Stock Calculation Engine
// Converts raw carton/piece breakdowns into available stock.
// ============================================================

/**
 * Compute available stock from the raw product_stock view row.
 *
 * Formula:
 *   totalPiecesIn  = cartons_in  * pieces_per_carton + pieces_in
 *   totalPiecesOut = cartons_sold * pieces_per_carton + pieces_sold
 *   totalAdj       = carton_adj  * pieces_per_carton + piece_adj
 *   totalPieces    = totalPiecesIn - totalPiecesOut + totalAdj
 *   availCartons   = floor(totalPieces / pieces_per_carton)
 *   availLoose     = totalPieces % pieces_per_carton
 *
 * Edge cases:
 *   - Zero stock → returns { totalPieces: 0, availCartons: 0, availLoose: 0 }
 *   - Over-sold (negative) → clamps totalPieces to 0
 */
export function computeStock(row: ProductStock): ComputedStock {
  const ppc = row.pieces_per_carton || 1; // guard against 0 division

  const totalPiecesIn = row.cartons_in * ppc + row.pieces_in;
  const totalPiecesOut = row.cartons_sold * ppc + row.pieces_sold;
  const totalAdj = row.carton_adj * ppc + row.piece_adj;

  // Clamp to 0 — never show negative stock
  const totalPieces = Math.max(0, totalPiecesIn - totalPiecesOut + totalAdj);

  const availCartons = Math.floor(totalPieces / ppc);
  const availLoose = totalPieces % ppc;

  return { totalPieces, availCartons, availLoose };
}
