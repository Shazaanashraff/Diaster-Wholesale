import React, { useState, useEffect, useCallback } from 'react';
import { Delete, LockKeyhole, ShieldCheck } from 'lucide-react';
import {
  type Role, ROLE_LABELS, getRolePin,
} from '../utils/permissions';

const MAX_ATTEMPTS = 3;
const PIN_LENGTH = 4;

interface PinAuthPageProps {
  onSuccess: () => void;
}

export const PinAuthPage: React.FC<PinAuthPageProps> = ({ onSuccess }) => {
  const [pin, setPin]             = useState('');
  const [attempts, setAttempts]   = useState(0);
  const [error, setError]         = useState('');
  const [shake, setShake]         = useState(false);
  const [locked, setLocked]       = useState(false);
  const [success, setSuccess]     = useState(false);
  const [exitFade, setExitFade]   = useState(false);
  const [identifiedRole, setIdentifiedRole] = useState<Role | null>(null);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const submitPin = useCallback((entered: string) => {
    // Check which role this PIN belongs to
    const roles: Role[] = ['admin', 'accountant', 'officer', 'pos_operator', 'warehouse'];
    let matchingRole: Role | null = null;

    for (const r of roles) {
      if (entered === getRolePin(r)) {
        matchingRole = r;
        break;
      }
    }

    if (matchingRole) {
      sessionStorage.setItem('pin_auth', '1');
      sessionStorage.setItem('user_role', matchingRole);
      setIdentifiedRole(matchingRole);
      setSuccess(true);
      setTimeout(() => setExitFade(true), 1600);
      setTimeout(() => onSuccess(), 2000);
      return;
    }

    const next = attempts + 1;
    setAttempts(next);
    triggerShake();
    if (next >= MAX_ATTEMPTS) {
      setLocked(true);
      setError('Too many attempts. App locked.');
    } else {
      setError(`Incorrect PIN. ${MAX_ATTEMPTS - next} attempt${MAX_ATTEMPTS - next === 1 ? '' : 's'} remaining.`);
    }
    setPin('');
  }, [attempts, onSuccess]);

  const handleDigit = useCallback((digit: string) => {
    if (locked || success) return;
    setError('');
    setPin(prev => {
      if (prev.length >= PIN_LENGTH) return prev;
      const next = prev + digit;
      if (next.length === PIN_LENGTH) setTimeout(() => submitPin(next), 80);
      return next;
    });
  }, [locked, success, submitPin]);

  const handleBackspace = useCallback(() => {
    if (locked || success) return;
    setError('');
    setPin(prev => prev.slice(0, -1));
  }, [locked, success]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key);
      else if (e.key === 'Backspace' || e.key === 'Delete') handleBackspace();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleDigit, handleBackspace]);

  const keys = ['1','2','3','4','5','6','7','8','9','','0','backspace'];

  return (
    <div
      className="fixed inset-0 app-cosy flex items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(circle at top left, #12161d 0%, #0d1016 60%, #090c11 100%)',
        transition: 'opacity 0.4s ease',
        opacity: exitFade ? 0 : 1,
      }}
    >
      {/* ── Success overlay ── */}
      {success && (
        <div
          className="fixed inset-0 flex flex-col items-center justify-center"
          style={{
            background: 'radial-gradient(circle at 50% 50%, #12352d 0%, #0b1f1c 50%, #090c11 100%)',
            animation: 'success-bg-in 0.35s ease forwards',
            zIndex: 10,
          }}
        >
          <div style={{ position: 'relative', width: 160, height: 160 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', animation: 'ring-pulse 1.2s ease-out 0.3s infinite' }} />
            <div style={{ position: 'absolute', inset: 12, borderRadius: '50%', background: 'rgba(16,185,129,0.08)', animation: 'ring-pulse 1.2s ease-out 0.5s infinite' }} />
            <div
              className="relative z-[1] w-[160px] h-[160px] rounded-full border border-emerald-400/30 bg-[#171c23] flex items-center justify-center"
              style={{ animation: 'text-rise 0.45s ease both' }}
            >
              <ShieldCheck size={72} className="text-emerald-400" strokeWidth={1.8} />
            </div>
          </div>
          <div style={{ marginTop: 28, textAlign: 'center', animation: 'text-rise 0.5s ease 0.9s both' }}>
            <p style={{ color: '#f8fafc', fontSize: 22, fontWeight: 700, fontFamily: 'Inter, Urbanist, sans-serif' }}>
              Access Granted
            </p>
            <p style={{ color: '#6ee7b7', fontSize: 12, marginTop: 6, fontFamily: 'Inter, Urbanist, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
              {identifiedRole ? ROLE_LABELS[identifiedRole] : 'Welcome back'}
            </p>
          </div>
        </div>
      )}
      {/* ── PIN entry ── */}
      {!success && (
        <div
          className="w-full max-w-5xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-stretch select-none"
          style={{
            transition: 'opacity 0.2s ease, transform 0.2s ease',
            animation: 'text-rise 0.25s ease',
          }}
        >
          <div className="hidden lg:flex flex-col justify-between rounded-2xl border border-[#2b313a] bg-[#11161d] p-8">
            <div className="pos-brand">
              <div className="pos-brand-logo">D</div>
              <div className="pos-brand-meta">
                <span>Diastar</span>
                <p>Wholesale ERP</p>
              </div>
            </div>
            <div className="space-y-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] font-bold text-gray-500">Secure Session</p>
                <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">Sign in with your staff PIN.</h1>
              </div>
              <p className="max-w-md text-sm leading-6 text-gray-400">
                Access follows your assigned role for POS, inventory, finance, procurement, and reports.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {['POS', 'Stock', 'Reports'].map((label) => (
                <div key={label} className="rounded-xl border border-[#2b313a] bg-[#171c23] px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
                  <p className="mt-1 text-xs font-bold text-white">Ready</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#2b313a] bg-[#171c23] p-6 shadow-2xl shadow-black/30 flex flex-col items-center justify-center gap-6">
            <div className="lg:hidden pos-brand self-start">
              <div className="pos-brand-logo">D</div>
              <div className="pos-brand-meta">
                <span>Diastar</span>
                <p>Wholesale ERP</p>
              </div>
            </div>

            <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-[#1d222a] border border-[#2b313a]">
              <LockKeyhole size={24} className="text-white" strokeWidth={1.8} />
            </div>

            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.24em] font-bold text-gray-500">Staff Access</p>
              <h2 className="mt-2 text-xl font-bold text-white">Enter PIN</h2>
            </div>

            <div className="flex gap-3" style={{ animation: shake ? 'pin-shake 0.5s ease' : undefined }}>
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 44, height: 48, borderRadius: 12,
                    transition: 'background 0.15s ease, transform 0.15s ease, border-color 0.15s ease',
                    background: i < pin.length ? '#f8fafc' : '#1d222a',
                    border: '1px solid',
                    borderColor: i < pin.length ? '#f8fafc' : '#2b313a',
                    transform: i < pin.length ? 'translateY(-1px)' : 'translateY(0)',
                    boxShadow: i < pin.length ? '0 10px 26px rgba(248,250,252,0.08)' : 'none',
                  }}
                />
              ))}
            </div>

            <div className="h-5 text-center">
              {error && (
                <p className="text-xs font-semibold" style={{ color: locked ? '#f87171' : '#fbbf24' }}>{error}</p>
              )}
            </div>

            <div className="grid gap-2.5 w-full max-w-[252px]" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {keys.map((k, idx) => {
                if (k === '') return <div key={idx} />;
                const isBackspace = k === 'backspace';
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => isBackspace ? handleBackspace() : handleDigit(k)}
                    disabled={locked}
                    className="h-[64px] rounded-xl border border-[#2b313a] bg-[#1d222a] text-white hover:bg-[#252b35] active:scale-[0.96] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center font-bold transition-all"
                    style={{ fontSize: isBackspace ? 18 : 20 }}
                    aria-label={isBackspace ? 'Delete digit' : `Digit ${k}`}
                  >
                    {isBackspace ? <Delete size={20} /> : k}
                  </button>
                );
              })}
            </div>

            {!locked && (
              <p className="text-[11px] font-semibold text-gray-500">
                Use keyboard or number pad
              </p>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pin-shake {
          0%, 100% { transform: translateX(0); }
          15%  { transform: translateX(-8px); }
          30%  { transform: translateX(8px); }
          45%  { transform: translateX(-6px); }
          60%  { transform: translateX(6px); }
          75%  { transform: translateX(-3px); }
          90%  { transform: translateX(3px); }
        }
        @keyframes success-bg-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes circle-draw { to { stroke-dashoffset: 0; } }
        @keyframes check-draw  { to { stroke-dashoffset: 0; } }
        @keyframes ring-pulse {
          0%   { transform: scale(1);    opacity: 0.7; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        @keyframes text-rise {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
