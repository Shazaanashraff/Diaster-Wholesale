import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RefreshCw, CheckCircle, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { UpdateBanner } from './UpdateBanner';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface LayoutWrapperProps {
  children: React.ReactNode;
}

type UpdaterStatus =
  | 'checking'
  | 'update-available'
  | 'update-not-available'
  | 'download-progress'
  | 'update-downloaded'
  | 'error'
  | 'idle';

interface UpdaterPayload {
  status: UpdaterStatus;
  version?: string;
  percent?: number;
  message?: string;
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

  // Login-time update notice
  const [loginNotice, setLoginNotice] = useState<{ version: string; status: 'update-available' | 'update-downloaded' } | null>(null);
  const loginCheckDone = useRef(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (isProductsRoute) {
      setIsSessionCollapsed(true);
    }
  }, [isProductsRoute]);

  // Trigger update check on login and show a notice if update is found
  useEffect(() => {
    if (loginCheckDone.current) return;
    const updater = (window as any).desktop?.updater;
    if (!updater) return;
    loginCheckDone.current = true;

    const cleanup = updater.onStatus((payload: UpdaterPayload) => {
      if (payload.status === 'update-available' || payload.status === 'update-downloaded') {
        setLoginNotice({
          version: payload.version || '',
          status: payload.status,
        });
        // Auto-dismiss after 8 seconds
        setTimeout(() => setLoginNotice(null), 8000);
      }
    });

    // Trigger the check now that the user has logged in
    updater.checkNow();

    return cleanup;
  }, []);

  const handleLoginNoticeClick = () => {
    setLoginNotice(null);
    navigate('/updates');
  };

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

          {/* Login-time update notice */}
          <AnimatePresence>
            {loginNotice && location.pathname !== '/updates' && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-80 shadow-xl"
              >
                <div
                  className="rounded-xl border border-violet-200 bg-white overflow-hidden cursor-pointer hover:shadow-2xl transition-shadow"
                  onClick={handleLoginNoticeClick}
                >
                  <div className="h-1 bg-gradient-to-r from-violet-500 to-violet-400" />
                  <div className="px-4 py-3 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {loginNotice.status === 'update-downloaded' ? (
                        <CheckCircle size={16} className="text-violet-600" />
                      ) : (
                        <RefreshCw size={16} className="text-violet-600 animate-spin" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">
                        {loginNotice.status === 'update-downloaded'
                          ? 'Update ready to install'
                          : 'New update available'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {loginNotice.version ? `Version ${loginNotice.version} — ` : ''}
                        Click to view details
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setLoginNotice(null); }}
                      className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
