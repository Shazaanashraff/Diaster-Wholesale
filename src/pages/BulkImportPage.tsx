import React from 'react';
import { TopBar } from '../components/TopBar';
import { FileUp, Box, CheckCircle2, History, Trash2, ArrowRight } from 'lucide-react';

export const BulkImportPage: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-accent">
      <TopBar />
      
      <div className="p-10 max-w-6xl mx-auto w-full">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-dark tracking-tight">Bulk Import</h1>
          <p className="text-gray-400 text-sm font-semibold mt-1">Upload inventory files to sync digital product inventory.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-[3rem] border-4 border-dashed border-orange-50 p-16 flex flex-col items-center justify-center group hover:border-primary/20 hover:bg-orange-50/10 transition-all cursor-pointer shadow-sm">
              <div className="w-24 h-24 bg-accent rounded-[2rem] flex items-center justify-center text-gray-300 group-hover:bg-primary group-hover:text-white transition-all duration-500 mb-6 shadow-sm border border-border/50">
                <FileUp size={48} strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-bold text-dark">Drop your CSV here</h3>
              <p className="text-sm text-gray-400 font-semibold mt-2">Maximum file size: 10MB</p>
              <button className="mt-10 px-10 py-4 bg-white border-2 border-border/50 rounded-2xl text-sm font-bold text-dark hover:border-primary/20 transition-all shadow-sm">
                BROWSE FILES
              </button>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-border/50 p-10 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-bold text-dark">Shipment Information</h3>
                <Box size={22} className="text-primary" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">Shipment Tracking ID</label>
                  <input 
                    type="text" 
                    placeholder="e.g. TRK-BIJ-2024" 
                    className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">Supplier Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Digital Distro Ltd." 
                    className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <button className="w-full py-5 bg-primary text-white rounded-3xl font-bold shadow-2xl shadow-orange-100 flex items-center justify-center gap-4 hover:bg-orange-600 transition-all active:scale-[0.98] group tracking-widest text-sm">
              START IMPORT PROCESSING <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="space-y-8">
            <div className="bg-white rounded-[2.5rem] border border-border/50 p-8 shadow-sm">
              <h3 className="font-bold text-dark mb-6 flex items-center gap-3">
                <CheckCircle2 size={20} className="text-primary" strokeWidth={2.5} /> Quality Check
              </h3>
              <ul className="space-y-6">
                {[
                  "Ensure product IDs exactly match current catalog.",
                  "Price values must be up to 2 decimal places.",
                  "Keys must be unique and non-duplicate."
                ].map((note, idx) => (
                  <li key={idx} className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-orange-50 text-primary text-[11px] flex-shrink-0 flex items-center justify-center font-bold border border-orange-100">{idx+1}</div>
                    <p className="text-xs text-gray-400 leading-relaxed font-semibold">{note}</p>
                  </li>
                ))}
              </ul>
              <button className="w-full mt-10 py-4 rounded-2xl border-2 border-border/50 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-dark hover:border-primary/20 transition-all">
                Download Template
              </button>
            </div>

            <div className="bg-orange-50/30 rounded-[2.5rem] border border-orange-100/50 p-8">
              <h3 className="font-bold text-dark mb-6 flex items-center gap-3">
                <History size={20} className="text-primary" /> Last 48 Hours
              </h3>
              <div className="space-y-4">
                {[1, 2].map(i => (
                  <div key={i} className="bg-white p-4 rounded-2xl border border-border/50 flex items-center justify-between group shadow-sm">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-dark truncate">SHIP-KEY-993-0{i}</p>
                      <p className="text-[10px] text-gray-400 font-bold mt-1">Today • 120 items</p>
                    </div>
                    <button className="w-8 h-8 rounded-xl bg-accent text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
