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

export function ReportTable<T>({
  columns,
  data,
  emptyMessage = 'No data available for this period.',
  className,
}: ReportTableProps<T>) {
  return (
    <div className={cn('overflow-x-auto rounded-2xl border border-[#2b313a] bg-[#171c23]', className)}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-[#1d222a] border-b border-[#2b313a]">
            {columns.map((col, i) => (
              <th
                key={i}
                className={cn(
                  'px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-500',
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2b313a]">
          {data.length > 0 ? (
            data.map((item, i) => (
              <tr
                key={i}
                className="hover:bg-[#1d222a] transition-colors"
                style={{ animation: `posFadeIn 200ms ease both`, animationDelay: `${i * 25}ms` }}
              >
                {columns.map((col, j) => (
                  <td
                    key={j}
                    className={cn('px-5 py-3.5 text-[12px] text-gray-300', col.className)}
                  >
                    {typeof col.accessor === 'function'
                      ? col.accessor(item)
                      : (item[col.accessor] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-5 py-12 text-center">
                <p className="text-sm text-gray-600 font-semibold">{emptyMessage}</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
