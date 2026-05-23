import React from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { type ReportPeriod, PERIOD_LABELS } from '../../../utils/reportUtils';
import { cn } from '../../../lib/utils';

interface DateRangePickerProps {
  value: ReportPeriod;
  onChange: (period: ReportPeriod) => void;
  customFrom?: string;
  customTo?: string;
  onCustomChange?: (from: string, to: string) => void;
  className?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  customFrom = '',
  customTo = '',
  onCustomChange,
  className,
}) => {
  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value as ReportPeriod)}
          className="appearance-none bg-[#1d222a] border border-[#2b313a] text-gray-300 text-[11px] font-bold rounded-xl px-4 py-2.5 pl-9 pr-8 focus:outline-none focus:border-primary/40 transition-all cursor-pointer hover:border-[#3d4652]"
        >
          {Object.entries(PERIOD_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
      </div>

      {value === 'custom' && onCustomChange && (
        <>
          <input
            type="date"
            value={customFrom}
            onChange={e => onCustomChange(e.target.value, customTo)}
            className="bg-[#1d222a] border border-[#2b313a] text-gray-300 text-[11px] rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40 transition-all hover:border-[#3d4652] [color-scheme:dark]"
          />
          <span className="text-gray-600 text-[11px]">to</span>
          <input
            type="date"
            value={customTo}
            onChange={e => onCustomChange(customFrom, e.target.value)}
            className="bg-[#1d222a] border border-[#2b313a] text-gray-300 text-[11px] rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40 transition-all hover:border-[#3d4652] [color-scheme:dark]"
          />
        </>
      )}
    </div>
  );
};
