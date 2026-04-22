import { supabase } from '../lib/supabase';

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  newCustomers: number;
  successRate: number;
}

export interface ProductMovement {
  name: string;
  totalSold: number;
  rank: 'fast' | 'slow';
}

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
