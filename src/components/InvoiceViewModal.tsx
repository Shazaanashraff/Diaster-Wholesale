import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { POSSaleReceipt, splitInvoiceLinesForReceipt, exchangeForFromNotes, type SaleReceiptData } from './POSSaleReceipt';

interface Props {
  invoiceId: string;
  onClose: () => void;
}

/** Loads a billed invoice by id and shows its receipt, ready to reprint. */
export const InvoiceViewModal: React.FC<Props> = ({ invoiceId, onClose }) => {
  const [data, setData] = useState<SaleReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [invRes, itemsRes, payRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('id, invoice_no, subtotal, discount, total, mode, notes, created_at, salesperson_name, salesperson:salespeople(name), customers(name)')
          .eq('id', invoiceId)
          .single(),
        supabase
          .from('invoice_items')
          .select('cartons, pieces, unit_price, total, batch_id, products(id, name, item_code, pieces_per_carton, wholesale_price, retail_price, cost_price, model, category, created_at, updated_at)')
          .eq('invoice_id', invoiceId),
        supabase
          .from('payments')
          .select('method, amount')
          .eq('invoice_id', invoiceId)
          .gt('amount', 0),
      ]);
      if (cancelled) return;
      if (invRes.error || !invRes.data) {
        setError(invRes.error?.message ?? 'Invoice not found');
        return;
      }
      const inv = invRes.data as any;
      const { cartSnapshot, returnedItems } = splitInvoiceLinesForReceipt((itemsRes.data ?? []) as any[]);
      setData({
        invoiceNo: inv.invoice_no,
        cartSnapshot,
        exchangeFor: exchangeForFromNotes(inv.notes),
        returnedItems,
        customerName: inv.customers?.name ?? 'Walk-in',
        salespersonName: inv.salesperson?.name ?? inv.salesperson_name ?? '—',
        paymentSplits: ((payRes.data ?? []) as any[]).map(p => ({ method: p.method, amount: Number(p.amount) })),
        subtotal: Number(inv.subtotal),
        discount: Number(inv.discount),
        redeemedPoints: 0,
        total: Number(inv.total),
        isWholesale: inv.mode === 'wholesale',
        earnedPoints: 0,
        timestamp: new Date(inv.created_at),
      });
    })();
    return () => { cancelled = true; };
  }, [invoiceId]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative">
        <button
          onClick={onClose}
          className="absolute -top-8 right-0 flex items-center gap-1 text-gray-400 hover:text-white text-xs transition-colors"
        >
          <X size={12} /> Close Preview
        </button>
        {data ? (
          <POSSaleReceipt data={data} onClose={onClose} />
        ) : error ? (
          <div className="bg-[#171c23] border border-red-500/30 rounded-2xl p-6 text-sm text-red-400">{error}</div>
        ) : (
          <div className="bg-[#171c23] rounded-2xl p-10 text-gray-400"><Loader2 className="animate-spin" size={20} /></div>
        )}
      </div>
    </div>
  );
};
