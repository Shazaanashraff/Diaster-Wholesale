import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { type ReportPeriod, getReportDateRange, fmtCurrency, fmtDate } from '../../utils/reportUtils';
import { ReportTable } from './shared/ReportTable';
import { DateRangePicker } from './shared/DateRangePicker';
import { ExportBar } from './shared/ExportBar';
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import { ReportKPICard } from './shared/ReportKPICard';

interface CashFlowTransaction {
  amount: number;
  created_at: string;
  type: 'IN' | 'OUT';
  label: string;
  method?: string;
}

export const CashFlowReport: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [data, setData] = useState<{
    cashIn: number;
    cashOut: number;
    transactions: CashFlowTransaction[];
  }>({ cashIn: 0, cashOut: 0, transactions: [] });

  useEffect(() => {
    async function load() {
      const { from, to } = getReportDateRange(period);
      
      const [payments, expenses] = await Promise.all([
        supabase.from('payments').select('amount, created_at, method').gte('created_at', from || '').lte('created_at', to || ''),
        supabase.from('expenses').select('amount, created_at').gte('created_at', from || '').lte('created_at', to || '')
      ]);

      const inData: CashFlowTransaction[] = (payments.data || []).map(p => ({ ...p, type: 'IN', label: 'Sales Receipt' } as CashFlowTransaction));
      const outData: CashFlowTransaction[] = (expenses.data || []).map(e => ({ ...e, type: 'OUT', label: 'Expense' } as CashFlowTransaction));

      const all = [...inData, ...outData].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      const cashIn = inData.reduce((sum, p) => sum + Number(p.amount), 0);
      const cashOut = outData.reduce((sum, e) => sum + Number(e.amount), 0);

      setData({ cashIn, cashOut, transactions: all });
    }
    load();
  }, [period]);

  const headers = ['Date', 'Type', 'Description', 'Amount'];
  const rows = data.transactions.map((r) => [
    fmtDate(r.created_at), r.type, r.label, fmtCurrency(r.amount)
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Cash Flow Report</h2>
        <div className="flex items-center gap-3">
          <DateRangePicker value={period} onChange={setPeriod} />
          <ExportBar filename="Cash_Flow_Report" headers={headers} rows={rows} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ReportKPICard label="Cash In" value={data.cashIn} prefix="LKR " icon={ArrowDownLeft} color="bg-green-600" />
        <ReportKPICard label="Cash Out" value={data.cashOut} prefix="LKR " icon={ArrowUpRight} color="bg-red-600" />
        <ReportKPICard label="Net Flow" value={data.cashIn - data.cashOut} prefix="LKR " icon={Wallet} color="bg-blue-600" />
      </div>

      <ReportTable<CashFlowTransaction>
        columns={[
          { header: 'Date', accessor: (r) => fmtDate(r.created_at) },
          { header: 'Type', accessor: (r) => (
            <span className={r.type === 'IN' ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
              {r.type}
            </span>
          )},
          { header: 'Description', accessor: 'label' },
          { header: 'Amount', accessor: (r) => fmtCurrency(r.amount), className: 'text-right font-mono' }
        ]}
        data={data.transactions}
        emptyMessage="No cash flow transactions found for this period."
      />
    </div>
  );
};
