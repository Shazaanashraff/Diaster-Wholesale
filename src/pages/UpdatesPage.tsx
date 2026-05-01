import React, { useState, useEffect } from 'react';
import { TopBar } from '../components/TopBar';
import { RefreshCw, AlertCircle, CheckCircle, Download, Package, History, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { version as currentVersion } from '../../package.json';

// True if running inside Electron (either via contextBridge exposure or UA check)
const isElectron = () =>
  !!(window as any).desktop?.updater || /Electron/.test(navigator.userAgent);

const callUpdater = (method: 'checkNow' | 'installNow') => {
  const updater = (window as any).desktop?.updater;
  if (!updater) return;
  if (method === 'checkNow') updater.checkNow();
  else updater.installNow();
};

const CHANGELOG: { version: string; date: string; current?: boolean; highlights: string[] }[] = [
  {
    version: '0.1.0',
    date: 'May 2026',
    current: true,
    highlights: [
      'Initial release of Diastar Wholesale ERP',
      'POS System with cart management and inventory validation',
      'Inventory tracking with bulk import support',
      'Customer management with ledger and payment recording',
      'Procurement module with purchase orders and supplier management',
      'Comprehensive reporting suite — Sales, Profit/Loss, Stock, and more',
      'Role-based access control — Admin, Accountant, Officer, POS Operator',
      'Auto-update support with background download and install',
    ],
  },
];

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

export const UpdatesPage: React.FC = () => {
  const [status, setStatus] = useState<UpdaterStatus>('idle');
  const [percent, setPercent] = useState(0);
  const [newVersion, setNewVersion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    setDesktop(isElectron());
  }, []);

  useEffect(() => {
    const updater = (window as any).desktop?.updater;
    if (!updater) return;

    const cleanup = updater.onStatus((payload: UpdaterPayload) => {
      setStatus(payload.status);

      if (payload.status === 'download-progress' && payload.percent !== undefined) {
        setPercent(payload.percent);
      }
      if (payload.status === 'update-available') {
        setNewVersion(payload.version || '');
      }
      if (payload.status === 'update-downloaded') {
        setPercent(100);
      }
      if (payload.status === 'error') {
        setError(payload.message || 'An unknown error occurred.');
      }
      if (payload.status === 'update-not-available' || payload.status === 'error') {
        setLastChecked(new Date());
      }
    });

    return cleanup;
  }, []);

  const handleRestart = () => callUpdater('installNow');

  const handleCheckUpdates = () => {
    setStatus('checking');
    setError(null);
    callUpdater('checkNow');
  };

  const isActive = status !== 'idle';

  return (
    <div className="pos-standard-page flex flex-col min-h-screen bg-transparent">
      <TopBar />

      <div className="p-10 pos-page-body w-full max-w-3xl">

        {/* Page header */}
        <div className="pos-page-header mb-8" style={{ animation: 'posFadeIn 380ms ease both' }}>
          <h1 className="text-3xl font-bold text-white tracking-tight">App Updates</h1>
          <p className="text-gray-500 text-sm font-semibold mt-1">
            Manage application updates and view release history.
          </p>
        </div>

        {/* Version card */}
        <div
          className="bg-[#171c23] rounded-[2.5rem] border border-[#2b313a] p-8 mb-5 shadow-sm"
          style={{ animation: 'posFadeIn 400ms ease both', animationDelay: '60ms' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#1d222a] rounded-2xl border border-[#2b313a] flex items-center justify-center">
                <Package size={20} className="text-gray-400" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                  Diastar Wholesale
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-white">v{currentVersion}</span>
                  <span className="px-2 py-0.5 bg-[#1d222a] border border-[#2b313a] text-gray-400 text-[10px] font-bold rounded-lg uppercase tracking-wide">
                    Installed
                  </span>
                </div>
                {lastChecked && (
                  <p className="text-[11px] text-gray-600 mt-1">
                    Last checked {lastChecked.toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>

            {desktop ? (
              <button
                onClick={handleCheckUpdates}
                disabled={status === 'checking' || status === 'download-progress'}
                className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RefreshCw size={14} className={status === 'checking' ? 'animate-spin' : ''} />
                {status === 'checking' ? 'Checking…' : 'Check for Updates'}
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-[#1d222a] border border-[#2b313a] text-gray-500 rounded-xl text-xs font-semibold">
                <AlertCircle size={13} />
                Desktop app only
              </div>
            )}
          </div>
        </div>

        {/* Status panel */}
        <AnimatePresence mode="wait">
          {isActive && (
            <motion.div
              key={status}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-[#171c23] rounded-[2.5rem] border border-[#2b313a] p-8 mb-5 shadow-sm"
            >
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-4">
                Update Status
              </p>

              {status === 'checking' && (
                <div className="flex items-center gap-3 p-4 bg-[#1d222a] rounded-xl border border-[#2b313a]">
                  <RefreshCw size={16} className="text-gray-400 animate-spin flex-shrink-0" />
                  <p className="text-sm text-gray-300 font-semibold">Checking for updates…</p>
                </div>
              )}

              {status === 'update-not-available' && (
                <div className="flex items-center justify-between p-4 bg-[#1d222a] rounded-xl border border-[#2b313a]">
                  <div className="flex items-center gap-3">
                    <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                    <p className="text-sm text-gray-200 font-semibold">You're on the latest version</p>
                  </div>
                  <button
                    onClick={handleCheckUpdates}
                    className="px-3 py-1.5 bg-[#252a30] border border-[#2b313a] text-gray-400 rounded-lg text-xs font-bold"
                  >
                    Check again
                  </button>
                </div>
              )}

              {status === 'update-available' && (
                <div className="flex items-center gap-3 p-4 bg-[#1d222a] rounded-xl border border-[#2b313a]">
                  <RefreshCw size={16} className="text-white animate-spin flex-shrink-0" />
                  <div>
                    <p className="text-sm text-white font-bold">
                      New version available{newVersion ? ` — v${newVersion}` : ''}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">Downloading in the background…</p>
                  </div>
                </div>
              )}

              {status === 'download-progress' && (
                <div className="p-4 bg-[#1d222a] rounded-xl border border-[#2b313a]">
                  <div className="flex items-center gap-3 mb-3">
                    <Download size={16} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-white font-bold">
                        Downloading{newVersion ? ` v${newVersion}` : ' update'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{Math.round(percent)}% complete</p>
                    </div>
                    <span className="text-sm font-bold text-gray-300">{Math.round(percent)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#252a30] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-white"
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ ease: 'easeOut' }}
                    />
                  </div>
                </div>
              )}

              {status === 'update-downloaded' && (
                <div className="flex items-start justify-between gap-4 p-4 bg-[#1d222a] rounded-xl border border-[#2b313a]">
                  <div className="flex items-start gap-3 flex-1">
                    <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-white font-bold">
                        {newVersion ? `v${newVersion} ready` : 'Update ready to install'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        The app will restart to complete installation.
                      </p>
                      <div className="mt-2.5 w-48 h-1.5 bg-[#252a30] rounded-full overflow-hidden">
                        <div className="h-full w-full bg-white rounded-full" />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleRestart}
                    className="px-4 py-2 bg-white text-black rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0"
                  >
                    Restart & Install
                  </button>
                </div>
              )}

              {status === 'error' && error && (
                <div className="p-4 bg-[#1d222a] rounded-xl border border-[#2b313a]">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm text-white font-bold">Update failed</p>
                        <button
                          onClick={handleCheckUpdates}
                          className="px-3 py-1 bg-[#252a30] border border-[#2b313a] text-gray-400 rounded-lg text-xs font-bold"
                        >
                          Try again
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{error}</p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Version history */}
        <div
          className="bg-[#171c23] rounded-[2.5rem] border border-[#2b313a] p-8 shadow-sm"
          style={{ animation: 'posFadeIn 420ms ease both', animationDelay: '120ms' }}
        >
          <div className="flex items-center gap-2.5 mb-7">
            <div className="w-6 h-6 bg-[#1d222a] border border-[#2b313a] rounded-lg flex items-center justify-center">
              <History size={12} className="text-gray-500" />
            </div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
              Version History
            </p>
          </div>

          <div className="space-y-8">
            {CHANGELOG.map((release) => (
              <div key={release.version} className="relative pl-6 border-l border-[#2b313a]">
                <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-[#171c23]" />
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="text-base font-bold text-white tracking-tight">
                    v{release.version}
                  </span>
                  {release.current && (
                    <span className="px-1.5 py-0.5 bg-[#1d222a] border border-[#2b313a] text-gray-400 text-[9px] font-bold rounded uppercase tracking-widest">
                      Current
                    </span>
                  )}
                  <span className="text-[11px] text-gray-600 font-semibold">{release.date}</span>
                </div>
                <ul className="space-y-2">
                  {release.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Zap size={11} className="text-gray-600 flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-gray-500 font-semibold leading-relaxed">{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
