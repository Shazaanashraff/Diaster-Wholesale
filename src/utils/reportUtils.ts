// ============================================================
// Diastar ERP — Report Utilities
// ============================================================

export type ReportPeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom';

export const PERIOD_LABELS: Record<ReportPeriod, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  quarter: 'This Quarter',
  year: 'This Year',
  all: 'All Time',
  custom: 'Custom Range',
};

export function getReportDateRange(
  period: ReportPeriod,
  customFrom?: string,
  customTo?: string
): { from: string | null; to: string | null } {
  const now = new Date();
  switch (period) {
    case 'today': {
      const s = new Date(now);
      s.setHours(0, 0, 0, 0);
      return { from: s.toISOString(), to: now.toISOString() };
    }
    case 'week': {
      const s = new Date(now);
      s.setDate(now.getDate() - 7);
      return { from: s.toISOString(), to: now.toISOString() };
    }
    case 'month':
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        to: now.toISOString(),
      };
    case 'quarter':
      return {
        from: new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString(),
        to: now.toISOString(),
      };
    case 'year':
      return {
        from: new Date(now.getFullYear(), 0, 1).toISOString(),
        to: now.toISOString(),
      };
    case 'custom': {
      const from = customFrom ? new Date(customFrom + 'T00:00:00').toISOString() : null;
      const to = customTo ? new Date(customTo + 'T23:59:59').toISOString() : null;
      return { from, to };
    }
    case 'all':
    default:
      return { from: null, to: null };
  }
}

export function fmtCurrency(value: number): string {
  return `LKR ${value.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDate(isoString: string): string {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleDateString('en-LK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function fmtDateShort(isoString: string): string {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleDateString('en-LK', {
    day: '2-digit',
    month: 'short',
  });
}

export function daysBetween(from: string, to?: string): number {
  const d1 = new Date(from);
  const d2 = to ? new Date(to) : new Date();
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

export function getAgingBucket(days: number): '0-30' | '31-60' | '61-90' | '90+' {
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

// CSV Export
export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csvContent = [
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

// A cheque only counts toward any total once it has actually cleared —
// it may bounce or sit in float for weeks otherwise. Non-cheque payments
// have no cheque_status and always count.
export function isClearedForReporting(p: { cheque_status?: string | null }): boolean {
  return p.cheque_status == null || p.cheque_status === 'completed';
}
