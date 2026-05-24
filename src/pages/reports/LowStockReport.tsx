import React, { useState, useEffect } from 'react';
import { getLowStockReport } from '../../services/reportService';
import { ReportTable } from './shared/ReportTable';
import { ExportBar } from './shared/ExportBar';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { ReportKPICard } from './shared/ReportKPICard';

export const LowStockReport: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const res = await getLowStockReport(10); // Default threshold 10
    setData(res);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const headers = ['Product', 'Code', 'Category', 'Available Pieces', 'Threshold'];
  const rows = data.map(r => {
    const totalIn = r.cartons_in * r.pieces_per_carton + r.pieces_in;
    const totalSold = r.cartons_sold * r.pieces_per_carton + r.pieces_sold;
    const available = totalIn - totalSold + r.piece_adj;
    return [r.name, r.item_code, r.category, available, 10];
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-900/20 text-red-400">
            <AlertTriangle size={20} />
          </div>
          <h2 className="text-xl font-bold text-white">Low Stock Report</h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-500 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
          <ExportBar filename="Low_Stock_Report" headers={headers} rows={rows} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReportKPICard label="Alerting Products" value={data.length} icon={AlertTriangle} color="bg-red-600" />
        <div className="p-5 rounded-2xl border border-[#2b313a] bg-[#171c23] flex items-center justify-between">
           <p className="text-sm text-gray-400">Stock Threshold:</p>
           <p className="text-lg font-bold text-white">10 Pieces</p>
        </div>
      </div>

      <ReportTable
        columns={[
          { header: 'Product', accessor: 'name' },
          { header: 'Code', accessor: 'item_code' },
          { header: 'Category', accessor: 'category' },
          { header: 'Current Stock', accessor: (r) => {
            const available = (r.cartons_in * r.pieces_per_carton + r.pieces_in) - (r.cartons_sold * r.pieces_per_carton + r.pieces_sold) + r.piece_adj;
            return <span className="text-red-400 font-bold">{available} Pieces</span>;
          }, className: 'text-right' }
        ]}
        data={data}
        emptyMessage="No products are currently below the stock threshold."
      />
    </div>
  );
};
