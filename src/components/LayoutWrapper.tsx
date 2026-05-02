import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { UpdateBanner } from './UpdateBanner';
import { cn } from '../lib/utils';

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export const LayoutWrapper: React.FC<LayoutWrapperProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isPosRoute = ['/pos', '/', '/inventory', '/products', '/customers', '/reports', '/suppliers', '/purchases'].some(
    (p) => location.pathname === p || location.pathname.startsWith('/purchases/')
  );
  const isProductsRoute = ['/products', '/customers', '/reports', '/suppliers', '/purchases'].some(
    (p) => location.pathname === p || location.pathname.startsWith('/purchases/')
  );
  const [hydrated, setHydrated] = useState(false);
  const [isSessionCollapsed, setIsSessionCollapsed] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (isProductsRoute) {
      setIsSessionCollapsed(true);
    }
  }, [isProductsRoute]);

  return (
    <div className="pos-shell pos-theme app-cosy">
      <div className={cn("pos-frame pos-frame-2col", hydrated && "pos-frame-ready")}>
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(p => !p)} />
        <div
          className={cn(
            "pos-content custom-scrollbar relative flex flex-col p-0",
            isPosRoute ? "pos-content-pos" : "pos-content-standard"
          )}
          >
            <UpdateBanner />

          {isPosRoute ? (
            children
          ) : (
            <div className={cn("pos-standard-layout", isSessionCollapsed && "collapsed")}>
              <div className="pos-standard-surface pos-standard-main">{children}</div>
              <aside className={cn("pos-standard-right", isSessionCollapsed && "collapsed")}>
                <div className="pos-standard-right-toolbar">
                  <button
                    type="button"
                    className="pos-standard-right-toggle"
                    onClick={() => setIsSessionCollapsed((prev) => !prev)}
                    aria-label={isSessionCollapsed ? 'Expand session panel' : 'Collapse session panel'}
                  >
                    {isSessionCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                  </button>
                </div>

                {!isSessionCollapsed && (
                  <>
                    <div className="pos-standard-right-head">
                      <h3>Session</h3>
                      <p>System status</p>
                    </div>
                    <div className="pos-standard-right-list">
                      <div className="pos-standard-right-item">
                        <span>1</span>
                        <div>
                          <h4>Dashboard Sync</h4>
                          <p>Running</p>
                        </div>
                      </div>
                      <div className="pos-standard-right-item">
                        <span>2</span>
                        <div>
                          <h4>Inventory Check</h4>
                          <p>Ready</p>
                        </div>
                      </div>
                      <div className="pos-standard-right-item">
                        <span>3</span>
                        <div>
                          <h4>Customer Ledger</h4>
                          <p>Updated</p>
                        </div>
                      </div>
                    </div>
                    <div className="pos-standard-right-total">
                      <div><span>Mode</span><strong>Live</strong></div>
                      <div><span>Panel</span><strong>Unified POS</strong></div>
                    </div>
                    <button className="pos-standard-right-btn" onClick={() => navigate('/pos')}>Open POS Style Controls</button>
                  </>
                )}
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
