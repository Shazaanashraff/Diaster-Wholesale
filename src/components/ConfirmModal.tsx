import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  error?: string | null;
  confirmDisabled?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
  error = null
  ,
  confirmDisabled = false
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-[6px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
            className="relative w-full max-w-sm bg-[#171c23] rounded-[2rem] shadow-2xl border border-[#2b313a] overflow-hidden"
          >
            <div className="p-6 text-center">
              <div className={cn(
                "w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4",
                variant === 'danger' ? "bg-red-500/10 text-red-500" :
                variant === 'warning' ? "bg-amber-500/10 text-amber-500" :
                "bg-primary/10 text-primary"
              )}>
                <AlertTriangle size={32} />
              </div>
              
              <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
              <div className="text-sm text-gray-400 leading-relaxed">
                {message}
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-xs text-red-400 text-left">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-[#1d222a] border border-[#2b313a] text-gray-400 rounded-2xl text-xs font-bold hover:text-white hover:bg-[#2b313a] transition-all active:scale-95"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading || confirmDisabled}
                className={cn(
                  "flex-1 py-3 rounded-2xl text-xs font-bold transition-all active:scale-95 shadow-lg",
                  variant === 'danger' ? "bg-red-600 hover:bg-red-700 text-white shadow-red-900/20" :
                  variant === 'warning' ? "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-900/20" :
                  "bg-[#f8fafc] hover:bg-white text-black shadow-white/10"
                )}
              >
                {isLoading ? <Loader2 size={16} className="animate-spin mx-auto" /> : confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
