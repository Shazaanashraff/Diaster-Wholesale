import React from 'react';
import { TopBar } from '../components/TopBar';
import { 
  ArrowUpRight,
  Maximize2,
  MoreVertical,
  Filter,
  Package,
  Clock,
  TrendingUp,
  AlertCircle
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
  { name: 'Completed', value: 92.46, color: '#ff6b00' },
  { name: 'Remaining', value: 7.54, color: '#f8f9fa' },
];

const stats = [
  { label: 'Orders to Ship', value: '52.00', update: 'Updated 1 hr Ago', color: 'bg-blue-50', iconColor: 'text-blue-600', icon: Package },
  { label: 'Late Orders', value: '64.00', update: 'Updated 2 hr Ago', color: 'bg-[#fff3e0]', iconColor: 'text-orange-600', icon: Clock },
  { label: 'Open Opportunities', value: '154.00', update: 'Updated 1 hr Ago', color: 'bg-[#fffde7]', iconColor: 'text-yellow-600', icon: TrendingUp },
  { label: 'Overdue Deals', value: '152.00', update: 'Updated 4 hr Ago', color: 'bg-[#fce4ec]', iconColor: 'text-pink-600', icon: AlertCircle },
];

const customers = [
  { name: 'Florence', email: 'florence@untitleddui.com', phone: '(406) 555-0120', type: 'Email', summary: 'Called the customer', status: 'Open', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100&h=100&auto=format&fit=crop' },
  { name: 'Ammar Faurent', email: 'ammar@untitleddui.com', phone: '(406) 545-0110', type: 'Chat', summary: 'Escalated to AR team', status: 'Completed', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100&h=100&auto=format&fit=crop' },
  { name: 'Caitlyn King', email: 'caitlyn@untitleddui.com', phone: '(406) 573-0420', type: 'Note', summary: 'Called the customer', status: 'Open', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=100&h=100&auto=format&fit=crop' },
];

export const DashboardPage: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-[#f8f9fa] pb-20">
      <TopBar />
      
      <div className="px-10 py-6 space-y-8">
        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <div key={i} className="premium-card flex flex-col justify-between group">
              <div className="flex items-start justify-between mb-4">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", stat.color)}>
                  <stat.icon className={stat.iconColor} size={20} strokeWidth={2.5} />
                </div>
                <button className="text-gray-300 hover:text-dark transition-colors">
                  <Maximize2 size={16} />
                </button>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-400 mb-1">{stat.label}</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-bold text-dark tracking-tight">{stat.value}</h3>
                </div>
                <p className="text-[11px] text-gray-300 font-medium mt-2">{stat.update}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* OVERVIEW CHART */}
          <div className="lg:col-span-2 premium-card">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-dark">Overview</h3>
                <p className="text-3xl font-bold text-dark mt-2">1.1k</p>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-xl cursor-pointer">
                <span className="text-[11px] font-bold text-gray-500">Last Month</span>
                <ArrowUpRight size={14} className="text-gray-400" />
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff6b00" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#ff6b00" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#9ca3af', fontSize: 10, fontWeight: 700}}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#9ca3af', fontSize: 10, fontWeight: 700}}
                  />
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    cursor={{stroke: '#ff6b00', strokeWidth: 2}}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#ff6b00" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* RECENT PURCHASE HISTORY GAUGE */}
          <div className="premium-card flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-dark">Recent Purchase History</h3>
              <MoreVertical size={20} className="text-gray-300 cursor-pointer" />
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center relative">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={gaugeData}
                    cx="50%"
                    cy="100%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={0}
                    dataKey="value"
                  >
                    {gaugeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute top-[75%] flex flex-col items-center">
                <p className="text-[11px] font-semibold text-gray-500 mb-1">Completed Accuracy</p>
                <p className="text-4xl font-bold text-dark tracking-tighter">92.46</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-12 px-2">
              {[
                { label: 'Project', value: '26.40', color: 'bg-primary' },
                { label: 'Is Empty', value: '31.75', color: 'bg-secondary' },
                { label: 'Other', value: '34.31', color: 'bg-dark' },
              ].map((item, i) => (
                <div key={i} className="text-center group cursor-default">
                  <div className="flex items-center justify-center gap-1.5 mb-1.5">
                    <div className={cn("w-2 h-2 rounded-full", item.color)}></div>
                    <span className="text-[10px] font-semibold text-gray-400 group-hover:text-dark transition-colors">{item.label}</span>
                  </div>
                  <p className="text-[15px] font-bold text-dark">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CUSTOMER CONTACTS TABLE */}
        <div className="premium-card">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-dark">Customer Contacts</h3>
            <button className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <span className="text-[11px] font-bold text-gray-500">Filters</span>
              <Filter size={14} className="text-gray-400" />
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest px-4">User name</th>
                  <th className="text-left py-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest px-4">Phone</th>
                  <th className="text-left py-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest px-4">Activity Type</th>
                  <th className="text-left py-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest px-4">Summary</th>
                  <th className="text-left py-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer, i) => (
                  <tr key={i} className="group hover:bg-gray-50/50 transition-colors border-b border-gray-50 last:border-0">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <img src={customer.avatar} className="w-9 h-9 rounded-full object-cover" alt="" />
                        <div>
                          <p className="text-[13px] font-semibold text-dark">{customer.name}</p>
                          <p className="text-[11px] text-gray-400 font-medium">{customer.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-[12px] font-semibold text-dark">{customer.phone}</td>
                    <td className="py-4 px-4 text-[12px] font-semibold text-gray-400">{customer.type}</td>
                    <td className="py-4 px-4">
                      <span className="text-[12px] font-semibold text-blue-600 underline cursor-pointer">{customer.summary}</span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <span className={cn(
                          "px-4 py-1.5 rounded-full text-[11px] font-bold leading-none",
                          customer.status === 'Open' ? "bg-orange-50 text-orange-600" : "bg-blue-50 text-blue-500"
                        )}>
                          {customer.status}
                        </span>
                        <MoreVertical size={16} className="text-gray-300 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
