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
  description?: string;
  category: string;
  wholesale_price: number;
  retail_price: number;
  pieces_per_carton: number;
  reorder_level?: number;
  cost_price?: number;
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
  location_id?: string | null;
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
  reorder_level?: number;
  cartons_in: number;
  pieces_in: number;
  cartons_sold: number;
  pieces_sold: number;
  carton_adj: number;
  piece_adj: number;
  location_name?: string | null;
  location_type?: 'warehouse' | 'shop' | null;
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
  credit_limit?: number;
  credit_days?: number;
  current_payable?: number;
  created_at: string;
}

export type PurchaseStatus = 'draft' | 'ordered' | 'received' | 'completed' | 'cancelled';

export interface Location {
  id: string;
  name: string;
  type: 'warehouse' | 'shop';
  is_active: boolean;
  created_at: string;
}

export interface Purchase {
  id: string;
  reference: string;
  supplier_id: string;
  location_id?: string;
  rep_name?: string;
  status: PurchaseStatus;
  exchange_rate: number;
  total_rmb: number;
  discount_amount?: number;
  total_lkr: number;
  cost_finalized: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
  suppliers?: Supplier;
  locations?: Location;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity_units: number;
  quantity_cartons: number;
  unit_price_rmb: number;
  discount_percent?: number;
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
  method: 'cash' | 'card' | 'cheque' | 'credit' | 'online' | 'bank_transfer' | 'mixed';
  cheque_number?: string;
  bank_name?: string;
  due_date?: string;
  notes: string;
  paid_at: string;
  created_at: string;
  purchases?: Pick<Purchase, 'reference'>;
}

export interface SupplierPaymentLine {
  id: string;
  payment_id: string;
  amount: number;
  method: 'cash' | 'card' | 'cheque' | 'credit' | 'online' | 'bank_transfer';
  cheque_number?: string;
  bank_name?: string;
  due_date?: string;
  notes?: string;
  created_at: string;
}

export type SupplierReturnStatus = 'pending' | 'completed' | 'cancelled';
export type SupplierReturnType = 'return' | 'exchange';
export type SettlementType = 'payable' | 'refund' | 'credit_note' | 'even';

export interface SupplierReturn {
  id: string;
  reference: string;
  supplier_id: string;
  purchase_id: string | null;
  return_type: SupplierReturnType;
  status: SupplierReturnStatus;
  return_value_lkr: number;
  replacement_value_lkr: number;
  difference_lkr: number;
  settlement_type: SettlementType | null;
  settlement_notes?: string;
  notes?: string;
  created_at: string;
  completed_at?: string;
  suppliers?: Pick<Supplier, 'name'>;
  purchases?: Pick<Purchase, 'reference'>;
}

export interface SupplierReturnItem {
  id: string;
  return_id: string;
  product_id: string;
  item_type: 'return' | 'replacement';
  quantity: number;
  unit_value_lkr: number;
  created_at: string;
  products?: Product;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  method: string;
  location_id?: string;
  notes: string;
  created_by?: string;
  reference?: string;
  created_at: string;
  locations?: Pick<Location, 'name'>;
}

export type OtherIncomeSource = 'supplier_refund' | 'credit_note' | 'discount_received' | 'other';

export interface OtherIncome {
  id: string;
  source_type: OtherIncomeSource;
  amount: number;
  method: string;
  supplier_id?: string;
  notes: string;
  created_by?: string;
  created_at: string;
  suppliers?: Pick<Supplier, 'name'>;
}

export interface PurchaseDiscountApproval {
  id: string;
  purchase_id: string;
  discount_type: 'item' | 'bill';
  discount_percent?: number;
  discount_amount?: number;
  status: 'pending' | 'approved' | 'rejected';
  requested_by: string;
  approved_by?: string;
  notes?: string;
  created_at: string;
  resolved_at?: string;
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

export type StockTransferStatus = 'pending' | 'completed' | 'cancelled';

export interface StockTransfer {
  id: string;
  reference: string;
  from_location_id: string;
  to_location_id: string;
  status: StockTransferStatus;
  notes: string;
  requested_by: string;
  approved_by?: string;
  created_at: string;
  completed_at?: string;
  from_location?: Pick<Location, 'name' | 'type'>;
  to_location?: Pick<Location, 'name' | 'type'>;
}

export interface StockTransferItem {
  id: string;
  transfer_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  products?: Product;
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
