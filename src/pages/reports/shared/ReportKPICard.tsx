import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { AnimatedNumber } from '../../../components/AnimatedNumber';

interface ReportKPICardProps {
  label: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  icon?: LucideIcon;
  trend?: string;
  isUp?: boolean;
  color?: string;
  className?: string;
  animate?: boolean;
}

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  'bg-blue-600':   { bg: 'bg-[#1e3a5f]', text: 'text-blue-400' },
  'bg-green-600':  { bg: 'bg-[#1a3a2a]', text: 'text-green-400' },
  'bg-red-600':    { bg: 'bg-[#3a1a1a]', text: 'text-red-400' },
  'bg-purple-600': { bg: 'bg-primary/15', text: 'text-primary' },
  'bg-orange-600': { bg: 'bg-[#3a2a1a]', text: 'text-orange-400' },
  'bg-cyan-600':   { bg: 'bg-[#1a3a3a]', text: 'text-cyan-400' },
};

export const ReportKPICard: React.FC<ReportKPICardProps> = ({
  label,
  value,
  prefix = '',
  suffix = '',
  icon: Icon,
  trend,
  isUp,
  color = 'bg-purple-600',
  animate = true,
  className,
}) => {
  const palette = COLOR_MAP[color] ?? { bg: 'bg-primary/15', text: 'text-primary' };

  const displayValue = typeof value === 'number' 
    ? (animate ? <AnimatedNumber value={value} /> : value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    : value;

  return (
    <div className={cn(
      'p-5 rounded-2xl border border-[#2b313a] bg-[#171c23] flex flex-col gap-3 transition-all hover:border-[#3d4652]',
      className
    )}>
      <div className="flex items-center justify-between">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', palette.bg)}>
          {Icon && <Icon size={17} className={palette.text} />}
        </div>
        {trend && (
          <span className={cn(
            'text-[10px] font-bold px-2 py-0.5 rounded-full',
            isUp ? 'bg-green-900/20 text-green-400 border border-green-900/30'
                 : 'bg-red-900/20 text-red-400 border border-red-900/30'
          )}>
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{label}</p>
        <h4 className="text-2xl font-bold text-white mt-1 tracking-tight">
          {prefix}{displayValue}{suffix}
        </h4>
      </div>
    </div>
  );
};
