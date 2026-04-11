import React from 'react';
import { TopBar } from '../components/TopBar';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, ShoppingBag, Users, Calendar } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-accent">
      <TopBar />
      
      <div className="p-10">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-dark tracking-tight">Analytics</h1>
            <p className="text-gray-400 text-sm font-semibold mt-1">Deep dive into your store's sales performance.</p>
          </div>
          <button className="flex items-center gap-3 px-8 py-4 bg-white border-2 border-border/50 rounded-3xl font-bold text-sm text-dark hover:border-primary/20 transition-all shadow-sm">
            <Calendar size={22} strokeWidth={2.5} className="text-primary" /> LAST 30 DAYS
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {[
            { label: 'Total Revenue', value: 'LKR 4,52,000', trend: '+12.5%', isUp: true, icon: DollarSign, color: 'text-primary', bg: 'bg-orange-50' },
            { label: 'Total Orders', value: '1,240', trend: '+8.2%', isUp: true, icon: ShoppingBag, color: 'text-blue-500', bg: 'bg-blue-50' },
            { label: 'New Members', value: '48', trend: '-2.4%', isUp: false, icon: Users, color: 'text-purple-500', bg: 'bg-purple-50' },
            { label: 'Success Rate', value: '98.5%', trend: '+0.5%', isUp: true, icon: TrendingUp, color: 'text-orange-500', bg: 'bg-orange-50' },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-border/50 hover:shadow-xl hover:shadow-orange-100/10 transition-all duration-500">
              <div className="flex items-center justify-between mb-6">
                <div className={`w-14 h-14 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center border border-orange-100/30 shadow-sm shadow-orange-50`}>
                  <stat.icon size={28} strokeWidth={2.5} />
                </div>
                <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest ${stat.isUp ? 'text-primary' : 'text-red-500'}`}>
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
              <h3 className="text-lg font-bold text-dark tracking-tight">Revenue Forecast</h3>
              <BarChart3 size={24} className="text-primary" />
            </div>
            <div className="flex-1 bg-accent/50 rounded-[2rem] border-4 border-dashed border-orange-50 flex flex-col items-center justify-center text-gray-400">
              <BarChart3 size={64} strokeWidth={1} className="mb-6 opacity-20" />
              <p className="text-sm font-semibold text-gray-400">Monthly Revenue Analytics</p>
              <div className="mt-4 px-4 py-1.5 bg-white rounded-full text-[10px] font-bold text-gray-300 border border-border">CHART DATA SOURCE CONNECTED</div>
            </div>
          </div>

          <div className="bg-white rounded-[3rem] border border-border/50 p-10 min-h-[450px] flex flex-col shadow-sm">
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-lg font-bold text-dark tracking-tight">Category Distribution</h3>
              <ShoppingBag size={24} className="text-primary" />
            </div>
            <div className="flex-1 bg-orange-50/20 rounded-[2rem] border-4 border-dashed border-orange-50 flex flex-col items-center justify-center">
              <div className="w-40 h-40 rounded-full border-[12px] border-orange-50 border-t-primary border-r-blue-100 mb-6 opacity-40 shadow-inner"></div>
              <p className="text-sm font-semibold text-gray-400">Item Distribution Breakdown</p>
              <div className="flex gap-4 mt-6">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary"></div><span className="text-[10px] font-bold text-gray-400">SOFTWARE</span></div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-200"></div><span className="text-[10px] font-bold text-gray-400">GAMING</span></div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-gray-100"></div><span className="text-[10px] font-bold text-gray-400">OTHERS</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
