import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, RefreshCw, X, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';

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
  const [version, setVersion] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // @ts-ignore
    if (!window.desktop?.updater) return;

    // @ts-ignore
    const cleanup = window.desktop.updater.onStatus((payload: UpdaterPayload) => {
      console.log('Updater Status:', payload);
      setStatus(payload.status);
      
      if (payload.status === 'download-progress' && payload.percent !== undefined) {
        setPercent(payload.percent);
        setIsVisible(true);
      }

      if (payload.status === 'update-available') {
        setVersion(payload.version || '');
        setIsVisible(true);
      }

      if (payload.status === 'update-downloaded') {
        setPercent(100);
        setIsVisible(true);
      }

      if (payload.status === 'error') {
        setError(payload.message || 'An error occurred during update.');
        setIsVisible(true);
        setTimeout(() => setIsVisible(false), 5000);
      }
    });

    return cleanup;
  }, []);

  const handleRestart = () => {
    // @ts-ignore
    window.desktop.updater.installNow();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className={cn(
            "w-full overflow-hidden border-b transition-colors duration-500",
            status === 'error' ? "bg-red-50 border-red-100" : "bg-violet-600 border-violet-500"
          )}
        >
          <div className="px-10 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                status === 'error' ? "bg-red-100 text-red-600" : "bg-white/20 text-white"
              )}>
                {status === 'download-progress' && <Download size={16} className="animate-bounce" />}
                {status === 'update-downloaded' && <CheckCircle size={16} />}
                {status === 'error' && <AlertCircle size={16} />}
                {status === 'update-available' && <RefreshCw size={16} className="animate-spin" />}
              </div>
              
              <div className="flex flex-col">
                <p className={cn(
                  "text-[13px] font-bold",
                  status === 'error' ? "text-red-800" : "text-white"
                )}>
                  {status === 'download-progress' && `Downloading update... ${percent}%`}
                  {status === 'update-available' && `New version ${version} available. Starting download...`}
                  {status === 'update-downloaded' && `Version ${version} ready to install`}
                  {status === 'error' && `Update Error: ${error}`}
                </p>
                {status === 'download-progress' && (
                  <div className="w-48 h-1 bg-white/20 rounded-full mt-1.5 overflow-hidden">
                    <motion.div 
                      className="h-full bg-white"
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {status === 'update-downloaded' && (
                <button
                  onClick={handleRestart}
                  className="px-4 py-1.5 bg-white text-violet-600 rounded-lg text-[11px] font-bold hover:bg-violet-50 transition-colors uppercase tracking-widest shadow-lg shadow-black/10"
                >
                  Restart & Install
                </button>
              )}
              <button 
                onClick={() => setIsVisible(false)}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  status === 'error' ? "hover:bg-red-200 text-red-400" : "hover:bg-white/10 text-white/60"
                )}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
