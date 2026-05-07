import React, { useState, useEffect } from 'react';
import { Banknote, CreditCard, Smartphone, Building, Wallet, FileText, Split } from 'lucide-react';
import { cn } from '../lib/utils';

export type PaymentMethodType = 'cash' | 'card' | 'cheque' | 'credit' | 'online' | 'bank_transfer';

export interface PaymentLineData {
  method: PaymentMethodType;
  amount: number;
  cheque_number?: string;
  bank_name?: string;
  due_date?: string;
}

interface PaymentMethodSelectorProps {
  total: number;
  onChange: (lines: PaymentLineData[]) => void;
  className?: string;
}

const METHOD_CONFIG: Record<PaymentMethodType, { label: string; icon: React.ElementType; color: string }> = {
  cash:          { label: 'Cash',       icon: Banknote,    color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' },
  card:          { label: 'Card',       icon: CreditCard,  color: 'text-blue-400 border-blue-500/40 bg-blue-500/10' },
  cheque:        { label: 'Cheque',     icon: FileText,    color: 'text-amber-400 border-amber-500/40 bg-amber-500/10' },
  credit:        { label: 'Credit',     icon: Wallet,      color: 'text-purple-400 border-purple-500/40 bg-purple-500/10' },
  online:        { label: 'Online',     icon: Smartphone,  color: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10' },
  bank_transfer: { label: 'Bank',       icon: Building,    color: 'text-sky-400 border-sky-500/40 bg-sky-500/10' },
};

const ALL_METHODS = Object.keys(METHOD_CONFIG) as PaymentMethodType[];

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  total,
  onChange,
  className,
}) => {
  const [isMixed, setIsMixed] = useState(false);
  const [primaryMethod, setPrimaryMethod] = useState<PaymentMethodType>('cash');
  const [secondaryMethod, setSecondaryMethod] = useState<PaymentMethodType>('bank_transfer');
  const [primaryAmount, setPrimaryAmount] = useState('');
  const [chequeFields, setChequeFields] = useState<Record<'primary' | 'secondary', { number: string; bank: string; date: string }>>({
    primary: { number: '', bank: '', date: '' },
    secondary: { number: '', bank: '', date: '' },
  });

  const secondaryAmount = isMixed
    ? Math.max(0, total - (parseFloat(primaryAmount) || 0))
    : 0;

  useEffect(() => {
    if (!isMixed) {
      const line: PaymentLineData = {
        method: primaryMethod,
        amount: total,
        cheque_number: primaryMethod === 'cheque' ? chequeFields.primary.number : undefined,
        bank_name: primaryMethod === 'cheque' ? chequeFields.primary.bank : undefined,
        due_date: primaryMethod === 'cheque' ? chequeFields.primary.date : undefined,
      };
      onChange([line]);
    } else {
      const amt1 = parseFloat(primaryAmount) || 0;
      const amt2 = secondaryAmount;
      const lines: PaymentLineData[] = [
        {
          method: primaryMethod,
          amount: amt1,
          cheque_number: primaryMethod === 'cheque' ? chequeFields.primary.number : undefined,
          bank_name: primaryMethod === 'cheque' ? chequeFields.primary.bank : undefined,
          due_date: primaryMethod === 'cheque' ? chequeFields.primary.date : undefined,
        },
        {
          method: secondaryMethod,
          amount: amt2,
          cheque_number: secondaryMethod === 'cheque' ? chequeFields.secondary.number : undefined,
          bank_name: secondaryMethod === 'cheque' ? chequeFields.secondary.bank : undefined,
          due_date: secondaryMethod === 'cheque' ? chequeFields.secondary.date : undefined,
        },
      ];
      onChange(lines);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMixed, primaryMethod, secondaryMethod, primaryAmount, chequeFields, total]);

  const fmt = (n: number) => 'LKR ' + n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const ChequeFields = ({ slot }: { slot: 'primary' | 'secondary' }) => (
    <div className="mt-2 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-1">Cheque No. *</label>
          <input
            type="text"
            value={chequeFields[slot].number}
            onChange={e => setChequeFields(p => ({ ...p, [slot]: { ...p[slot], number: e.target.value } }))}
            placeholder="CHQ-001234"
            className="w-full bg-[#111315] border border-amber-500/30 text-amber-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500/60"
          />
        </div>
        <div>
          <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-1">Bank *</label>
          <input
            type="text"
            value={chequeFields[slot].bank}
            onChange={e => setChequeFields(p => ({ ...p, [slot]: { ...p[slot], bank: e.target.value } }))}
            placeholder="Bank of Ceylon"
            className="w-full bg-[#111315] border border-amber-500/30 text-amber-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500/60"
          />
        </div>
      </div>
      <div>
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-1">Due Date *</label>
        <input
          type="date"
          value={chequeFields[slot].date}
          onChange={e => setChequeFields(p => ({ ...p, [slot]: { ...p[slot], date: e.target.value } }))}
          className="w-full bg-[#111315] border border-amber-500/30 text-amber-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500/60"
        />
      </div>
    </div>
  );

  return (
    <div className={cn('space-y-3', className)}>
      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsMixed(false)}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[10px] font-bold transition-all',
            !isMixed ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-[#1d222a] border-[#2b313a] text-gray-500 hover:border-[#3d4652]'
          )}
        >
          Single Method
        </button>
        <button
          type="button"
          onClick={() => setIsMixed(true)}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[10px] font-bold transition-all',
            isMixed ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-[#1d222a] border-[#2b313a] text-gray-500 hover:border-[#3d4652]'
          )}
        >
          <Split size={11} /> Mixed / Partial
        </button>
      </div>

      {!isMixed ? (
        /* ── Single Method ── */
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {ALL_METHODS.map(m => {
              const cfg = METHOD_CONFIG[m];
              const Icon = cfg.icon;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPrimaryMethod(m)}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[10px] font-bold transition-all',
                    primaryMethod === m ? cfg.color : 'bg-[#1d222a] border-[#2b313a] text-gray-500 hover:border-[#3d4652]'
                  )}
                >
                  <Icon size={14} />
                  {cfg.label}
                </button>
              );
            })}
          </div>
          {primaryMethod === 'cheque' && <ChequeFields slot="primary" />}
          <div className="flex items-center justify-between px-1 text-xs">
            <span className="text-gray-500">Amount</span>
            <span className="font-mono font-bold text-white">{fmt(total)}</span>
          </div>
        </div>
      ) : (
        /* ── Mixed / Partial ── */
        <div className="space-y-3">
          {/* Line 1 */}
          <div className="bg-[#1d222a] border border-[#2b313a] rounded-xl p-3 space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Line 1</p>
            <div className="grid grid-cols-3 gap-1.5">
              {ALL_METHODS.map(m => {
                const cfg = METHOD_CONFIG[m];
                const Icon = cfg.icon;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPrimaryMethod(m)}
                    className={cn(
                      'flex flex-col items-center gap-0.5 py-2 rounded-lg border text-[9px] font-bold transition-all',
                      primaryMethod === m ? cfg.color : 'bg-[#171c23] border-[#2b313a] text-gray-600 hover:border-[#3d4652]'
                    )}
                  >
                    <Icon size={12} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
            {primaryMethod === 'cheque' && <ChequeFields slot="primary" />}
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-1">Amount (LKR) *</label>
              <input
                type="number"
                min="0"
                max={total}
                step="0.01"
                value={primaryAmount}
                onChange={e => setPrimaryAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#111315] border border-[#2b313a] text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary/40 font-mono"
              />
            </div>
          </div>

          {/* Line 2 — auto-calculated */}
          <div className="bg-[#1d222a] border border-[#2b313a] rounded-xl p-3 space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Line 2 (Remainder)</p>
            <div className="grid grid-cols-3 gap-1.5">
              {ALL_METHODS.map(m => {
                const cfg = METHOD_CONFIG[m];
                const Icon = cfg.icon;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSecondaryMethod(m)}
                    className={cn(
                      'flex flex-col items-center gap-0.5 py-2 rounded-lg border text-[9px] font-bold transition-all',
                      secondaryMethod === m ? cfg.color : 'bg-[#171c23] border-[#2b313a] text-gray-600 hover:border-[#3d4652]'
                    )}
                  >
                    <Icon size={12} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
            {secondaryMethod === 'cheque' && <ChequeFields slot="secondary" />}
            <div className="flex items-center justify-between px-1 text-xs">
              <span className="text-gray-500">Auto-calculated</span>
              <span className={cn('font-mono font-bold', secondaryAmount < 0 ? 'text-red-400' : 'text-emerald-400')}>
                {fmt(secondaryAmount)}
              </span>
            </div>
          </div>

          {/* Sum validation */}
          {parseFloat(primaryAmount) > 0 && (
            <div className={cn(
              'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold',
              Math.abs((parseFloat(primaryAmount) || 0) + secondaryAmount - total) < 0.01
                ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            )}>
              <span>Total Check</span>
              <span className="font-mono">{fmt((parseFloat(primaryAmount) || 0) + secondaryAmount)} / {fmt(total)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
