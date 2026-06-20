import { supabase } from '../lib/supabase';
import { PRODUCT_STOCK_COLUMNS } from './inventoryService';

// ============================================================
// Types & Interfaces
// ============================================================

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  newCustomers: number;
  successRate: number;
}

export interface DashboardMetrics {
  revenue: number;
  expenses: number;
  customers: number;
  lowStockCount: number;
  cogs: number;
  netProfit: number;
}

export interface ProductMovement {
  name: string;
  totalSold: number;
  rank: 'fast' | 'slow';
}

export interface TopPerformer {
  product_id: string;
  name: string;
  revenue: number;
  unitsSold: number;
  rank: number;
}

export interface RecentSale {
  invoice_no: string;
  customer_name: string;
  product_name: string;
  total: number;
  payment_status: 'paid' | 'partial' | 'unpaid';
  created_at: string;
}

export interface ProfitExpensePoint {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

// ============================================================
// Phase 1: Service Layer Extensions
// ============================================================

/** 1.1 Profit & Loss Report */
export const getProfitAndLoss = async (from?: string, to?: string) => {
  let invQuery = supabase.from('invoices').select('total, subtotal, discount, payment_status, created_at');
  let expQuery = supabase.from('expenses').select('amount, created_at');
  let itemQuery = supabase.from('invoice_items').select('total, cartons, pieces, products(pieces_per_carton, cost_price), product_id, invoice_id, created_at');
  if (from) {
    invQuery = invQuery.gte('created_at', from);
    expQuery = expQuery.gte('created_at', from);
    itemQuery = itemQuery.gte('created_at', from);
  }
  if (to) {
    invQuery = invQuery.lte('created_at', to);
    expQuery = expQuery.lte('created_at', to);
    itemQuery = itemQuery.lte('created_at', to);
  }

  const [invRes, expRes, itemRes] = await Promise.all([invQuery, expQuery, itemQuery]);

  const invoices = invRes.data || [];
  const expenses = expRes.data || [];
  const items = itemRes.data || [];

  const revenue = invoices
    .filter(i => i.payment_status === 'paid' || i.payment_status === 'partial')
    .reduce((sum, i) => sum + Number(i.total), 0);

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  let cogs = 0;
  items.forEach(item => {
    const prod = item.products as { pieces_per_carton?: number; cost_price?: number } | null;
    const ppc = prod?.pieces_per_carton || 1;
    const totalPieces = item.cartons * ppc + item.pieces;
    const unitCost = prod?.cost_price || 0;
    cogs += unitCost * totalPieces;
  });

  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - totalExpenses;

  return { revenue, cogs, grossProfit, expenses: totalExpenses, netProfit };
};

/** 1.2 Sales Profit Report */
export const getSalesProfitReport = async (from?: string, to?: string) => {
  let query = supabase
    .from('invoice_items')
    .select('invoice_id, product_id, cartons, pieces, unit_price, total, created_at, products(name, pieces_per_carton, cost_price), invoices(invoice_no, payment_status, salesperson_id, salesperson_name, salesperson:salespeople(name))');

  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(item => {
    const prod = item.products as { name?: string; pieces_per_carton?: number; cost_price?: number } | null;
    const ppc = prod?.pieces_per_carton || 1;
    const totalPieces = item.cartons * ppc + item.pieces;
    const unitCost = prod?.cost_price || 0;
    const totalCost = unitCost * totalPieces;
    const profit = Number(item.total) - totalCost;
    const inv = item.invoices as {
      invoice_no?: string;
      salesperson?: { name?: string } | { name?: string }[];
      salesperson_name?: string;
    } | null;
    const salesperson = inv?.salesperson;
    const spName = Array.isArray(salesperson) ? salesperson[0]?.name : salesperson?.name;

    return {
      invoice_no: inv?.invoice_no,
      product: prod?.name,
      salesperson_name: spName ?? inv?.salesperson_name ?? null,
      quantity: totalPieces,
      selling_price: item.unit_price,
      cost_price: unitCost,
      total_revenue: item.total,
      total_cost: totalCost,
      profit
    };
  });
};

/** 2.1 Current Stock Report */
export const getCurrentStockReport = async () => {
  const { data, error } = await supabase
    .from('product_stock')
    .select(PRODUCT_STOCK_COLUMNS)
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
};

/** 2.1a Current Stock Report by Location */
export const getCurrentStockReportByLocation = async () => {
  const { data, error } = await supabase
    .from('product_stock_by_location')
    .select('product_id, name, item_code, pieces_per_carton, location_id, location_name, location_type, total_units')
    .order('location_name', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;

  const grouped: Record<string, { location_id: string | null; location_name: string | null; location_type: string | null; products: NonNullable<typeof data> }> = {};

  (data || []).forEach(row => {
    const locKey = row.location_id || 'unassigned';
    if (!grouped[locKey]) {
      grouped[locKey] = {
        location_id: row.location_id,
        location_name: row.location_name || 'Unassigned',
        location_type: row.location_type,
        products: []
      };
    }
    grouped[locKey].products.push(row);
  });

  return Object.values(grouped);
};

/** 2.4 Low Stock Report */
export const getLowStockReport = async (threshold = 10) => {
  const stocks = await getCurrentStockReport();
  return stocks.filter(s => {
    const remaining = (s.cartons_in + s.carton_adj - s.cartons_sold) * s.pieces_per_carton +
                      (s.pieces_in + s.piece_adj - s.pieces_sold);
    return remaining <= threshold;
  });
};

/** 3.1 Daily Sales Report */
export const getDailySalesReport = async (from?: string, to?: string) => {
  let query = supabase.from('invoices').select('total, payment_status, created_at');
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error } = await query;
  if (error) throw error;

  const totalSales = (data || []).reduce((sum, i) => sum + Number(i.total), 0);
  const transactions = data?.length || 0;

  return { totalSales, transactions, data };
};

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const { data, error } = await supabase.rpc('get_dashboard_stats');
  if (error) throw error;
  const row = data as Record<string, number>;
  return {
    totalRevenue: Number(row.totalRevenue ?? 0),
    totalOrders: Number(row.totalOrders ?? 0),
    newCustomers: Number(row.newCustomers ?? 0),
    successRate: Number(row.successRate ?? 100),
  };
};

export const getRecentSales = async (): Promise<RecentSale[]> => {
  const { data, error } = await supabase
    .from('invoices')
    .select('invoice_no, total, payment_status, created_at, customers(name), invoice_items(total, products(name))')
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) throw error;

  return (data || []).map(inv => {
    const items = (inv.invoice_items as { total?: number; products?: { name?: string } }[]) || [];
    const productName = items.length === 1 ? (items[0]?.products?.name || 'Item') : `${items.length} items`;
    return {
      invoice_no: inv.invoice_no,
      customer_name: (inv.customers as { name?: string } | null)?.name || '—',
      product_name: productName,
      total: Number(inv.total),
      payment_status: inv.payment_status as RecentSale['payment_status'],
      created_at: inv.created_at || '',
    };
  });
};

export const getDashboardMetrics = async (): Promise<DashboardMetrics> => {
  const { data, error } = await supabase.rpc('get_dashboard_metrics', { p_low_stock_threshold: 10 });
  if (error) throw error;
  const row = data as Record<string, number>;
  return {
    revenue: Number(row.revenue ?? 0),
    expenses: Number(row.expenses ?? 0),
    customers: Number(row.customers ?? 0),
    lowStockCount: Number(row.lowStockCount ?? 0),
    cogs: Number(row.cogs ?? 0),
    netProfit: Number(row.netProfit ?? 0),
  };
};

export const getTopPerformers = async (period: 'day' | 'month' | 'all' = 'month'): Promise<TopPerformer[]> => {
  const { data, error } = await supabase.rpc('get_top_performers', { p_period: period });
  if (error) throw error;
  return ((data as TopPerformer[]) ?? []).map((item) => ({
    product_id: item.product_id,
    name: item.name,
    revenue: Number(item.revenue ?? 0),
    unitsSold: Number(item.unitsSold ?? 0),
    rank: Number(item.rank ?? 0),
  }));
};

export const getProfitExpensesTimeline = async (): Promise<ProfitExpensePoint[]> => {
  const { data, error } = await supabase.rpc('get_profit_expenses_timeline');
  if (error) throw error;
  return ((data as ProfitExpensePoint[]) ?? []).map((pt) => ({
    month: pt.month,
    revenue: Number(pt.revenue ?? 0),
    expenses: Number(pt.expenses ?? 0),
    profit: Number(pt.profit ?? 0),
  }));
};

export const getCategoryDistribution = async (): Promise<{ name: string; value: number }[]> => {
  const { data, error } = await supabase.rpc('get_category_distribution');
  if (error) throw error;
  return ((data as { name: string; value: number }[]) ?? []).map((row) => ({
    name: row.name,
    value: Number(row.value ?? 0),
  }));
};

/** Stock valuation grouped by location (server-side aggregate). */
export const getStockValuationReport = async () => {
  const { data, error } = await supabase.rpc('get_stock_valuation_report');
  if (error) throw error;
  return (data ?? []) as Array<{
    location_id: string | null;
    location_name: string;
    location_type: string | null;
    products: Array<{
      product_id: string;
      name: string;
      item_code: string;
      available: number;
      unitCost: number;
      valuation: number;
    }>;
    totalValuation: number;
  }>;
};
