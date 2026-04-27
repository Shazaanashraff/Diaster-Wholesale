import { supabase } from '../lib/supabase';

// Deduplicates concurrent expense fetches so parallel callers share one request
let _expensesReq: Promise<{ amount: number; created_at: string }[]> | null = null;
const fetchExpenses = (): Promise<{ amount: number; created_at: string }[]> => {
  if (!_expensesReq) {
    const req = Promise.resolve(supabase.from('expenses').select('amount, created_at'))
      .then(({ data }) => (data as { amount: number; created_at: string }[] | null) ?? [])
      .catch((): { amount: number; created_at: string }[] => []);
    _expensesReq = req;
    req.finally(() => { _expensesReq = null; });
  }
  return _expensesReq!;
};

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

export const getTopPerformers = async (period: 'day' | 'month' | 'all'): Promise<TopPerformer[]> => {
  const now = new Date();
  let invoiceQuery = supabase
    .from('invoices')
    .select('id')
    .in('payment_status', ['paid', 'partial']);

  if (period === 'day') {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    invoiceQuery = invoiceQuery.gte('created_at', start.toISOString());
  } else if (period === 'month') {
    invoiceQuery = invoiceQuery.gte('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
  }

  const { data: invData } = await invoiceQuery;
  const invoiceIds = (invData || []).map(i => i.id);
  if (invoiceIds.length === 0) return [];

  const { data, error } = await supabase
    .from('invoice_items')
    .select('product_id, total, pieces, cartons, products(name, pieces_per_carton)')
    .in('invoice_id', invoiceIds);

  if (error) throw error;

  const map: Record<string, { name: string; revenue: number; unitsSold: number }> = {};
  (data || []).forEach(item => {
    const ppc = (item.products as { pieces_per_carton?: number } | null)?.pieces_per_carton || 1;
    if (!map[item.product_id]) {
      map[item.product_id] = { name: (item.products as { name?: string } | null)?.name || 'Unknown', revenue: 0, unitsSold: 0 };
    }
    map[item.product_id].revenue += Number(item.total);
    map[item.product_id].unitsSold += item.cartons * ppc + item.pieces;
  });

  return Object.entries(map)
    .map(([product_id, d]) => ({ product_id, ...d, rank: 0 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((d, i) => ({ ...d, rank: i + 1 }));
};

export const getRecentSales = async (): Promise<RecentSale[]> => {
  const { data, error } = await supabase
    .from('invoices')
    .select('invoice_no, total, payment_status, created_at, customers(name), invoice_items(total, products(name))')
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) throw error;

  return (data || []).map(inv => {
    const items = (inv.invoice_items as { products: { name?: string } | null }[] | null) || [];
    const productName = items.length === 1
      ? (items[0]?.products as { name?: string } | null)?.name || 'Item'
      : `${items.length} items`;
    return {
      invoice_no: inv.invoice_no,
      customer_name: (inv.customers as { name?: string } | null)?.name || '—',
      product_name: productName,
      total: Number(inv.total),
      payment_status: inv.payment_status as 'paid' | 'partial' | 'unpaid',
      created_at: inv.created_at || '',
    };
  });
};

export const getProfitExpensesTimeline = async (): Promise<ProfitExpensePoint[]> => {
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('total, payment_status, created_at')
    .order('created_at', { ascending: true });

  if (error) throw error;

  const monthMap: Record<string, { revenue: number; expenses: number }> = {};
  (invoices || []).forEach(inv => {
    if (!inv.created_at) return;
    const d = new Date(inv.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthMap[key]) monthMap[key] = { revenue: 0, expenses: 0 };
    if (inv.payment_status === 'paid' || inv.payment_status === 'partial') {
      monthMap[key].revenue += Number(inv.total);
    }
  });

  try {
    const expData = await fetchExpenses();
    expData.forEach((e: { amount: number; created_at: string }) => {
      if (!e.created_at) return;
      const d = new Date(e.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap[key]) monthMap[key] = { revenue: 0, expenses: 0 };
      monthMap[key].expenses += Number(e.amount);
    });
  } catch (_) {}

  return Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, { revenue, expenses }]) => {
      const [year, month] = key.split('-');
      const label = new Date(Number(year), Number(month) - 1).toLocaleString('default', { month: 'short' });
      return { month: `${label} '${year.slice(2)}`, revenue, expenses, profit: revenue - expenses };
    });
};

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const { data: invoices, error: invError } = await supabase
    .from('invoices')
    .select('total, payment_status');

  if (invError) throw invError;

  const { count: customerCount, error: custError } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true });

  if (custError) throw custError;

  const totalRevenue = invoices
    .filter(i => i.payment_status === 'paid' || i.payment_status === 'partial')
    .reduce((sum, i) => sum + Number(i.total), 0);

  const paidInvoices = invoices.filter(i => i.payment_status === 'paid').length;
  const successRate = invoices.length > 0 ? (paidInvoices / invoices.length) * 100 : 100;

  return {
    totalRevenue,
    totalOrders: invoices.length,
    newCustomers: customerCount || 0,
    successRate
  };
};

export const getProductMovement = async (): Promise<ProductMovement[]> => {
  const { data, error } = await supabase
    .from('invoice_items')
    .select('product_id, cartons, pieces, products(name)');

  if (error) throw error;

  // Aggregate by product
  const movements: Record<string, { name: string; totalSold: number }> = {};
  
  data.forEach(item => {
    const name = (item.products as any)?.name || 'Unknown';
    const totalPieces = (item.cartons * 0) + item.pieces; // Simplify for now, just pieces sold
    if (!movements[item.product_id]) {
      movements[item.product_id] = { name, totalSold: 0 };
    }
    movements[item.product_id].totalSold += totalPieces;
  });

  const result = Object.values(movements)
    .sort((a, b) => b.totalSold - a.totalSold)
    .map((m, i, arr) => ({
      ...m,
      rank: i < arr.length / 2 ? ('fast' as const) : ('slow' as const)
    }));

  return result;
};

export const getDashboardMetrics = async (): Promise<DashboardMetrics> => {
  const [invoiceResult, customerResult, stockResult, itemResult, batchResult] = await Promise.allSettled([
    supabase.from('invoices').select('total, payment_status'),
    supabase.from('customers').select('*', { count: 'exact', head: true }),
    supabase.from('product_stock').select('cartons_in, pieces_in, cartons_sold, pieces_sold, carton_adj, piece_adj, pieces_per_carton'),
    supabase.from('invoice_items').select('product_id, pieces, cartons, products(pieces_per_carton)'),
    supabase.from('stock_batches').select('product_id, cost_per_piece'),
  ]);

  const invoices = invoiceResult.status === 'fulfilled' ? (invoiceResult.value.data || []) : [];
  const revenue = invoices
    .filter(i => i.payment_status === 'paid' || i.payment_status === 'partial')
    .reduce((sum, i) => sum + Number(i.total), 0);

  const expData = await fetchExpenses();
  const expenses = expData.reduce((sum, e) => sum + Number(e.amount), 0);

  const customers = customerResult.status === 'fulfilled' ? (customerResult.value.count || 0) : 0;

  const LOW_THRESHOLD = 10;
  const stocks = stockResult.status === 'fulfilled' ? (stockResult.value.data || []) : [];
  const lowStockCount = stocks.filter(s => {
    const remaining =
      (s.cartons_in + (s.carton_adj || 0) - s.cartons_sold) * s.pieces_per_carton +
      (s.pieces_in + (s.piece_adj || 0) - s.pieces_sold);
    return remaining <= LOW_THRESHOLD;
  }).length;

  const items = itemResult.status === 'fulfilled' ? (itemResult.value.data || []) : [];
  const batches = batchResult.status === 'fulfilled' ? (batchResult.value.data || []) : [];

  const costMap: Record<string, { total: number; count: number }> = {};
  batches.forEach((b: { product_id: string; cost_per_piece: number | null }) => {
    if (b.cost_per_piece) {
      if (!costMap[b.product_id]) costMap[b.product_id] = { total: 0, count: 0 };
      costMap[b.product_id].total += Number(b.cost_per_piece);
      costMap[b.product_id].count++;
    }
  });

  let cogs = 0;
  items.forEach((item: { product_id: string; pieces: number; cartons: number; products: unknown }) => {
    const ppc = (item.products as { pieces_per_carton?: number } | null)?.pieces_per_carton || 0;
    const totalPieces = item.cartons * ppc + item.pieces;
    const c = costMap[item.product_id];
    if (c && c.count > 0) cogs += (c.total / c.count) * totalPieces;
  });

  return {
    revenue,
    expenses,
    customers,
    lowStockCount,
    cogs,
    netProfit: revenue - cogs - expenses,
  };
};

export const getCategoryDistribution = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('category');
    
    if (error) throw error;
    
    const dist: Record<string, number> = {};
    data.forEach(p => {
        dist[p.category] = (dist[p.category] || 0) + 1;
    });
    
    return Object.entries(dist).map(([name, value]) => ({ name, value }));
};
