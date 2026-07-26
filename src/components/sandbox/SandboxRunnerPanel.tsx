import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlaskConical,
  Play,
  Square,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ConfirmModal } from '../ConfirmModal';
import { TEST_GROUPS } from '../../sandbox/test-groups';
import { TEST_CASES, type TestCase } from '../../sandbox/test-cases';

type RunStatus = 'idle' | 'running' | 'passed' | 'failed';

const TYPE_SECTIONS: { type: TestCase['type']; label: string }[] = [
  { type: 'unit', label: 'Unit tests' },
  { type: 'integration', label: 'Integration tests (real database)' },
  { type: 'e2e', label: 'End-to-end tests (Playwright)' },
];

function countByType(cases: TestCase[]) {
  return {
    unit: cases.filter(c => c.type === 'unit').length,
    integration: cases.filter(c => c.type === 'integration').length,
    e2e: cases.filter(c => c.type === 'e2e').length,
  };
}

function classifyLine(line: string): 'pass' | 'fail' | 'neutral' {
  if (/(FAIL|ERROR|✗|✕)/.test(line)) return 'fail';
  if (/(^|\s)(✓|PASS|passed)(\s|$)/i.test(line)) return 'pass';
  return 'neutral';
}

const Pill: React.FC<{ color: 'blue' | 'violet' | 'amber'; label: string }> = ({ color, label }) => (
  <span
    className={cn(
      'px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0',
      color === 'blue' && 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      color === 'violet' && 'bg-violet-500/10 text-violet-400 border-violet-500/20',
      color === 'amber' && 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    )}
  >
    {label}
  </span>
);

export const SandboxRunnerPanel: React.FC = () => {
  const [status, setStatus] = useState<RunStatus>('idle');
  const [lines, setLines] = useState<string[]>([]);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const logRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const runner = window.sandboxRunner;

  useEffect(() => {
    if (!runner) return;
    const off = runner.onOutput(line => setLines(prev => [...prev, line]));
    return off;
  }, [runner]);

  useEffect(() => {
    const el = logRef.current;
    if (!el || !pinnedRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  const handleLogScroll = () => {
    const el = logRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };

  const isRunning = status === 'running';

  const startRun = useCallback(
    async (moduleKey: string, type: 'unit' | 'e2e', filter?: { files?: string[]; spec?: string }) => {
      if (!runner || isRunning) return;
      setLines([]);
      setStatus('running');
      setActiveModule(moduleKey);
      try {
        const result = await runner.run(type, filter);
        setStatus(result.ok ? 'passed' : 'failed');
      } catch {
        setStatus('failed');
      } finally {
        setActiveModule(null);
      }
    },
    [runner, isRunning]
  );

  const handleCancel = useCallback(() => {
    runner?.cancel();
  }, [runner]);

  const handleResetConfirm = useCallback(async () => {
    if (!runner) return;
    setResetLoading(true);
    setResetError(null);
    try {
      const result = await runner.reset();
      if (!result.ok) {
        setResetError(result.reason || 'Reset failed.');
      } else {
        setConfirmReset(false);
      }
    } catch (err: any) {
      setResetError(err?.message || 'Reset failed.');
    } finally {
      setResetLoading(false);
    }
  }, [runner]);

  if (!runner) return null;

  return (
    <div className="space-y-6" style={{ animation: 'posFadeIn 220ms ease' }}>
      {/* Header + status badge */}
      <div className="flex items-center justify-between bg-[#171c23] border border-[#2b313a] rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#1d222a] flex items-center justify-center">
            <FlaskConical size={16} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Sandbox Test Runner</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Runs the real test suite against an isolated sandbox — never touches production data
            </p>
          </div>
        </div>

        <span
          role="status"
          aria-live="polite"
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border',
            status === 'idle' && 'bg-[#1d222a] border-[#2b313a] text-gray-400',
            status === 'running' && 'bg-blue-500/10 border-blue-500/30 text-blue-400',
            status === 'passed' && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
            status === 'failed' && 'bg-red-500/10 border-red-500/30 text-red-400'
          )}
        >
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              status === 'idle' && 'bg-gray-500',
              status === 'running' && 'bg-blue-400 sandbox-status-pulse',
              status === 'passed' && 'bg-emerald-400',
              status === 'failed' && 'bg-red-400'
            )}
          />
          {status === 'idle' ? 'Idle' : status === 'running' ? 'Running' : status === 'passed' ? 'Passed' : 'Failed'}
        </span>
      </div>

      {/* Broad actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => startRun('__broad_unit__', 'unit')}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1d222a] border border-[#2b313a] text-gray-300 rounded-xl text-xs font-bold hover:text-white hover:border-blue-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {activeModule === '__broad_unit__' ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
          Run Unit + Integration
        </button>
        <button
          onClick={() => startRun('__broad_e2e__', 'e2e')}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1d222a] border border-[#2b313a] text-gray-300 rounded-xl text-xs font-bold hover:text-white hover:border-amber-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {activeModule === '__broad_e2e__' ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
          Run E2E
        </button>
        <button
          onClick={() => setConfirmReset(true)}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-4 py-2 bg-red-950/20 border border-red-500/30 text-red-400 rounded-xl text-xs font-bold hover:text-white hover:bg-red-950/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <RotateCcw size={13} />
          Reset Sandbox Data
        </button>
        {isRunning && (
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1d222a] border border-gray-500/30 text-gray-300 rounded-xl text-xs font-bold hover:text-white transition-all cursor-pointer"
          >
            <Square size={13} />
            Cancel
          </button>
        )}
      </div>

      {isRunning && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 font-bold">
          <Loader2 size={13} className="animate-spin" />
          Tests are running — other modules are disabled until this finishes.
        </div>
      )}

      {/* Per-module grid */}
      <div className="space-y-2">
        {TEST_GROUPS.map(group => {
          const cases = TEST_CASES[group.id] ?? [];
          const counts = countByType(cases);
          const isExpanded = expanded === group.id;
          const unitKey = `${group.id}:unit`;
          const e2eKey = `${group.id}:e2e`;

          return (
            <div key={group.id} className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <button
                  onClick={() => setExpanded(isExpanded ? null : group.id)}
                  className="flex items-center gap-2 text-left flex-1 min-w-0 cursor-pointer"
                >
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-gray-500 shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-gray-500 shrink-0" />
                  )}
                  <span className="text-xs font-bold text-white truncate">{group.label}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {counts.unit > 0 && <Pill color="blue" label={`${counts.unit} unit`} />}
                    {counts.integration > 0 && <Pill color="violet" label={`${counts.integration} db`} />}
                    {counts.e2e > 0 && <Pill color="amber" label={`${counts.e2e} e2e`} />}
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => startRun(unitKey, 'unit', { files: group.vitestFiles })}
                    disabled={isRunning || group.vitestFiles.length === 0}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1d222a] border border-[#2b313a] text-gray-400 rounded-lg text-[10px] font-bold hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {activeModule === unitKey ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                    Run Tests
                  </button>
                  {group.e2e ? (
                    <button
                      onClick={() => startRun(e2eKey, 'e2e', { spec: group.e2e! })}
                      disabled={isRunning}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1d222a] border border-[#2b313a] text-gray-400 rounded-lg text-[10px] font-bold hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {activeModule === e2eKey ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                      Run E2E
                    </button>
                  ) : (
                    <span className="text-[10px] text-gray-600 italic px-2">no E2E</span>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-[#2b313a] px-4 py-3 space-y-4 bg-[#13171d]">
                  {cases.length === 0 ? (
                    <p className="text-xs text-gray-600 italic">{group.unitDesc}</p>
                  ) : (
                    TYPE_SECTIONS.map(section => {
                      const items = cases.filter(c => c.type === section.type);
                      if (items.length === 0) return null;
                      return (
                        <div key={section.type}>
                          <h5 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                            {section.label}
                          </h5>
                          <ul className="space-y-1.5">
                            {items.map((c, i) => (
                              <li key={i} className="text-xs text-gray-400 leading-relaxed">
                                <span className="font-bold text-gray-300">{c.name}</span> — {c.what}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Streaming log panel */}
      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2b313a] flex items-center justify-between">
          <h4 className="text-xs font-bold text-white">Output</h4>
          <span className="text-[10px] text-gray-600">{lines.length} lines</span>
        </div>
        <div
          ref={logRef}
          onScroll={handleLogScroll}
          className="h-64 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed space-y-1 bg-[#0f1318]"
        >
          {lines.length === 0 ? (
            <p className="text-gray-600 italic">No output yet — run a test to see live output here.</p>
          ) : (
            lines.map((line, i) => {
              const kind = classifyLine(line);
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-2',
                    kind === 'pass' && 'text-emerald-400',
                    kind === 'fail' && 'text-red-400',
                    kind === 'neutral' && 'text-gray-400'
                  )}
                >
                  {kind === 'pass' && <CheckCircle2 size={12} className="mt-0.5 shrink-0" />}
                  {kind === 'fail' && <XCircle size={12} className="mt-0.5 shrink-0" />}
                  <span className="whitespace-pre-wrap break-all">{line}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmReset}
        onClose={() => {
          if (resetLoading) return;
          setConfirmReset(false);
          setResetError(null);
        }}
        onConfirm={handleResetConfirm}
        title="Reset Sandbox Data"
        message="This wipes and reseeds the sandbox schema. It never touches real (public) data, but any in-progress sandbox test state will be lost."
        confirmText="Reset"
        variant="danger"
        isLoading={resetLoading}
        error={resetError}
      />
    </div>
  );
};
