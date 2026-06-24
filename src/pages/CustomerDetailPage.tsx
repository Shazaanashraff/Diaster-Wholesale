import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import {
  ArrowLeft, Wallet, CreditCard, PieChart, CheckCircle2, ChevronDown,
  ClipboardList, Receipt, Edit, AlertCircle, Loader2, Mail, Phone,
  MapPin, Hash, User, Landmark, FileText, ArrowRightCircle,
  CheckCircle, XCircle, Clock, Building2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Modal } from '../components/Modal';
import {
  getCustomerById, getCustomerLedger, recordPayment, updateCustomer,
  depositCheque, completeCheque, returnCheque,
} from '../services/customerService';
import { getRemainingCredit } from '../utils/creditCheck';
import { SL_BANKS } from '../constants/banks';
import type { Customer, Invoice, Payment } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedNumber } from '../components/AnimatedNumber';

type PayMethod = 'cash' | 'bank_transfer' | 'cheque';
type ChequeTab = 'float' | 'completed' | 'returned';

export const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>('cash');
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentBankName, setPaymentBankName] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDueDate, setChequeDueDate] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('general');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState('');
  const [paymentError, setPaymentError] = useState('');

  // Cheque action loading state — keyed by payment id
  const [chequeActionLoading, setChequeActionLoading] = useState<Record<string, boolean>>({});

  // Cheque section tab
  const [chequeTab, setChequeTab] = useState<ChequeTab>('float');

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '', phone: '', email: '', address: '',
    type: 'retail' as 'wholesale' | 'retail',
    credit_limit: 0,
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [custData, ledgerData] = await Promise.all([
        getCustomerById(id),
        getCustomerLedger(id),
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

  useEffect(() => { loadData(); }, [id]);

  // ── Payment modal helpers ──────────────────────────────────────
  const openPaymentModal = () => {
    setPaymentSuccess('');
    setPaymentError('');
    setPaymentAmount('');
    setPaymentMethod('cash');
    setPaymentBankName('');
    setChequeNumber('');
    setChequeDueDate('');
    setSelectedInvoiceId('general');
    setIsPaymentModalOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!id) return;
    if (!paymentAmount || Number(paymentAmount) < 1) {
      setPaymentError('Amount must be at least 1');
      return;
    }
    if (paymentMethod === 'bank_transfer' && !paymentBankName) {
      setPaymentError('Please select a bank');
      return;
    }
    if (paymentMethod === 'cheque') {
      if (!chequeNumber.trim())  { setPaymentError('Cheque number is required'); return; }
      if (!paymentBankName)      { setPaymentError('Please select a bank'); return; }
      if (!chequeDueDate)        { setPaymentError('Due date is required'); return; }
    }

    try {
      setPaymentLoading(true);
      setPaymentError('');
      const invId = selectedInvoiceId === 'general' ? null : selectedInvoiceId;
      await recordPayment(
        id, invId, Number(paymentAmount),
        paymentMethod,
        paymentBankName || undefined,
        chequeNumber || undefined,
        chequeDueDate || undefined,
      );
      setPaymentSuccess('Payment recorded successfully!');
      setPaymentAmount('');
      await loadData();
      setTimeout(() => { setPaymentSuccess(''); setIsPaymentModalOpen(false); }, 2000);
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to record payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  // ── Cheque lifecycle actions ───────────────────────────────────
  const handleChequeAction = async (
    paymentId: string,
    action: 'deposit' | 'complete' | 'return'
  ) => {
    setChequeActionLoading(prev => ({ ...prev, [paymentId]: true }));
    try {
      if (action === 'deposit')  await depositCheque(paymentId);
      if (action === 'complete') await completeCheque(paymentId);
      if (action === 'return')   await returnCheque(paymentId);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    } finally {
      setChequeActionLoading(prev => ({ ...prev, [paymentId]: false }));
    }
  };

  // ── Edit modal ─────────────────────────────────────────────────
  const openEditModal = () => {
    if (!customer) return;
    setEditFormData({
      name: customer.name, phone: customer.phone || '',
      email: customer.email || '', address: customer.address || '',
      type: customer.type, credit_limit: customer.credit_limit || 0,
    });
    setEditError(''); setEditSuccess('');
    setIsEditModalOpen(true);
  };

  const handleSaveChanges = async () => {
    if (!id || !customer) return;
    if (!editFormData.name.trim()) { setEditError('Name is required'); return; }
    try {
      setEditLoading(true); setEditError('');
      await updateCustomer(id, editFormData);
      setEditSuccess('Customer updated successfully!');
      await loadData();
      setTimeout(() => { setEditSuccess(''); setIsEditModalOpen(false); }, 2000);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update customer');
    } finally {
      setEditLoading(false);
    }
  };

  // ── Derived data ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="pos-standard-page flex flex-col min-h-screen bg-transparent">
        <TopBar />
        <div className="p-4 md:p-10 pos-page-body w-full">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-full skeleton" />
            <div className="w-48 h-10 rounded-xl skeleton" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 rounded-3xl skeleton" style={{ animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
            <div className="h-96 rounded-[2.5rem] skeleton" style={{ animationDelay: '300ms' }} />
            <div className="h-96 rounded-[2.5rem] skeleton" style={{ animationDelay: '400ms' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="pos-standard-page flex flex-col min-h-screen bg-transparent">
        <TopBar />
        <div className="p-10 text-center text-gray-500 font-bold">Customer not found</div>
      </div>
    );
  }

  const remainingCredit  = getRemainingCredit(customer);
  const unpaidInvoices   = invoices.filter(i => i.payment_status !== 'paid');
  const chequeFloat      = customer.cheque_float || 0;

  const pendingCheques    = payments.filter(p => p.method === 'cheque' && p.cheque_status === 'pending');
  const processingCheques = payments.filter(p => p.method === 'cheque' && p.cheque_status === 'processing');
  const completedCheques  = payments.filter(p => p.method === 'cheque' && p.cheque_status === 'completed');
  const returnedCheques   = payments.filter(p => p.method === 'cheque' && p.cheque_status === 'returned');

  const chequeTabCounts: Record<ChequeTab, number> = {
    float:     pendingCheques.length + processingCheques.length,
    completed: completedCheques.length,
    returned:  returnedCheques.length,
  };

  const chequeTabData: Record<ChequeTab, Payment[]> = {
    float:     [...pendingCheques, ...processingCheques],
    completed: completedCheques,
    returned:  returnedCheques,
  };

  const CHEQUE_STATUS_STYLE: Record<string, string> = {
    pending:    'bg-gray-500/10 text-gray-400',
    processing: 'bg-amber-500/10 text-amber-400',
    completed:  'bg-green-500/10 text-green-400',
    returned:   'bg-red-500/10 text-red-400',
  };

  const METHOD_LABEL: Record<string, string> = {
    cash: 'Cash', bank_transfer: 'Bank Transfer', cheque: 'Cheque', credit: 'Credit',
  };

  return (
    <div className="pos-standard-page flex flex-col min-h-screen bg-transparent">
      <TopBar />

      <div className="p-4 md:p-10 pos-page-body w-full">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="pos-page-header flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4" style={{ animation: 'posFadeIn 380ms ease both' }}>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/customers')}
              className="w-12 h-12 bg-[#1d222a] rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#2b313a] border border-[#2b313a] transition-all"
            >
              <ArrowLeft size={20} strokeWidth={2.5} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl md:text-3xl font-bold text-white tracking-tight">{customer.name}</h1>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-transparent",
                  customer.type === 'wholesale'
                    ? "bg-purple-900/30 text-purple-400 border-purple-900/50"
                    : "bg-indigo-900/30 text-indigo-400 border-indigo-900/50"
                )}>
                  {customer.type}
                </span>
              </div>
              <p className="text-gray-500 text-sm font-semibold mt-1">Customer Ledger & History</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={openEditModal}
              className="flex items-center gap-2 px-4 md:px-6 py-3 md:py-4 bg-[#1d222a] text-gray-400 hover:text-white hover:bg-[#2b313a] rounded-2xl md:rounded-3xl font-bold text-sm border border-[#2b313a] transition-all active:scale-[0.98]">
              <Edit size={18} strokeWidth={2.5} /> EDIT
            </button>
            <button onClick={openPaymentModal}
              className="flex items-center gap-3 px-6 md:px-8 py-3 md:py-4 bg-primary text-black rounded-2xl md:rounded-3xl font-bold text-sm hover:bg-white transition-all active:scale-[0.98]">
              <Wallet size={20} strokeWidth={2.5} /> RECORD PAYMENT
            </button>
          </div>
        </div>

        {/* ── Summary cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-10">
          {/* Outstanding Balance */}
          <div className="bg-[#171c23] rounded-3xl p-6 border border-[#2b313a] flex items-center gap-4 md:gap-6" style={{ animation: 'posFadeIn 400ms ease both', animationDelay: '100ms' }}>
            <div className="w-12 h-12 rounded-2xl bg-red-900/20 text-red-400 flex items-center justify-center border border-red-900/30 shrink-0">
              <PieChart size={22} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Outstanding</p>
              <p className={cn("text-xl font-bold tracking-tighter", (customer.outstanding_balance || 0) > 0 ? "text-red-400" : "text-white")}>
                Rs. <AnimatedNumber value={customer.outstanding_balance || 0} />
              </p>
            </div>
          </div>

          {/* Credit Limit */}
          <div className="bg-[#171c23] rounded-3xl p-6 border border-[#2b313a] flex items-center gap-4 md:gap-6" style={{ animation: 'posFadeIn 400ms ease both', animationDelay: '200ms' }}>
            <div className="w-12 h-12 rounded-2xl bg-purple-900/20 text-purple-400 flex items-center justify-center border border-purple-900/30 shrink-0">
              <CreditCard size={22} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Credit Limit</p>
              <p className="text-xl font-bold tracking-tighter text-white">
                {(customer.credit_limit || 0) > 0 ? <>Rs. <AnimatedNumber value={customer.credit_limit || 0} /></> : 'No Limit'}
              </p>
            </div>
          </div>

          {/* Remaining Credit */}
          <div className="bg-[#171c23] rounded-3xl p-6 border border-[#2b313a] flex items-center gap-4 md:gap-6" style={{ animation: 'posFadeIn 400ms ease both', animationDelay: '300ms' }}>
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0",
              remainingCredit === Infinity ? "bg-[#1d222a] text-gray-400 border-[#2b313a]" :
              remainingCredit > 0 ? "bg-green-900/20 text-green-400 border-green-900/30" : "bg-red-900/20 text-red-400 border-red-900/30"
            )}>
              <Wallet size={22} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Remaining Credit</p>
              <p className={cn("text-xl font-bold tracking-tighter",
                remainingCredit === Infinity ? "text-white" :
                remainingCredit > 0 ? "text-green-400" : "text-red-400"
              )}>
                {remainingCredit === Infinity ? 'Unlimited' : <>Rs. <AnimatedNumber value={remainingCredit} /></>}
              </p>
            </div>
          </div>

          {/* Cheque Float */}
          <div className="bg-[#171c23] rounded-3xl p-6 border border-[#2b313a] flex items-center gap-4 md:gap-6" style={{ animation: 'posFadeIn 400ms ease both', animationDelay: '400ms' }}>
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0",
              chequeFloat > 0 ? "bg-amber-900/20 text-amber-400 border-amber-900/30" : "bg-[#1d222a] text-gray-500 border-[#2b313a]"
            )}>
              <Landmark size={22} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Cheque Float</p>
              <p className={cn("text-xl font-bold tracking-tighter", chequeFloat > 0 ? "text-amber-400" : "text-gray-500")}>
                {chequeFloat > 0 ? <>Rs. <AnimatedNumber value={chequeFloat} /></> : 'None'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Invoices + Payment History ──────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 mb-10">

          {/* Invoices */}
          <div className="bg-[#171c23] rounded-[2.5rem] p-8 border border-[#2b313a]" style={{ animation: 'posFadeIn 400ms ease both', animationDelay: '500ms' }}>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-indigo-900/20 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-900/30">
                <Receipt size={24} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl font-bold text-white">Invoices</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#2b313a]">
                    <th className="py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">No.</th>
                    <th className="py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Date</th>
                    <th className="py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Total</th>
                    <th className="py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2b313a]">
                  {invoices.length === 0 ? (
                    <tr><td colSpan={4} className="py-12 text-center text-sm text-gray-500 font-semibold italic">No invoices found</td></tr>
                  ) : invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-[#1d222a]/50 transition-colors">
                      <td className="py-4 text-sm font-mono font-bold text-white">{inv.invoice_no}</td>
                      <td className="py-4 text-xs font-semibold text-gray-500">{new Date(inv.created_at!).toLocaleDateString()}</td>
                      <td className="py-4 text-sm font-mono font-bold text-white text-right">
                        Rs. {(inv.total || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 text-right">
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest inline-block",
                          inv.payment_status === 'paid'    ? "bg-green-500/10 text-green-400" :
                          inv.payment_status === 'partial' ? "bg-amber-500/10 text-amber-400" :
                                                             "bg-red-500/10 text-red-400"
                        )}>
                          {inv.payment_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment History */}
          <div className="bg-[#171c23] rounded-[2.5rem] p-8 border border-[#2b313a]" style={{ animation: 'posFadeIn 400ms ease both', animationDelay: '600ms' }}>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-green-900/20 text-green-400 rounded-xl flex items-center justify-center border border-green-900/30">
                <ClipboardList size={24} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl font-bold text-white">Payment History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#2b313a]">
                    <th className="py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Date</th>
                    <th className="py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Invoice</th>
                    <th className="py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Method</th>
                    <th className="py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2b313a]">
                  {payments.length === 0 ? (
                    <tr><td colSpan={4} className="py-12 text-center text-sm text-gray-500 font-semibold italic">No payments found</td></tr>
                  ) : payments.map(pay => {
                    const linkedInv = pay.invoice_id ? invoices.find(i => i.id === pay.invoice_id) : null;
                    const isNeg = pay.amount < 0;
                    const isLoading = chequeActionLoading[pay.id];
                    return (
                      <tr key={pay.id} className="hover:bg-[#1d222a]/50 transition-colors">
                        <td className="py-3 text-xs font-semibold text-gray-500 align-top pt-4">
                          {new Date(pay.paid_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 align-top pt-4">
                          <span className="text-sm font-bold text-white">
                            {linkedInv ? linkedInv.invoice_no : 'General'}
                          </span>
                        </td>
                        <td className="py-3 align-top pt-4">
                          <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-bold text-gray-400">
                              {METHOD_LABEL[pay.method] ?? pay.method}
                            </span>
                            {pay.cheque_status && (
                              <span className={cn("px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest inline-block w-fit", CHEQUE_STATUS_STYLE[pay.cheque_status])}>
                                {pay.cheque_status}
                              </span>
                            )}
                            {/* Cheque action buttons */}
                            {pay.method === 'cheque' && pay.cheque_status === 'pending' && (
                              <button
                                disabled={isLoading}
                                onClick={() => handleChequeAction(pay.id, 'deposit')}
                                className="flex items-center gap-1 px-2 py-1 bg-amber-900/20 text-amber-400 border border-amber-900/30 rounded-lg text-[10px] font-bold hover:bg-amber-900/40 transition-all disabled:opacity-50 w-fit"
                              >
                                {isLoading ? <Loader2 size={10} className="animate-spin" /> : <ArrowRightCircle size={10} />}
                                Deposit
                              </button>
                            )}
                            {pay.method === 'cheque' && pay.cheque_status === 'processing' && (
                              <div className="flex gap-1.5">
                                <button
                                  disabled={isLoading}
                                  onClick={() => handleChequeAction(pay.id, 'complete')}
                                  className="flex items-center gap-1 px-2 py-1 bg-green-900/20 text-green-400 border border-green-900/30 rounded-lg text-[10px] font-bold hover:bg-green-900/40 transition-all disabled:opacity-50"
                                >
                                  {isLoading ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                                  Cleared
                                </button>
                                <button
                                  disabled={isLoading}
                                  onClick={() => handleChequeAction(pay.id, 'return')}
                                  className="flex items-center gap-1 px-2 py-1 bg-red-900/20 text-red-400 border border-red-900/30 rounded-lg text-[10px] font-bold hover:bg-red-900/40 transition-all disabled:opacity-50"
                                >
                                  {isLoading ? <Loader2 size={10} className="animate-spin" /> : <XCircle size={10} />}
                                  Returned
                                </button>
                              </div>
                            )}
                            {/* Cheque meta */}
                            {pay.method === 'cheque' && pay.cheque_number && (
                              <span className="text-[10px] text-gray-600 font-mono">#{pay.cheque_number}</span>
                            )}
                            {pay.bank_name && (
                              <span className="text-[10px] text-gray-600">{pay.bank_name}</span>
                            )}
                          </div>
                        </td>
                        <td className={cn("py-3 text-sm font-mono font-bold text-right align-top pt-4", isNeg ? "text-red-400" : "text-green-400")}>
                          {isNeg ? '-' : '+'} Rs. {Math.abs(pay.amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Cheque Management Section ───────────────────────────── */}
        {(pendingCheques.length + processingCheques.length + completedCheques.length + returnedCheques.length) > 0 && (
          <div className="bg-[#171c23] rounded-[2.5rem] p-8 border border-[#2b313a]" style={{ animation: 'posFadeIn 400ms ease both', animationDelay: '700ms' }}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-amber-900/20 text-amber-400 rounded-xl flex items-center justify-center border border-amber-900/30">
                <FileText size={24} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl font-bold text-white">Cheque Management</h2>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              {((['float', 'completed', 'returned'] as ChequeTab[])).map(tab => (
                <button
                  key={tab}
                  onClick={() => setChequeTab(tab)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                    chequeTab === tab
                      ? tab === 'float'     ? "bg-amber-900/30 text-amber-400 border border-amber-900/50"
                        : tab === 'completed' ? "bg-green-900/30 text-green-400 border border-green-900/50"
                        : "bg-red-900/30 text-red-400 border border-red-900/50"
                      : "bg-[#1d222a] text-gray-500 border border-[#2b313a] hover:text-gray-300"
                  )}
                >
                  {tab === 'float' && <Clock size={12} />}
                  {tab === 'completed' && <CheckCircle size={12} />}
                  {tab === 'returned' && <XCircle size={12} />}
                  {tab === 'float' ? 'In Float' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {chequeTabCounts[tab] > 0 && (
                    <span className="bg-current/20 text-current rounded-full w-4 h-4 flex items-center justify-center text-[9px]">
                      {chequeTabCounts[tab]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Cheque rows */}
            <div className="space-y-3">
              {chequeTabData[chequeTab].length === 0 ? (
                <p className="text-sm text-gray-500 font-semibold italic text-center py-8">No cheques in this category</p>
              ) : chequeTabData[chequeTab].map(pay => {
                const linkedInv = pay.invoice_id ? invoices.find(i => i.id === pay.invoice_id) : null;
                const isLoading = chequeActionLoading[pay.id];
                return (
                  <div key={pay.id} className="flex items-center justify-between gap-4 p-4 bg-[#1d222a] rounded-2xl border border-[#2b313a]">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center border shrink-0",
                        pay.cheque_status === 'pending'    ? "bg-gray-800 text-gray-400 border-gray-700" :
                        pay.cheque_status === 'processing' ? "bg-amber-900/20 text-amber-400 border-amber-900/30" :
                        pay.cheque_status === 'completed'  ? "bg-green-900/20 text-green-400 border-green-900/30" :
                                                             "bg-red-900/20 text-red-400 border-red-900/30"
                      )}>
                        <FileText size={16} strokeWidth={2.5} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-bold text-white font-mono">#{pay.cheque_number || '—'}</span>
                          <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest", CHEQUE_STATUS_STYLE[pay.cheque_status!])}>
                            {pay.cheque_status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-gray-500">
                          {pay.bank_name && <span className="flex items-center gap-1"><Building2 size={10} />{pay.bank_name}</span>}
                          {pay.due_date  && <span>Due: {new Date(pay.due_date).toLocaleDateString()}</span>}
                          <span>{linkedInv ? linkedInv.invoice_no : 'General'}</span>
                          <span>{new Date(pay.paid_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-base font-bold font-mono text-white">
                        Rs. {(pay.amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {pay.cheque_status === 'pending' && (
                        <button
                          disabled={isLoading}
                          onClick={() => handleChequeAction(pay.id, 'deposit')}
                          className="flex items-center gap-1.5 px-3 py-2 bg-amber-900/20 text-amber-400 border border-amber-900/30 rounded-xl text-xs font-bold hover:bg-amber-900/40 transition-all disabled:opacity-50"
                        >
                          {isLoading ? <Loader2 size={12} className="animate-spin" /> : <ArrowRightCircle size={12} />}
                          Deposit
                        </button>
                      )}
                      {pay.cheque_status === 'processing' && (
                        <div className="flex gap-2">
                          <button
                            disabled={isLoading}
                            onClick={() => handleChequeAction(pay.id, 'complete')}
                            className="flex items-center gap-1.5 px-3 py-2 bg-green-900/20 text-green-400 border border-green-900/30 rounded-xl text-xs font-bold hover:bg-green-900/40 transition-all disabled:opacity-50"
                          >
                            {isLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                            Cheque Cleared
                          </button>
                          <button
                            disabled={isLoading}
                            onClick={() => handleChequeAction(pay.id, 'return')}
                            className="flex items-center gap-1.5 px-3 py-2 bg-red-900/20 text-red-400 border border-red-900/30 rounded-xl text-xs font-bold hover:bg-red-900/40 transition-all disabled:opacity-50"
                          >
                            {isLoading ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                            Cheque Returned
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* ── RECORD PAYMENT MODAL ─────────────────────────────────── */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => !paymentSuccess && setIsPaymentModalOpen(false)} title="Record Payment">
        <div className="space-y-5">
          {paymentSuccess ? (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-green-900/20 text-green-400 rounded-full flex items-center justify-center mb-6 border border-green-900/30">
                <CheckCircle2 size={40} strokeWidth={2.5} />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Payment Recorded!</h3>
              <p className="text-sm font-semibold text-gray-400">The ledger has been updated successfully.</p>
            </div>
          ) : (
            <>
              {paymentError && (
                <div className="p-3 bg-red-900/20 text-red-400 text-sm font-bold rounded-xl border border-red-900/30 flex items-center gap-2">
                  <AlertCircle size={14} /> {paymentError}
                </div>
              )}

              {/* Method selector */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: 'cash',          label: 'Cash',          Icon: Wallet   },
                    { v: 'bank_transfer', label: 'Bank Transfer', Icon: Building2 },
                    { v: 'cheque',        label: 'Cheque',        Icon: FileText  },
                  ] as { v: PayMethod; label: string; Icon: any }[]).map(({ v, label, Icon }) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => { setPaymentMethod(v); setPaymentBankName(''); setPaymentError(''); }}
                      className={cn(
                        "flex flex-col items-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all",
                        paymentMethod === v
                          ? "bg-primary/10 border-primary/50 text-primary"
                          : "bg-[#171c23] border-[#2b313a] text-gray-500 hover:text-gray-300"
                      )}
                    >
                      <Icon size={18} strokeWidth={2.5} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                  Amount (Rs.) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number" min="1"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value ? Number(e.target.value) : '')}
                  placeholder="e.g. 5000"
                  className="w-full bg-[#171c23] border border-[#2b313a] focus:border-primary/50 rounded-2xl py-4 px-6 text-xl font-bold outline-none transition-all text-white placeholder-gray-500"
                />
              </div>

              {/* Bank dropdown — bank_transfer */}
              {paymentMethod === 'bank_transfer' && (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">Bank <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <select
                      value={paymentBankName}
                      onChange={e => setPaymentBankName(e.target.value)}
                      className="w-full bg-[#171c23] border border-[#2b313a] focus:border-primary/50 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all appearance-none pr-12 text-white"
                    >
                      <option value="">Select bank…</option>
                      {SL_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                  </div>
                </div>
              )}

              {/* Cheque fields */}
              {paymentMethod === 'cheque' && (
                <div className="space-y-3 p-4 bg-amber-900/5 rounded-2xl border border-amber-900/20">
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Clock size={10} /> Outstanding balance updates only when cheque clears
                  </p>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">Cheque Number <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={chequeNumber}
                      onChange={e => setChequeNumber(e.target.value)}
                      placeholder="e.g. 001234"
                      className="w-full bg-[#171c23] border border-[#2b313a] focus:border-primary/50 rounded-2xl py-3 px-5 text-sm font-semibold outline-none transition-all text-white font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">Bank <span className="text-red-400">*</span></label>
                    <div className="relative">
                      <select
                        value={paymentBankName}
                        onChange={e => setPaymentBankName(e.target.value)}
                        className="w-full bg-[#171c23] border border-[#2b313a] focus:border-primary/50 rounded-2xl py-3 px-5 text-sm font-semibold outline-none transition-all appearance-none pr-10 text-white"
                      >
                        <option value="">Select bank…</option>
                        {SL_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                      <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={14} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">Due Date <span className="text-red-400">*</span></label>
                    <input
                      type="date"
                      value={chequeDueDate}
                      onChange={e => setChequeDueDate(e.target.value)}
                      className="w-full bg-[#171c23] border border-[#2b313a] focus:border-primary/50 rounded-2xl py-3 px-5 text-sm font-semibold outline-none transition-all text-white"
                    />
                  </div>
                </div>
              )}

              {/* Link to invoice */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">Link to Invoice</label>
                <div className="relative">
                  <select
                    value={selectedInvoiceId}
                    onChange={e => setSelectedInvoiceId(e.target.value)}
                    className="w-full bg-[#171c23] border border-[#2b313a] focus:border-primary/50 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all appearance-none pr-12 text-white"
                  >
                    <option value="general">General Payment (No Invoice)</option>
                    {unpaidInvoices.map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_no} — Rs. {(inv.total || 0).toLocaleString()} ({inv.payment_status})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                </div>
              </div>

              <div className="pt-2 grid grid-cols-2 gap-4">
                <button
                  disabled={paymentLoading}
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="w-full py-4 rounded-2xl border border-[#c4d7db] bg-[#d7e5e8] text-sm font-bold text-[#1f2937] hover:bg-[#cbe0e4] transition-all disabled:opacity-50"
                >
                  CANCEL
                </button>
                <button
                  disabled={paymentLoading || !paymentAmount}
                  onClick={handleRecordPayment}
                  className="w-full h-[52px] bg-[#f8fafc] text-black border border-[#f8fafc] rounded-2xl font-bold text-sm hover:bg-white transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center relative overflow-hidden"
                >
                  <AnimatePresence mode="wait">
                    {paymentLoading ? (
                      <motion.div key="spinner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </motion.div>
                    ) : (
                      <motion.div key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute">
                        CONFIRM PAYMENT
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ── EDIT CUSTOMER MODAL ──────────────────────────────────── */}
      <Modal isOpen={isEditModalOpen} onClose={() => !editSuccess && setIsEditModalOpen(false)} title="Edit Customer Details">
        <div className="space-y-6">
          {editSuccess ? (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-green-900/20 text-green-400 rounded-full flex items-center justify-center mb-6 border border-green-900/30">
                <CheckCircle2 size={40} strokeWidth={2.5} />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Changes Saved!</h3>
              <p className="text-sm font-semibold text-gray-400">Customer details have been updated successfully.</p>
            </div>
          ) : (
            <>
              {editError && (
                <div className="p-3 bg-red-900/20 text-red-400 text-sm font-bold rounded-xl border border-red-900/30 flex items-center gap-2">
                  <AlertCircle size={16} /> {editError}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                  <User size={12} className="text-primary" /> Full Name <span className="text-red-400">*</span>
                </label>
                <input type="text" value={editFormData.name}
                  onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full bg-[#171c23] border border-[#2b313a] focus:border-primary/50 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all text-white" />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                    <Phone size={12} className="text-primary" /> Phone
                  </label>
                  <input type="tel" value={editFormData.phone}
                    onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })}
                    placeholder="+94 77 XXX XXXX"
                    className="w-full bg-[#171c23] border border-[#2b313a] focus:border-primary/50 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                    <Mail size={12} className="text-primary" /> Email
                  </label>
                  <input type="email" value={editFormData.email}
                    onChange={e => setEditFormData({ ...editFormData, email: e.target.value })}
                    placeholder="john@example.com"
                    className="w-full bg-[#171c23] border border-[#2b313a] focus:border-primary/50 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                    <Hash size={12} className="text-primary" /> Type
                  </label>
                  <select value={editFormData.type}
                    onChange={e => setEditFormData({ ...editFormData, type: e.target.value as any })}
                    className="w-full bg-[#171c23] border border-[#2b313a] focus:border-primary/50 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all appearance-none text-white">
                    <option value="retail">Retail</option>
                    <option value="wholesale">Wholesale</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                    <CreditCard size={12} className="text-primary" /> Credit Limit
                  </label>
                  <input type="number" min="0" value={editFormData.credit_limit}
                    onChange={e => setEditFormData({ ...editFormData, credit_limit: Number(e.target.value) })}
                    className="w-full bg-[#171c23] border border-[#2b313a] focus:border-primary/50 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all text-white" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                  <MapPin size={12} className="text-primary" /> Billing Address
                </label>
                <textarea value={editFormData.address}
                  onChange={e => setEditFormData({ ...editFormData, address: e.target.value })}
                  placeholder="Full address for invoicing..." rows={2}
                  className="w-full bg-[#171c23] border border-[#2b313a] focus:border-primary/50 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all resize-none text-white" />
              </div>
              <div className="pt-4 grid grid-cols-2 gap-4">
                <button disabled={editLoading} onClick={() => setIsEditModalOpen(false)}
                  className="w-full py-4 rounded-2xl border border-[#2b313a] bg-[#1d222a] text-sm font-bold text-gray-400 hover:text-white hover:bg-[#252a33] transition-all disabled:opacity-50">
                  CANCEL
                </button>
                <button disabled={editLoading} onClick={handleSaveChanges}
                  className="w-full h-[52px] bg-[#f8fafc] text-black border border-[#f8fafc] rounded-2xl font-bold text-sm hover:bg-white transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center relative overflow-hidden">
                  <AnimatePresence mode="wait">
                    {editLoading ? (
                      <motion.div key="spinner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute">
                        <Loader2 size={20} className="animate-spin" />
                      </motion.div>
                    ) : (
                      <motion.div key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute">
                        SAVE CHANGES
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};
