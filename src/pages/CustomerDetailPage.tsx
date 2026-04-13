import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { ArrowLeft, Wallet, CreditCard, PieChart, CheckCircle2, ChevronDown, ClipboardList, Receipt } from 'lucide-react';
import { cn } from '../lib/utils';
import { Modal } from '../components/Modal';
import { getCustomerById, getCustomerLedger, recordPayment } from '../services/customerService';
import { getRemainingCredit } from '../utils/creditCheck';
import type { Customer, Invoice, Payment } from '../types';

export const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>('' as any);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState('');
  const [paymentError, setPaymentError] = useState('');

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [custData, ledgerData] = await Promise.all([
        getCustomerById(id),
        getCustomerLedger(id)
      ]);
      setCustomer(custData);
      setInvoices(ledgerData.invoices);
      setPayments(ledgerData.payments);
    } catch (err) {
      console.error('Failed to load customer details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleRecordPayment = async () => {
    if (!id) return;
    if (!paymentAmount || paymentAmount < 1) {
      setPaymentError('Amount must be at least 1');
      return;
    }

    try {
      setPaymentLoading(true);
      setPaymentError('');
      
      const invId = selectedInvoiceId === 'general' || !selectedInvoiceId ? null : selectedInvoiceId;
      await recordPayment(id, invId, Number(paymentAmount));
      
      setPaymentSuccess('Payment recorded successfully!');
      setPaymentAmount('' as any);
      setSelectedInvoiceId('');
      
      // Reload everything to get updated balances and ledger
      await loadData();
      
      setTimeout(() => {
        setPaymentSuccess('');
        setIsPaymentModalOpen(false);
      }, 2000);
      
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to record payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  const openPaymentModal = () => {
    setPaymentSuccess('');
    setPaymentError('');
    setPaymentAmount('' as any);
    setSelectedInvoiceId('general');
    setIsPaymentModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-accent">
        <TopBar />
        <div className="flex justify-center items-center flex-1">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col min-h-screen bg-accent">
        <TopBar />
        <div className="p-10 text-center text-gray-500 font-bold">Customer not found</div>
      </div>
    );
  }

  const remainingCredit = getRemainingCredit(customer);
  const unpaidInvoices = invoices.filter(i => i.payment_status !== 'paid' && i.status !== 'cancelled');

  return (
    <div className="flex flex-col min-h-screen bg-accent">
      <TopBar />
      
      <div className="p-10 max-w-7xl mx-auto w-full">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/customers')}
              className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-gray-400 hover:text-dark hover:shadow-md transition-all"
            >
              <ArrowLeft size={20} strokeWidth={2.5} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-dark tracking-tight">{customer.name}</h1>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border-2",
                  customer.type === 'Wholesale' ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-amber-50 text-amber-600 border-amber-100"
                )}>
                  {customer.type}
                </span>
              </div>
              <p className="text-gray-400 text-sm font-semibold mt-1">Customer Ledger & History</p>
            </div>
          </div>
          <button 
            onClick={openPaymentModal}
            className="flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-3xl font-bold text-sm shadow-xl shadow-orange-100 hover:bg-orange-600 transition-all active:scale-[0.98]"
          >
            <Wallet size={20} strokeWidth={2.5} /> RECORD PAYMENT
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-border/50 flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center">
              <PieChart size={24} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-1">Outstanding Balance</p>
              <p className={cn("text-2xl font-bold tracking-tighter", (customer.outstanding_balance || 0) > 0 ? "text-red-500" : "text-dark")}>
                Rs. {(customer.outstanding_balance || 0).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-border/50 flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center">
              <CreditCard size={24} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-1">Credit Limit</p>
              <p className="text-2xl font-bold tracking-tighter text-dark">
                {(customer.credit_limit || 0) > 0 ? `Rs. ${(customer.credit_limit || 0).toLocaleString()}` : 'No Limit'}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-border/50 flex items-center gap-6">
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", 
              remainingCredit === Infinity ? "bg-gray-50 text-gray-400" :
              remainingCredit > 0 ? "bg-green-50 text-green-500" : "bg-red-50 text-red-500"
            )}>
              <Wallet size={24} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-1">Remaining Credit</p>
              <p className={cn("text-2xl font-bold tracking-tighter", 
                remainingCredit === Infinity ? "text-dark" :
                remainingCredit > 0 ? "text-green-500" : "text-red-500"
              )}>
                {remainingCredit === Infinity ? 'Unlimited' : `Rs. ${remainingCredit.toLocaleString()}`}
              </p>
            </div>
          </div>
        </div>

        {/* Ledger Tables */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
          
          {/* Invoices */}
          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-border/50">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-orange-50 text-primary rounded-xl flex items-center justify-center">
                <Receipt size={24} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl font-bold text-dark">Invoices</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-border/50">
                    <th className="pb-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">No.</th>
                    <th className="pb-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Date</th>
                    <th className="pb-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-right">Total</th>
                    <th className="pb-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-sm text-gray-400 font-semibold">No invoices found</td>
                    </tr>
                  ) : (
                    invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-border/50 hover:bg-slate-50 transition-colors">
                        <td className="py-4 text-sm font-bold text-dark">{inv.invoice_number}</td>
                        <td className="py-4 text-sm font-semibold text-gray-500">
                          {new Date(inv.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-4 text-sm font-bold text-dark text-right">
                          Rs. {(inv.total || 0).toLocaleString()}
                        </td>
                        <td className="py-4 text-center">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                            inv.payment_status === 'paid' ? "bg-green-50 text-green-600" :
                            inv.payment_status === 'partial' ? "bg-amber-50 text-amber-600" :
                            "bg-red-50 text-red-600"
                          )}>
                            {inv.payment_status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payments */}
          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-border/50">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-green-50 text-green-500 rounded-xl flex items-center justify-center">
                <ClipboardList size={24} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl font-bold text-dark">Payment History</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-border/50">
                    <th className="pb-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Date</th>
                    <th className="pb-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Linked To</th>
                    <th className="pb-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-sm text-gray-400 font-semibold">No payments found</td>
                    </tr>
                  ) : (
                    payments.map((pay) => {
                      const linkedInv = pay.invoice_id ? invoices.find(i => i.id === pay.invoice_id) : null;
                      return (
                        <tr key={pay.id} className="border-b border-border/50 hover:bg-slate-50 transition-colors">
                          <td className="py-4 text-sm font-semibold text-gray-500">
                            {new Date(pay.paid_at).toLocaleDateString()}
                          </td>
                          <td className="py-4">
                            <span className="text-sm font-bold text-dark">
                              {linkedInv ? linkedInv.invoice_number : 'General'}
                            </span>
                          </td>
                          <td className="py-4 text-sm font-bold text-green-600 text-right">
                            + Rs. {(pay.amount || 0).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* RECORD PAYMENT MODAL */}
      <Modal 
        isOpen={isPaymentModalOpen}
        onClose={() => !paymentSuccess && setIsPaymentModalOpen(false)}
        title="Record Payment"
      >
        <div className="space-y-6">
          {paymentSuccess ? (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 size={40} strokeWidth={2.5} />
              </div>
              <h3 className="text-2xl font-bold text-dark mb-2">Payment Recorded!</h3>
              <p className="text-sm font-semibold text-gray-500">The ledger has been updated successfully.</p>
            </div>
          ) : (
            <>
              {paymentError && (
                <div className="p-3 bg-red-50 text-red-500 text-sm font-bold rounded-xl">
                  {paymentError}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                  Amount (Rs.) <span className="text-red-400">*</span>
                </label>
                <input 
                  type="number" 
                  min="1"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value ? Number(e.target.value) : ('' as any))}
                  placeholder="e.g. 5000" 
                  className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-xl font-bold outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                  Link to Invoice
                </label>
                <div className="relative">
                  <select 
                    value={selectedInvoiceId}
                    onChange={(e) => setSelectedInvoiceId(e.target.value)}
                    className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all appearance-none pr-12"
                  >
                    <option value="general">General Payment (No Invoice)</option>
                    {unpaidInvoices.map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} — Rs. {(inv.total || 0).toLocaleString()} ({inv.payment_status})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                </div>
              </div>

              <div className="pt-4 grid grid-cols-2 gap-4">
                <button 
                  disabled={paymentLoading}
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="w-full py-4 rounded-2xl border-2 border-border/50 text-sm font-bold text-gray-400 hover:text-dark hover:border-dark/20 transition-all disabled:opacity-50"
                >
                  CANCEL
                </button>
                <button 
                  disabled={paymentLoading}
                  onClick={handleRecordPayment}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-sm shadow-xl shadow-orange-100 hover:bg-orange-600 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                >
                  {paymentLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : 'CONFIRM PAYMENT'}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};
