import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TopBar } from '../components/TopBar';
import { Modal } from '../components/Modal';
import {
  RotateCcw,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ReceiptText,
  RefreshCw,
} from 'lucide-react';
import { searchReturnableInvoices, processInvoiceReturn, type ReturnInvoice } from '../services/returnsService';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export const ReturnsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [invoices, setInvoices] = useState<ReturnInvoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [reason, setReason] = useState('Customer returned items');
  const [adjustedBy, setAdjustedBy] = useState('returns_ui');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const rows = await searchReturnableInvoices(search);
      setInvoices(rows);

      if (rows.length > 0) {
        setSelectedInvoiceId((prev) => {
          if (prev && rows.some((row) => row.id === prev)) return prev;
          return rows[0].id;
        });
      } else {
        setSelectedInvoiceId('');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load invoices.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadInvoices();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loadInvoices]);

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null,
    [invoices, selectedInvoiceId]
  );

  const handleProcessReturn = async () => {
    if (!selectedInvoice) return;

    setProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      await processInvoiceReturn(selectedInvoice.id, reason, adjustedBy);
      setSuccess(`Invoice ${selectedInvoice.invoice_no} returned and stock restored.`);
      setShowConfirm(false);
      await loadInvoices();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process return.';
      setError(message);
      setShowConfirm(false);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="pos-standard-page flex flex-col min-h-screen bg-transparent">
      <TopBar />

      <div className="p-10 pos-page-body">
        <div className="pos-page-header mb-8 flex items-center justify-between" style={{ animation: 'posFadeIn 380ms ease both' }}>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Sales Returns</h1>
            <p className="text-sm font-semibold text-gray-500 mt-1">
              Reverse a paid invoice, restore stock, and adjust ledger entries.
            </p>
          </div>
          <button
            onClick={loadInvoices}
            className="px-4 py-2.5 bg-[#1d222a] rounded-xl border border-[#2b313a] text-xs font-bold text-gray-400 hover:text-white hover:bg-[#2b313a] transition-all flex items-center gap-2"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-red-900/20 border border-red-900/30 rounded-2xl p-4 flex items-start gap-3" style={{ animation: 'posFadeIn 380ms ease' }}>
            <AlertTriangle size={16} className="text-red-400 mt-0.5" />
            <p className="text-sm font-semibold text-red-400">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-900/20 border border-green-900/30 rounded-2xl p-4 flex items-start gap-3" style={{ animation: 'posFadeIn 380ms ease' }}>
            <CheckCircle2 size={16} className="text-green-400 mt-0.5" />
            <p className="text-sm font-semibold text-green-400">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[380px,1fr] gap-6">
          <div className="bg-[#171c23] rounded-[2rem] border border-[#2b313a] shadow-sm p-6 h-[calc(100vh-220px)] flex flex-col" style={{ animation: 'posFadeIn 400ms ease both', animationDelay: '100ms' }}>
            <div className="relative mb-5">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice number"
                className="w-full bg-[#1d222a] border border-[#2b313a] focus:border-primary/50 rounded-xl py-3 pl-10 pr-4 text-sm font-semibold outline-none transition-all text-white placeholder-gray-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-24 rounded-2xl skeleton" style={{ animationDelay: `${i * 60}ms` }}></div>
                  ))}
                </div>
              ) : invoices.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-500" style={{ animation: 'posFadeIn 380ms ease' }}>
                  <ReceiptText size={36} strokeWidth={1.75} />
                  <p className="text-xs font-bold">No matching paid invoices</p>
                </div>
              ) : (
                invoices.map((invoice, idx) => (
                  <button
                    key={invoice.id}
                    onClick={() => setSelectedInvoiceId(invoice.id)}
                    className={cn(
                      'w-full text-left rounded-2xl p-4 border transition-all',
                      selectedInvoiceId === invoice.id
                        ? 'border-primary bg-primary'
                        : 'border-[#2b313a] bg-[#1d222a] hover:border-primary/50'
                    )}
                    style={{ animation: 'posFadeIn 400ms ease both', animationDelay: `${idx * 40}ms` }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className={cn('text-sm font-bold truncate', selectedInvoiceId === invoice.id ? 'text-black' : 'text-white')}>
                        {invoice.invoice_no}
                      </p>
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                        invoice.is_returned
                          ? 'bg-red-900/30 text-red-400'
                          : selectedInvoiceId === invoice.id 
                            ? 'bg-green-500/20 text-green-700'
                            : 'bg-green-900/30 text-green-400'
                      )}>
                        {invoice.is_returned ? 'Returned' : 'Returnable'}
                      </span>
                    </div>
                    <p className={cn('text-xs font-semibold mt-1 truncate', selectedInvoiceId === invoice.id ? 'text-slate-600' : 'text-gray-500')}>
                      {invoice.customer_name}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <p className={cn('text-[11px] font-bold', selectedInvoiceId === invoice.id ? 'text-slate-500' : 'text-gray-500')}>
                        {new Date(invoice.created_at).toLocaleString()}
                      </p>
                      <p className={cn('text-sm font-bold', selectedInvoiceId === invoice.id ? 'text-black' : 'text-primary')}>
                        LKR {invoice.total.toFixed(2)}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="bg-[#171c23] rounded-[2rem] border border-[#2b313a] shadow-sm p-8 h-[calc(100vh-220px)] overflow-y-auto custom-scrollbar" style={{ animation: 'posFadeIn 400ms ease both', animationDelay: '200ms' }}>
            {!selectedInvoice ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3" style={{ animation: 'posFadeIn 380ms ease' }}>
                <RotateCcw size={42} strokeWidth={1.75} />
                <p className="text-sm font-bold">Select an invoice to process return</p>
              </div>
            ) : (
              <div className="space-y-8" style={{ animation: 'posFadeIn 300ms ease' }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">{selectedInvoice.invoice_no}</h2>
                    <p className="text-sm font-semibold text-gray-400 mt-1">{selectedInvoice.customer_name}</p>
                    <p className="text-xs font-bold text-gray-500 mt-1">
                      {new Date(selectedInvoice.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider',
                    selectedInvoice.is_returned
                      ? 'bg-red-900/30 text-red-400'
                      : 'bg-green-900/30 text-green-400'
                  )}>
                    {selectedInvoice.is_returned ? 'Already Returned' : 'Ready To Return'}
                  </div>
                </div>

                <div className="bg-[#1d222a] rounded-2xl border border-[#2b313a] overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#2b313a]">
                        <th className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest p-4">Product</th>
                        <th className="text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest p-4">Qty</th>
                        <th className="text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest p-4">Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.items.map((item) => (
                        <tr key={item.id} className="border-b last:border-b-0 border-[#2b313a]">
                          <td className="p-4">
                            <p className="text-sm font-bold text-white">{item.product_name}</p>
                            <p className="text-[11px] font-semibold text-gray-500 mt-1">{item.item_code}</p>
                          </td>
                          <td className="p-4 text-right text-xs font-bold text-white">
                            {item.cartons} CTN, {item.pieces} PCS
                          </td>
                          <td className="p-4 text-right text-sm font-bold text-primary">
                            LKR {item.total.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-[#1d222a] border border-[#2b313a] rounded-2xl p-5">
                  <div className="flex justify-between items-center text-sm font-bold text-gray-400">
                    <span>Invoice Total</span>
                    <span className="text-primary">LKR {selectedInvoice.total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Return Reason</label>
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full bg-[#1d222a] border border-[#2b313a] focus:border-primary/50 rounded-xl py-3 px-4 text-sm font-semibold outline-none transition-all text-white placeholder-gray-500"
                      placeholder="e.g. Damaged item"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Adjusted By</label>
                    <input
                      value={adjustedBy}
                      onChange={(e) => setAdjustedBy(e.target.value)}
                      className="w-full bg-[#1d222a] border border-[#2b313a] focus:border-primary/50 rounded-xl py-3 px-4 text-sm font-semibold outline-none transition-all text-white placeholder-gray-500"
                      placeholder="staff username"
                    />
                  </div>
                </div>

                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={processing || selectedInvoice.is_returned}
                  className={cn(
                    'w-full py-4 rounded-2xl font-bold text-sm tracking-widest transition-all',
                    processing || selectedInvoice.is_returned
                      ? 'bg-[#1d222a] text-gray-500 cursor-not-allowed border border-[#2b313a]'
                      : 'bg-primary text-black hover:bg-white/90 border border-primary/20'
                  )}
                >
                  {selectedInvoice.is_returned ? 'ALREADY RETURNED' : 'PROCESS RETURN'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Confirm Return"
      >
        <div className="space-y-6">
          <p className="text-sm font-semibold text-gray-400">
            This will restock all items from the selected invoice and add a ledger reversal entry.
          </p>
          <p className="text-sm font-bold text-white">
            Invoice: {selectedInvoice?.invoice_no ?? '-'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 py-3 rounded-xl bg-[#1d222a] border border-[#2b313a] text-sm font-bold text-gray-400 hover:text-white hover:bg-[#252a33] transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleProcessReturn}
              disabled={processing}
              className={cn(
                'flex-1 h-[48px] rounded-xl text-sm font-bold transition-all border relative overflow-hidden flex items-center justify-center',
                processing
                  ? 'bg-[#1d222a] text-gray-500 border-[#2b313a] cursor-not-allowed'
                  : 'bg-[#f8fafc] text-black border-[#f8fafc] hover:bg-white'
              )}
            >
              <AnimatePresence mode="wait">
                {processing ? (
                  <motion.div key="spinner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute">
                    <Loader2 size={18} className="animate-spin" />
                  </motion.div>
                ) : (
                  <motion.div key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute">
                    Confirm Return
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
