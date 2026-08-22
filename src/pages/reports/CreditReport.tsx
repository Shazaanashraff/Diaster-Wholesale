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
  totalAmount: number; totalPaid: number; outstanding: number; oldestInvoice: string | null;
}

export const CreditReport: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [rows, setRows] = useState<CreditRow[]>([]);

  useEffect(() => {
    async function load() {
      const { from, to } = getReportDateRange(period, customFrom, customTo);

      const { data: customers } = await supabase
        .from('customers')
        .select('id, name, outstanding_balance')
        .eq('is_active', true)
        .gt('outstanding_balance', 0)
        .order('outstanding_balance', { ascending: false });

      // Supabase caps a single request at 1000 rows, and "All Time" on a
      // busy store easily exceeds that — page through with .range() so
      // Total Billed/Paid aren't silently computed from a truncated set.
      const PAGE_SIZE = 1000;
      const invoices: any[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        let q = supabase
          .from('invoices')
          .select('id, total, created_at, customer_id, payments(amount)')
          .in('payment_status', ['unpaid', 'partial'])
          .order('id', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        if (from) q = q.gte('created_at', from);
        if (to)   q = q.lte('created_at', to);
        const { data: page, error } = await q;
        if (error) { console.error('Credit report fetch failed:', error); break; }
        invoices.push(...(page ?? []));
        if (!page || page.length < PAGE_SIZE) break;
      }

      const invMap: Record<string, { invoiceCount: number; totalAmount: number; totalPaid: number; oldestInvoice: string | null }> = {};
      for (const inv of (invoices ?? []) as any[]) {
        const cid = inv.customer_id ?? 'unknown';
        const paid = (inv.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
        if (!invMap[cid]) invMap[cid] = { invoiceCount: 0, totalAmount: 0, totalPaid: 0, oldestInvoice: inv.created_at };
        invMap[cid].invoiceCount++;
        invMap[cid].totalAmount += Number(inv.total);
        invMap[cid].totalPaid   += paid;
        if (!invMap[cid].oldestInvoice || inv.created_at < invMap[cid].oldestInvoice!) invMap[cid].oldestInvoice = inv.created_at;
      }

      const newRows: CreditRow[] = ((customers ?? []) as any[]).map(c => {
        const stats = invMap[c.id];
        return {
          customerId: c.id,
          customerName: c.name ?? 'Walk-in',
          invoiceCount: stats?.invoiceCount ?? 0,
          totalAmount: stats?.totalAmount ?? 0,
          totalPaid: stats?.totalPaid ?? 0,
          outstanding: Number(c.outstanding_balance) || 0,
          oldestInvoice: stats?.oldestInvoice ?? null,
        };
      });
      setRows(newRows.sort((a, b) => b.outstanding - a.outstanding));
    }
    load();
  }, [period, customFrom, customTo]);

  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);
  const totalCustomers   = rows.length;

  const exportHeaders = ['Customer', 'Invoices', 'Total Billed', 'Paid', 'Outstanding', 'Oldest Invoice'];
  const exportRows = rows.map(r => [r.customerName, r.invoiceCount, fmtCurrency(r.totalAmount), fmtCurrency(r.totalPaid), fmtCurrency(r.outstanding), r.oldestInvoice ? fmtDate(r.oldestInvoice) : '-']);

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
            r.oldestInvoice ? (
              <span className="flex items-center gap-1 text-amber-400">
                <AlertCircle size={11} />
                {fmtDate(r.oldestInvoice)}
              </span>
            ) : <span className="text-gray-500">-</span>
          )},
        ]}
        data={rows}
        emptyMessage="No outstanding credit invoices found."
      />
    </div>
  );
};
