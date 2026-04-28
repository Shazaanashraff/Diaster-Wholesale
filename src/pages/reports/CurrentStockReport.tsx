import React, { useState, useEffect } from 'react';
import { getCurrentStockReport } from '../../services/reportService';
import { ReportTable } from './shared/ReportTable';
import { ExportBar } from './shared/ExportBar';
import { Package, Activity } from 'lucide-react';
import { ReportKPICard } from './shared/ReportKPICard';

export const CurrentStockReport: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await getCurrentStockReport();
      setData(res);
      setLoading(false);
    }
    load();
  }, []);

  const headers = ['Product', 'Code', 'Category', 'Cartons In', 'Pieces In', 'Cartons Sold', 'Pieces Sold', 'Available Pieces'];
  const rows = data.map(r => {
    const totalIn = r.cartons_in * r.pieces_per_carton + r.pieces_in;
    const totalSold = r.cartons_sold * r.pieces_per_carton + r.pieces_sold;
    const adj = r.piece_adj;
    const available = totalIn - totalSold + adj;
    return [r.name, r.item_code, r.category, r.cartons_in, r.pieces_in, r.cartons_sold, r.pieces_sold, available];
  });

  const totalAvailable = rows.reduce((sum, r) => sum + (r[7] as number), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Current Stock Report</h2>
        <ExportBar filename="Current_Stock_Report" headers={headers} rows={rows} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ReportKPICard label="Total Products" value={data.length} icon={Package} color="bg-blue-600" />
        <ReportKPICard label="Total Available Pieces" value={totalAvailable} icon={Activity} color="bg-indigo-600" />
      </div>

      <ReportTable
        columns={[
          { header: 'Product', accessor: 'name' },
          { header: 'Code', accessor: 'item_code' },
          { header: 'Category', accessor: 'category' },
          { header: 'Available', accessor: (r) => {
            const available = (r.cartons_in * r.pieces_per_carton + r.pieces_in) - (r.cartons_sold * r.pieces_per_carton + r.pieces_sold) + r.piece_adj;
            const cartons = Math.floor(available / r.pieces_per_carton);
            const pieces = available % r.pieces_per_carton;
            return <span className="font-bold text-white">{cartons} Ctn, {pieces} Pcs</span>;
          }, className: 'text-right' }
        ]}
        data={data}
      />
    </div>
  );
};


