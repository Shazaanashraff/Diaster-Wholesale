import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { fmtCurrency, fmtDate } from '../../utils/reportUtils';
import { ReportTable } from './shared/ReportTable';
import { ExportBar } from './shared/ExportBar';
import { ReportKPICard } from './shared/ReportKPICard';
import { Building2, DollarSign } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PayableRow {
  supplierId: string; supplierName: string; purchaseCount: number;
  totalBilled: number; totalPaid: number; outstanding: number; lastPurchase: string;
}

export const PayablesReport: React.FC = () => {
  const [rows, setRows] = useState<PayableRow[]>([]);

  useEffect(() => {
    async function load() {
      const [purchasesRes, paymentsRes] = await Promise.all([
        supabase
          .from('purchases')
          .select('id, supplier_id, total_lkr, created_at, suppliers(name)')
          .in('status', ['received', 'completed']),
        supabase
          .from('supplier_payments')
          .select('supplier_id, amount'),
      ]);

      const paidBySupplier: Record<string, number> = {};
      for (const p of (paymentsRes.data ?? []) as any[]) {
        paidBySupplier[p.supplier_id] = (paidBySupplier[p.supplier_id] ?? 0) + Number(p.amount);
      }

      const map: Record<string, PayableRow> = {};
      for (const po of (purchasesRes.data ?? []) as any[]) {
        const sid = po.supplier_id ?? 'unknown';
        const name = po.suppliers?.name ?? 'Unknown Supplier';
        if (!map[sid]) map[sid] = { supplierId: sid, supplierName: name, purchaseCount: 0, totalBilled: 0, totalPaid: 0, outstanding: 0, lastPurchase: po.created_at };
        map[sid].purchaseCount++;
        map[sid].totalBilled += Number(po.total_lkr);
        if (po.created_at > map[sid].lastPurchase) map[sid].lastPurchase = po.created_at;
      }
      for (const row of Object.values(map)) {
        row.totalPaid    = paidBySupplier[row.supplierId] ?? 0;
        row.outstanding  = Math.max(0, row.totalBilled - row.totalPaid);
      }
      setRows(Object.values(map).sort((a, b) => b.outstanding - a.outstanding));
    }
    load();
  }, []);

  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);
  const totalBilled      = rows.reduce((s, r) => s + r.totalBilled, 0);

  const exportHeaders = ['Supplier', 'POs', 'Total Billed (LKR)', 'Paid (LKR)', 'Outstanding (LKR)', 'Last Purchase'];
  const exportRows = rows.map(r => [r.supplierName, r.purchaseCount, fmtCurrency(r.totalBilled), fmtCurrency(r.totalPaid), fmtCurrency(r.outstanding), fmtDate(r.lastPurchase)]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Payables</h2>
        <ExportBar filename="Payables_Report" headers={exportHeaders} rows={exportRows} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ReportKPICard label="Total Outstanding" value={totalOutstanding} prefix="LKR " icon={DollarSign} color="bg-red-600" />
        <ReportKPICard label="Total Billed" value={totalBilled} prefix="LKR " icon={Building2} color="bg-gray-600" />
      </div>

      <ReportTable
        columns={[
          { header: 'Supplier',       accessor: (r: PayableRow) => <span className="font-semibold text-white">{r.supplierName}</span> },
          { header: 'POs',            accessor: (r: PayableRow) => r.purchaseCount, className: 'text-center' },
          { header: 'Total Billed',   accessor: (r: PayableRow) => fmtCurrency(r.totalBilled), className: 'text-right font-mono' },
          { header: 'Paid',           accessor: (r: PayableRow) => fmtCurrency(r.totalPaid), className: 'text-right font-mono text-green-400' },
          { header: 'Outstanding',    accessor: (r: PayableRow) => (
            <span className={cn('font-bold font-mono', r.outstanding > 0 ? 'text-red-400' : 'text-green-400')}>
              {fmtCurrency(r.outstanding)}
            </span>
          ), className: 'text-right' },
          { header: 'Last Purchase',  accessor: (r: PayableRow) => fmtDate(r.lastPurchase), className: 'text-gray-400' },
        ]}
        data={rows}
        emptyMessage="No outstanding payables found."
      />
    </div>
  );
};
