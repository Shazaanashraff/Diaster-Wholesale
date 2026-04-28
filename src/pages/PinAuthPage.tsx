import React, { useState, useEffect, useCallback } from 'react';
import {
  type Role, ROLE_LABELS, ROLE_DESCRIPTIONS, getRolePin,
  ROLE_PIN_KEYS, DEFAULT_PINS,
} from '../utils/permissions';

const MAX_ATTEMPTS = 3;
const PIN_LENGTH = 4;

const ROLES: Role[] = ['admin', 'accountant', 'officer', 'pos_operator'];

const ROLE_ICONS: Record<Role, string> = {
  admin:        '👑',
  accountant:   '📊',
  officer:      '📦',
  pos_operator: '🖥️',
};

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
    const roles: Role[] = ['admin', 'accountant', 'officer', 'pos_operator'];
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

  // Helper methods removed

  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        background: 'radial-gradient(circle at 30% 20%, #2d1b69 0%, #1e1b4b 40%, #0f0a2e 100%)',
        transition: 'opacity 0.4s ease',
        opacity: exitFade ? 0 : 1,
      }}
    >
      {/* ── Success overlay ── */}
      {success && (
        <div
          className="fixed inset-0 flex flex-col items-center justify-center"
          style={{
            background: 'radial-gradient(circle at 50% 50%, #064e3b 0%, #022c22 50%, #011a15 100%)',
            animation: 'success-bg-in 0.35s ease forwards',
            zIndex: 10,
          }}
        >
          <div style={{ position: 'relative', width: 160, height: 160 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', animation: 'ring-pulse 1.2s ease-out 0.3s infinite' }} />
            <div style={{ position: 'absolute', inset: 12, borderRadius: '50%', background: 'rgba(16,185,129,0.08)', animation: 'ring-pulse 1.2s ease-out 0.5s infinite' }} />
            <svg width="160" height="160" viewBox="0 0 160 160" style={{ position: 'relative', zIndex: 1 }}>
              <circle cx="80" cy="80" r="62" fill="none" stroke="rgba(16,185,129,0.25)" strokeWidth="3" />
              <circle cx="80" cy="80" r="62" fill="none" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="389.6" strokeDashoffset="389.6" style={{ animation: 'circle-draw 0.55s cubic-bezier(0.4,0,0.2,1) 0.15s forwards' }} />
              <polyline points="48,82 68,102 112,56" fill="none" stroke="#10b981" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="90" strokeDashoffset="90" style={{ animation: 'check-draw 0.4s cubic-bezier(0.4,0,0.2,1) 0.65s forwards' }} />
            </svg>
          </div>
          <div style={{ marginTop: 28, textAlign: 'center', animation: 'text-rise 0.5s ease 0.9s both' }}>
            <p style={{ color: '#34d399', fontSize: 22, fontWeight: 700, fontFamily: 'Urbanist, sans-serif' }}>
              Access Granted
            </p>
            <p style={{ color: 'rgba(52,211,153,0.55)', fontSize: 13, marginTop: 6, fontFamily: 'Urbanist, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {identifiedRole ? ROLE_LABELS[identifiedRole] : 'Welcome back'}
            </p>
          </div>
        </div>
      )}
      {/* ── PIN entry ── */}
      {!success && (
        <div
          className="flex flex-col items-center gap-8 select-none"
          style={{
            transition: 'opacity 0.2s ease, transform 0.2s ease',
            animation: 'text-rise 0.25s ease',
          }}
        >
          {/* Brand */}
          <div className="text-center">
            <div className="text-3xl font-bold text-white tracking-wide" style={{ fontFamily: 'Urbanist, sans-serif' }}>Diastar</div>
            <div className="text-sm text-purple-300 mt-1 tracking-widest uppercase">Wholesale ERP</div>
          </div>

          {/* Lock icon */}
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>

          {/* PIN dots */}
          <div className="flex gap-5" style={{ animation: shake ? 'pin-shake 0.5s ease' : undefined }}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 18, height: 18, borderRadius: '50%',
                  transition: 'background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
                  background: i < pin.length ? '#a78bfa' : 'transparent',
                  border: '2px solid',
                  borderColor: i < pin.length ? '#a78bfa' : 'rgba(167,139,250,0.4)',
                  transform: i < pin.length ? 'scale(1.15)' : 'scale(1)',
                  boxShadow: i < pin.length ? '0 0 10px rgba(167,139,250,0.6)' : 'none',
                }}
              />
            ))}
          </div>

          {/* Error */}
          <div style={{ height: 20, textAlign: 'center' }}>
            {error && (
              <p className="text-sm" style={{ color: locked ? '#f87171' : '#fca5a5' }}>{error}</p>
            )}
          </div>

          {/* Numpad */}
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {keys.map((k, idx) => {
              if (k === '') return <div key={idx} />;
              const isBackspace = k === '⌫';
              return (
                <button
                  key={idx}
                  onClick={() => isBackspace ? handleBackspace() : handleDigit(k)}
                  disabled={locked}
                  style={{
                    width: 70, height: 70, borderRadius: 16,
                    background: isBackspace ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: isBackspace ? '#a78bfa' : '#f1f5f9',
                    fontSize: isBackspace ? 20 : 22, fontWeight: 600,
                    cursor: locked ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.12s, transform 0.1s',
                    fontFamily: 'Urbanist, sans-serif',
                    opacity: locked ? 0.4 : 1,
                  }}
                  onMouseDown={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = isBackspace ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.14)';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.93)';
                  }}
                  onMouseUp={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = isBackspace ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.06)';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = isBackspace ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.06)';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                  }}
                >
                  {k}
                </button>
              );
            })}
          </div>

          {!locked && (
            <p className="text-xs" style={{ color: 'rgba(167,139,250,0.4)', marginTop: -8 }}>
              Enter your 4-digit PIN
            </p>
          )}
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
