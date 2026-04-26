import React, { useState, useEffect } from 'react';
import { 
  ArrowUpRight,
  Maximize2,
  MoreVertical,
  Filter,
  Package,
  Clock,
  TrendingUp,
  AlertCircle,
  Search
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
  Cell
} from 'recharts';
import { cn } from '../lib/utils';
import { AnimatedNumber } from '../components/AnimatedNumber';

const chartData = [
  { name: '200', value: 400 },
  { name: '400', value: 300 },
  { name: '600', value: 600 },
  { name: '800', value: 800 },
  { name: '1000', value: 500 },
  { name: '1200', value: 900 },
  { name: '1500', value: 700 },
  { name: '2000', value: 1100 },
];

const gaugeData = [
  { name: 'Completed', value: 92.46, color: '#f8fafc' },
  { name: 'Remaining', value: 7.54, color: '#1d222a' },
];

const stats = [
  { label: 'Orders to Ship', value: 52, update: 'Updated 1 hr Ago', color: 'bg-[#d7e5e8]', icon: Package },
  { label: 'Late Orders', value: 64, update: 'Updated 2 hr Ago', color: 'bg-[#e6d3f0]', icon: Clock },
  { label: 'Open Opps', value: 154, update: 'Updated 1 hr Ago', color: 'bg-[#d4e8f8]', icon: TrendingUp },
  { label: 'Overdue', value: 152, update: 'Updated 4 hr Ago', color: 'bg-[#f2c8de]', icon: AlertCircle },
];

const customers = [
  { name: 'Florence', email: 'florence@untitleddui.com', phone: '(406) 555-0120', type: 'Email', summary: 'Called the customer', status: 'Open', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100&h=100&auto=format&fit=crop' },
  { name: 'Ammar Faurent', email: 'ammar@untitleddui.com', phone: '(406) 545-0110', type: 'Chat', summary: 'Escalated to AR team', status: 'Completed', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100&h=100&auto=format&fit=crop' },
  { name: 'Caitlyn King', email: 'caitlyn@untitleddui.com', phone: '(406) 573-0420', type: 'Note', summary: 'Called the customer', status: 'Open', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=100&h=100&auto=format&fit=crop' },
];

export const DashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Overview');

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

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
          <div className="pos-skeleton-products mt-4">
            <div className="w-full h-[400px] rounded-xl skeleton"></div>
            <div className="w-full h-[300px] rounded-xl skeleton mt-4"></div>
          </div>
        </div>
        <div className="pos-skeleton-panel" />
      </div>
    );
  }

  return (
    <div className="pos-page-grid">
      <section className="pos-main">
        <div className="pos-main-head">
          <label className="pos-search">
            <Search size={18} />
            <input placeholder="Search operations..." />
          </label>
          <div className="pos-mode-toggle">
            <button 
              type="button" 
              className={cn(activeTab === 'Overview' && 'active')} 
              onClick={() => setActiveTab('Overview')}
            >
              Overview
            </button>
            <button 
              type="button" 
              className={cn(activeTab === 'Detailed' && 'active')} 
              onClick={() => setActiveTab('Detailed')}
            >
              Detailed
            </button>
          </div>
        </div>

        <div className="pos-tile-grid pb-2">
          {stats.map((stat, i) => (
            <button
              key={i}
              type="button"
              className={cn("pos-tile transition-all", stat.color)}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <stat.icon size={18} />
              <h3>{stat.label}</h3>
              <p><AnimatedNumber value={stat.value} /> alerts</p>
            </button>
          ))}
        </div>

        <div className="pos-product-grid px-3 overflow-y-auto pb-8 custom-scrollbar block space-y-6">
          
          {/* AREA CHART */}
          <div className="pos-product-card transition-all duration-300 w-full" style={{ animationDelay: '200ms', padding: '1.25rem' }}>
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-gray-400 text-xs mb-1">Monthly Snapshot</p>
                <h4 className="text-xl font-bold text-white tracking-tight">Revenue Stream</h4>
                <strong className="text-2xl mt-1 block">LKR <AnimatedNumber value={1100} /> k</strong>
              </div>
              <div className="flex items-center gap-2 bg-[#1d222a] border border-[#2b313a] px-3 py-1.5 rounded-xl cursor-pointer">
                <span className="text-[11px] font-bold text-gray-400">Last Month</span>
                <ArrowUpRight size={14} className="text-gray-500" />
              </div>
            </div>
            
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f8fafc" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#f8fafc" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2b313a" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#6b7280', fontSize: 10, fontWeight: 700}}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#6b7280', fontSize: 10, fontWeight: 700}}
                  />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: '1px solid #2b313a', background: '#1c2026', padding: '8px 12px'}}
                    itemStyle={{ color: '#fff' }}
                    cursor={{stroke: '#f8fafc', strokeWidth: 1.5, strokeDasharray: '4 4'}}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#f8fafc" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CUSTOMERS TABLE */}
          <div className="pos-product-card transition-all duration-300 w-full" style={{ animationDelay: '300ms', padding: '1.25rem' }}>
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-gray-400 text-xs mb-1">CRM Pipeline</p>
                <h4 className="text-lg font-bold text-white tracking-tight">Active Contacts</h4>
              </div>
              <button className="flex items-center gap-2 px-3 py-1.5 border border-[#2b313a] rounded-xl hover:bg-[#1d222a] transition-colors">
                <span className="text-[11px] font-bold text-gray-400">Filters</span>
                <Filter size={14} className="text-gray-500" />
              </button>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2b313a]">
                    <th className="text-left py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4">Contact</th>
                    <th className="text-left py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4">Phone</th>
                    <th className="text-left py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4">Activity</th>
                    <th className="text-left py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4">Summary</th>
                    <th className="text-right py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer, i) => (
                    <tr key={i} className="group hover:bg-[#1d222a] transition-colors border-b border-[#2b313a] last:border-0">
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <img src={customer.avatar} className="w-8 h-8 rounded-full object-cover" alt="" />
                          <div>
                            <p className="text-[13px] font-semibold text-white leading-tight">{customer.name}</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">{customer.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-[12px] font-medium text-white">{customer.phone}</td>
                      <td className="py-4 px-4 text-[12px] font-medium text-gray-400">{customer.type}</td>
                      <td className="py-4 px-4">
                        <span className="text-[11px] font-medium text-[#f1c3db] underline cursor-pointer hover:text-white transition-colors">{customer.summary}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            customer.status === 'Open' ? "bg-[#1d222a] border border-[#2b313a] text-gray-300" : "bg-[#f8fafc] text-[#111315]"
                          )}>
                            {customer.status}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </section>

      <aside className="pos-bill">
        <div className="pos-bill-head flex flex-col items-start gap-1 pb-6 border-b border-[#1f242c]">
          <h2 className="text-xl font-bold tracking-tight">Performance</h2>
          <p className="text-xs font-semibold text-gray-500">Real-time KPI gauge</p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center relative mt-8">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={gaugeData}
                cx="50%"
                cy="100%"
                startAngle={180}
                endAngle={0}
                innerRadius={80}
                outerRadius={110}
                paddingAngle={0}
                dataKey="value"
                stroke="none"
              >
                {gaugeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute top-[70%] flex flex-col items-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Completion</p>
            <p className="text-4xl font-bold text-white tracking-tighter">92<span className="text-lg text-gray-400">.46%</span></p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-auto mb-8 px-2">
          {[
            { label: 'Project', value: '26.4', color: 'bg-[#e6d3f0]' },
            { label: 'Is Empty', value: '31.7', color: 'bg-[#d7e5e8]' },
            { label: 'Other', value: '34.3', color: 'bg-[#d4e8f8]' },
          ].map((item, i) => (
            <div key={i} className="text-center group cursor-default bg-[#161a20] rounded-xl border border-[#1f242c] py-3">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className={cn("w-2 h-2 rounded-full", item.color)}></div>
              </div>
              <p className="text-[14px] font-bold text-white">{item.value}</p>
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">{item.label}</span>
            </div>
          ))}
        </div>

        <button type="button" className="pos-submit mt-auto mb-4">
          Generate Full Report
        </button>
      </aside>
    </div>
  );
};




