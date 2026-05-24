import { supabase } from '../lib/supabase';

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
// Helper: Fetch Expenses (Shared)
// ============================================================

// ============================================================
// Phase 1: Service Layer Extensions
// ============================================================

/** 1.1 Profit & Loss Report */
export const getProfitAndLoss = async (from?: string, to?: string) => {
  let invQuery = supabase.from('invoices').select('total, subtotal, discount, payment_status, created_at');
  let expQuery = supabase.from('expenses').select('amount, created_at');
  let itemQuery = supabase.from('invoice_items').select('total, cartons, pieces, products(pieces_per_carton), product_id, invoice_id, created_at');
  let batchQuery = supabase.from('stock_batches').select('product_id, cost_per_piece');

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

  const [invRes, expRes, itemRes, batchRes] = await Promise.all([invQuery, expQuery, itemQuery, batchQuery]);

  const invoices = invRes.data || [];
  const expenses = expRes.data || [];
  const items = itemRes.data || [];
  const batches = batchRes.data || [];

  const revenue = invoices
    .filter(i => i.payment_status === 'paid' || i.payment_status === 'partial')
    .reduce((sum, i) => sum + Number(i.total), 0);

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  // Calculate COGS
  const costMap: Record<string, number> = {};
  batches.forEach(b => {
    if (b.cost_per_piece) costMap[b.product_id] = Number(b.cost_per_piece);
  });

  let cogs = 0;
  items.forEach(item => {
    const ppc = (item.products as any)?.pieces_per_carton || 1;
    const totalPieces = item.cartons * ppc + item.pieces;
    const unitCost = costMap[item.product_id as string] || 0;
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
    .select('invoice_id, product_id, cartons, pieces, unit_price, total, created_at, products(name, pieces_per_carton), invoices(invoice_no, payment_status, salesperson_id, salesperson_name, salesperson:salespeople(name))');

  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error } = await query;
  if (error) throw error;

  const { data: batches } = await supabase.from('stock_batches').select('product_id, cost_per_piece');
  const costMap: Record<string, number> = {};
  batches?.forEach(b => { if (b.cost_per_piece) costMap[b.product_id] = Number(b.cost_per_piece); });

  return (data || []).map(item => {
    const ppc = (item.products as any)?.pieces_per_carton || 1;
    const totalPieces = item.cartons * ppc + item.pieces;
    const unitCost = costMap[item.product_id as string] || 0;
    const totalCost = unitCost * totalPieces;
    const profit = Number(item.total) - totalCost;

    return {
      invoice_no: (item.invoices as any)?.invoice_no,
      product: (item.products as any)?.name,
      salesperson_name: (item.invoices as any)?.salesperson?.name ?? (item.invoices as any)?.salesperson_name ?? null,
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
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
};

/** 2.1a Current Stock Report by Location */
export const getCurrentStockReportByLocation = async () => {
  const { data, error } = await supabase
    .from('product_stock_by_location')
    .select('product_id, name, item_code, pieces_per_carton, location_id, location_name, location_type, total_units')
    .order('location_name', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  
  // Group by location_id
  const grouped: Record<string, { location_id: string | null; location_name: string | null; location_type: string | null; products: typeof data }> = {};
  
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

// Existing dashboard functions kept for compatibility
export const getDashboardStats = async (): Promise<DashboardStats> => {
  const { data: invoices, error: invError } = await supabase.from('invoices').select('total, payment_status');
  if (invError) throw invError;

  const { count: customerCount, error: custError } = await supabase.from('customers').select('*', { count: 'exact', head: true });
  if (custError) throw custError;

  const totalRevenue = (invoices || [])
    .filter(i => i.payment_status === 'paid' || i.payment_status === 'partial')
    .reduce((sum, i) => sum + Number(i.total), 0);

  const paidInvoices = (invoices || []).filter(i => i.payment_status === 'paid').length;
  const successRate = invoices && invoices.length > 0 ? (paidInvoices / invoices.length) * 100 : 100;

  return { totalRevenue, totalOrders: invoices?.length || 0, newCustomers: customerCount || 0, successRate };
};

export const getRecentSales = async (): Promise<RecentSale[]> => {
  const { data, error } = await supabase
    .from('invoices')
    .select('invoice_no, total, payment_status, created_at, customers(name), invoice_items(total, products(name))')
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) throw error;

  return (data || []).map(inv => {
    const items = (inv.invoice_items as any[]) || [];
    const productName = items.length === 1 ? (items[0]?.products?.name || 'Item') : `${items.length} items`;
    return {
      invoice_no: inv.invoice_no,
      customer_name: (inv.customers as any)?.name || '—',
      product_name: productName,
      total: Number(inv.total),
      payment_status: inv.payment_status as any,
      created_at: inv.created_at || '',
    };
  });
};

export const getDashboardMetrics = async (): Promise<DashboardMetrics> => {
  const stats = await getProfitAndLoss();
  const { count: customerCount } = await supabase.from('customers').select('*', { count: 'exact', head: true });
  const lowStock = await getLowStockReport();

  return {
    revenue: stats.revenue,
    expenses: stats.expenses,
    customers: customerCount || 0,
    lowStockCount: lowStock.length,
    cogs: stats.cogs,
    netProfit: stats.netProfit
  };
};

export const getTopPerformers = async (period: 'day' | 'month' | 'all' = 'month'): Promise<TopPerformer[]> => {
  let from: string | undefined;
  const now = new Date();
  if (period === 'day') from = new Date(now.setHours(0,0,0,0)).toISOString();
  if (period === 'month') from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  let query = supabase.from('invoice_items').select('product_id, total, cartons, pieces, products(name, pieces_per_carton)');
  if (from) query = query.gte('created_at', from);

  const { data } = await query;
  const map: Record<string, any> = {};

  (data || []).forEach(item => {
    const id = item.product_id;
    const ppc = (item.products as any)?.pieces_per_carton || 1;
    const qty = (item.cartons * ppc) + item.pieces;
    if (!map[id]) map[id] = { product_id: id, name: (item.products as any)?.name, revenue: 0, unitsSold: 0 };
    map[id].revenue += Number(item.total);
    map[id].unitsSold += qty;
  });

  return Object.values(map)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((item, i) => ({ ...item, rank: i + 1 }));
};

export const getProfitExpensesTimeline = async (): Promise<ProfitExpensePoint[]> => {
  const { data: invoices } = await supabase.from('invoices').select('total, created_at').in('payment_status', ['paid', 'partial']);
  const { data: expenses } = await supabase.from('expenses').select('amount, created_at');

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const resMap: Record<string, ProfitExpensePoint> = {};

  // Initialize last 6 months
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const m = months[d.getMonth()];
    resMap[m] = { month: m, revenue: 0, expenses: 0, profit: 0 };
  }

  (invoices || []).forEach(inv => {
    const m = months[new Date(inv.created_at).getMonth()];
    if (resMap[m]) resMap[m].revenue += Number(inv.total);
  });

  (expenses || []).forEach(exp => {
    const m = months[new Date(exp.created_at).getMonth()];
    if (resMap[m]) resMap[m].expenses += Number(exp.amount);
  });

  return Object.values(resMap).map(pt => ({ ...pt, profit: pt.revenue - pt.expenses }));
};

export const getCategoryDistribution = async (): Promise<{ name: string; value: number }[]> => {
  const { data } = await supabase.from('products').select('category');
  const map: Record<string, number> = {};
  (data || []).forEach(p => {
    const cat = p.category || 'Other';
    map[cat] = (map[cat] || 0) + 1;
  });
  return Object.entries(map).map(([name, value]) => ({ name, value }));
};
