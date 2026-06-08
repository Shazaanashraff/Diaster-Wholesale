import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { type ReportPeriod, getReportDateRange, fmtDate } from '../../utils/reportUtils';
import { ReportTable } from './shared/ReportTable';
import { DateRangePicker } from './shared/DateRangePicker';
import { ExportBar } from './shared/ExportBar';
import { ReportKPICard } from './shared/ReportKPICard';
import { PackageX, Clock } from 'lucide-react';

interface DeadRow {
  productId: string; productName: string; itemCode: string;
  piecesInStock: number; oldestBatch: string; ageDays: number;
}

export const DeadStockReport: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [rows, setRows] = useState<DeadRow[]>([]);

  useEffect(() => {
    async function load() {
      const { from, to } = getReportDateRange(period, customFrom, customTo);

      // Get all products currently in shop stock
      const { data: batches } = await supabase
        .from('stock_batches')
        .select('product_id, cartons, loose_pieces, received_at, products(name, item_code, pieces_per_carton), locations(type)')
        .eq('locations.type', 'shop');

      // Get product_ids that had sales in the period
      let soldQ = supabase.from('invoice_items').select('product_id');
      if (from) soldQ = soldQ.gte('created_at', from);
      if (to)   soldQ = soldQ.lte('created_at', to);
      const { data: soldItems } = await soldQ;
      const soldIds = new Set((soldItems ?? []).map((s: any) => s.product_id));

      const now = Date.now();
      const map: Record<string, DeadRow> = {};

      for (const b of (batches ?? []) as any[]) {
        if (b.locations?.type !== 'shop') continue;
        const pid = b.product_id;
        if (soldIds.has(pid)) continue; // had sales → not dead
        const ppc = b.products?.pieces_per_carton || 1;
        const pcs = b.cartons * ppc + b.loose_pieces;
        if (pcs <= 0) continue;
        const ageDays = Math.floor((now - new Date(b.received_at).getTime()) / 86_400_000);
        if (!map[pid]) map[pid] = { productId: pid, productName: b.products?.name ?? '—', itemCode: b.products?.item_code ?? '—', piecesInStock: 0, oldestBatch: b.received_at, ageDays };
        map[pid].piecesInStock += pcs;
        if (b.received_at < map[pid].oldestBatch) { map[pid].oldestBatch = b.received_at; map[pid].ageDays = ageDays; }
      }

      setRows(Object.values(map).sort((a, b) => b.ageDays - a.ageDays));
    }
    load();
  }, [period, customFrom, customTo]);

  const totalPieces = rows.reduce((s, r) => s + r.piecesInStock, 0);

  const exportHeaders = ['Product', 'Code', 'Pieces in Stock', 'Oldest Batch', 'Days Idle'];
  const exportRows = rows.map(r => [r.productName, r.itemCode, r.piecesInStock, fmtDate(r.oldestBatch), r.ageDays]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Dead Stock</h2>
        <div className="flex items-center gap-3">
          <DateRangePicker value={period} onChange={setPeriod} customFrom={customFrom} customTo={customTo} onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }} />
          <ExportBar filename="Dead_Stock" headers={exportHeaders} rows={exportRows} />
        </div>
      </div>
      <p className="text-xs text-gray-500">Products currently in shop stock with zero sales in the selected period.</p>

      <div className="grid grid-cols-2 gap-4">
        <ReportKPICard label="Dead Stock Products" value={rows.length}     icon={PackageX} color="bg-gray-600" />
        <ReportKPICard label="Total Idle Pieces"   value={totalPieces}     icon={Clock}    color="bg-amber-600" />
      </div>

      <ReportTable
        columns={[
          { header: 'Product',          accessor: (r: DeadRow) => <span className="font-semibold text-white">{r.productName}</span> },
          { header: 'Code',             accessor: (r: DeadRow) => <span className="font-mono text-gray-500 text-xs">{r.itemCode}</span> },
          { header: 'Pieces in Stock',  accessor: (r: DeadRow) => <span className="font-mono text-amber-400 font-bold">{r.piecesInStock}</span>, className: 'text-center' },
          { header: 'Oldest Batch',     accessor: (r: DeadRow) => fmtDate(r.oldestBatch), className: 'text-gray-400' },
          { header: 'Days Idle',        accessor: (r: DeadRow) => <span className="font-bold font-mono text-red-400">{r.ageDays}d</span>, className: 'text-center' },
        ]}
        data={rows}
        emptyMessage="No dead stock found — all products had sales in this period."
      />
    </div>
  );
};
