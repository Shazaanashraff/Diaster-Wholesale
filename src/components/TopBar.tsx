import React from 'react';

export const TopBar: React.FC = () => {
  return (
    <header className="h-20 bg-transparent flex items-center justify-between px-10 shrink-0 mt-2">
      <div className="flex-1"></div>

      <div className="flex items-center gap-6">


        
        <div className="h-8 w-px bg-border mx-2"></div>

        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="text-right">
            <p className="text-[13px] font-bold text-dark leading-none group-hover:text-primary transition-colors">Tusher Sardar</p>
            <p className="text-[11px] text-gray-400 font-semibold mt-1">Administrator</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center border-2 border-white shadow-xl shadow-gray-200/50 ring-1 ring-border group-hover:ring-primary/30 transition-all">
            <span className="text-white font-bold text-sm">A</span>
          </div>
        </div>
      </div>
    </header>
  );
};


