import React from 'react';
import { TopBar } from '../components/TopBar';
import {
  RefreshCw, AlertCircle, CheckCircle, Download, Package,
  History, Zap, Shield, BarChart2, Users, ShoppingCart, Star,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { version as currentVersion } from '../../package.json';
import { useUpdater } from '../hooks/useUpdater';

type ChangelogEntry = {
  version: string;
  date: string;
  tag?: 'latest' | 'new';
  highlights: { icon: React.ElementType; text: string }[];
};

const CHANGELOG: ChangelogEntry[] = [
  {
    version: currentVersion,
    date: 'May 2026',
    tag: 'latest',
    highlights: [
      { icon: Shield,     text: 'Resolved updater bridge race condition for reliable startup' },
      { icon: Star,       text: 'Dashboard update strip now shows live download progress and restart action' },
      { icon: Download,   text: 'Updates page now shows top status strip with download percentage' },
    ],
  },
  {
    version: '0.1.4',
    date: 'May 2026',
    highlights: [
      { icon: BarChart2,  text: 'Extended financial reporting suite with export support' },
      { icon: Users,      text: 'Customer ledger improvements and payment history view' },
      { icon: Zap,        text: 'Stability fixes and minor UI tweaks' },
    ],
  },
  {
    version: '0.1.3',
    date: 'Apr 2026',
    highlights: [
      { icon: Shield,     text: 'Auto-updater CI environment variable fixes for signed releases' },
      { icon: Zap,        text: 'Resolved GitHub Actions workflow token scoping issue' },
    ],
  },
  {
    version: '0.1.2',
    date: 'Apr 2026',
    highlights: [
      { icon: Download,   text: 'Fixed update download and install flow on first launch' },
      { icon: Zap,        text: 'Improved update error messaging and retry logic' },
    ],
  },
  {
    version: '0.1.1',
    date: 'Apr 2026',
    highlights: [
      { icon: Download,   text: 'Introduced auto-update system with background download and banner notifications' },
      { icon: Users,      text: 'Customer detail page with full ledger and payment recording' },
      { icon: ShoppingCart, text: 'Purchase detail page with status management and receiving workflow' },
      { icon: BarChart2,  text: 'Financial reporting pages — Sales, Profit/Loss, Stock, and more' },
    ],
  },
  {
    version: '0.1.0',
    date: 'Mar 2026',
    highlights: [
      { icon: Star,       text: 'Initial release of Diaster Wholesale ERP' },
      { icon: ShoppingCart, text: 'POS system with cart management and inventory validation' },
      { icon: Package,    text: 'Inventory tracking with bulk import support' },
      { icon: Users,      text: 'Customer management module' },
      { icon: BarChart2,  text: 'Procurement module with purchase orders and supplier management' },
      { icon: Shield,     text: 'Role-based access control — Admin, Accountant, Officer, POS Operator' },
    ],
  },
];

export const UpdatesPage: React.FC = () => {
  const {
    status,
    percent,
    version: newVersion,
    message: error,
    lastCheckedAt,
    isDesktop,
    hasUpdaterBridge,
    checkNow,
  } = useUpdater();

  const lastChecked = lastCheckedAt ? new Date(lastCheckedAt) : null;
  const handleCheckUpdates = () => checkNow();

  const statusConfig = {
    checking: {
      icon: <RefreshCw size={15} className="text-gray-400 animate-spin" />,
      label: 'Checking for updates…',
      sub: null,
      accent: 'border-[#2b313a]',
    },
    'update-not-available': {
      icon: <CheckCircle size={15} className="text-emerald-400" />,
      label: "You're on the latest version",
      sub: null,
      accent: 'border-emerald-500/20',
    },
    'update-available': {
      icon: <RefreshCw size={15} className="text-blue-400 animate-spin" />,
      label: `New version available${newVersion ? ` — v${newVersion}` : ''}`,
      sub: 'Downloading in the background…',
      accent: 'border-blue-500/20',
    },
    'update-downloaded': {
      icon: <CheckCircle size={15} className="text-emerald-400" />,
      label: newVersion ? `v${newVersion} is ready to install` : 'Update ready to install',
      sub: 'The app will restart to complete installation.',
      accent: 'border-emerald-500/20',
    },
    'download-progress': {
      icon: <Download size={15} className="text-blue-400" />,
      label: `Downloading${newVersion ? ` v${newVersion}` : ' update'}`,
      sub: `${Math.round(percent)}% complete`,
      accent: 'border-blue-500/20',
    },
    error: {
      icon: <AlertCircle size={15} className="text-red-400" />,
      label: 'Update check failed',
      sub: error,
      accent: 'border-red-500/20',
    },
    skipped: {
      icon: <AlertCircle size={15} className="text-amber-400" />,
      label: 'Updater is unavailable',
      sub: error,
      accent: 'border-amber-500/20',
    },
    idle: null,
  } as const;

  const activeStatus = statusConfig[status];

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

        {status !== 'idle' && activeStatus && (
          <div
            className={`mb-5 rounded-xl border ${activeStatus.accent} bg-[#171c23] px-4 py-3`}
            style={{ animation: 'posFadeIn 360ms ease both' }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 flex-shrink-0">{activeStatus.icon}</div>
                <div className="min-w-0">
                  <p className="text-sm text-white font-bold">{activeStatus.label}</p>
                  {activeStatus.sub && <p className="text-xs text-gray-300 mt-0.5">{activeStatus.sub}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {(status === 'update-not-available' || status === 'error' || status === 'skipped') && (
                  <button
                    onClick={handleCheckUpdates}
                    className="px-3 py-1.5 bg-[#252a30] border border-[#2b313a] text-gray-300 rounded-lg text-xs font-semibold"
                  >
                    {status === 'error' ? 'Try again' : 'Check again'}
                  </button>
                )}
              </div>
            </div>
            {(status === 'download-progress' || status === 'update-downloaded') && (
              <div className="mt-3 w-full h-1.5 bg-[#252a30] rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-white"
                  initial={{ width: 0 }}
                  animate={{ width: `${percent}%` }}
                  transition={{ ease: 'easeOut', duration: 0.3 }}
                />
              </div>
            )}
          </div>
        )}

        {/* Version card */}
        <div
          className="bg-[#171c23] rounded-[2.5rem] border border-[#2b313a] overflow-hidden mb-5 shadow-sm"
          style={{ animation: 'posFadeIn 400ms ease both', animationDelay: '60ms' }}
        >
          {/* Subtle top accent stripe */}
          <div className="h-[2px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <div className="p-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#1d222a] rounded-2xl border border-[#2b313a] flex items-center justify-center">
                  <Package size={20} className="text-gray-300" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                    Diaster Wholesale
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xl font-bold text-white">v{currentVersion}</span>
                    <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-lg uppercase tracking-wide">
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

              {isDesktop ? (
                <button
                  onClick={handleCheckUpdates}
                  disabled={!hasUpdaterBridge || status === 'checking' || status === 'download-progress'}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                  style={{ backgroundColor: '#f8fafc', color: '#111315', borderColor: '#f8fafc' }}
                >
                  <RefreshCw size={14} className={status === 'checking' ? 'animate-spin' : ''} />
                  {!hasUpdaterBridge ? 'Updater unavailable' : status === 'checking' ? 'Checking…' : 'Check for Updates'}
                </button>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-[#1d222a] border border-[#2b313a] text-gray-500 rounded-xl text-xs font-semibold">
                  <AlertCircle size={13} />
                  Desktop app only
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status panel */}
        <AnimatePresence mode="wait">
          {status !== 'idle' && activeStatus && (
            <motion.div
              key={status}
              initial={{ opacity: 0, y: -8, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className={`bg-[#171c23] rounded-[2.5rem] border ${activeStatus.accent} p-8 mb-5 shadow-sm`}
            >
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-4">
                Update Status
              </p>

              <div className="bg-[#1d222a] rounded-xl border border-[#2b313a] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="mt-0.5 flex-shrink-0">{activeStatus.icon}</div>
                    <div className="min-w-0">
                      <p className="text-sm text-white font-bold">{activeStatus.label}</p>
                      {activeStatus.sub && (
                        <p className="text-xs text-gray-300 mt-0.5">{activeStatus.sub}</p>
                      )}
                    </div>
                  </div>

                  {(status === 'update-not-available' || status === 'error' || status === 'skipped') && (
                    <button
                      onClick={handleCheckUpdates}
                      className="px-3 py-1.5 bg-[#252a30] border border-[#2b313a] text-gray-400 rounded-lg text-xs font-bold flex-shrink-0"
                    >
                      {status === 'error' ? 'Try again' : 'Check again'}
                    </button>
                  )}
                </div>

                {(status === 'download-progress' || status === 'update-downloaded') && (
                  <div className="mt-3 w-full h-1.5 bg-[#252a30] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-white"
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ ease: 'easeOut', duration: 0.3 }}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Version history */}
        <div
          className="bg-[#171c23] rounded-[2.5rem] border border-[#2b313a] p-8 shadow-sm"
          style={{ animation: 'posFadeIn 420ms ease both', animationDelay: '120ms' }}
        >
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-6 h-6 bg-[#1d222a] border border-[#2b313a] rounded-lg flex items-center justify-center">
              <History size={12} className="text-gray-500" />
            </div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
              Version History
            </p>
          </div>

          <div className="space-y-8">
            {CHANGELOG.map((release, idx) => (
              <motion.div
                key={release.version}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.22 }}
                className="relative pl-6 border-l border-[#2b313a]"
              >
                {/* Timeline dot */}
                <div
                  className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-[#171c23] ${
                    release.tag === 'latest' ? 'bg-emerald-400' : 'bg-[#3a4049]'
                  }`}
                />

                <div className="flex items-center gap-2.5 mb-3 flex-wrap">
                  <span className="text-base font-bold text-white tracking-tight">
                    v{release.version}
                  </span>
                  {release.tag === 'latest' && (
                    <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold rounded uppercase tracking-widest">
                      Latest
                    </span>
                  )}
                  <span className="text-[11px] text-gray-600 font-semibold">{release.date}</span>
                </div>

                <ul className="space-y-2">
                  {release.highlights.map(({ icon: Icon, text }, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Icon size={11} className="text-gray-600 flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-gray-500 font-semibold leading-relaxed">{text}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
