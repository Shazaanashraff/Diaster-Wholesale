import React, { useState, useEffect } from 'react';
import { getCurrentStockReportByLocation } from '../../services/reportService';
import { ReportTable } from './shared/ReportTable';
import { ExportBar } from './shared/ExportBar';
import { Package, Activity, Warehouse, ShoppingCart, RefreshCw } from 'lucide-react';
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
  const [refreshing, setRefreshing] = useState(false);
  const [locationFilter, setLocationFilter] = useState<'all' | 'shop' | 'warehouse'>('all');

  const loadData = async () => {
    try {
      const res = await getCurrentStockReportByLocation();
      setLocationData(res);
    } catch (err) {
      console.error('Failed to load stock report:', err);
    }
  };

  useEffect(() => {
    async function load() {
      await loadData();
      setLoading(false);
    }
    load();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const filteredData = locationData.filter(loc => {
    if (locationFilter === 'all') return true;
    return loc.location_type === locationFilter;
  });

  const clampUnits = (units?: number | null) => Math.max(0, Number(units ?? 0));

  // Calculate totals across filtered locations
  const totalProducts = filteredData.reduce((sum, loc) => sum + loc.products.length, 0);
  const totalUnits = filteredData.reduce((sum, loc) => sum + loc.products.reduce((pSum, p) => pSum + clampUnits(p.total_units), 0), 0);

  // Calculate per-location totals
  const getLocationStats = (location: LocationStockData) => {
    const products = location.products.length;
    const units = location.products.reduce((sum, p) => sum + clampUnits(p.total_units), 0);
    return { products, units };
  };

  if (loading) {
    return <div className="text-white">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Current Stock Report</h2>
        <div className="flex items-center gap-3">
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value as 'all' | 'shop' | 'warehouse')}
            className="px-4 py-2 rounded-lg bg-[#2b313a] border border-[#3d444d] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Locations</option>
            <option value="shop">Shop Only</option>
            <option value="warehouse">Warehouse Only</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-500 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {/* Overall Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReportKPICard label={`${locationFilter === 'all' ? 'Total' : locationFilter === 'shop' ? 'Shop' : 'Warehouse'} Products`} value={totalProducts} icon={Package} color="bg-blue-600" />
        <ReportKPICard label={`${locationFilter === 'all' ? 'Total' : locationFilter === 'shop' ? 'Shop' : 'Warehouse'} Available Units`} value={totalUnits} icon={Activity} color="bg-indigo-600" />
      </div>

      {/* Location-wise breakdown */}
      {filteredData.map((location) => {
        const stats = getLocationStats(location);
        const headers = ['Product', 'Code', 'Qty per Carton', 'Total Qty (Units)'];
        const rows = location.products.map(p => [
          p.name,
          p.item_code ?? '—',
          p.pieces_per_carton || 1,
          clampUnits(p.total_units)
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
                { header: 'Total Qty (Units)', accessor: (r) => <span className="font-bold text-white">{clampUnits(r.total_units)}</span>, className: 'text-right' },
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



