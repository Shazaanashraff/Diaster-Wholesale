// ============================================================
// Diastar ERP — TypeScript Interfaces
// Maps 1:1 to Supabase tables and views
// ============================================================

export interface Product {
  id: string;
  item_code: string;
  name: string;
  model: string;
  description: string;
  category: string;
  wholesale_price: number;
  retail_price: number;
  pieces_per_carton: number;
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
  shipment_id: string | null;
  cartons: number;
  pieces: number;
  cost_per_piece: number;
  notes: string;
  received_at: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  subtotal: number;
  discount: number;
  total: number;
  status: 'draft' | 'confirmed' | 'paid' | 'cancelled';
  payment_status: 'unpaid' | 'partial' | 'paid';
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  quantity_cartons: number;
  quantity_pieces: number;
  unit_price: number;
  line_total: number;
  created_at: string;
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
  adjustment_cartons: number;
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
