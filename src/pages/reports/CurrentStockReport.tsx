import React, { useState, useEffect } from 'react';
import { getCurrentStockReport } from '../../services/reportService';
import { ReportTable } from './shared/ReportTable';
import { ExportBar } from './shared/ExportBar';
import { Package, Activity } from 'lucide-react';
import { ReportKPICard } from './shared/ReportKPICard';

export const CurrentStockReport: React.FC = () => {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const res = await getCurrentStockReport();
      setData(res);
    }
    load();
  }, []);

  const rows = data.map(r => {
    const ppc = r.pieces_per_carton || 1;
    const totalIn = r.cartons_in * ppc + r.pieces_in;
    const totalSold = r.cartons_sold * ppc + r.pieces_sold;
    const adj = (r.carton_adj ?? 0) * ppc + (r.piece_adj ?? 0);
    const availPieces = Math.max(0, totalIn - totalSold + adj);
    const availCartons = Math.floor(availPieces / ppc);
    const totalUnits = availPieces;
    return [r.name, r.item_code ?? '—', ppc, availCartons, totalUnits];
  });

  const totalAvailable = rows.reduce((sum, r) => sum + (r[4] as number), 0);
  const headers = ['Product', 'Code', 'Qty per Carton', 'No. of Cartons', 'Total Qty (Units)'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Current Stock Report</h2>
        <ExportBar filename="Current_Stock_Report" headers={headers} rows={rows} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ReportKPICard label="Total Products" value={data.length} icon={Package} color="bg-blue-600" />
        <ReportKPICard label="Total Available Units" value={totalAvailable} icon={Activity} color="bg-indigo-600" />
      </div>

      <ReportTable
        columns={[
          { header: 'Product', accessor: 'name' },
          { header: 'Code', accessor: (r) => r.item_code ?? '—' },
          { header: 'Qty / Carton', accessor: (r) => r.pieces_per_carton || 1, className: 'text-center' },
          { header: 'No. of Cartons', accessor: (r) => {
            const ppc = r.pieces_per_carton || 1;
            const totalIn = r.cartons_in * ppc + r.pieces_in;
            const totalSold = r.cartons_sold * ppc + r.pieces_sold;
            const adj = (r.carton_adj ?? 0) * ppc + (r.piece_adj ?? 0);
            const avail = Math.max(0, totalIn - totalSold + adj);
            return <span className="font-bold text-white">{Math.floor(avail / ppc)}</span>;
          }, className: 'text-center' },
          { header: 'Total Qty (Units)', accessor: (r) => {
            const ppc = r.pieces_per_carton || 1;
            const totalIn = r.cartons_in * ppc + r.pieces_in;
            const totalSold = r.cartons_sold * ppc + r.pieces_sold;
            const adj = (r.carton_adj ?? 0) * ppc + (r.piece_adj ?? 0);
            const avail = Math.max(0, totalIn - totalSold + adj);
            return <span className="font-bold text-white">{avail}</span>;
          }, className: 'text-right' },
        ]}
        data={data}
      />
    </div>
  );
};


