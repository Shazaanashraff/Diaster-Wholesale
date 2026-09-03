import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { type ReportPeriod, getReportDateRange, fmtCurrency, fmtDate } from '../../utils/reportUtils';
import { ReportTable } from './shared/ReportTable';
import { DateRangePicker } from './shared/DateRangePicker';
import { ExportBar } from './shared/ExportBar';
import { ReportKPICard } from './shared/ReportKPICard';
import { CreditCard, Users, AlertCircle, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CreditRow {
  customerId: string; customerName: string; invoiceCount: number;
  totalAmount: number; totalPaid: number; pending: number; outstanding: number; oldestInvoice: string | null;
}

export const CreditReport: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [rows, setRows] = useState<CreditRow[]>([]);

  useEffect(() => {
    async function load() {
      const { from, to } = getReportDateRange(period, customFrom, customTo);

      // Supabase caps a single request at 1000 rows — page every query that
      // could exceed that so nothing is silently truncated.
      const PAGE_SIZE = 1000;

      // Credit customers. outstanding_balance is the authoritative figure
      // (it already accounts for account-level payments, settlements, manual
      // adjustments and cleared cheques); no invoice math can reproduce it.
      const customers: any[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data: page, error } = await supabase
          .from('customers')
          .select('id, name, outstanding_balance')
          .eq('is_active', true)
          .gt('outstanding_balance', 0)
          .order('outstanding_balance', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);
        if (error) { console.error('Credit report customer fetch failed:', error); break; }
        customers.push(...(page ?? []));
        if (!page || page.length < PAGE_SIZE) break;
      }

      const creditCustomerIds = customers.map(c => c.id);

      // Every invoice for those customers — not just the still-open ones.
      // Each row must reconcile as Total Billed − Paid = Outstanding, and
      // Paid is derived from Outstanding, so Total Billed has to be the full
      // billed figure. Payments are deliberately NOT summed here: account
      // payments / settlements / adjustments carry no invoice_id and
      // uncleared cheques would over-count, so any payments-based sum drifts
      // away from the real balance.
      const invMap: Record<string, { invoiceCount: number; totalAmount: number; oldestOpen: string | null }> = {};
      for (let start = 0; start < creditCustomerIds.length; start += 200) {
        const idChunk = creditCustomerIds.slice(start, start + 200);
        for (let offset = 0; ; offset += PAGE_SIZE) {
          let q = supabase
            .from('invoices')
            .select('id, total, created_at, customer_id, payment_status')
            .in('customer_id', idChunk)
            .order('id', { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);
          if (from) q = q.gte('created_at', from);
          if (to)   q = q.lte('created_at', to);
          const { data: page, error } = await q;
          if (error) { console.error('Credit report invoice fetch failed:', error); break; }
          for (const inv of (page ?? []) as any[]) {
            const cid = inv.customer_id ?? 'unknown';
            if (!invMap[cid]) invMap[cid] = { invoiceCount: 0, totalAmount: 0, oldestOpen: null };
            invMap[cid].invoiceCount++;
            invMap[cid].totalAmount += Number(inv.total);
            if ((inv.payment_status === 'unpaid' || inv.payment_status === 'partial') &&
                (!invMap[cid].oldestOpen || inv.created_at < invMap[cid].oldestOpen!)) {
              invMap[cid].oldestOpen = inv.created_at;
            }
          }
          if (!page || page.length < PAGE_SIZE) break;
        }
      }

      // Uncleared cheques — money the customer has handed over that has NOT
      // yet been deducted from outstanding_balance. cheque_status 'pending' =
      // received, awaiting deposit; 'processing' = deposited, sitting in bank
      // float. When a cheque clears it flips to 'completed', update_cheque_status
      // drops outstanding_balance, and it rolls into the derived Paid figure
      // automatically. This is a current-state number like Outstanding, so it
      // is deliberately NOT date-filtered.
      const pendingMap: Record<string, number> = {};
      for (let start = 0; start < creditCustomerIds.length; start += 200) {
        const idChunk = creditCustomerIds.slice(start, start + 200);
        for (let offset = 0; ; offset += PAGE_SIZE) {
          const { data: page, error } = await supabase
            .from('payments')
            .select('customer_id, amount, cheque_status')
            .eq('method', 'cheque')
            .in('cheque_status', ['pending', 'processing'])
            .in('customer_id', idChunk)
            .order('id', { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);
          if (error) { console.error('Credit report pending-cheque fetch failed:', error); break; }
          for (const p of (page ?? []) as any[]) {
            const cid = p.customer_id ?? 'unknown';
            pendingMap[cid] = (pendingMap[cid] ?? 0) + Math.abs(Number(p.amount) || 0);
          }
          if (!page || page.length < PAGE_SIZE) break;
        }
      }

      const newRows: CreditRow[] = customers.map(c => {
        const stats = invMap[c.id];
        const outstanding = Number(c.outstanding_balance) || 0;
        const totalAmount = stats?.totalAmount ?? 0;
        return {
          customerId: c.id,
          customerName: c.name ?? 'Walk-in',
          invoiceCount: stats?.invoiceCount ?? 0,
          totalAmount,
          // Derived from the authoritative balance so the row always ties out
          // as Total Billed − Paid = Outstanding.
          totalPaid: Math.max(0, totalAmount - outstanding),
          // Uncleared cheques still sitting inside Outstanding — informational,
          // not part of the reconciliation above.
          pending: pendingMap[c.id] ?? 0,
          outstanding,
          oldestInvoice: stats?.oldestOpen ?? null,
        };
      });
      setRows(newRows.sort((a, b) => b.outstanding - a.outstanding));
    }
    load();
  }, [period, customFrom, customTo]);

  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);
  const totalPending     = rows.reduce((s, r) => s + r.pending, 0);
  const totalCustomers   = rows.length;

  const exportHeaders = ['Customer', 'Invoices', 'Total Billed', 'Paid', 'Pending', 'Outstanding', 'Oldest Invoice'];
  const exportRows = rows.map(r => [r.customerName, r.invoiceCount, fmtCurrency(r.totalAmount), fmtCurrency(r.totalPaid), fmtCurrency(r.pending), fmtCurrency(r.outstanding), r.oldestInvoice ? fmtDate(r.oldestInvoice) : '-']);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Credit Report</h2>
        <div className="flex items-center gap-3">
          <DateRangePicker value={period} onChange={setPeriod} customFrom={customFrom} customTo={customTo} onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }} />
          <ExportBar filename="Credit_Report" headers={exportHeaders} rows={exportRows} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <ReportKPICard label="Total Outstanding" value={totalOutstanding} prefix="LKR " icon={CreditCard} color="bg-red-600" />
        <ReportKPICard label="Pending (Uncleared Cheques)" value={totalPending} prefix="LKR " icon={Clock} color="bg-sky-600" />
        <ReportKPICard label="Customers with Credit" value={totalCustomers} icon={Users} color="bg-amber-600" />
      </div>

      <ReportTable
        columns={[
          { header: 'Customer',      accessor: (r: CreditRow) => <span className="font-semibold text-white">{r.customerName}</span> },
          { header: 'Invoices',      accessor: (r: CreditRow) => r.invoiceCount, className: 'text-center' },
          { header: 'Total Billed',  accessor: (r: CreditRow) => fmtCurrency(r.totalAmount), className: 'text-right font-mono' },
          { header: 'Paid',          accessor: (r: CreditRow) => fmtCurrency(r.totalPaid), className: 'text-right font-mono text-green-400' },
          { header: 'Pending',       accessor: (r: CreditRow) => (
            <span className={cn('font-mono', r.pending > 0 ? 'text-sky-400' : 'text-gray-500')}>
              {fmtCurrency(r.pending)}
            </span>
          ), className: 'text-right' },
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
