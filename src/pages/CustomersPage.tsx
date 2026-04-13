import React, { useState, useEffect } from 'react';
import { TopBar } from '../components/TopBar';
import { UserPlus, Phone, CreditCard, ChevronRight, Mail, MapPin, User, Hash, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { Modal } from '../components/Modal';
import { getCustomers, createCustomer } from '../services/customerService';
import type { Customer } from '../types';
import { useNavigate } from 'react-router-dom';

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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
    } catch (err: any) {
      setFormError(err.message || 'Failed to create customer');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-accent">
      <TopBar />
      
      <div className="p-10">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-dark tracking-tight">Customer List</h1>
            <p className="text-gray-400 text-sm font-semibold mt-1">Manage your member database and ledgers.</p>
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-3xl font-bold text-sm shadow-xl shadow-orange-100 hover:bg-orange-600 transition-all active:scale-[0.98]"
          >
            <UserPlus size={22} strokeWidth={2.5} /> NEW CUSTOMER
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {customers.map((customer) => (
              <div 
                key={customer.id} 
                onClick={() => navigate(`/customers/${customer.id}`)}
                className="bg-white rounded-[2.5rem] p-8 hover:-translate-y-2 transition-all duration-500 group cursor-pointer shadow-sm border border-border/50 hover:shadow-2xl hover:shadow-orange-100/20 flex flex-col"
              >
                <div className="flex items-start justify-between mb-8">
                  <div className="w-20 h-20 bg-orange-50 text-primary rounded-[1.75rem] flex items-center justify-center border-2 border-orange-100 shadow-sm shadow-orange-50 group-hover:bg-primary group-hover:text-white transition-all duration-500">
                    <span className="text-3xl font-bold uppercase">{customer.name.charAt(0)}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest leading-none mb-2">Type</p>
                    <span className={cn(
                      "px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border-2",
                      customer.type === 'wholesale' ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-amber-50 text-amber-600 border-amber-100"
                    )}>
                      {customer.type}
                    </span>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-dark mb-4 leading-tight">{customer.name}</h3>
                
                <div className="space-y-3 mb-8">
                  <div className="flex items-center gap-3 text-gray-400">
                    <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center text-gray-400 group-hover:text-primary transition-colors">
                      <Phone size={14} strokeWidth={2.5} />
                    </div>
                    <p className="text-xs font-semibold">{customer.phone || 'N/A'}</p>
                  </div>
                  <div className="flex items-center gap-3 text-gray-400">
                    <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center text-gray-400">
                      <Mail size={14} strokeWidth={2.5} />
                    </div>
                    <p className="text-xs font-semibold">{customer.email || 'N/A'}</p>
                  </div>
                </div>

                <div className="pt-6 border-t-2 border-dashed border-border flex items-end justify-between mt-auto">
                  <div className="space-y-3 w-full">
                    <div className="flex justify-between items-center">
                      <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">Credit Limit</p>
                      <p className="text-sm font-bold text-gray-600">
                        {(customer.credit_limit || 0) > 0 ? (customer.credit_limit || 0).toLocaleString() : 'No Limit'}
                      </p>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">Balance</p>
                      <p className={cn("text-lg font-bold tracking-tighter", (customer.outstanding_balance || 0) > 0 ? "text-red-500" : "text-dark")}>
                        {(customer.outstanding_balance || 0).toLocaleString()}
                      </p>
                    </div>
                    
                    <button className="w-full mt-2 py-3 bg-accent text-dark font-bold text-xs rounded-xl flex items-center justify-center gap-2 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                      View Ledger <ChevronRight size={14} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            {!loading && customers.length === 0 && (
              <div className="col-span-full py-20 text-center text-gray-400">
                <User size={48} className="mx-auto mb-4 opacity-20" />
                <p className="text-lg font-bold">No customers found</p>
                <p className="text-sm">Click 'New Customer' to add one.</p>
              </div>
            )}
          </div>
        )}
      </div>

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
              className="w-full py-4 rounded-2xl border-2 border-border/50 text-sm font-bold text-gray-400 hover:text-dark hover:border-dark/20 transition-all disabled:opacity-50"
            >
              CANCEL
            </button>
            <button 
              disabled={formLoading}
              onClick={handleRegister}
              className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-sm shadow-xl shadow-orange-100 hover:bg-orange-600 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              {formLoading ? 'SAVING...' : 'REGISTER CUSTOMER'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
