import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { ArrowLeft, Wallet, CreditCard, PieChart, CheckCircle2, ChevronDown, ClipboardList, Receipt, Edit, AlertCircle, Loader2, Mail, Phone, MapPin, Hash, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { Modal } from '../components/Modal';
import { getCustomerById, getCustomerLedger, recordPayment, updateCustomer } from '../services/customerService';
import { getRemainingCredit } from '../utils/creditCheck';
import type { Customer, Invoice, Payment } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedNumber } from '../components/AnimatedNumber';

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

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
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

  const openEditModal = () => {
    if (customer) {
      setEditFormData({
        name: customer.name,
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || '',
        type: customer.type,
        credit_limit: customer.credit_limit || 0,
      });
      setEditError('');
      setEditSuccess('');
      setIsEditModalOpen(true);
    }
  };

  const handleSaveChanges = async () => {
    if (!id || !customer) return;
    if (!editFormData.name.trim()) {
      setEditError('Name is required');
      return;
    }

    try {
      setEditLoading(true);
      setEditError('');
      await updateCustomer(id, editFormData);
      setEditSuccess('Customer updated successfully!');
      await loadData();

      setTimeout(() => {
        setEditSuccess('');
        setIsEditModalOpen(false);
      }, 2000);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update customer');
    } finally {
      setEditLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="pos-standard-page flex flex-col min-h-screen bg-transparent">
        <TopBar />
        <div className="p-4 md:p-10 pos-page-body w-full">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-full skeleton"></div>
            <div className="w-48 h-10 rounded-xl skeleton"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 rounded-3xl skeleton" style={{ animationDelay: `${i * 100}ms` }}></div>
            ))}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
            <div className="h-96 rounded-[2.5rem] skeleton" style={{ animationDelay: '300ms' }}></div>
            <div className="h-96 rounded-[2.5rem] skeleton" style={{ animationDelay: '400ms' }}></div>
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

  const remainingCredit = getRemainingCredit(customer);
  const unpaidInvoices = invoices.filter(i => i.payment_status !== 'paid');

  return (
    <div className="pos-standard-page flex flex-col min-h-screen bg-transparent">
      <TopBar />
      
      <div className="p-4 md:p-10 pos-page-body w-full">
        {/* Header Section */}
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
                  customer.type === 'wholesale' ? "bg-purple-900/30 text-purple-400 border-purple-900/50" : "bg-indigo-900/30 text-indigo-400 border-indigo-900/50"
                )}>
                  {customer.type}
                </span>
              </div>
              <p className="text-gray-500 text-sm font-semibold mt-1">Customer Ledger & History</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={openEditModal}
              className="flex items-center gap-2 px-4 md:px-6 py-3 md:py-4 bg-[#1d222a] text-gray-400 hover:text-white hover:bg-[#2b313a] rounded-2xl md:rounded-3xl font-bold text-sm border border-[#2b313a] transition-all active:scale-[0.98]"
            >
              <Edit size={18} strokeWidth={2.5} /> EDIT
            </button>
            <button 
              onClick={openPaymentModal}
              className="flex items-center gap-3 px-6 md:px-8 py-3 md:py-4 bg-primary text-black rounded-2xl md:rounded-3xl font-bold text-sm hover:bg-white transition-all active:scale-[0.98]"
            >
              <Wallet size={20} strokeWidth={2.5} /> RECORD PAYMENT
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-[#171c23] rounded-3xl p-6 border border-[#2b313a] flex items-center gap-6" style={{ animation: 'posFadeIn 400ms ease both', animationDelay: '100ms' }}>
            <div className="w-14 h-14 rounded-2xl bg-red-900/20 text-red-400 flex items-center justify-center border border-red-900/30">
              <PieChart size={24} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mb-1">Outstanding Balance</p>
              <p className={cn("text-2xl font-bold tracking-tighter", (customer.outstanding_balance || 0) > 0 ? "text-red-400" : "text-white")}>
                Rs. <AnimatedNumber value={customer.outstanding_balance || 0} />
              </p>
            </div>
          </div>

          <div className="bg-[#171c23] rounded-3xl p-6 border border-[#2b313a] flex items-center gap-6" style={{ animation: 'posFadeIn 400ms ease both', animationDelay: '200ms' }}>
            <div className="w-14 h-14 rounded-2xl bg-purple-900/20 text-purple-400 flex items-center justify-center border border-purple-900/30">
              <CreditCard size={24} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mb-1">Credit Limit</p>
              <p className="text-2xl font-bold tracking-tighter text-white">
                {(customer.credit_limit || 0) > 0 ? <>Rs. <AnimatedNumber value={customer.credit_limit || 0} /></> : 'No Limit'}
              </p>
            </div>
          </div>

          <div className="bg-[#171c23] rounded-3xl p-6 border border-[#2b313a] flex items-center gap-6" style={{ animation: 'posFadeIn 400ms ease both', animationDelay: '300ms' }}>
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center border", 
              remainingCredit === Infinity ? "bg-[#1d222a] text-gray-400 border-[#2b313a]" :
              remainingCredit > 0 ? "bg-green-900/20 text-green-400 border-green-900/30" : "bg-red-900/20 text-red-400 border-red-900/30"
            )}>
              <Wallet size={24} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mb-1">Remaining Credit</p>
              <p className={cn("text-2xl font-bold tracking-tighter", 
                remainingCredit === Infinity ? "text-white" :
                remainingCredit > 0 ? "text-green-400" : "text-red-400"
              )}>
                {remainingCredit === Infinity ? 'Unlimited' : <>Rs. <AnimatedNumber value={remainingCredit} /></>}
              </p>
            </div>
          </div>
        </div>

        {/* Ledger Tables */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
          
          {/* Invoices */}
          <div className="bg-[#171c23] rounded-[2.5rem] p-8 border border-[#2b313a]" style={{ animation: 'posFadeIn 400ms ease both', animationDelay: '400ms' }}>
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
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-sm text-gray-500 font-semibold italic">No invoices found</td>
                    </tr>
                  ) : (
                    invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-[#1d222a]/50 transition-colors">
                        <td className="py-4 text-sm font-mono font-bold text-white">{inv.invoice_no}</td>
                        <td className="py-4 text-xs font-semibold text-gray-500">
                          {new Date(inv.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-4 text-sm font-mono font-bold text-white text-right">
                          Rs. {(inv.total || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 text-right">
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest inline-block",
                            inv.payment_status === 'paid' ? "bg-green-500/10 text-green-400" :
                            inv.payment_status === 'partial' ? "bg-amber-500/10 text-amber-400" :
                            "bg-red-500/10 text-red-400"
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
          <div className="bg-[#171c23] rounded-[2.5rem] p-8 border border-[#2b313a]" style={{ animation: 'posFadeIn 400ms ease both', animationDelay: '500ms' }}>
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
                    <th className="py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Linked To</th>
                    <th className="py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2b313a]">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-12 text-center text-sm text-gray-500 font-semibold italic">No payments found</td>
                    </tr>
                  ) : (
                    payments.map((pay) => {
                      const linkedInv = pay.invoice_id ? invoices.find(i => i.id === pay.invoice_id) : null;
                      const isNegative = pay.amount < 0;
                      return (
                        <tr key={pay.id} className="hover:bg-[#1d222a]/50 transition-colors">
                          <td className="py-4 text-xs font-semibold text-gray-500">
                            {new Date(pay.paid_at).toLocaleDateString()}
                          </td>
                          <td className="py-4">
                            <span className="text-sm font-bold text-white">
                              {linkedInv ? linkedInv.invoice_no : 'General'}
                            </span>
                          </td>
                          <td className={cn(
                            "py-4 text-sm font-mono font-bold text-right",
                            isNegative ? "text-red-400" : "text-green-400"
                          )}>
                            {isNegative ? '-' : '+'} Rs. {Math.abs(pay.amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              <div className="w-20 h-20 bg-green-900/20 text-green-400 rounded-full flex items-center justify-center mb-6 border border-green-900/30">
                <CheckCircle2 size={40} strokeWidth={2.5} />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Payment Recorded!</h3>
              <p className="text-sm font-semibold text-gray-400">The ledger has been updated successfully.</p>
            </div>
          ) : (
            <>
              {paymentError && (
                <div className="p-3 bg-red-900/20 text-red-400 text-sm font-bold rounded-xl border border-red-900/30">
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
                  className="w-full bg-[#171c23] border border-[#2b313a] focus:border-primary/50 rounded-2xl py-4 px-6 text-xl font-bold outline-none transition-all text-white placeholder-gray-500"
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

              <div className="pt-4 grid grid-cols-2 gap-4">
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

      {/* EDIT CUSTOMER MODAL */}
      <Modal 
        isOpen={isEditModalOpen}
        onClose={() => !editSuccess && setIsEditModalOpen(false)}
        title="Edit Customer Details"
      >
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
                <input 
                  type="text" 
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                  placeholder="e.g. John Doe" 
                  className="w-full bg-[#171c23] border border-[#2b313a] focus:border-primary/50 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                    <Phone size={12} className="text-primary" /> Contact (Phone)
                  </label>
                  <input 
                    type="tel" 
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                    placeholder="e.g. +94 77 XXX XXXX" 
                    className="w-full bg-[#171c23] border border-[#2b313a] focus:border-primary/50 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                    <Mail size={12} className="text-primary" /> Email
                  </label>
                  <input 
                    type="email" 
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                    placeholder="e.g. john@example.com" 
                    className="w-full bg-[#171c23] border border-[#2b313a] focus:border-primary/50 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                    <Hash size={12} className="text-primary" /> Type
                  </label>
                  <select 
                    value={editFormData.type}
                    onChange={(e) => setEditFormData({...editFormData, type: e.target.value as any})}
                    className="w-full bg-[#171c23] border border-[#2b313a] focus:border-primary/50 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all appearance-none text-white"
                  >
                    <option value="retail">Retail</option>
                    <option value="wholesale">Wholesale</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                    <CreditCard size={12} className="text-primary" /> Credit Limit
                  </label>
                  <input 
                    type="number" 
                    min="0"
                    value={editFormData.credit_limit}
                    onChange={(e) => setEditFormData({...editFormData, credit_limit: Number(e.target.value)})}
                    className="w-full bg-[#171c23] border border-[#2b313a] focus:border-primary/50 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                  <MapPin size={12} className="text-primary" /> Billing Address
                </label>
                <textarea 
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({...editFormData, address: e.target.value})}
                  placeholder="Full address for invoicing..." 
                  rows={2}
                  className="w-full bg-[#171c23] border border-[#2b313a] focus:border-primary/50 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all resize-none text-white"
                />
              </div>

              <div className="pt-4 grid grid-cols-2 gap-4">
                <button 
                  disabled={editLoading}
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-full py-4 rounded-2xl border border-[#2b313a] bg-[#1d222a] text-sm font-bold text-gray-400 hover:text-white hover:bg-[#252a33] transition-all disabled:opacity-50"
                >
                  CANCEL
                </button>
                <button 
                  disabled={editLoading}
                  onClick={handleSaveChanges}
                  className="w-full h-[52px] bg-[#f8fafc] text-black border border-[#f8fafc] rounded-2xl font-bold text-sm hover:bg-white transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center relative overflow-hidden"
                >
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

