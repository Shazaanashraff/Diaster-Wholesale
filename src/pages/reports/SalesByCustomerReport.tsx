import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { type ReportPeriod, getReportDateRange, fmtCurrency } from '../../utils/reportUtils';
import { ReportTable } from './shared/ReportTable';
import { DateRangePicker } from './shared/DateRangePicker';
import { ExportBar } from './shared/ExportBar';
import { Users } from 'lucide-react';
import { ReportKPICard } from './shared/ReportKPICard';

export const SalesByCustomerReport: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { from, to } = getReportDateRange(period);
      
      let query = supabase
        .from('invoices')
        .select('customer_id, total, customers(name, type, outstanding_balance)')
        .in('payment_status', ['paid', 'partial']);

      if (from) query = query.gte('created_at', from);
      if (to) query = query.lte('created_at', to);

      const { data: res } = await query;

      const map: Record<string, any> = {};
      (res || []).forEach(inv => {
        const id = inv.customer_id;
        if (!map[id]) {
          map[id] = { 
            name: (inv.customers as any)?.name || 'Unknown', 
            type: (inv.customers as any)?.type,
            purchases: 0, 
            revenue: 0,
            outstanding: (inv.customers as any)?.outstanding_balance || 0
          };
        }
        map[id].purchases++;
        map[id].revenue += Number(inv.total);
      });

      setData(Object.values(map).sort((a, b) => b.revenue - a.revenue));
      setLoading(false);
    }
    load();
  }, [period]);

  const headers = ['Customer', 'Type', 'Orders', 'Revenue', 'Outstanding'];
  const rows = data.map(r => [r.name, r.type, r.purchases, fmtCurrency(r.revenue), fmtCurrency(r.outstanding)]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Sales by Customer Report</h2>
        <div className="flex items-center gap-3">
          <DateRangePicker value={period} onChange={setPeriod} />
          <ExportBar filename="Sales_By_Customer" headers={headers} rows={rows} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReportKPICard label="Active Customers" value={data.length} icon={Users} color="bg-blue-600" />
      </div>

      <ReportTable
        columns={[
          { header: 'Customer', accessor: 'name' },
          { header: 'Type', accessor: 'type', className: 'capitalize' },
          { header: 'Orders', accessor: 'purchases', className: 'text-center' },
          { header: 'Revenue', accessor: (r) => fmtCurrency(r.revenue), className: 'text-right font-mono text-white' },
          { header: 'Outstanding', accessor: (r) => fmtCurrency(r.outstanding), className: 'text-right font-mono text-red-400' }
        ]}
        data={data}
        emptyMessage="No customer sales found for this period."
      />
    </div>
  );
};
