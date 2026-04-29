import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { fmtCurrency } from '../../utils/reportUtils';
import { ReportTable } from './shared/ReportTable';
import { ExportBar } from './shared/ExportBar';

interface PurchaseRow {
  reference: string;
  supplier: string;
  status: string;
  totalRmb: number;
  exchangeRate: number;
  totalLkr: number;
  additionalCosts: number;
  createdAt: string;
}

export const PurchaseHistoryReport: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PurchaseRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    async function load() {
      setLoading(true);

      const query = supabase
        .from('purchases')
        .select(`
          reference,
          status,
          exchange_rate,
          total_rmb,
          total_lkr,
          created_at,
          suppliers ( name ),
          purchase_costs ( amount )
        `)
        .order('created_at', { ascending: false });

      const { data: rows } = await query;

      const mapped: PurchaseRow[] = (rows ?? []).map((r: any) => {
        const additionalCosts = (r.purchase_costs ?? []).reduce(
          (sum: number, c: any) => sum + Number(c.amount ?? 0),
          0
        );
        return {
          reference: r.reference,
          supplier: r.suppliers?.name ?? '—',
          status: r.status,
          totalRmb: Number(r.total_rmb ?? 0),
          exchangeRate: Number(r.exchange_rate ?? 0),
          totalLkr: Number(r.total_lkr ?? 0),
          additionalCosts,
          createdAt: r.created_at ? new Date(r.created_at).toLocaleDateString() : '—',
        };
      });

      setData(mapped);
      setLoading(false);
    }
    load();
  }, []);

  const STATUSES = ['all', 'draft', 'confirmed', 'in_transit', 'received', 'closed'];

  const filtered = statusFilter === 'all' ? data : data.filter(r => r.status === statusFilter);

  const headers = ['Reference', 'Supplier', 'Status', 'Total RMB', 'Rate', 'Total LKR', 'Extra Costs', 'Date'];
  const rows = filtered.map(r => [
    r.reference, r.supplier, r.status, r.totalRmb, r.exchangeRate,
    fmtCurrency(r.totalLkr), fmtCurrency(r.additionalCosts), r.createdAt,
  ]);

  const STATUS_COLORS: Record<string, string> = {
    draft: 'text-gray-400',
    confirmed: 'text-blue-400',
    in_transit: 'text-amber-400',
    received: 'text-emerald-400',
    closed: 'text-primary',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-white">Purchase History</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1">
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  statusFilter === s
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-[#1d222a] text-gray-500 border border-[#2b313a] hover:text-gray-300'
                }`}
              >
                {s === 'all' ? 'All' : s.replace('_', ' ')}
              </button>
            ))}
          </div>
          <ExportBar filename="Purchase_History" headers={headers} rows={rows} />
        </div>
      </div>

      <ReportTable
        columns={[
          { header: 'Reference',   accessor: 'reference',      className: 'font-mono text-primary' },
          { header: 'Supplier',    accessor: 'supplier' },
          { header: 'Status',      accessor: (r) => (
            <span className={`text-[11px] font-bold uppercase tracking-wider ${STATUS_COLORS[r.status] ?? 'text-gray-400'}`}>
              {r.status.replace('_', ' ')}
            </span>
          )},
          { header: 'Total RMB',  accessor: (r) => `¥ ${r.totalRmb.toFixed(2)}`, className: 'text-right font-mono' },
          { header: 'Rate',       accessor: (r) => r.exchangeRate > 0 ? `${r.exchangeRate}` : '—', className: 'text-right' },
          { header: 'Total LKR',  accessor: (r) => fmtCurrency(r.totalLkr), className: 'text-right font-mono text-white' },
          { header: 'Extra Costs', accessor: (r) => r.additionalCosts > 0 ? fmtCurrency(r.additionalCosts) : '—', className: 'text-right font-mono' },
          { header: 'Date',       accessor: 'createdAt', className: 'text-gray-400' },
        ]}
        data={filtered}
        emptyMessage={loading ? 'Loading...' : 'No purchase orders found.'}
      />

      {/* Summary strip */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mt-2">
          {[
            { label: 'Total Orders',   value: String(filtered.length) },
            { label: 'Total LKR',      value: fmtCurrency(filtered.reduce((s, r) => s + r.totalLkr, 0)) },
            { label: 'Total Extra Costs', value: fmtCurrency(filtered.reduce((s, r) => s + r.additionalCosts, 0)) },
          ].map(kpi => (
            <div key={kpi.label} className="bg-[#1d222a] border border-[#2b313a] rounded-xl px-5 py-4">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{kpi.label}</p>
              <p className="text-lg font-bold text-white">{kpi.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
