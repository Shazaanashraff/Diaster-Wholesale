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
    <div className="flex flex-col min-h-screen bg-accent">
      <TopBar />

      <div className="p-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-dark tracking-tight">Sales Returns</h1>
            <p className="text-sm font-semibold text-gray-400 mt-1">
              Reverse a paid invoice, restore stock, and adjust ledger entries.
            </p>
          </div>
          <button
            onClick={loadInvoices}
            className="px-4 py-2.5 bg-white rounded-xl border border-border/50 text-xs font-bold text-gray-500 hover:text-dark hover:border-primary/20 transition-all flex items-center gap-2"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-red-500 mt-0.5" />
            <p className="text-sm font-semibold text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3">
            <CheckCircle2 size={16} className="text-green-500 mt-0.5" />
            <p className="text-sm font-semibold text-green-600">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[380px,1fr] gap-6">
          <div className="bg-white rounded-[2rem] border border-border/50 shadow-sm p-6 h-[calc(100vh-220px)] flex flex-col">
            <div className="relative mb-5">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice number"
                className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-xl py-3 pl-10 pr-4 text-sm font-semibold outline-none transition-all"
              />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-300">
                  <Loader2 size={26} className="animate-spin" />
                  <p className="text-xs font-bold">Loading invoices…</p>
                </div>
              ) : invoices.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-300">
                  <ReceiptText size={36} strokeWidth={1.75} />
                  <p className="text-xs font-bold">No matching paid invoices</p>
                </div>
              ) : (
                invoices.map((invoice) => (
                  <button
                    key={invoice.id}
                    onClick={() => setSelectedInvoiceId(invoice.id)}
                    className={cn(
                      'w-full text-left rounded-2xl p-4 border transition-all',
                      selectedInvoiceId === invoice.id
                        ? 'border-primary bg-violet-50/60'
                        : 'border-border/60 bg-white hover:border-primary/20'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-dark truncate">{invoice.invoice_no}</p>
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                        invoice.is_returned
                          ? 'bg-red-100 text-red-600'
                          : 'bg-green-100 text-green-600'
                      )}>
                        {invoice.is_returned ? 'Returned' : 'Returnable'}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-gray-400 mt-1 truncate">{invoice.customer_name}</p>
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-[11px] font-bold text-gray-400">
                        {new Date(invoice.created_at).toLocaleString()}
                      </p>
                      <p className="text-sm font-bold text-primary">LKR {invoice.total.toFixed(2)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-border/50 shadow-sm p-8 h-[calc(100vh-220px)] overflow-y-auto custom-scrollbar">
            {!selectedInvoice ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-3">
                <RotateCcw size={42} strokeWidth={1.75} />
                <p className="text-sm font-bold">Select an invoice to process return</p>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-dark tracking-tight">{selectedInvoice.invoice_no}</h2>
                    <p className="text-sm font-semibold text-gray-400 mt-1">{selectedInvoice.customer_name}</p>
                    <p className="text-xs font-bold text-gray-400 mt-1">
                      {new Date(selectedInvoice.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider',
                    selectedInvoice.is_returned
                      ? 'bg-red-100 text-red-600'
                      : 'bg-green-100 text-green-600'
                  )}>
                    {selectedInvoice.is_returned ? 'Already Returned' : 'Ready To Return'}
                  </div>
                </div>

                <div className="bg-accent/50 rounded-2xl border border-border/50 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest p-4">Product</th>
                        <th className="text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest p-4">Qty</th>
                        <th className="text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest p-4">Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.items.map((item) => (
                        <tr key={item.id} className="border-b last:border-b-0 border-border/40">
                          <td className="p-4">
                            <p className="text-sm font-bold text-dark">{item.product_name}</p>
                            <p className="text-[11px] font-semibold text-gray-400 mt-1">{item.item_code}</p>
                          </td>
                          <td className="p-4 text-right text-xs font-bold text-dark">
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

                <div className="bg-white border border-border/50 rounded-2xl p-5">
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
                      className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-xl py-3 px-4 text-sm font-semibold outline-none transition-all"
                      placeholder="e.g. Damaged item"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Adjusted By</label>
                    <input
                      value={adjustedBy}
                      onChange={(e) => setAdjustedBy(e.target.value)}
                      className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-xl py-3 px-4 text-sm font-semibold outline-none transition-all"
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
                      ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      : 'bg-primary text-white shadow-xl shadow-violet-100 hover:bg-violet-600'
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
          <p className="text-sm font-semibold text-gray-500">
            This will restock all items from the selected invoice and add a ledger reversal entry.
          </p>
          <p className="text-sm font-bold text-dark">
            Invoice: {selectedInvoice?.invoice_no ?? '-'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 py-3 rounded-xl bg-accent text-sm font-bold text-dark hover:bg-gray-100 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleProcessReturn}
              disabled={processing}
              className={cn(
                'flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all',
                processing ? 'bg-violet-300 cursor-not-allowed' : 'bg-primary hover:bg-violet-600'
              )}
            >
              {processing ? 'PROCESSING...' : 'Confirm Return'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
