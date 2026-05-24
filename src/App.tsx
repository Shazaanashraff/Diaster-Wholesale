import React, { useState } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LayoutWrapper } from './components/LayoutWrapper';
import { DashboardPage } from './pages/DashboardPage';
import { POSPage } from './pages/POSPage';
import { InventoryPage } from './pages/InventoryPage';
import { ProductsPage } from './pages/ProductsPage';
import { CustomersPage } from './pages/CustomersPage';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { BulkImportPage } from './pages/BulkImportPage';
import { ReportsPage } from './pages/ReportsPage';
import { ReturnsPage } from './pages/ReturnsPage';
import { PinAuthPage } from './pages/PinAuthPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { PurchaseDetailPage } from './pages/PurchaseDetailPage';
import { SupplierReturnsPage } from './pages/SupplierReturnsPage';
import { DayTransactionsPage } from './pages/DayTransactionsPage';
import { StockTransfersPage } from './pages/StockTransfersPage';
import { UpdatesPage } from './pages/UpdatesPage';
import { CashierPage } from './pages/CashierPage';
import { SalespeoplePage } from './pages/SalespeoplePage';
import { usePermissions, type Permission } from './utils/permissions';


const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

const ProtectedRoute: React.FC<{ children: React.ReactNode; req: Permission | Permission[] }> = ({ children, req }) => {
  const { can, canAny } = usePermissions();
  const hasAccess = Array.isArray(req) ? canAny(req) : can(req);
  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const App: React.FC = () => {
  const [authenticated, setAuthenticated] = useState(
    () => sessionStorage.getItem('pin_auth') === '1'
  );

  if (!authenticated) {
    return <PinAuthPage onSuccess={() => setAuthenticated(true)} />;
  }

  return (
    <Router>
      <LayoutWrapper>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/pos" element={<ProtectedRoute req="pos"><POSPage /></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute req="view_inventory"><InventoryPage /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute req="manage_products"><ProductsPage /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute req="view_customers"><CustomersPage /></ProtectedRoute>} />
          <Route path="/customers/:id" element={<ProtectedRoute req="view_customers"><CustomerDetailPage /></ProtectedRoute>} />
          <Route path="/import" element={<ProtectedRoute req="bulk_import"><BulkImportPage /></ProtectedRoute>} />
          <Route path="/salespeople" element={<ProtectedRoute req="manage_salespeople"><SalespeoplePage /></ProtectedRoute>} />
          <Route path="/returns" element={<ProtectedRoute req="manage_returns"><ReturnsPage /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute req="view_reports"><ReportsPage /></ProtectedRoute>} />
          <Route path="/suppliers" element={<ProtectedRoute req={['manage_suppliers', 'manage_payments']}><SuppliersPage /></ProtectedRoute>} />
          <Route path="/purchases" element={<ProtectedRoute req="manage_procurement"><PurchasesPage /></ProtectedRoute>} />
          <Route path="/purchases/:id" element={<ProtectedRoute req="manage_procurement"><PurchaseDetailPage /></ProtectedRoute>} />
          <Route path="/supplier-returns" element={<ProtectedRoute req="manage_procurement"><SupplierReturnsPage /></ProtectedRoute>} />
          <Route path="/stock-transfers" element={<ProtectedRoute req="manage_procurement"><StockTransfersPage /></ProtectedRoute>} />
          <Route path="/day-transactions" element={<ProtectedRoute req={['manage_costs', 'manage_payments']}><DayTransactionsPage /></ProtectedRoute>} />
          <Route path="/expenses" element={<Navigate to="/day-transactions" replace />} />
          <Route path="/cashier" element={<ProtectedRoute req="pos"><CashierPage /></ProtectedRoute>} />
          <Route path="/updates" element={<UpdatesPage />} />
          <Route path="/settings" element={<div className="p-8 flex items-center justify-center text-gray-400">Settings Page Placeholder</div>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </LayoutWrapper>
    </Router>
  );
};

export default App;
