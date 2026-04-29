import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Users,
  Calendar,
  AlertTriangle,
  Search,
  ArrowUpRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { getDashboardStats } from '../services/reportService';
import type { DashboardStats } from '../services/reportService';
import { cn } from '../lib/utils';
import { AnimatedNumber } from '../components/AnimatedNumber';

const revenueData = [
  { name: 'Jan', value: 320 },
  { name: 'Feb', value: 480 },
  { name: 'Mar', value: 380 },
  { name: 'Apr', value: 620 },
  { name: 'May', value: 550 },
  { name: 'Jun', value: 780 },
  { name: 'Jul', value: 690 },
  { name: 'Aug', value: 920 },
];

const tileConfig = [
  { label: 'Total Revenue', prefix: 'LKR ', suffix: '', icon: DollarSign, color: 'bg-[#f2c8de]', trend: '+12.5%', isUp: true },
  { label: 'Order Count',   prefix: '',     suffix: '', icon: ShoppingBag, color: 'bg-[#d7e5e8]', trend: '+8.2%',  isUp: true },
  { label: 'Customers',     prefix: '',     suffix: '', icon: Users,       color: 'bg-[#e6d3f0]', trend: '+2.4%',  isUp: true },
  { label: 'Success Rate',  prefix: '',     suffix: '%',icon: TrendingUp,  color: 'bg-[#d4e8f8]', trend: '+0.5%',  isUp: true },
];

export const ReportsPage: React.FC = () => {
  const [stats, setStats]           = useState<DashboardStats | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [activeTab, setActiveTab]   = useState('Overview');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const s = await getDashboardStats();
        setStats(s);
      } catch (err) {
        console.error('Error loading reports:', err);
        setError('Failed to load analytics data.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="pos-page-grid">
        <div className="pos-skeleton-main">
          <div className="pos-skeleton-search skeleton" />
          <div className="pos-skeleton-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="pos-skeleton-tile skeleton" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
          <div className="mt-4 block space-y-4">
            <div className="w-full h-[360px] rounded-xl skeleton" />
            <div className="w-full h-[260px] rounded-xl skeleton" />
          </div>
        </div>
        <div className="pos-skeleton-panel" />
      </div>
    );
  }

  /* ── Error state ── */
  if (error) {
    return (
      <div className="pos-page-grid">
        <div className="pos-main flex items-center justify-center">
          <div className="flex flex-col items-center gap-4" style={{ animation: 'posFadeIn 380ms ease' }}>
            <div className="w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center border border-red-900/50">
              <AlertTriangle size={28} className="text-red-400" />
            </div>
            <p className="text-sm font-semibold text-red-400">{error}</p>
          </div>
        </div>
        <div className="pos-bill" />
      </div>
    );
  }

  const tiles = [
    { ...tileConfig[0], value: stats?.totalRevenue  ?? 0 },
    { ...tileConfig[1], value: stats?.totalOrders   ?? 0 },
    { ...tileConfig[2], value: stats?.newCustomers  ?? 0 },
    { ...tileConfig[3], value: stats?.successRate   ?? 0 },
  ];

  const successRate = stats?.successRate ?? 92;
  const liveGauge = [
    { name: 'Done',      value: successRate,       color: '#f8fafc' },
    { name: 'Remaining', value: 100 - successRate, color: '#1d222a' },
  ];

  return (
    <div className="pos-page-grid">

      {/* ── LEFT MAIN ── */}
      <section className="pos-main">

        {/* header row */}
        <div className="pos-main-head">
          <label className="pos-search">
            <Search size={18} />
            <input placeholder="Search reports..." />
          </label>
          <div className="pos-mode-toggle">
            <button type="button" className={cn(activeTab === 'Overview' && 'active')} onClick={() => setActiveTab('Overview')}>
              Overview
            </button>
            <button type="button" className={cn(activeTab === 'Detailed' && 'active')} onClick={() => setActiveTab('Detailed')}>
              Detailed
            </button>
          </div>
        </div>

        {/* stat tiles */}
        <div className="pos-tile-grid pb-2">
          {tiles.map((t, i) => (
            <button
              key={i}
              type="button"
              className={cn('pos-tile transition-all', t.color)}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <t.icon size={18} />
              <h3>{t.label}</h3>
              <p>{t.prefix}<AnimatedNumber value={t.value} />{t.suffix}</p>
            </button>
          ))}
        </div>

        {/* scrollable content */}
        <div className="px-3 overflow-y-auto pb-8 custom-scrollbar block space-y-6">

          {/* area chart */}
          <div className="pos-product-card transition-all duration-300 w-full" style={{ animationDelay: '200ms', padding: '1.25rem' }}>
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-gray-400 text-xs mb-1">Monthly Snapshot</p>
                <h4 className="text-xl font-bold text-white tracking-tight">Revenue Stream</h4>
                <strong className="text-2xl mt-1 block">
                  LKR <AnimatedNumber value={stats?.totalRevenue ?? 0} />
                </strong>
              </div>
              <div className="flex items-center gap-2 bg-[#1d222a] border border-[#2b313a] px-3 py-1.5 rounded-xl cursor-pointer">
                <span className="text-[11px] font-bold text-gray-400">All Time</span>
                <ArrowUpRight size={14} className="text-gray-500" />
              </div>
            </div>

            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="rpGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f8fafc" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#f8fafc" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2b313a" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 700 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 700 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #2b313a', background: '#1c2026', padding: '8px 12px' }}
                    itemStyle={{ color: '#fff' }}
                    cursor={{ stroke: '#f8fafc', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#f8fafc" strokeWidth={3} fillOpacity={1} fill="url(#rpGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </section>

      {/* ── RIGHT BILL PANEL ── */}
      <aside className="pos-bill">

        <div className="pos-bill-head flex flex-col items-start gap-1 pb-6 border-b border-[#1f242c]">
          <h2 className="text-xl font-bold tracking-tight">Performance</h2>
          <p className="text-xs font-semibold text-gray-500">Real-time KPI gauge</p>
        </div>

        {/* gauge */}
        <div className="flex-1 flex flex-col items-center justify-center relative mt-6">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={liveGauge}
                cx="50%" cy="100%"
                startAngle={180} endAngle={0}
                innerRadius={80} outerRadius={110}
                paddingAngle={0}
                dataKey="value"
                stroke="none"
              >
                {liveGauge.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute top-[65%] flex flex-col items-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Success Rate</p>
            <p className="text-4xl font-bold text-white tracking-tighter">
              <AnimatedNumber value={successRate} />
              <span className="text-lg text-gray-400">%</span>
            </p>
          </div>
        </div>

        {/* mini KPI tiles */}
        <div className="grid grid-cols-3 gap-2 mt-auto mb-6 px-2">
          {[
            { label: 'Revenue', value: stats?.totalRevenue ? `${(stats.totalRevenue / 1000).toFixed(1)}k` : '—', color: 'bg-[#f2c8de]' },
            { label: 'Orders',  value: String(stats?.totalOrders  ?? '—'), color: 'bg-[#d7e5e8]' },
            { label: 'Clients', value: String(stats?.newCustomers ?? '—'), color: 'bg-[#e6d3f0]' },
          ].map((item, i) => (
            <div key={i} className="text-center bg-[#161a20] rounded-xl border border-[#1f242c] py-3 cursor-default">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className={cn('w-2 h-2 rounded-full', item.color)} />
              </div>
              <p className="text-[14px] font-bold text-white">{item.value}</p>
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">{item.label}</span>
            </div>
          ))}
        </div>

        {/* date range picker placeholder */}
        <div className="px-1 mb-4">
          <button className="w-full flex items-center justify-between px-4 py-3 bg-[#1d222a] border border-[#2b313a] rounded-xl hover:border-gray-500/50 transition-all">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-400" />
              <span className="text-xs font-bold text-gray-400">All Time</span>
            </div>
            <ArrowUpRight size={14} className="text-gray-600" />
          </button>
        </div>

        <button type="button" className="pos-submit mt-auto mb-4">
          Generate Full Report
        </button>

      </aside>
    </div>
  );
};
