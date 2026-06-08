import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { type ReportPeriod, getReportDateRange, fmtCurrency, fmtDate } from '../../utils/reportUtils';
import { ReportTable } from './shared/ReportTable';
import { DateRangePicker } from './shared/DateRangePicker';
import { ExportBar } from './shared/ExportBar';
import { ReportKPICard } from './shared/ReportKPICard';
import { CreditCard, Users, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CreditRow {
  customerId: string; customerName: string; invoiceCount: number;
  totalAmount: number; totalPaid: number; outstanding: number; oldestInvoice: string;
}

export const CreditReport: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [rows, setRows] = useState<CreditRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { from, to } = getReportDateRange(period, customFrom, customTo);
      let q = supabase
        .from('invoices')
        .select('id, total, created_at, customer_id, customers(name), payments(amount)')
        .in('payment_status', ['unpaid', 'partial']);
      if (from) q = q.gte('created_at', from);
      if (to)   q = q.lte('created_at', to);
      const { data } = await q;

      const map: Record<string, CreditRow> = {};
      for (const inv of (data ?? []) as any[]) {
        const cid = inv.customer_id ?? 'unknown';
        const name = inv.customers?.name ?? 'Walk-in';
        const paid = (inv.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
        const outstanding = Math.max(0, Number(inv.total) - paid);
        if (!map[cid]) map[cid] = { customerId: cid, customerName: name, invoiceCount: 0, totalAmount: 0, totalPaid: 0, outstanding: 0, oldestInvoice: inv.created_at };
        map[cid].invoiceCount++;
        map[cid].totalAmount += Number(inv.total);
        map[cid].totalPaid   += paid;
        map[cid].outstanding += outstanding;
        if (inv.created_at < map[cid].oldestInvoice) map[cid].oldestInvoice = inv.created_at;
      }
      setRows(Object.values(map).sort((a, b) => b.outstanding - a.outstanding));
      setLoading(false);
    }
    load();
  }, [period, customFrom, customTo]);

  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);
  const totalCustomers   = rows.length;

  const exportHeaders = ['Customer', 'Invoices', 'Total Billed', 'Paid', 'Outstanding', 'Oldest Invoice'];
  const exportRows = rows.map(r => [r.customerName, r.invoiceCount, fmtCurrency(r.totalAmount), fmtCurrency(r.totalPaid), fmtCurrency(r.outstanding), fmtDate(r.oldestInvoice)]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Credit Report</h2>
        <div className="flex items-center gap-3">
          <DateRangePicker value={period} onChange={setPeriod} customFrom={customFrom} customTo={customTo} onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }} />
          <ExportBar filename="Credit_Report" headers={exportHeaders} rows={exportRows} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ReportKPICard label="Total Outstanding" value={totalOutstanding} prefix="LKR " icon={CreditCard} color="bg-red-600" />
        <ReportKPICard label="Customers with Credit" value={totalCustomers} icon={Users} color="bg-amber-600" />
      </div>

      <ReportTable
        columns={[
          { header: 'Customer',      accessor: (r: CreditRow) => <span className="font-semibold text-white">{r.customerName}</span> },
          { header: 'Invoices',      accessor: (r: CreditRow) => r.invoiceCount, className: 'text-center' },
          { header: 'Total Billed',  accessor: (r: CreditRow) => fmtCurrency(r.totalAmount), className: 'text-right font-mono' },
          { header: 'Paid',          accessor: (r: CreditRow) => fmtCurrency(r.totalPaid), className: 'text-right font-mono text-green-400' },
          { header: 'Outstanding',   accessor: (r: CreditRow) => (
            <span className={cn('font-bold font-mono', r.outstanding > 0 ? 'text-red-400' : 'text-green-400')}>
              {fmtCurrency(r.outstanding)}
            </span>
          ), className: 'text-right' },
          { header: 'Oldest Invoice', accessor: (r: CreditRow) => (
            <span className="flex items-center gap-1 text-amber-400">
              <AlertCircle size={11} />
              {fmtDate(r.oldestInvoice)}
            </span>
          )},
        ]}
        data={rows}
        emptyMessage="No outstanding credit invoices found."
      />
    </div>
  );
};
