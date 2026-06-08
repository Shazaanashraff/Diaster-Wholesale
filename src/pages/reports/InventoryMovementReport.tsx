import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { type ReportPeriod, getReportDateRange } from '../../utils/reportUtils';
import { ReportTable } from './shared/ReportTable';
import { DateRangePicker } from './shared/DateRangePicker';
import { ExportBar } from './shared/ExportBar';
import { ReportKPICard } from './shared/ReportKPICard';
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MovementRow {
  productId: string; productName: string; itemCode: string;
  received: number; sold: number; net: number;
}

export const InventoryMovementReport: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { from, to } = getReportDateRange(period, customFrom, customTo);

      const [receivedRes, soldRes] = await Promise.all([
        (() => {
          let q = supabase
            .from('stock_batches')
            .select('product_id, cartons, loose_pieces, products(name, item_code, pieces_per_carton)');
          if (from) q = q.gte('received_at', from);
          if (to)   q = q.lte('received_at', to);
          return q;
        })(),
        (() => {
          let q = supabase
            .from('invoice_items')
            .select('product_id, cartons, pieces, products(name, item_code, pieces_per_carton)');
          if (from) q = q.gte('created_at', from);
          if (to)   q = q.lte('created_at', to);
          return q;
        })(),
      ]);

      const map: Record<string, MovementRow> = {};

      for (const b of (receivedRes.data ?? []) as any[]) {
        const pid  = b.product_id;
        const ppc  = b.products?.pieces_per_carton || 1;
        const pcs  = b.cartons * ppc + b.loose_pieces;
        if (!map[pid]) map[pid] = { productId: pid, productName: b.products?.name ?? '—', itemCode: b.products?.item_code ?? '—', received: 0, sold: 0, net: 0 };
        map[pid].received += pcs;
      }

      for (const s of (soldRes.data ?? []) as any[]) {
        const pid  = s.product_id;
        const ppc  = s.products?.pieces_per_carton || 1;
        const pcs  = s.cartons * ppc + s.pieces;
        if (!map[pid]) map[pid] = { productId: pid, productName: s.products?.name ?? '—', itemCode: s.products?.item_code ?? '—', received: 0, sold: 0, net: 0 };
        map[pid].sold += pcs;
      }

      for (const r of Object.values(map)) r.net = r.received - r.sold;
      setRows(Object.values(map).sort((a, b) => b.sold - a.sold));
      setLoading(false);
    }
    load();
  }, [period, customFrom, customTo]);

  const totalReceived = rows.reduce((s, r) => s + r.received, 0);
  const totalSold     = rows.reduce((s, r) => s + r.sold, 0);

  const exportHeaders = ['Product', 'Code', 'Received (pcs)', 'Sold (pcs)', 'Net'];
  const exportRows = rows.map(r => [r.productName, r.itemCode, r.received, r.sold, r.net]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Inventory Movement</h2>
        <div className="flex items-center gap-3">
          <DateRangePicker value={period} onChange={setPeriod} customFrom={customFrom} customTo={customTo} onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }} />
          <ExportBar filename="Inventory_Movement" headers={exportHeaders} rows={exportRows} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ReportKPICard label="Total Received (pcs)" value={totalReceived} icon={ArrowDownCircle} color="bg-green-600" />
        <ReportKPICard label="Total Sold (pcs)"     value={totalSold}     icon={ArrowUpCircle}  color="bg-blue-600" />
      </div>

      <ReportTable
        columns={[
          { header: 'Product',         accessor: (r: MovementRow) => <span className="font-semibold text-white">{r.productName}</span> },
          { header: 'Code',            accessor: (r: MovementRow) => <span className="font-mono text-gray-500 text-xs">{r.itemCode}</span> },
          { header: 'Received (pcs)',  accessor: (r: MovementRow) => <span className="font-mono text-green-400">{r.received > 0 ? r.received : '—'}</span>, className: 'text-right' },
          { header: 'Sold (pcs)',      accessor: (r: MovementRow) => <span className="font-mono text-blue-400">{r.sold > 0 ? r.sold : '—'}</span>, className: 'text-right' },
          { header: 'Net',             accessor: (r: MovementRow) => (
            <span className={cn('font-bold font-mono', r.net > 0 ? 'text-green-400' : r.net < 0 ? 'text-red-400' : 'text-gray-500')}>
              {r.net > 0 ? `+${r.net}` : r.net}
            </span>
          ), className: 'text-right' },
        ]}
        data={rows}
        emptyMessage="No inventory movement found for this period."
      />
    </div>
  );
};
