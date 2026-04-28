import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { fmtCurrency } from '../../utils/reportUtils';
import { ReportTable } from './shared/ReportTable';
import { ExportBar } from './shared/ExportBar';
import { BarChart3 } from 'lucide-react';
import { ReportKPICard } from './shared/ReportKPICard';

export const StockValuationReport: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      
      const { data: stocks } = await supabase.from('product_stock').select('*');
      const { data: batches } = await supabase.from('stock_batches').select('product_id, cost_per_piece');

      const costMap: Record<string, number> = {};
      (batches || []).forEach(b => { if (b.cost_per_piece) costMap[b.product_id] = Number(b.cost_per_piece); });

      const result = (stocks || []).map(s => {
        const available = (s.cartons_in * s.pieces_per_carton + s.pieces_in) - (s.cartons_sold * s.pieces_per_carton + s.pieces_sold) + s.piece_adj;
        const unitCost = costMap[s.product_id] || 0;
        const valuation = available * unitCost;

        return {
          ...s,
          available,
          unitCost,
          valuation
        };
      }).filter(r => r.available > 0);

      setData(result.sort((a, b) => b.valuation - a.valuation));
      setLoading(false);
    }
    load();
  }, []);

  const totalValuation = data.reduce((sum, r) => sum + r.valuation, 0);
  const headers = ['Product', 'Qty', 'Unit Cost', 'Total Value'];
  const rows = data.map(r => [r.name, r.available, fmtCurrency(r.unitCost), fmtCurrency(r.valuation)]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Stock Valuation Report</h2>
        <ExportBar filename="Stock_Valuation" headers={headers} rows={rows} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReportKPICard label="Total Stock Value" value={totalValuation} prefix="LKR " icon={BarChart3} color="bg-emerald-600" />
      </div>

      <ReportTable
        columns={[
          { header: 'Product', accessor: 'name' },
          { header: 'Available Qty', accessor: (r) => `${r.available} Pieces`, className: 'text-center' },
          { header: 'Unit Cost', accessor: (r) => fmtCurrency(r.unitCost), className: 'text-right' },
          { header: 'Total Value', accessor: (r) => fmtCurrency(r.valuation), className: 'text-right font-mono text-emerald-400' }
        ]}
        data={data}
        emptyMessage="No stock available for valuation."
      />
    </div>
  );
};
