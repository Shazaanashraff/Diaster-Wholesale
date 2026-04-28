import React from 'react';
import { cn } from '../../../lib/utils';

interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T) => React.ReactNode);
  className?: string;
}

interface ReportTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  className?: string;
}

export function ReportTable<T>({ columns, data, emptyMessage = 'No data available', className }: ReportTableProps<T>) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-[#2b313a] bg-[#171c23]", className)}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-[#1d222a] border-b border-[#2b313a]">
            {columns.map((col, i) => (
              <th key={i} className={cn("px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500", col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2b313a]">
          {data.length > 0 ? (
            data.map((item, i) => (
              <tr key={i} className="hover:bg-[#1f2630] transition-colors">
                {columns.map((col, j) => (
                  <td key={j} className={cn("px-4 py-3 text-sm text-gray-300", col.className)}>
                    {typeof col.accessor === 'function' ? col.accessor(item) : (item[col.accessor] as any)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500 italic">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
