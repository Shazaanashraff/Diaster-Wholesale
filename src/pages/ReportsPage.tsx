import React, { useState } from 'react';
import {
  BarChart3,
  DollarSign,
  Package,
  ShoppingCart,
  Users,
  Truck,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  Search,
} from 'lucide-react';
import { cn } from '../lib/utils';

import { ProfitLossReport }           from './reports/ProfitLossReport';
import { SalesProfitReport }          from './reports/SalesProfitReport';
import { BatchProfitReport }          from './reports/BatchProfitReport';
import { ExpenseReport }              from './reports/ExpenseReport';
import { CashFlowReport }             from './reports/CashFlowReport';
import { CurrentStockReport }         from './reports/CurrentStockReport';
import { LowStockReport }             from './reports/LowStockReport';
import { InventoryAdjustmentReport }  from './reports/InventoryAdjustmentReport';
import { SalesByProductReport }       from './reports/SalesByProductReport';
import { SalesByCustomerReport }      from './reports/SalesByCustomerReport';
import { StockValuationReport }       from './reports/StockValuationReport';
import { DamageReport }               from './reports/DamageReport';
import { SalesReturnReport }          from './reports/SalesReturnReport';
import { PurchaseHistoryReport }      from './reports/PurchaseHistoryReport';
import { CustomerLedgerAggregateReport } from './reports/CustomerLedgerAggregateReport';
import { FastMovingReport }           from './reports/FastMovingReport';
import { SlowMovingReport }           from './reports/SlowMovingReport';
import { DailyFinanceReport }         from './reports/DailyFinanceReport';
import { SalesByPersonReport }        from './reports/SalesByPersonReport';
import { WholesaleRetailReport }      from './reports/WholesaleRetailReport';
import { InvoiceReport }              from './reports/InvoiceReport';
import { CreditReport }               from './reports/CreditReport';
import { ARAgingReport }              from './reports/ARAgingReport';
import { PayablesReport }             from './reports/PayablesReport';
import { StockAgingReport }           from './reports/StockAgingReport';
import { InventoryMovementReport }    from './reports/InventoryMovementReport';
import { DeadStockReport }            from './reports/DeadStockReport';

const CATEGORIES = [
  {
    id: 'financial',
    label: 'Financial',
    icon: DollarSign,
    reports: [
      { id: 'pl',           label: 'Profit & Loss',   component: ProfitLossReport },
      { id: 'sales-profit', label: 'Sales Profit',    component: SalesProfitReport },
      { id: 'batch-profit', label: 'Batch Profit',    component: BatchProfitReport },
      { id: 'expense',        label: 'Expenses',        component: ExpenseReport },
      { id: 'cash-flow',      label: 'Cash Flow',       component: CashFlowReport },
      { id: 'daily-finance',  label: 'Daily Finance',   component: DailyFinanceReport },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Package,
    reports: [
      { id: 'current-stock',   label: 'Current Stock',       component: CurrentStockReport },
      { id: 'stock-valuation', label: 'Stock Valuation',     component: StockValuationReport },
      { id: 'low-stock',       label: 'Low Stock',           component: LowStockReport },
      { id: 'adjustment',      label: 'Stock Adjustment',    component: InventoryAdjustmentReport },
      { id: 'stock-aging',     label: 'Stock Aging',         component: StockAgingReport },
      { id: 'movement',        label: 'Inventory Movement',  component: InventoryMovementReport },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    icon: ShoppingCart,
    reports: [
      { id: 'sales-by-product',   label: 'By Product',          component: SalesByProductReport },
      { id: 'sales-by-customer',  label: 'By Customer',         component: SalesByCustomerReport },
      { id: 'sales-by-person',    label: 'By Salesperson',      component: SalesByPersonReport },
      { id: 'sales-by-mode',      label: 'Wholesale vs Retail', component: WholesaleRetailReport },
      { id: 'invoice-report',     label: 'Invoice Report',      component: InvoiceReport },
    ],
  },
  {
    id: 'customer',
    label: 'Customers',
    icon: Users,
    reports: [
      { id: 'customer-ledger', label: 'Customer Ledger', component: CustomerLedgerAggregateReport },
      { id: 'credit-report',   label: 'Credit Report',   component: CreditReport },
      { id: 'ar-aging',        label: 'AR Aging',        component: ARAgingReport },
    ],
  },
  {
    id: 'supplier',
    label: 'Supplier',
    icon: Truck,
    reports: [
      { id: 'purchase-history',      label: 'Purchase History', component: PurchaseHistoryReport },
      { id: 'outstanding-payables',  label: 'Payables',         component: PayablesReport },
    ],
  },
  {
    id: 'returns',
    label: 'Returns & Damage',
    icon: AlertCircle,
    reports: [
      { id: 'sales-return',   label: 'Sales Return',   component: SalesReturnReport },
      { id: 'damage-report',  label: 'Damage Report',  component: DamageReport },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: TrendingUp,
    reports: [
      { id: 'fast-moving', label: 'Fast Moving', component: FastMovingReport },
      { id: 'slow-moving', label: 'Slow Moving', component: SlowMovingReport },
      { id: 'dead-stock',  label: 'Dead Stock',  component: DeadStockReport },
    ],
  },
];

export const ReportsPage: React.FC = () => {
  const [activeCategoryId, setActiveCategoryId] = useState(CATEGORIES[0].id);
  const [activeReportId, setActiveReportId]     = useState(CATEGORIES[0].reports[0].id);
  const [searchQuery, setSearchQuery]           = useState('');

  const q = searchQuery.toLowerCase();
  const filteredCategories = CATEGORIES.map(cat => ({
    ...cat,
    reports: cat.reports.filter(r => !q || r.label.toLowerCase().includes(q)),
  })).filter(cat => !q || cat.reports.length > 0);

  const activeReport = CATEGORIES
    .flatMap(c => c.reports)
    .find(r => r.id === activeReportId);

  const renderReport = () => {
    if (!activeReport) return null;

    const Component = (activeReport as any).component;
    return Component ? (
      <div style={{ animation: 'posFadeIn 220ms ease' }}>
        <Component />
      </div>
    ) : null;
  };

  return (
    <div className="pos-standard-page flex overflow-hidden" style={{ height: '100vh' }}>

      {/* ── Left nav ── */}
      <aside className="w-64 shrink-0 flex flex-col border-r border-[#1f242c] bg-[#0d1016] overflow-hidden">

        {/* Header */}
        <div className="px-5 py-5 border-b border-[#1f242c]">
          <div className="flex items-center gap-2.5 mb-0.5">
            <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
              <BarChart3 size={15} className="text-primary" />
            </div>
            <h1 className="text-base font-bold text-white tracking-tight">Reports</h1>
          </div>
          <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold pl-9">Business Intelligence</p>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-[#1f242c]">
          <label className="flex items-center gap-2 bg-[#171c23] border border-[#2b313a] rounded-xl px-3 py-2 focus-within:border-primary/40 transition-all">
            <Search size={13} className="text-gray-600 shrink-0" />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-gray-300 placeholder-gray-600 outline-none w-full"
            />
          </label>
        </div>

        {/* Nav list */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar py-3 px-3 space-y-5">
          {filteredCategories.map(cat => (
            <div key={cat.id}>
              <div className="flex items-center gap-1.5 px-2 mb-1.5">
                <cat.icon size={11} className="text-gray-600" />
                <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">{cat.label}</span>
              </div>
              <div className="space-y-1.5">
                {cat.reports.map(rep => {
                  const isActive = activeReportId === rep.id;
                  return (
                    <button
                      key={rep.id}
                      onClick={() => {
                        setActiveCategoryId(cat.id);
                        setActiveReportId(rep.id);
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-xl text-[11px] font-semibold transition-all flex items-center justify-between group',
                        isActive
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'text-gray-500 hover:bg-[#171c23] hover:text-gray-200 border border-transparent'
                      )}
                    >
                      <span className="truncate">{rep.label}</span>
                      <span className="shrink-0 flex items-center gap-1.5 ml-2">
                        {isActive && <ChevronRight size={12} className="text-primary" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {filteredCategories.length === 0 && (
            <p className="text-center text-xs text-gray-600 py-8">No reports match "{searchQuery}"</p>
          )}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#111315]">
        {/* Breadcrumb bar */}
        <div className="sticky top-0 z-10 flex items-center gap-2 px-8 py-4 border-b border-[#1f242c] bg-[#111315]/90 backdrop-blur-sm">
          <span className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">
            {CATEGORIES.find(c => c.id === activeCategoryId)?.label}
          </span>
          <ChevronRight size={12} className="text-gray-700" />
          <span className="text-[11px] font-bold text-gray-300 uppercase tracking-widest">
            {activeReport?.label}
          </span>
        </div>

        <div className="px-8 py-7 max-w-6xl mx-auto">
          {renderReport()}
        </div>
      </main>
    </div>
  );
};
