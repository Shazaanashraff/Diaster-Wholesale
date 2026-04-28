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

const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

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
          <Route path="/pos" element={<POSPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/import" element={<BulkImportPage />} />
          <Route path="/returns" element={<ReturnsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<div className="p-8 flex items-center justify-center text-gray-400">Settings Page Placeholder</div>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </LayoutWrapper>
    </Router>
  );
};

export default App;
