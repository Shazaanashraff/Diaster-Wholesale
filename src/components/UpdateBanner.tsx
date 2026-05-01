import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, CheckCircle, ChevronRight, Download } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

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

export const UpdateBanner: React.FC = () => {
  const [status, setStatus] = useState<UpdaterStatus>('idle');
  const [percent, setPercent] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // @ts-ignore
    if (!window.desktop?.updater) return;

    // @ts-ignore
    const cleanup = window.desktop.updater.onStatus((payload: UpdaterPayload) => {
      setStatus(payload.status);
      if (payload.status === 'download-progress' && payload.percent !== undefined) {
        setPercent(payload.percent);
      }
      if (
        payload.status === 'update-available' ||
        payload.status === 'update-downloaded' ||
        payload.status === 'download-progress'
      ) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    });

    return cleanup;
  }, []);

  if (location.pathname === '/updates' || !isVisible) return null;

  const isDownloaded = status === 'update-downloaded';
  const isDownloading = status === 'download-progress';

  const bg = isDownloaded ? 'bg-amber-600 hover:bg-amber-700 border-amber-500' : 'bg-violet-600 hover:bg-violet-700 border-violet-500';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 20, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className={`fixed top-4 right-4 z-50 shadow-lg cursor-pointer max-w-xs w-72 rounded-xl overflow-hidden border text-white transition-colors ${bg}`}
        onClick={() => navigate('/updates')}
      >
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="bg-white/20 p-1.5 rounded-lg flex-shrink-0">
              {isDownloaded ? (
                <CheckCircle size={18} />
              ) : isDownloading ? (
                <Download size={18} />
              ) : (
                <RefreshCw size={18} className="animate-spin" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-sm font-bold leading-tight">
                {isDownloaded
                  ? 'Update ready to install'
                  : isDownloading
                  ? `Downloading… ${Math.round(percent)}%`
                  : 'New update available'}
              </p>
              <p className="text-xs opacity-75 mt-0.5">Click to view details</p>
            </div>
          </div>
          <ChevronRight size={16} className="opacity-60 flex-shrink-0" />
        </div>
        {isDownloading && (
          <div className="h-1 bg-white/20">
            <motion.div
              className="h-full bg-white/60"
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
            />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
