import React from 'react';
import { Download, Printer } from 'lucide-react';
import { exportToCSV } from '../../../utils/reportUtils';
import { cn } from '../../../lib/utils';

interface ExportBarProps {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
  className?: string;
}

export const ExportBar: React.FC<ExportBarProps> = ({ filename, headers, rows, className }) => {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        onClick={() => exportToCSV(filename, headers, rows)}
        className="flex items-center gap-1.5 px-3 py-2 bg-[#1d222a] border border-[#2b313a] text-gray-400 rounded-xl hover:bg-[#252a33] hover:text-white hover:border-[#3d4652] transition-all text-[11px] font-bold"
      >
        <Download size={13} />
        Export CSV
      </button>
      <button
        onClick={() => window.print()}
        className="flex items-center gap-1.5 px-3 py-2 bg-[#1d222a] border border-[#2b313a] text-gray-400 rounded-xl hover:bg-[#252a33] hover:text-white hover:border-[#3d4652] transition-all text-[11px] font-bold"
      >
        <Printer size={13} />
        Print
      </button>
    </div>
  );
};
