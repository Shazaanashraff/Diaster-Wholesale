import React, { useState, useEffect } from 'react';
import { getCustomers } from '../../services/customerService';
import type { Customer } from '../../types';
import { Loader2, ArrowUpRight, ArrowDownRight, Search } from 'lucide-react';
import { cn } from '../../lib/utils';

export const CustomerLedgerAggregateReport: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getCustomers().then(data => {
      setCustomers(data);
      setLoading(false);
    });
  }, []);

  const fmt = (n: number) =>
    'LKR ' + Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  ).sort((a, b) => b.outstanding_balance - a.outstanding_balance);

  const totalOutstanding = customers.reduce((s, c) => s + (c.outstanding_balance || 0), 0);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl p-5">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Receivables</p>
          <h2 className="text-2xl font-mono font-bold text-red-400">{fmt(totalOutstanding)}</h2>
        </div>
        <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl p-5">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Active Customers</p>
          <h2 className="text-2xl font-bold text-white">{customers.length}</h2>
        </div>
        <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl p-5 flex items-end">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search customers..."
              className="w-full bg-[#1d222a] border border-[#2b313a] text-xs text-white rounded-xl py-2 pl-9 pr-4 outline-none focus:border-primary/40"
            />
          </div>
        </div>
      </div>

      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#1d222a]">
              {['Customer', 'Type', 'Credit Limit', 'Outstanding Balance', 'Status'].map(h => (
                <th key={h} className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2b313a]">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-[#1d222a] transition-colors">
                <td className="px-6 py-4">
                  <p className="text-sm font-semibold text-white">{c.name}</p>
                  <p className="text-[10px] text-gray-500">{c.phone || 'No phone'}</p>
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase",
                    c.type === 'wholesale' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'
                  )}>
                    {c.type}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-mono text-gray-400">{fmt(c.credit_limit || 0)}</td>
                <td className="px-6 py-4 text-sm font-mono font-bold text-white">
                  <span className={c.outstanding_balance > 0 ? 'text-red-400' : 'text-green-400'}>
                    {fmt(c.outstanding_balance || 0)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {c.outstanding_balance > (c.credit_limit || 0) ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 uppercase tracking-tighter">
                      <ArrowUpRight size={12} /> Over Limit
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-green-500 uppercase tracking-tighter">
                      <ArrowDownRight size={12} /> Healthy
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
