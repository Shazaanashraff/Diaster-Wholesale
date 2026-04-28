import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownRight,
  TrendingUp,
  AlertTriangle,
  Users,
  Receipt,
  DollarSign,
  Search,
  Trophy,
  ShoppingCart,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '../lib/utils';
import { AnimatedNumber } from '../components/AnimatedNumber';
import {
  getDashboardMetrics,
  getTopPerformers,
  getRecentSales,
  getProfitExpensesTimeline,
  getCategoryDistribution,
} from '../services/reportService';
import type {
  DashboardMetrics,
  TopPerformer,
  RecentSale,
  ProfitExpensePoint,
} from '../services/reportService';

const CAT_COLORS = ['#d4e8f8', '#bfdbfe', '#d4f0e4', '#fde8c8', '#cbd5e1', '#d7e5e8', '#f8d4d4', '#e2e8f0'];

type PeriodFilter = 'day' | 'month' | 'all';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Overview');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [profitTimeline, setProfitTimeline] = useState<ProfitExpensePoint[]>([]);
  const [performerFilter, setPerformerFilter] = useState<PeriodFilter>('month');
  const [performersLoading, setPerformersLoading] = useState(false);
  const [barsVisible, setBarsVisible] = useState(false);
  const [categoryDist, setCategoryDist] = useState<{ name: string; value: number }[]>([]);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    getDashboardMetrics().then(setMetrics).catch(() => {});
    getTopPerformers('month').then(d => { setTopPerformers(d); setTimeout(() => setBarsVisible(true), 120); }).catch(() => {});
    getRecentSales().then(setRecentSales).catch(() => {});
    getProfitExpensesTimeline().then(setProfitTimeline).catch(() => {});
    getCategoryDistribution().then(setCategoryDist).catch(() => {});
    return () => clearTimeout(timer);
  }, []);

  const handlePeriodChange = async (period: PeriodFilter) => {
    setPerformerFilter(period);
    setBarsVisible(false);
    setPerformersLoading(true);
    try {
      const data = await getTopPerformers(period);
      setTopPerformers(data);
      setTimeout(() => setBarsVisible(true), 80);
    } catch (_) {}
    setPerformersLoading(false);
  };

  const maxRevenue = topPerformers[0]?.revenue || 1;

  if (loading) {
    return (
      <div className="pos-page-grid">
        <div className="pos-skeleton-main">
          <div className="pos-skeleton-search skeleton" />
          <div className="pos-skeleton-grid">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="pos-skeleton-tile skeleton" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
          <div className="pos-skeleton-products mt-4">
            <div className="w-full h-[360px] rounded-xl skeleton" />
            <div className="w-full h-[320px] rounded-xl skeleton mt-4" />
          </div>
        </div>
        <div className="pos-skeleton-panel" />
      </div>
    );
  }

  return (
    <div className={cn("pos-page-grid", rightCollapsed && "right-collapsed")}>
      <section className="pos-main">
        <div className="pos-main-head">
          <label className="pos-search">
            <Search size={18} />
            <input placeholder="Search operations..." />
          </label>
          <div className="pos-mode-toggle">
            <button type="button" className={cn(activeTab === 'Overview' && 'active')} onClick={() => setActiveTab('Overview')}>Overview</button>
            <button type="button" className={cn(activeTab === 'Detailed' && 'active')} onClick={() => setActiveTab('Detailed')}>Detailed</button>
          </div>
        </div>

        {/* METRIC TILES */}
        <div className="pos-tile-grid pb-2" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
          {([
            { label: 'Revenue',          value: metrics?.revenue ?? 0,       icon: DollarSign,    color: 'bg-[#d4e8f8]', currency: true,  decimals: 2, to: '/reports' },
            { label: 'Expenses',         value: metrics?.expenses ?? 0,      icon: Receipt,       color: 'bg-[#fde8c8]', currency: true,  decimals: 2, to: '/reports' },
            { label: 'Customers',        value: metrics?.customers ?? 0,     icon: Users,         color: 'bg-[#d7e5e8]', currency: false, decimals: 0, to: '/customers' },
            { label: 'Low Stock Alerts', value: metrics?.lowStockCount ?? 0, icon: AlertTriangle, color: 'bg-[#fde8c8]', currency: false, decimals: 0, to: '/inventory' },
            {
              label: 'Net Profit',
              value: metrics?.netProfit ?? 0,
              icon: (metrics?.netProfit ?? 0) >= 0 ? TrendingUp : ArrowDownRight,
              color: (metrics?.netProfit ?? 0) >= 0 ? 'bg-[#d4f0e4]' : 'bg-[#f8d4d4]',
              currency: true,
              decimals: 2,
              to: '/reports',
            },
          ] as const).map((tile, i) => (
            <button key={i} type="button" onClick={() => navigate(tile.to)} className={cn('pos-tile transition-all cursor-pointer', tile.color)} style={{ animationDelay: `${i * 60}ms` }}>
              <tile.icon size={18} />
              <h3>{tile.label}</h3>
              <p>{tile.currency && 'LKR '}<AnimatedNumber value={tile.value} decimals={tile.decimals} /></p>
            </button>
          ))}
        </div>

        <div className="pos-product-grid px-3 overflow-y-auto pb-8 custom-scrollbar block space-y-6">

          {/* PROFIT & EXPENSES CHART */}
          <div className="pos-product-card transition-all duration-300 w-full" style={{ animationDelay: '200ms', padding: '1.25rem' }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-gray-400 text-xs mb-1">Last 6 Months</p>
                <h4 className="text-xl font-bold text-white tracking-tight">Profit & Expenses</h4>
              </div>
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#4ade80]" />
                  <span className="text-[11px] font-bold text-gray-400">Profit</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#f87171]" />
                  <span className="text-[11px] font-bold text-gray-400">Expenses</span>
                </div>
              </div>
            </div>

            <div className="h-[280px] w-full">
              {profitTimeline.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-600 text-sm">No data available</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={profitTimeline} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4ade80" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f87171" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2b313a" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 700 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 700 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid #2b313a', background: '#1c2026', padding: '8px 14px' }}
                      itemStyle={{ color: '#fff', fontSize: 12 }}
                      formatter={(value, name) => [`LKR ${Number(value).toLocaleString()}`, name === 'profit' ? 'Profit' : 'Expenses']}
                      cursor={{ stroke: '#f8fafc', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Area
                      type="monotone" dataKey="profit" stroke="#4ade80" strokeWidth={2.5}
                      fillOpacity={1} fill="url(#gradProfit)"
                      isAnimationActive animationDuration={1200} animationEasing="ease-out"
                    />
                    <Area
                      type="monotone" dataKey="expenses" stroke="#f87171" strokeWidth={2.5}
                      fillOpacity={1} fill="url(#gradExpenses)"
                      isAnimationActive animationDuration={1200} animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* RECENT SALES */}
          <div className="pos-product-card transition-all duration-300 w-full" style={{ animationDelay: '300ms', padding: '1.25rem' }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-gray-400 text-xs mb-1">Latest Transactions</p>
                <h4 className="text-lg font-bold text-white tracking-tight">Recent Sales</h4>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 bg-[#1d222a] border border-[#2b313a] px-3 py-1.5 rounded-xl">
                <ShoppingCart size={12} />
                <span>{recentSales.length} records</span>
              </div>
            </div>

            {recentSales.length === 0 ? (
              <p className="text-center text-gray-600 text-sm py-8">No sales data</p>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#2b313a]">
                      <th className="text-left py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4">Invoice</th>
                      <th className="text-left py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4">Customer</th>
                      <th className="text-left py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4">Product</th>
                      <th className="text-right py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4">Total</th>
                      <th className="text-right py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSales.map((sale, i) => (
                      <tr key={i} className="group hover:bg-[#1d222a] transition-colors border-b border-[#2b313a] last:border-0">
                        <td className="py-3.5 px-4">
                          <span className="text-[12px] font-mono font-semibold text-gray-300">{sale.invoice_no}</span>
                          <p className="text-[10px] text-gray-600 mt-0.5">
                            {sale.created_at ? new Date(sale.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-[12px] font-medium text-white">{sale.customer_name}</td>
                        <td className="py-3.5 px-4 text-[12px] text-gray-400 max-w-[180px] truncate">{sale.product_name}</td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="text-[12px] font-bold text-white">LKR {sale.total.toLocaleString()}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className={cn(
                            'px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider',
                            sale.payment_status === 'paid' && 'bg-[#f8fafc] text-[#111315]',
                            sale.payment_status === 'partial' && 'bg-[#fde8c8] text-[#92400e]',
                            sale.payment_status === 'unpaid' && 'bg-[#1d222a] border border-[#2b313a] text-gray-400',
                          )}>
                            {sale.payment_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* CATEGORY DISTRIBUTION */}
          <div className="pos-product-card transition-all duration-300 w-full" style={{ animationDelay: '400ms', padding: '1.25rem' }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-gray-400 text-xs mb-1">Products Breakdown</p>
                <h4 className="text-lg font-bold text-white tracking-tight">Category Distribution</h4>
              </div>
              {categoryDist.length > 0 && (
                <span className="text-[11px] font-bold text-gray-500 bg-[#1d222a] border border-[#2b313a] px-3 py-1.5 rounded-xl">
                  {categoryDist.reduce((s, c) => s + c.value, 0)} products
                </span>
              )}
            </div>

            {categoryDist.length === 0 ? (
              <p className="text-center text-gray-600 text-sm py-8">No category data</p>
            ) : (() => {
              const total = categoryDist.reduce((s, c) => s + c.value, 0);
              return (
                <div className="grid grid-cols-2 gap-2">
                  {categoryDist.map((item, i) => {
                    const pct = total > 0 ? (item.value / total) * 100 : 0;
                    const color = CAT_COLORS[i % CAT_COLORS.length];
                    return (
                      <div
                        key={i}
                        className="bg-[#1d222a] px-3 py-3 rounded-xl border border-[#2b313a]"
                        style={{ animation: 'posFadeIn 300ms ease both', animationDelay: `${i * 50}ms` }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                            <span className="text-xs font-semibold text-gray-300 capitalize truncate">{item.name}</span>
                          </div>
                          <span className="text-xs font-bold text-white ml-2 shrink-0">{item.value}</span>
                        </div>
                        <div className="w-full bg-[#2b313a] rounded-full h-1 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <p className="text-[10px] text-gray-600 mt-1.5">{pct.toFixed(1)}%</p>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

        </div>
      </section>

      {/* SIDEBAR — TOP PERFORMERS */}
      <aside className="pos-bill">
        <button
          type="button"
          onClick={() => setRightCollapsed((prev) => !prev)}
          className="pos-bill-collapse-toggle"
          aria-label={rightCollapsed ? 'Expand right panel' : 'Collapse right panel'}
          title={rightCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {rightCollapsed ? <PanelRightOpen size={15} /> : <PanelRightClose size={15} />}
        </button>
        {!rightCollapsed && (
        <div className="pos-bill-inner">
        <div className="pos-bill-head flex flex-col items-start gap-1 pb-4 border-b border-[#1f242c]">
          <div className="flex items-center gap-2">
            <Trophy size={15} className="text-[#f8fafc]" />
            <h2 className="text-lg font-bold tracking-tight">Top Performers</h2>
          </div>
          <p className="text-xs font-semibold text-gray-500">Best-selling products by revenue</p>
        </div>

        {/* PERIOD FILTER TABS */}
        <div className="flex gap-1.5 mt-4 mb-5">
          {(['day', 'month', 'all'] as PeriodFilter[]).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => handlePeriodChange(p)}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all',
                performerFilter === p
                  ? 'bg-[#f8fafc] text-[#111315]'
                  : 'bg-[#1d222a] text-gray-500 hover:text-gray-300 border border-[#2b313a]',
              )}
            >
              {p === 'all' ? 'All Time' : p}
            </button>
          ))}
        </div>

        {/* PERFORMER LIST */}
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
          {performersLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton rounded-xl h-[68px]" style={{ animationDelay: `${i * 60}ms` }} />
            ))
          ) : topPerformers.length === 0 ? (
            <p className="text-center text-gray-600 text-sm py-12">No data for this period</p>
          ) : (
            topPerformers.map((performer, i) => (
              <div
                key={performer.product_id}
                className="bg-[#161a20] border border-[#1f242c] rounded-xl p-3.5"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0',
                      i === 0 ? 'bg-[#f8fafc] text-[#111315]' : 'bg-[#2b313a] text-gray-400',
                    )}>
                      {performer.rank}
                    </span>
                    <span className="text-[12px] font-semibold text-white leading-tight truncate">{performer.name}</span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 shrink-0 ml-2">{performer.unitsSold} pcs</span>
                </div>

                <div className="w-full bg-[#2b313a] rounded-full h-1.5 mb-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: barsVisible ? `${(performer.revenue / maxRevenue) * 100}%` : '0%',
                      transitionDelay: `${i * 90}ms`,
                      background: i === 0 ? '#f8fafc' : i === 1 ? '#94a3b8' : '#475569',
                    }}
                  />
                </div>

                <span className="text-[10px] font-bold text-gray-500">LKR {performer.revenue.toLocaleString()}</span>
              </div>
            ))
          )}
        </div>

        <button type="button" className="pos-submit mt-4 mb-4" onClick={() => navigate('/reports')}>
          Generate Full Report
        </button>
        </div>
        )}
      </aside>
    </div>
  );
};
