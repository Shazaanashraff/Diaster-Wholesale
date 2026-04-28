import React from 'react';

interface ReportSkeletonProps {
  rows?: number;
  kpis?: number;
}

export const ReportSkeleton: React.FC<ReportSkeletonProps> = ({ rows = 5, kpis = 4 }) => (
  <div className="space-y-6">
    {/* KPI row */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: kpis }).map((_, i) => (
        <div key={i} className="h-24 rounded-2xl skeleton" style={{ animationDelay: `${i * 60}ms` }} />
      ))}
    </div>
    {/* Table */}
    <div className="rounded-2xl border border-[#2b313a] overflow-hidden">
      <div className="h-10 bg-[#1d222a] border-b border-[#2b313a]" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 border-b border-[#2b313a] skeleton last:border-0" style={{ animationDelay: `${i * 40}ms` }} />
      ))}
    </div>
  </div>
);
