import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { fmtDate } from '../../utils/reportUtils';
import { ReportTable } from './shared/ReportTable';
import { ExportBar } from './shared/ExportBar';
import { ReportKPICard } from './shared/ReportKPICard';
import { Package, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AgingBatch {
  productId: string; productName: string; itemCode: string;
  totalPieces: number; piecesPerCarton: number;
  oldestBatchDate: string; ageDays: number; bucket: string;
}

const BUCKETS = [
  { label: '0–30 days',  key: '0_30',   color: 'text-green-400' },
  { label: '31–60 days', key: '31_60',  color: 'text-yellow-400' },
  { label: '61–90 days', key: '61_90',  color: 'text-amber-400' },
  { label: '90+ days',   key: '90plus', color: 'text-red-400' },
];

function ageBucket(days: number): string {
  if (days <= 30) return '0_30';
  if (days <= 60) return '31_60';
  if (days <= 90) return '61_90';
  return '90plus';
}

export const StockAgingReport: React.FC = () => {
  const [rows, setRows] = useState<AgingBatch[]>([]);
  const [bucketFilter, setBucketFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('stock_batches')
        .select('product_id, cartons, loose_pieces, received_at, products(name, item_code, pieces_per_carton), locations(type)')
        .eq('locations.type', 'shop');

      const now = Date.now();
      const map: Record<string, AgingBatch> = {};

      for (const b of (data ?? []) as any[]) {
        if (b.locations?.type !== 'shop') continue;
        const pid = b.product_id;
        const ppc = b.products?.pieces_per_carton || 1;
        const pieces = b.cartons * ppc + b.loose_pieces;
        if (pieces <= 0) continue;

        const ageDays = Math.floor((now - new Date(b.received_at).getTime()) / 86_400_000);
        if (!map[pid]) {
          map[pid] = {
            productId: pid,
            productName: b.products?.name ?? '—',
            itemCode: b.products?.item_code ?? '—',
            totalPieces: 0,
            piecesPerCarton: ppc,
            oldestBatchDate: b.received_at,
            ageDays,
            bucket: ageBucket(ageDays),
          };
        }
        map[pid].totalPieces += pieces;
        if (b.received_at < map[pid].oldestBatchDate) {
          map[pid].oldestBatchDate = b.received_at;
          map[pid].ageDays = ageDays;
          map[pid].bucket  = ageBucket(ageDays);
        }
      }
      setRows(Object.values(map).sort((a, b) => b.ageDays - a.ageDays));
      setLoading(false);
    }
    load();
  }, []);

  const filtered = bucketFilter === 'all' ? rows : rows.filter(r => r.bucket === bucketFilter);
  const stale90  = rows.filter(r => r.bucket === '90plus').length;

  const exportHeaders = ['Product', 'Code', 'Pieces in Stock', 'Oldest Batch', 'Age (days)', 'Bucket'];
  const exportRows = filtered.map(r => [r.productName, r.itemCode, r.totalPieces, fmtDate(r.oldestBatchDate), r.ageDays, r.bucket.replace('_', '-')]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Stock Aging</h2>
        <ExportBar filename="Stock_Aging" headers={exportHeaders} rows={exportRows} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ReportKPICard label="Products in Shop" value={rows.length} icon={Package} color="bg-blue-600" />
        <ReportKPICard label="Stale (90+ days)" value={stale90} icon={Clock} color="bg-red-600" />
      </div>

      {/* Bucket filter */}
      <div className="flex items-center gap-2">
        {[{ key: 'all', label: 'All', color: 'text-gray-300' }, ...BUCKETS].map(b => (
          <button
            key={b.key}
            onClick={() => setBucketFilter(b.key)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border',
              bucketFilter === b.key
                ? 'bg-[#2b313a] border-[#3b414a] text-white'
                : 'bg-transparent border-[#2b313a] text-gray-500 hover:text-gray-300'
            )}
          >
            {b.label}
          </button>
        ))}
      </div>

      <ReportTable
        columns={[
          { header: 'Product',        accessor: (r: AgingBatch) => <span className="font-semibold text-white">{r.productName}</span> },
          { header: 'Code',           accessor: (r: AgingBatch) => <span className="font-mono text-gray-500">{r.itemCode}</span> },
          { header: 'Pieces in Stock', accessor: (r: AgingBatch) => r.totalPieces, className: 'text-center font-mono' },
          { header: 'Oldest Batch',   accessor: (r: AgingBatch) => fmtDate(r.oldestBatchDate), className: 'text-gray-400' },
          { header: 'Age',            accessor: (r: AgingBatch) => {
            const b = BUCKETS.find(x => x.key === r.bucket);
            return <span className={cn('font-bold font-mono', b?.color ?? 'text-gray-400')}>{r.ageDays}d</span>;
          }, className: 'text-center' },
          { header: 'Bucket',         accessor: (r: AgingBatch) => {
            const b = BUCKETS.find(x => x.key === r.bucket);
            return <span className={cn('text-xs font-bold', b?.color ?? 'text-gray-400')}>{b?.label ?? r.bucket}</span>;
          }},
        ]}
        data={filtered}
        emptyMessage="No shop stock found."
      />
    </div>
  );
};
