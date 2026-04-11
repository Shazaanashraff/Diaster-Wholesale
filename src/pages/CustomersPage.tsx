import React, { useState } from 'react';
import { CUSTOMERS } from '../data/mockData';
import { TopBar } from '../components/TopBar';
import { UserPlus, Phone, CreditCard, ChevronRight, Mail, MapPin, User, Hash } from 'lucide-react';
import { cn } from '../lib/utils';
import { Modal } from '../components/Modal';

export const CustomersPage: React.FC = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-accent">
      <TopBar />
      
      <div className="p-10">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-dark tracking-tight">Customer List</h1>
            <p className="text-gray-400 text-sm font-semibold mt-1">Manage your member database and loyalty points.</p>
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-3xl font-bold text-sm shadow-xl shadow-orange-100 hover:bg-orange-600 transition-all active:scale-[0.98]"
          >
            <UserPlus size={22} strokeWidth={2.5} /> NEW CUSTOMER
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {CUSTOMERS.map((customer) => (
            <div key={customer.id} className="bg-white rounded-[2.5rem] p-8 hover:-translate-y-2 transition-all duration-500 group cursor-pointer shadow-sm border border-border/50 hover:shadow-2xl hover:shadow-orange-100/20">
              <div className="flex items-start justify-between mb-8">
                <div className="w-20 h-20 bg-orange-50 text-primary rounded-[1.75rem] flex items-center justify-center border-2 border-orange-100 shadow-sm shadow-orange-50 group-hover:bg-primary group-hover:text-white transition-all duration-500">
                  <span className="text-3xl font-bold uppercase">{customer.name.charAt(0)}</span>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest leading-none mb-2">Member Type</p>
                  <span className={cn(
                    "px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border-2",
                    customer.creditBalance > 10000 ? "bg-orange-50 text-primary border-orange-100" : "bg-gray-50 text-gray-400 border-gray-100"
                  )}>
                    {customer.creditBalance > 10000 ? 'Platinum' : 'Standard'}
                  </span>
                </div>
              </div>

              <h3 className="text-xl font-bold text-dark mb-4 leading-tight">{customer.name}</h3>
              
              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3 text-gray-400">
                  <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center text-gray-400 group-hover:text-primary transition-colors">
                    <Phone size={14} strokeWidth={2.5} />
                  </div>
                  <p className="text-xs font-semibold">{customer.phone}</p>
                </div>
                <div className="flex items-center gap-3 text-gray-400">
                  <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center text-gray-400">
                    <Mail size={14} strokeWidth={2.5} />
                  </div>
                  <p className="text-xs font-semibold">{customer.name.toLowerCase().replace(' ', '')}@gmail.com</p>
                </div>
              </div>

              <div className="pt-8 border-t-2 border-dashed border-border flex items-end justify-between mt-auto">
                <div>
                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-2">Points Balance</p>
                  <div className="flex items-center gap-2 text-dark font-bold text-2xl tracking-tighter">
                    <CreditCard size={22} className="text-primary" strokeWidth={2.5} />
                    {customer.creditBalance.toLocaleString()} <span className="text-[10px] text-gray-300 uppercase tracking-widest ml-1">pts</span>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center text-gray-300 group-hover:text-primary group-hover:bg-orange-50 transition-all duration-500">
                  <ChevronRight size={24} strokeWidth={2.5} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* NEW CUSTOMER MODAL */}
      <Modal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Customer"
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
              <User size={12} className="text-primary" /> Full Name
            </label>
            <input 
              type="text" 
              placeholder="e.g. John Doe" 
              className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                <Phone size={12} className="text-primary" /> Phone Number
              </label>
              <input 
                type="tel" 
                placeholder="e.g. +94 77 XXX XXXX" 
                className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                <Mail size={12} className="text-primary" /> Email Address
              </label>
              <input 
                type="email" 
                placeholder="e.g. john@example.com" 
                className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
              <MapPin size={12} className="text-primary" /> Billing Address (Optional)
            </label>
            <textarea 
              placeholder="Full address for invoicing..." 
              rows={2}
              className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all resize-none"
            />
          </div>

          <div className="pt-4 grid grid-cols-2 gap-4">
            <button 
              onClick={() => setIsAddModalOpen(false)}
              className="w-full py-4 rounded-2xl border-2 border-border/50 text-sm font-bold text-gray-400 hover:text-dark hover:border-dark/20 transition-all"
            >
              CANCEL
            </button>
            <button className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-sm shadow-xl shadow-orange-100 hover:bg-orange-600 transition-all active:scale-[0.98]">
              REGISTER CUSTOMER
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
