import React, { useState } from 'react';
import {
  BarChart3,
  DollarSign,
  Package,
  ShoppingCart,
  Users,
  Truck,
  Settings,
  TrendingUp,
  FileText,
  AlertCircle,
  Clock,
  ChevronRight,
  Search,
  Download,
  Printer
} from 'lucide-react';
import { cn } from '../lib/utils';

// Import built report components
import { ProfitLossReport } from './reports/ProfitLossReport';
import { SalesProfitReport } from './reports/SalesProfitReport';
import { BatchProfitReport } from './reports/BatchProfitReport';
import { ExpenseReport } from './reports/ExpenseReport';
import { CashFlowReport } from './reports/CashFlowReport';
import { CurrentStockReport } from './reports/CurrentStockReport';
import { LowStockReport } from './reports/LowStockReport';
import { InventoryAdjustmentReport } from './reports/InventoryAdjustmentReport';
import { DailySalesReport } from './reports/DailySalesReport';
import { SalesByProductReport } from './reports/SalesByProductReport';
import { SalesByCustomerReport } from './reports/SalesByCustomerReport';
import { StockValuationReport } from './reports/StockValuationReport';
import { DamageReport } from './reports/DamageReport';
import { SalesReturnReport } from './reports/SalesReturnReport';

// Define Categories
const CATEGORIES = [
  {
    id: 'financial',
    label: 'Financial Reports',
    icon: DollarSign,
    reports: [
      { id: 'pl', label: 'Profit & Loss', component: ProfitLossReport },
      { id: 'sales-profit', label: 'Sales Profit', component: SalesProfitReport },
      { id: 'batch-profit', label: 'Batch Profit', component: BatchProfitReport },
      { id: 'expense', label: 'Expense Report', component: ExpenseReport },
      { id: 'cash-flow', label: 'Cash Flow', component: CashFlowReport },
    ]
  },
  {
    id: 'inventory',
    label: 'Inventory Reports',
    icon: Package,
    reports: [
      { id: 'current-stock', label: 'Current Stock', component: CurrentStockReport },
      { id: 'stock-valuation', label: 'Stock Valuation', component: StockValuationReport },
      { id: 'stock-aging', label: 'Stock Aging', comingSoon: true },
      { id: 'low-stock', label: 'Low Stock', component: LowStockReport },
      { id: 'movement', label: 'Inventory Movement', comingSoon: true },
      { id: 'adjustment', label: 'Stock Adjustment', component: InventoryAdjustmentReport },
    ]
  },
  {
    id: 'sales',
    label: 'Sales Reports',
    icon: ShoppingCart,
    reports: [
      { id: 'daily-sales', label: 'Daily Sales', component: DailySalesReport },
      { id: 'sales-by-product', label: 'By Product', component: SalesByProductReport },
      { id: 'sales-by-customer', label: 'By Customer', component: SalesByCustomerReport },
      { id: 'sales-by-mode', label: 'Wholesale vs Retail', comingSoon: true },
      { id: 'invoice-report', label: 'Invoice Report', comingSoon: true },
    ]
  },
  {
    id: 'customer',
    label: 'Customer Reports',
    icon: Users,
    reports: [
      { id: 'customer-ledger', label: 'Customer Ledger', comingSoon: true },
      { id: 'credit-report', label: 'Credit Report', comingSoon: true },
      { id: 'ar-aging', label: 'AR Aging', comingSoon: true },
    ]
  },
  {
    id: 'supplier',
    label: 'Supplier Reports',
    icon: Truck,
    reports: [
      { id: 'supplier-ledger', label: 'Supplier Ledger', comingSoon: true },
      { id: 'outstanding-payables', label: 'Payables Report', comingSoon: true },
    ]
  },
  {
    id: 'returns',
    label: 'Returns & Damage',
    icon: AlertCircle,
    reports: [
      { id: 'sales-return', label: 'Sales Return', component: SalesReturnReport },
      { id: 'damage-report', label: 'Damage Report', component: DamageReport },
    ]
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: TrendingUp,
    reports: [
      { id: 'fast-moving', label: 'Fast Moving Products', comingSoon: true },
      { id: 'slow-moving', label: 'Slow Moving Products', comingSoon: true },
      { id: 'dead-stock', label: 'Dead Stock', comingSoon: true },
    ]
  }
];

export const ReportsPage: React.FC = () => {
  const [activeCategoryId, setActiveCategoryId] = useState(CATEGORIES[0].id);
  const [activeReportId, setActiveReportId] = useState(CATEGORIES[0].reports[0].id);
  const [searchQuery, setSearchQuery] = useState('');

  const activeCategory = CATEGORIES.find(c => c.id === activeCategoryId);
  const activeReport = activeCategory?.reports.find(r => r.id === activeReportId);

  const renderReport = () => {
    if (activeReport?.comingSoon) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <div className="w-16 h-16 rounded-full bg-blue-900/20 flex items-center justify-center mb-4">
            <Clock size={32} className="text-blue-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">{activeReport.label}</h3>
          <p className="text-gray-400 max-w-md">
            This reporting module is currently under development and will be available in the next system update.
          </p>
        </div>
      );
    }
    
    const Component = activeReport?.component;
    return Component ? <Component /> : null;
  };

  return (
    <div className="pos-shell flex overflow-hidden">
      {/* Sidebar navigation */}
      <aside className="w-72 border-r border-[#1f242c] bg-[#0d1016] flex flex-col">
        <div className="p-6 border-b border-[#1f242c]">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="text-blue-500" />
            Reporting
          </h1>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-bold">Business Intelligence</p>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search reports..."
              className="w-full bg-[#171c23] border border-[#2b313a] rounded-xl pl-9 pr-4 py-2 text-xs text-gray-300 focus:outline-none focus:border-blue-500 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-6">
          {CATEGORIES.map(cat => (
            <div key={cat.id} className="space-y-1">
              <h3 className="px-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <cat.icon size={12} />
                {cat.label}
              </h3>
              <div className="space-y-0.5">
                {cat.reports.map(rep => (
                  <button
                    key={rep.id}
                    onClick={() => {
                      setActiveCategoryId(cat.id);
                      setActiveReportId(rep.id);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between group",
                      activeReportId === rep.id 
                        ? "bg-blue-600/10 text-blue-400" 
                        : "text-gray-400 hover:bg-[#171c23] hover:text-gray-200"
                    )}
                  >
                    {rep.label}
                    {activeReportId === rep.id && <ChevronRight size={14} />}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 bg-[#111315] overflow-y-auto custom-scrollbar p-8">
        <div className="max-w-6xl mx-auto">
          {renderReport()}
        </div>
      </main>
    </div>
  );
};
