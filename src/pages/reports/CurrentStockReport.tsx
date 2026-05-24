import React, { useState, useEffect } from 'react';
import { getCurrentStockReportByLocation } from '../../services/reportService';
import { ReportTable } from './shared/ReportTable';
import { ExportBar } from './shared/ExportBar';
import { Package, Activity, Warehouse, ShoppingCart } from 'lucide-react';
import { ReportKPICard } from './shared/ReportKPICard';

interface LocationStockData {
  location_id: string | null;
  location_name: string;
  location_type: string | null;
  products: Array<{
    product_id: string;
    name: string;
    item_code: string | null;
    pieces_per_carton: number;
    total_units: number;
  }>;
}

export const CurrentStockReport: React.FC = () => {
  const [locationData, setLocationData] = useState<LocationStockData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await getCurrentStockReportByLocation();
        setLocationData(res);
      } catch (err) {
        console.error('Failed to load stock report:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Calculate totals across all locations
  const totalProducts = locationData.reduce((sum, loc) => sum + loc.products.length, 0);
  const totalUnits = locationData.reduce((sum, loc) => sum + loc.products.reduce((pSum, p) => pSum + (p.total_units || 0), 0), 0);

  // Calculate per-location totals
  const getLocationStats = (location: LocationStockData) => {
    const products = location.products.length;
    const units = location.products.reduce((sum, p) => sum + (p.total_units || 0), 0);
    return { products, units };
  };

  if (loading) {
    return <div className="text-white">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Current Stock Report</h2>
      </div>

      {/* Overall Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReportKPICard label="Total Products" value={totalProducts} icon={Package} color="bg-blue-600" />
        <ReportKPICard label="Total Available Units" value={totalUnits} icon={Activity} color="bg-indigo-600" />
      </div>

      {/* Location-wise breakdown */}
      {locationData.map((location) => {
        const stats = getLocationStats(location);
        const headers = ['Product', 'Code', 'Qty per Carton', 'Total Qty (Units)'];
        const rows = location.products.map(p => [
          p.name,
          p.item_code ?? '—',
          p.pieces_per_carton || 1,
          p.total_units
        ]);

        const locationIcon = location.location_type === 'warehouse' ? Warehouse : ShoppingCart;
        const locationColor = location.location_type === 'warehouse' ? 'bg-amber-600' : 'bg-green-600';

        return (
          <div key={location.location_id || 'unassigned'} className="space-y-4">
            <div className="flex items-center gap-3">
              {React.createElement(locationIcon, { className: 'w-5 h-5 text-white' })}
              <h3 className="text-lg font-semibold text-white">{location.location_name}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ReportKPICard
                label={`${location.location_name} - Products`}
                value={stats.products}
                icon={Package}
                color={locationColor}
              />
              <ReportKPICard
                label={`${location.location_name} - Units`}
                value={stats.units}
                icon={Activity}
                color={locationColor}
              />
            </div>

            <div className="flex items-center justify-between">
              <h4 className="text-md font-semibold text-gray-300">{location.location_name} Inventory</h4>
              <ExportBar
                filename={`Stock_${location.location_name}`}
                headers={headers}
                rows={rows}
              />
            </div>

            <ReportTable
              columns={[
                { header: 'Product', accessor: 'name' },
                { header: 'Code', accessor: (r) => r.item_code ?? '—' },
                { header: 'Qty / Carton', accessor: (r) => r.pieces_per_carton || 1, className: 'text-center' },
                { header: 'Total Qty (Units)', accessor: (r) => <span className="font-bold text-white">{r.total_units || 0}</span>, className: 'text-right' },
              ]}
              data={location.products}
              emptyMessage={`No stock available in ${location.location_name}`}
            />
          </div>
        );
      })}
    </div>
  );
};



