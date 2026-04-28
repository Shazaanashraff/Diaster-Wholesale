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
}

export const ReportKPICard: React.FC<ReportKPICardProps> = ({
  label,
  value,
  prefix = '',
  suffix = '',
  icon: Icon,
  trend,
  isUp,
  color = 'bg-accent',
  className
}) => {
  return (
    <div className={cn("p-5 rounded-2xl border border-[#2b313a] bg-[#171c23] flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between">
        <div className={cn("p-2 rounded-xl", color)}>
          {Icon && <Icon size={18} className="text-white" />}
        </div>
        {trend && (
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", isUp ? "bg-green-900/20 text-green-400" : "bg-red-900/20 text-red-400")}>
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
        <h4 className="text-2xl font-bold text-white mt-1">
          {prefix}
          {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
          {suffix}
        </h4>
      </div>
    </div>
  );
};
