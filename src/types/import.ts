// ============================================================
// Diastar ERP — Bulk Import Types
// Used by importService.ts and BulkImportPage.tsx
// ============================================================

import type { Product } from './index';

/** Raw row parsed from the Excel file before classification */
export interface RawExcelRow {
  item_code?: string;
  name: string;
  model: string;
  cartons: number;
  units_per_carton: number;
  cost_price?: number;
}

/** Classified import row with match status and optional error info */
export interface ImportRow {
  item_code?: string;
  name: string;
  model: string;
  cartons: number;
  units_per_carton: number;
  cost_price?: number;
  status: 'match_code' | 'match_name' | 'new' | 'conflict' | 'error';
  matched_product?: Product;
  error_message?: string;
}

/** Summary counts returned after a confirmed import */
export interface ImportSummary {
  total: number;
  matched_by_code: number;
  matched_by_name: number;
  new_products: number;
  errors: number;
}
