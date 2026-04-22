import React, { useState, useEffect } from 'react';
import { TopBar } from '../components/TopBar';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingBag, 
  Users, 
  Calendar,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { getDashboardStats, getCategoryDistribution } from '../services/reportService';
import type { DashboardStats } from '../services/reportService';
import { cn } from '../lib/utils';

export const ReportsPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [categoryDist, setCategoryDist] = useState<{name: string, value: number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReports() {
      try {
        setLoading(true);
        const [statsData, distData] = await Promise.all([
          getDashboardStats(),
          getCategoryDistribution()
        ]);
        setStats(statsData);
        setCategoryDist(distData);
      } catch (err) {
        console.error('Error loading reports:', err);
        setError('Failed to load real-time analytics data.');
      } finally {
        setLoading(false);
      }
    }
    loadReports();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-accent">
        <TopBar />
        <div className="flex-1 flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 size={36} className="animate-spin text-primary" />
          <p className="text-sm font-semibold text-gray-400">Loading live analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-accent">
        <TopBar />
        <div className="flex-1 flex flex-col items-center justify-center py-32 gap-4">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle size={28} className="text-red-400" />
          </div>
          <p className="text-sm font-semibold text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  const statItems = [
    { 
      label: 'Total Revenue', 
      value: `LKR ${stats?.totalRevenue.toLocaleString() || '0'}`, 
      trend: '+12.5%', 
      isUp: true, 
      icon: DollarSign, 
      color: 'text-primary', 
      bg: 'bg-violet-50' 
    },
    { 
      label: 'Order Count', 
      value: stats?.totalOrders || '0', 
      trend: '+8.2%', 
      isUp: true, 
      icon: ShoppingBag, 
      color: 'text-purple-500', 
      bg: 'bg-purple-50' 
    },
    { 
      label: 'Total Customers', 
      value: stats?.newCustomers || '0', 
      trend: '+2.4%', 
      isUp: true, 
      icon: Users, 
      color: 'text-purple-500', 
      bg: 'bg-purple-50' 
    },
    { 
      label: 'Success Rate', 
      value: `${stats?.successRate.toFixed(1)}%`, 
      trend: '+0.5%', 
      isUp: true, 
      icon: TrendingUp, 
      color: 'text-violet-500', 
      bg: 'bg-violet-50' 
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-accent">
      <TopBar />
      
      <div className="p-10">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-dark tracking-tight">Analytics</h1>
            <p className="text-gray-400 text-sm font-semibold mt-1">Deep dive into your store's live performance.</p>
          </div>
          <button className="flex items-center gap-3 px-8 py-4 bg-white border-2 border-border/50 rounded-3xl font-bold text-sm text-dark hover:border-primary/20 transition-all shadow-sm">
            <Calendar size={22} strokeWidth={2.5} className="text-primary" /> ALL TIME
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {statItems.map((stat, i) => (
            <div key={i} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-border/50 hover:shadow-xl hover:shadow-violet-100/10 transition-all duration-500">
              <div className="flex items-center justify-between mb-6">
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center border border-violet-100/30 shadow-sm shadow-violet-50", stat.bg, stat.color)}>
                  <stat.icon size={28} strokeWidth={2.5} />
                </div>
                <div className={cn("flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest", stat.isUp ? 'text-primary' : 'text-red-500')}>
                  {stat.isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {stat.trend}
                </div>
              </div>
              <p className="text-xs font-bold text-gray-300 uppercase tracking-widest leading-none mb-2">{stat.label}</p>
              <h3 className="text-2xl font-bold text-dark tracking-tighter">{stat.value}</h3>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="bg-white rounded-[3rem] border border-border/50 p-10 min-h-[450px] flex flex-col shadow-sm">
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-lg font-bold text-dark tracking-tight">Live Forecast</h3>
              <BarChart3 size={24} className="text-primary" />
            </div>
            <div className="flex-1 bg-accent/50 rounded-[2rem] border-4 border-dashed border-violet-50 flex flex-col items-center justify-center text-gray-400">
              <BarChart3 size={64} strokeWidth={1} className="mb-6 opacity-20" />
              <p className="text-sm font-semibold text-gray-400">Monthly Revenue Analytics</p>
              <div className="mt-4 px-4 py-1.5 bg-white rounded-full text-[10px] font-bold text-gray-300 border border-border uppercase tracking-widest">Database Source Connected</div>
            </div>
          </div>

          <div className="bg-white rounded-[3rem] border border-border/50 p-10 min-h-[450px] flex flex-col shadow-sm">
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-lg font-bold text-dark tracking-tight">Category Distribution</h3>
              <ShoppingBag size={24} className="text-primary" />
            </div>
            <div className="flex-1 bg-violet-50/20 rounded-[2rem] border-4 border-dashed border-violet-50 flex flex-col items-center justify-center">
              <div className="relative w-40 h-40 rounded-full border-[12px] border-violet-50 border-t-primary border-r-purple-100 mb-6 shadow-inner flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{categoryDist.length} Categories</span>
              </div>
              <p className="text-sm font-semibold text-gray-400">Item Distribution Breakdown</p>
              <div className="flex flex-wrap items-center justify-center gap-4 mt-6 px-10">
                {categoryDist.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">{item.name} ({item.value})</span>
                    </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
