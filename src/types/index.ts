// ============================================================
// Diastar ERP — TypeScript Interfaces
// Maps 1:1 to Supabase tables and views
// ============================================================

export interface Product {
  id: string;
  item_code: string;
  sku?: string;
  name: string;
  model: string;
  description: string;
  category: string;
  wholesale_price: number;
  retail_price: number;
  pieces_per_carton: number;
  margin_pct?: number;
  cost_price?: number;
  msp?: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  type: 'wholesale' | 'retail';
  credit_limit: number;
  outstanding_balance: number;
  created_at: string;
  updated_at: string;
}

export interface Shipment {
  id: string;
  reference: string;
  supplier: string;
  notes: string;
  arrived_at: string;
  created_at: string;
}

export interface StockBatch {
  id: string;
  product_id: string;
  shipment_id?: string;
  cartons: number;
  loose_pieces: number;
  cost_per_piece?: number;
  notes?: string;
  received_at?: string;
  created_at?: string;
}

export interface Invoice {
  id: string;
  customer_id: string;
  invoice_no: string;
  mode: 'wholesale' | 'retail';
  subtotal: number;
  discount: number;
  total: number;
  payment_status: 'unpaid' | 'partial' | 'paid';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  cartons: number;
  pieces: number;
  unit_price: number;
  total: number;
  created_at?: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  customer_id: string;
  amount: number;
  method: 'cash' | 'bank_transfer' | 'cheque' | 'credit';
  reference: string;
  paid_at: string;
  created_at: string;
}

export interface StockAdjustment {
  id: string;
  product_id: string;
  adjustment_pieces: number;
  reason: string;
  adjusted_by: string;
  created_at: string;
}

/** Matches the product_stock VIEW in Supabase */
export interface ProductStock {
  product_id: string;
  item_code: string;
  name: string;
  model: string;
  category: string;
  wholesale_price: number;
  retail_price: number;
  pieces_per_carton: number;
  cartons_in: number;
  pieces_in: number;
  cartons_sold: number;
  pieces_sold: number;
  carton_adj: number;
  piece_adj: number;
}

/** Computed stock values derived from ProductStock */
export interface ComputedStock {
  totalPieces: number;
  availCartons: number;
  availLoose: number;
}

// ────────────────────────────────────────────────────────────────
// Procurement & Supplier types
// ────────────────────────────────────────────────────────────────

export interface Supplier {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  country: string;
  notes: string;
  created_at: string;
}

export type PurchaseStatus = 'draft' | 'confirmed' | 'in_transit' | 'received' | 'closed';

export interface Purchase {
  id: string;
  reference: string;
  supplier_id: string;
  status: PurchaseStatus;
  exchange_rate: number;
  total_rmb: number;
  total_lkr: number;
  cost_finalized: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
  suppliers?: Supplier;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity_units: number;
  quantity_cartons: number;
  unit_price_rmb: number;
  created_at: string;
  products?: Product;
}

export type PurchaseCostType = 'shipping' | 'clearing' | 'tax' | 'other';

export interface PurchaseCost {
  id: string;
  purchase_id: string;
  cost_type: PurchaseCostType;
  amount_lkr: number;
  notes: string;
  created_at: string;
}

export interface PurchaseReceive {
  id: string;
  purchase_id: string;
  product_id: string;
  ordered_units: number;
  received_units: number;
  damaged_units: number;
  notes: string;
  received_at: string;
  products?: Product;
}

export interface SupplierPayment {
  id: string;
  supplier_id: string;
  purchase_id: string | null;
  amount: number;
  method: 'cash' | 'bank_transfer' | 'credit';
  notes: string;
  paid_at: string;
  created_at: string;
  purchases?: Pick<Purchase, 'reference'>;
}

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  user_label: string;
  notes: string;
  created_at: string;
}

export interface Carton {
  id: string;
  purchase_id: string;
  product_id: string;
  carton_index: number;
  carton_code: string;
  status: 'in_stock' | 'sold' | 'damaged';
  created_at: string;
  products?: Product;
}
