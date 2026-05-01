import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, CheckCircle, Download } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUpdater } from '../hooks/useUpdater';

export const UpdateBanner: React.FC = () => {
  const { status, percent, version, message, isDesktop, installNow, checkNow } = useUpdater();
  const navigate = useNavigate();
  const location = useLocation();

  const isDownloaded = status === 'update-downloaded';
  const isDownloading = status === 'download-progress';
  const isChecking = status === 'checking';
  const restartReady = isDownloaded || (isDownloading && Math.round(percent) >= 100);
  const isDashboardRoute = location.pathname === '/' || location.pathname === '/dashboard';
  const isVisible =
    isChecking || status === 'update-available' || isDownloading || isDownloaded || status === 'error';

  if (!isDesktop || !isDashboardRoute || !isVisible) return null;

  const title = restartReady
    ? `Update ready${version ? ` — v${version}` : ''}`
    : isDownloading
      ? `Downloading update${version ? ` v${version}` : ''} — ${Math.round(percent)}%`
      : isChecking
        ? 'Checking for updates...'
        : status === 'error'
          ? 'Update check failed'
          : `New update available${version ? ` — v${version}` : ''}`;

  const subtitle = status === 'error'
    ? (message ?? 'Please try again.')
    : restartReady
      ? 'Download completed. Restart to install.'
      : isDownloading
        ? `${Math.round(percent)}% downloaded`
        : isChecking
          ? 'Contacting release feed...'
          : 'Download is running in the background.';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -10, opacity: 0 }}
        className="mx-5 mt-4 rounded-xl border border-[#2b313a] bg-[#171c23] text-white shadow-sm"
        aria-live="polite"
      >
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="bg-[#1d222a] border border-[#2b313a] p-1.5 rounded-lg flex-shrink-0">
              {isDownloaded ? (
                <CheckCircle size={17} className="text-emerald-400" />
              ) : isDownloading ? (
                <Download size={17} className="text-blue-400" />
              ) : (
                <RefreshCw size={17} className={`text-gray-300 ${isChecking ? 'animate-spin' : ''}`} />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-sm font-bold text-white leading-tight">{title}</p>
              <p className="text-xs text-gray-300 mt-0.5">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {status === 'error' && (
              <button
                type="button"
                onClick={checkNow}
                className="px-3 py-1.5 bg-[#1d222a] border border-[#2b313a] text-gray-300 rounded-lg text-xs font-semibold"
              >
                Retry
              </button>
            )}
            {restartReady && (
              <button
                type="button"
                onClick={installNow}
                className="px-3 py-1.5 bg-[#f8fafc] text-[#111315] rounded-lg text-xs font-bold border border-[#f8fafc]"
              >
                Restart now
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/updates')}
              className="px-3 py-1.5 bg-[#1d222a] border border-[#2b313a] text-gray-300 rounded-lg text-xs font-semibold"
            >
              Open Updates
            </button>
          </div>
        </div>
        {(isDownloading || isDownloaded) && (
          <div className="h-1 bg-[#222831]">
            <motion.div
              className="h-full bg-white"
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
            />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
