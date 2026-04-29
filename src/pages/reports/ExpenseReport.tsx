import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { type ReportPeriod, getReportDateRange, fmtCurrency, fmtDate } from '../../utils/reportUtils';
import { ReportTable } from './shared/ReportTable';
import { DateRangePicker } from './shared/DateRangePicker';
import { ExportBar } from './shared/ExportBar';
import { CreditCard, Activity } from 'lucide-react';
import { ReportKPICard } from './shared/ReportKPICard';

export const ExpenseReport: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { from, to } = getReportDateRange(period);
      
      let query = supabase.from('expenses').select('*').order('created_at', { ascending: false });
      if (from) query = query.gte('created_at', from);
      if (to) query = query.lte('created_at', to);

      const { data: res } = await query;
      setData(res || []);
    }
    load();
  }, [period]);

  const total = data.reduce((sum, e) => sum + Number(e.amount), 0);
  const headers = ['Date', 'Category', 'Description', 'Amount', 'Ref'];
  const rows = data.map(r => [fmtDate(r.created_at), r.category, r.description, fmtCurrency(r.amount), r.reference]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Expense Report</h2>
        <div className="flex items-center gap-3">
          <DateRangePicker value={period} onChange={setPeriod} />
          <ExportBar filename="Expense_Report" headers={headers} rows={rows} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReportKPICard label="Total Expenses" value={total} prefix="LKR " icon={CreditCard} color="bg-red-600" />
        <ReportKPICard label="Expense Count" value={data.length} icon={Activity} color="bg-orange-600" />
      </div>

      <ReportTable
        columns={[
          { header: 'Date', accessor: (r) => fmtDate(r.created_at) },
          { header: 'Category', accessor: 'category', className: 'capitalize' },
          { header: 'Description', accessor: 'description' },
          { header: 'Amount', accessor: (r) => fmtCurrency(r.amount), className: 'text-right font-mono text-red-400' }
        ]}
        data={data}
        emptyMessage="No expenses recorded for this period."
      />
    </div>
  );
};


