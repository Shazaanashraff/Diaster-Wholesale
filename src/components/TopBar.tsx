import React from 'react';
import { Search } from 'lucide-react';

export const TopBar: React.FC = () => {
  return (
    <header className="h-20 bg-transparent flex items-center justify-between px-10 shrink-0 mt-2">
      <label className="hidden lg:flex items-center gap-2 bg-[#2d2d2f] border border-[#363c44] rounded-xl px-4 py-2 min-w-[260px] text-gray-400">
        <Search size={16} />
        <input
          type="text"
          placeholder="Search"
          className="bg-transparent border-0 outline-none text-sm text-white w-full placeholder:text-gray-500"
        />
      </label>

      <div className="flex items-center gap-6">
        <div className="h-8 w-px bg-[#303640] mx-2"></div>
        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="text-right">
            <p className="text-[13px] font-bold text-white leading-none transition-colors">Tusher Sardar</p>
            <p className="text-[11px] text-gray-400 font-semibold mt-1">Administrator</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#2a2f36] flex items-center justify-center border border-[#3a4350] transition-all">
            <span className="text-white font-bold text-sm">T</span>
          </div>
        </div>
      </div>
    </header>
  );
};

