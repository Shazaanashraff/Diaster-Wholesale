import React, { useState, useEffect } from 'react';
import { UserPlus, Phone, CreditCard, Mail, MapPin, User, Hash, AlertCircle, Trash2, AlertTriangle, Loader2, Search, Filter, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { Modal } from '../components/Modal';
import { getCustomers, createCustomer, deleteCustomer } from '../services/customerService';
import type { Customer } from '../types';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedNumber } from '../components/AnimatedNumber';

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    type: 'retail' as 'wholesale' | 'retail',
    credit_limit: 0,
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'wholesale' | 'retail'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'balance' | 'credit'>('name');

  const visibleCustomers = customers
    .filter(c => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || c.name.toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.email || '').toLowerCase().includes(q);
      const matchesType = filterType === 'all' || c.type === filterType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === 'balance') return (b.outstanding_balance || 0) - (a.outstanding_balance || 0);
      if (sortBy === 'credit') return (b.credit_limit || 0) - (a.credit_limit || 0);
      return a.name.localeCompare(b.name);
    });

  const hasActiveFilters = filterType !== 'all' || sortBy !== 'name' || searchQuery !== '';
  const clearFilters = () => { setFilterType('all'); setSortBy('name'); setSearchQuery(''); };

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await getCustomers();
      setCustomers(data);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleRegister = async () => {
    if (!formData.name.trim()) {
      setFormError('Name is required');
      return;
    }
    try {
      setFormLoading(true);
      setFormError('');
      await createCustomer(formData);
      setIsAddModalOpen(false);
      setFormData({
        name: '',
        phone: '',
        email: '',
        address: '',
        type: 'retail',
        credit_limit: 0,
      });
      await loadCustomers();
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;
    try {
      setFormLoading(true);
      await deleteCustomer(customerToDelete.id);
      setIsDeleteModalOpen(false);
      setCustomerToDelete(null);
      await loadCustomers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to delete customer');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-transparent">
      <section className="pos-main flex-1 border-r-0 max-w-full">
        <div className="pos-main-head w-full max-w-7xl mx-auto px-3">
          <label className="pos-search">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </label>
          <div className="pos-mode-toggle">
            <button
              onClick={() => setFilterOpen(p => !p)}
              className={cn('flex items-center gap-2', (filterOpen || hasActiveFilters) && 'active')}
            >
              <Filter size={14} />
              Filter
              {hasActiveFilters && (
                <span className="w-4 h-4 rounded-full bg-white/20 text-[9px] font-black flex items-center justify-center">
                  {[filterType !== 'all', sortBy !== 'name', searchQuery !== ''].filter(Boolean).length}
                </span>
              )}
            </button>
            <div className="w-[1px] h-4 bg-[#2b313a] mx-1"></div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 text-primary ml-2 hover:opacity-80 transition-opacity whitespace-nowrap"
            >
              <UserPlus size={16} strokeWidth={3} />
              <span className="text-xs font-bold uppercase tracking-widest">New Customer</span>
            </button>
          </div>
        </div>

        {/* ── Filter Panel ── */}
        {filterOpen && (
          <div className="mx-3 mb-3 rounded-2xl border border-[#2b313a] bg-[#13181f] overflow-hidden" style={{ animation: 'posFadeIn 180ms ease' }}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#2b313a]">
              <div className="flex items-center gap-4">
                {/* Type filter */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Type</span>
                  <div className="flex gap-1">
                    {(['all', 'wholesale', 'retail'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setFilterType(t)}
                        className={cn(
                          'px-3 py-1 rounded-lg text-[11px] font-bold transition-all',
                          filterType === t
                            ? 'bg-[#f8fafc] text-[#111315]'
                            : 'bg-[#1d222a] text-gray-400 hover:text-white border border-[#2b313a]'
                        )}
                      >
                        {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="w-px h-5 bg-[#2b313a]" />

                {/* Sort */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Sort</span>
                  <div className="flex gap-1">
                    {([
                      { key: 'name',    label: 'Name' },
                      { key: 'balance', label: 'Balance' },
                      { key: 'credit',  label: 'Credit' },
                    ] as const).map(s => (
                      <button
                        key={s.key}
                        onClick={() => setSortBy(s.key)}
                        className={cn(
                          'px-3 py-1 rounded-lg text-[11px] font-bold transition-all',
                          sortBy === s.key
                            ? 'bg-[#f8fafc] text-[#111315]'
                            : 'bg-[#1d222a] text-gray-400 hover:text-white border border-[#2b313a]'
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-gray-500">
                  {visibleCustomers.length} of {customers.length}
                </span>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-900/20 text-red-400 text-[11px] font-bold hover:bg-red-900/30 transition-all border border-red-900/30"
                  >
                    <X size={11} /> Clear
                  </button>
                )}
                <button onClick={() => setFilterOpen(false)} className="text-gray-600 hover:text-gray-300 transition-colors">
                  <X size={15} />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="px-3 overflow-y-auto pb-8 custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full mt-2 max-w-7xl mx-auto">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-[200px] rounded-2xl skeleton" style={{ animationDelay: `${i * 100}ms` }} />
              ))
            ) : (
              <AnimatePresence>
              {visibleCustomers.map((customer) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, height: 0, overflow: 'hidden' }}
                  transition={{ duration: 0.2 }}
                  key={customer.id} 
                  onClick={() => navigate(`/customers/${customer.id}`)}
                  className="bg-[#171c23] rounded-2xl p-5 hover:-translate-y-1 transition-all duration-300 group cursor-pointer border border-[#2b313a] hover:border-gray-500/50 flex flex-col"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-[#1d222a] text-gray-300 rounded-xl flex items-center justify-center border border-[#2b313a] group-hover:bg-[#2b313a] group-hover:text-white transition-all duration-300">
                      <span className="text-xl font-bold uppercase">{customer.name.charAt(0)}</span>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-right">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border border-[#2b313a]",
                          "bg-[#1d222a] text-gray-400 group-hover:border-gray-500/50 transition-colors"
                        )}>
                          {customer.type}
                        </span>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setCustomerToDelete(customer);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg bg-[#1d222a] text-gray-400 hover:text-red-400 hover:bg-red-500/20 border border-[#2b313a] transition-all duration-300"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-[15px] font-bold text-white mb-3 leading-tight truncate" title={customer.name}>{customer.name}</h3>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-gray-400">
                      <div className="w-6 h-6 rounded-lg bg-[#1d222a] flex items-center justify-center text-gray-500 group-hover:text-white transition-colors border border-[#2b313a]">
                        <Phone size={12} strokeWidth={2.5} />
                      </div>
                      <p className="text-[11px] font-semibold text-gray-300 truncate" title={customer.phone}>{customer.phone || 'N/A'}</p>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <div className="w-6 h-6 rounded-lg bg-[#1d222a] flex items-center justify-center text-gray-500 group-hover:text-white transition-colors border border-[#2b313a]">
                        <Mail size={12} strokeWidth={2.5} />
                      </div>
                      <p className="text-[11px] font-semibold text-gray-300 truncate" title={customer.email}>{customer.email || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-dashed border-[#2b313a] flex flex-col mt-auto gap-2">
                    <div className="flex justify-between items-center px-1">
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Credit</p>
                      <p className="text-[10px] font-bold text-gray-300">
                        {(customer.credit_limit || 0) > 0 ? (customer.credit_limit || 0).toLocaleString() : 'No Limit'}
                      </p>
                    </div>
                    <div className="flex justify-between items-center px-1">
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Bal</p>
                      <p className={cn("text-sm font-bold tracking-tighter", (customer.outstanding_balance || 0) > 0 ? "text-red-400" : "text-white")}>
                        <AnimatedNumber value={customer.outstanding_balance || 0} />
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
              </AnimatePresence>
            )}            
            {!loading && customers.length === 0 && (
              <div className="col-span-full py-32 flex flex-col items-center justify-center gap-4 text-center mt-8 border border-[#2b313a] rounded-[2rem] bg-[#171c23]/50" style={{ animation: 'posFadeIn 380ms ease' }}>
                <div className="w-16 h-16 rounded-full bg-[#1d222a] flex items-center justify-center border border-[#2b313a]">
                  <User size={28} className="text-gray-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-gray-400">No customers found</p>
                  <p className="text-xs font-semibold text-gray-600">Click 'New Customer' to register a new account.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* NEW CUSTOMER MODAL */}
      <Modal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Customer"
      >
        <div className="space-y-6">
          {formError && (
            <div className="p-3 bg-red-50 text-red-500 text-sm font-bold rounded-xl flex items-center gap-2">
              <AlertCircle size={16} /> {formError}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
              <User size={12} className="text-primary" /> Full Name <span className="text-red-400">*</span>
            </label>
            <input 
              type="text" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="e.g. John Doe" 
              className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                <Phone size={12} className="text-primary" /> Contact (Phone)
              </label>
              <input 
                type="tel" 
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="e.g. +94 77 XXX XXXX" 
                className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                <Mail size={12} className="text-primary" /> Email
              </label>
              <input 
                type="email" 
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="e.g. john@example.com" 
                className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                <Hash size={12} className="text-primary" /> Type
              </label>
              <select 
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all appearance-none"
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
                value={formData.credit_limit}
                onChange={(e) => setFormData({...formData, credit_limit: Number(e.target.value)})}
                className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
              <MapPin size={12} className="text-primary" /> Billing Address (Optional)
            </label>
            <textarea 
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              placeholder="Full address for invoicing..." 
              rows={2}
              className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all resize-none"
            />
          </div>

          <div className="pt-4 grid grid-cols-2 gap-4">
            <button 
              disabled={formLoading}
              onClick={() => setIsAddModalOpen(false)}
              className="w-full py-4 rounded-2xl border border-[#c4d7db] bg-[#d7e5e8] text-sm font-bold text-[#1f2937] hover:bg-[#cbe0e4] transition-all disabled:opacity-50"
            >
              CANCEL
            </button>
            <button 
              disabled={formLoading}
              onClick={handleRegister}
              className="w-full h-[56px] bg-[#e6d3f0] text-[#312e81] border border-[#d7bde6] rounded-2xl font-bold text-sm hover:bg-[#dcc4ed] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center relative overflow-hidden"
            >
              <AnimatePresence mode="wait">
                {formLoading ? (
                  <motion.div key="spinner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute">
                    <Loader2 size={20} className="animate-spin" />
                  </motion.div>
                ) : (
                  <motion.div key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute">
                    REGISTER CUSTOMER
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Customer"
      >
        <div className="space-y-6">
          <div className="p-6 bg-red-50 rounded-[2rem] flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-red-500 mb-4 shadow-sm border border-red-100">
              <AlertTriangle size={32} />
            </div>
            <h4 className="text-xl font-bold text-dark mb-2">Are you sure?</h4>
            <p className="text-sm text-gray-500 font-semibold leading-relaxed">
              You are about to delete <span className="text-red-500 font-bold">{customerToDelete?.name}</span>. 
              This action will permanently remove the customer and all associated ledger history. This cannot be undone.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="py-4 rounded-2xl border border-[#c4d7db] bg-[#d7e5e8] text-sm font-bold text-[#1f2937] hover:bg-[#cbe0e4] transition-all"
            >
              CANCEL
            </button>
            <button
              onClick={handleDeleteCustomer}
              disabled={formLoading}
              className="w-full h-[56px] bg-[#f2c8de] text-[#7a284f] border border-[#e7aacb] rounded-2xl font-bold text-sm hover:bg-[#efbad5] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center relative overflow-hidden"
            >
              <AnimatePresence mode="wait">
                {formLoading ? (
                  <motion.div key="spinner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute">
                    <Loader2 size={20} className="animate-spin" />
                  </motion.div>
                ) : (
                  <motion.div key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute">
                    YES, DELETE
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



