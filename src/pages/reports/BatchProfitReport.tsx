import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { fmtCurrency, fmtDate } from '../../utils/reportUtils';
import { ReportTable } from './shared/ReportTable';
import { ExportBar } from './shared/ExportBar';
import { Ship } from 'lucide-react';
import { ReportKPICard } from './shared/ReportKPICard';

export const BatchProfitReport: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      
      // Get shipments joined with batches and invoice items
      const { data: shipments } = await supabase
        .from('shipments')
        .select(`
          id, reference, supplier, arrived_at,
          stock_batches(product_id, cartons, loose_pieces, cost_per_piece, products(pieces_per_carton))
        `);

      const { data: items } = await supabase
        .from('invoice_items')
        .select('product_id, total, cartons, pieces, products(pieces_per_carton)');

      // This is a complex calculation since invoice items aren't directly linked to batches
      // We'll approximate profit per shipment by aggregating costs and comparing to total product revenue
      // (For a real system, FIFO/LIFO tracking would be used)

      const result = (shipments || []).map(ship => {
        let totalCost = 0;
        const productsInShipment = new Set();
        
        (ship.stock_batches as any[] || []).forEach(batch => {
          const ppc = batch.products?.pieces_per_carton || 1;
          const pieces = batch.cartons * ppc + batch.loose_pieces;
          totalCost += pieces * (batch.cost_per_piece || 0);
          productsInShipment.add(batch.product_id);
        });

        // Approximate revenue for these products (simplified)
        const relevantRevenue = (items || [])
          .filter(i => productsInShipment.has(i.product_id))
          .reduce((sum, i) => sum + Number(i.total), 0);

        return {
          id: ship.id,
          reference: ship.reference || 'N/A',
          supplier: ship.supplier,
          arrived_at: ship.arrived_at,
          totalCost,
          approxRevenue: relevantRevenue,
          profit: relevantRevenue - totalCost
        };
      });

      setData(result.sort((a, b) => new Date(b.arrived_at).getTime() - new Date(a.arrived_at).getTime()));
      setLoading(false);
    }
    load();
  }, []);

  const headers = ['Ref', 'Supplier', 'Date', 'Total Cost', 'Approx. Sales', 'Profit'];
  const rows = data.map(r => [
    r.reference, r.supplier, fmtDate(r.arrived_at), 
    fmtCurrency(r.totalCost), fmtCurrency(r.approxRevenue), fmtCurrency(r.profit)
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Batch / Shipment Profit Report</h2>
        <ExportBar filename="Batch_Profit_Report" headers={headers} rows={rows} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReportKPICard label="Total Shipments" value={data.length} icon={Ship} color="bg-indigo-600" />
      </div>

      <ReportTable
        columns={[
          { header: 'Reference', accessor: 'reference' },
          { header: 'Supplier', accessor: 'supplier' },
          { header: 'Date', accessor: (r) => fmtDate(r.arrived_at) },
          { header: 'Cost', accessor: (r) => fmtCurrency(r.totalCost), className: 'text-right' },
          { header: 'Sales (Approx)', accessor: (r) => fmtCurrency(r.approxRevenue), className: 'text-right' },
          { header: 'Profit', accessor: (r) => (
            <span className={r.profit >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
              {fmtCurrency(r.profit)}
            </span>
          ), className: 'text-right' }
        ]}
        data={data}
      />
    </div>
  );
};
