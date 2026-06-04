import React, { useState, useEffect } from 'react';
import { getStockValuationReport } from '../../services/reportService';
import { fmtCurrency } from '../../utils/reportUtils';
import { ReportTable } from './shared/ReportTable';
import { ExportBar } from './shared/ExportBar';
import { BarChart3, Warehouse, ShoppingCart, RefreshCw } from 'lucide-react';
import { ReportKPICard } from './shared/ReportKPICard';

interface LocationValuationData {
  location_id: string | null;
  location_name: string;
  location_type: string | null;
  products: Array<{
    product_id: string;
    name: string;
    item_code: string;
    available: number;
    unitCost: number;
    valuation: number;
  }>;
  totalValuation: number;
}

export const StockValuationReport: React.FC = () => {
  const [locationData, setLocationData] = useState<LocationValuationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationFilter, setLocationFilter] = useState<'all' | 'shop' | 'warehouse'>('all');

  const loadData = async () => {
      const rows = await getStockValuationReport();
      setLocationData(
        rows.map((loc) => ({
          location_id: loc.location_id,
          location_name: loc.location_name,
          location_type: loc.location_type,
          products: loc.products.map((p) => ({
            product_id: p.product_id,
            name: p.name,
            item_code: p.item_code,
            available: Number(p.available),
            unitCost: Number(p.unitCost),
            valuation: Number(p.valuation),
          })),
          totalValuation: Number(loc.totalValuation),
        }))
      );
    } catch (err) {
      console.error('Failed to load stock valuation:', err);
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

  if (loading) {
    return <div className="text-white">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Stock Valuation Report</h2>
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

      {/* Overall Total */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
        <ReportKPICard
          label={locationFilter === 'all' ? 'Total Stock Value (All Locations)' : `Total Stock Value (${locationFilter === 'shop' ? 'Shops' : 'Warehouses'})`}
          value={filteredData.reduce((sum, loc) => sum + loc.totalValuation, 0)}
          prefix="LKR "
          icon={BarChart3}
          color="bg-emerald-600"
        />
      </div>

      {/* Location-wise breakdown */}
      {filteredData.map((location) => {
        const headers = ['Product', 'Code', 'Qty', 'Unit Cost', 'Total Value'];
        const rows = location.products.map(p => [
          p.name,
          p.item_code,
          p.available,
          fmtCurrency(p.unitCost),
          fmtCurrency(p.valuation)
        ]);

        const locationIcon = location.location_type === 'warehouse' ? Warehouse : ShoppingCart;
        const locationColor = location.location_type === 'warehouse' ? 'bg-amber-600' : 'bg-green-600';

        return (
          <div key={location.location_id || 'unassigned'} className="space-y-4">
            <div className="flex items-center gap-3">
              {React.createElement(locationIcon, { className: 'w-5 h-5 text-white' })}
              <h3 className="text-lg font-semibold text-white">{location.location_name}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
              <ReportKPICard
                label={`${location.location_name} - Stock Value`}
                value={location.totalValuation}
                prefix="LKR "
                icon={BarChart3}
                color={locationColor}
              />
            </div>

            <div className="flex items-center justify-between">
              <h4 className="text-md font-semibold text-gray-300">{location.location_name} Valuation</h4>
              <ExportBar
                filename={`Stock_Valuation_${location.location_name}`}
                headers={headers}
                rows={rows}
              />
            </div>

            <ReportTable
              columns={[
                { header: 'Product', accessor: 'name' },
                { header: 'Code', accessor: 'item_code' },
                { header: 'Available Qty', accessor: (r) => `${r.available} Pieces`, className: 'text-center' },
                { header: 'Unit Cost', accessor: (r) => fmtCurrency(r.unitCost), className: 'text-right' },
                { header: 'Total Value', accessor: (r) => fmtCurrency(r.valuation), className: 'text-right font-mono text-emerald-400' }
              ]}
              data={location.products}
              emptyMessage={`No stock available for valuation in ${location.location_name}`}
            />
          </div>
        );
      })}
    </div>
  );
};

