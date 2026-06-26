import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CheckCircle,
  XCircle,
  Loader2,
  FlaskConical,
  Play,
  Square,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Terminal,
} from 'lucide-react';
import { TEST_GROUPS } from '../../sandbox/test-groups';
import { TEST_CASES } from '../../sandbox/test-cases';
import { cn } from '../../lib/utils';

type RunStatus = 'idle' | 'running' | 'passed' | 'failed';

function LogLine({ line }: { line: string }) {
  if (line.startsWith('✓')) {
    return (
      <div className="flex items-start gap-1.5 text-emerald-400">
        <CheckCircle size={11} className="shrink-0 mt-[2px]" aria-hidden />
        <span>{line.slice(1).trimStart()}</span>
      </div>
    );
  }
  if (/^FAIL\b/.test(line) || line.startsWith('✗')) {
    return (
      <div className="flex items-start gap-1.5 text-red-400">
        <XCircle size={11} className="shrink-0 mt-[2px]" aria-hidden />
        <span>{line}</span>
      </div>
    );
  }
  return <div className="text-gray-400">{line}</div>;
}

function StatusBadge({ status }: { status: RunStatus }) {
  if (status === 'running') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-widest"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 motion-safe:animate-ping" />
        Running
      </div>
    );
  }
  if (status === 'passed') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest"
      >
        <CheckCircle size={12} aria-hidden />
        Passed
      </div>
    );
  }
  if (status === 'failed') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-widest"
      >
        <XCircle size={12} aria-hidden />
        Failed
      </div>
    );
  }
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-500/10 border border-gray-500/20 text-gray-400 text-[10px] font-bold uppercase tracking-widest"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
      Idle
    </div>
  );
}

function getPillCounts(groupId: string) {
  const cases = TEST_CASES[groupId] ?? [];
  return {
    unit: cases.filter(c => c.type === 'unit').length,
    integration: cases.filter(c => c.type === 'integration').length,
    e2e: cases.filter(c => c.type === 'e2e').length,
  };
}

export const SandboxRunnerPanel: React.FC = () => {
  const [status, setStatus] = useState<RunStatus>('idle');
  const [lines, setLines] = useState<string[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const logRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  useEffect(() => {
    const runner = (window as any).sandboxRunner;
    if (!runner) return;
    const off = runner.onOutput((line: string) => {
      setLines(prev => [...prev, line]);
    });
    return off;
  }, []);

  useEffect(() => {
    if (!pinned.current || !logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines]);

  const handleScroll = () => {
    const el = logRef.current;
    if (!el) return;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
  };

  const startRun = useCallback(
    async (fn: () => Promise<{ ok: boolean; code: number | null }>) => {
      setStatus('running');
      setLines([]);
      pinned.current = true;
      try {
        const result = await fn();
        setStatus(result.ok ? 'passed' : 'failed');
      } catch {
        setStatus('failed');
      }
    },
    []
  );

  const handleRunAll = () => {
    const runner = (window as any).sandboxRunner;
    if (!runner) return;
    startRun(() => runner.run('unit'));
  };

  const handleRunE2E = () => {
    const runner = (window as any).sandboxRunner;
    if (!runner) return;
    startRun(() => runner.run('e2e'));
  };

  const handleCancel = async () => {
    const runner = (window as any).sandboxRunner;
    if (!runner) return;
    await runner.cancel();
    setStatus('idle');
  };

  const handleConfirmReset = async () => {
    const runner = (window as any).sandboxRunner;
    if (!runner) return;
    setConfirmReset(false);
    setStatus('running');
    setLines([]);
    pinned.current = true;
    try {
      const result = await runner.reset();
      setStatus(result.ok ? 'passed' : 'failed');
    } catch {
      setStatus('failed');
    }
  };

  const handleRunModule = (
    _groupId: string,
    vitestFiles: string[],
    e2eSpec: string | null,
    runType: 'unit' | 'e2e'
  ) => {
    const runner = (window as any).sandboxRunner;
    if (!runner) return;
    if (runType === 'e2e' && e2eSpec) {
      startRun(() => runner.run('e2e', { spec: e2eSpec }));
    } else if (vitestFiles.length > 0) {
      startRun(() => runner.run('unit', { files: vitestFiles }));
    }
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const isRunning = status === 'running';

  return (
    <div className="space-y-4" style={{ animation: 'posFadeIn 220ms ease' }}>
      {/* ── Header ── */}
      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FlaskConical size={16} className="text-violet-400" />
            <h3 className="text-sm font-bold text-white">Sandbox Test Runner</h3>
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRunAll}
            disabled={isRunning}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer',
              'bg-blue-600 hover:bg-blue-700 text-white',
              isRunning && 'opacity-50 pointer-events-none'
            )}
          >
            <Play size={12} />
            Run Unit + Integration
          </button>

          <button
            onClick={handleRunE2E}
            disabled={isRunning}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer',
              'bg-amber-600 hover:bg-amber-700 text-white',
              isRunning && 'opacity-50 pointer-events-none'
            )}
          >
            <Play size={12} />
            Run E2E
          </button>

          <button
            onClick={() => setConfirmReset(true)}
            disabled={isRunning}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer',
              'bg-rose-950/40 border border-rose-500/30 hover:border-rose-500/60 text-rose-400',
              isRunning && 'opacity-50 pointer-events-none'
            )}
          >
            <RotateCcw size={12} />
            Reset Sandbox Data
          </button>

          {isRunning && (
            <button
              onClick={handleCancel}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-gray-700 hover:bg-gray-600 text-white transition-all cursor-pointer"
            >
              <Square size={12} />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* ── Running banner ── */}
      {isRunning && (
        <div className="flex items-center gap-2 px-4 py-3 bg-blue-950/30 border border-blue-500/20 rounded-xl text-xs text-blue-300 font-medium">
          <Loader2 size={13} className="animate-spin shrink-0" />
          Tests are running — per-module buttons are disabled until the run completes.
        </div>
      )}

      {/* ── Per-module grid ── */}
      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#2b313a] flex items-center justify-between">
          <h4 className="text-xs font-bold text-white uppercase tracking-widest">Test Modules</h4>
          <span className="text-[10px] text-gray-500">{TEST_GROUPS.length} modules</span>
        </div>

        <div className="divide-y divide-[#2b313a]">
          {TEST_GROUPS.map(group => {
            const pills = getPillCounts(group.id);
            const hasTests = group.vitestFiles.length > 0;
            const hasE2E = !!group.e2e;
            const isExpanded = expandedGroups.has(group.id);
            const cases = TEST_CASES[group.id] ?? [];

            return (
              <div key={group.id}>
                <div className="px-5 py-3 hover:bg-[#1d222a] transition-colors">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className="text-gray-500 hover:text-gray-300 transition-colors cursor-pointer shrink-0"
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${group.label}`}
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>

                    <span className="text-xs font-semibold text-white flex-1 min-w-0 truncate">
                      {group.label}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {pills.unit > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {pills.unit} unit
                        </span>
                      )}
                      {pills.integration > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20">
                          {pills.integration} db
                        </span>
                      )}
                      {pills.e2e > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {pills.e2e} e2e
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {hasTests ? (
                        <button
                          onClick={() =>
                            handleRunModule(group.id, group.vitestFiles, group.e2e, 'unit')
                          }
                          disabled={isRunning}
                          className={cn(
                            'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer',
                            'bg-[#1d222a] border border-[#2b313a] text-gray-400 hover:text-white hover:border-blue-500/40',
                            isRunning && 'opacity-40 pointer-events-none'
                          )}
                        >
                          <Play size={10} />
                          Run Tests
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-600 w-[72px] text-center">
                          no tests
                        </span>
                      )}

                      {hasE2E ? (
                        <button
                          onClick={() =>
                            handleRunModule(group.id, group.vitestFiles, group.e2e, 'e2e')
                          }
                          disabled={isRunning}
                          className={cn(
                            'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer',
                            'bg-[#1d222a] border border-[#2b313a] text-amber-400 hover:text-amber-300 hover:border-amber-500/40',
                            isRunning && 'opacity-40 pointer-events-none'
                          )}
                        >
                          <Play size={10} />
                          E2E
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-700 w-[52px] text-center">—</span>
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-5 pb-4 pt-1 bg-[#1a1f27] border-t border-[#2b313a]/60">
                    {cases.length === 0 ? (
                      <p className="text-[11px] text-gray-600 italic mt-2">{group.unitDesc}</p>
                    ) : (
                      (['unit', 'integration', 'e2e'] as const).map(type => {
                        const typedCases = cases.filter(c => c.type === type);
                        if (typedCases.length === 0) return null;
                        const sectionLabel =
                          type === 'unit'
                            ? 'Unit tests'
                            : type === 'integration'
                            ? 'Integration tests (real database)'
                            : 'End-to-end tests (Playwright)';
                        const sectionColor =
                          type === 'unit'
                            ? 'text-blue-400'
                            : type === 'integration'
                            ? 'text-violet-400'
                            : 'text-amber-400';
                        return (
                          <div key={type} className="mt-3">
                            <p
                              className={cn(
                                'text-[10px] font-bold uppercase tracking-widest mb-2',
                                sectionColor
                              )}
                            >
                              {sectionLabel}
                            </p>
                            <div className="space-y-1.5">
                              {typedCases.map((tc, i) => (
                                <div key={i} className="flex items-start gap-2 text-[11px]">
                                  <span className="shrink-0 text-gray-600 font-mono mt-[1px]">
                                    ·
                                  </span>
                                  <div>
                                    <span className="font-semibold text-gray-200">{tc.name}</span>
                                    <span className="text-gray-600"> — </span>
                                    <span className="text-gray-500">{tc.what}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
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
      </div>

      {/* ── Streaming log panel ── */}
      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#2b313a] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Terminal size={13} className="text-gray-500" />
            <h4 className="text-xs font-bold text-white">Output Log</h4>
          </div>
          {lines.length > 0 && (
            <button
              onClick={() => setLines([])}
              className="text-[10px] text-gray-600 hover:text-gray-400 font-bold cursor-pointer transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <div
          ref={logRef}
          onScroll={handleScroll}
          className="h-64 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed space-y-0.5"
        >
          {lines.length === 0 ? (
            <p className="text-gray-600 italic">
              No output yet — run tests to see streamed output here.
            </p>
          ) : (
            lines.map((line, i) => <LogLine key={i} line={line} />)
          )}
        </div>
      </div>

      {/* ── Reset confirm dialog ── */}
      {confirmReset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-dialog-title"
        >
          <div className="bg-[#1d222a] border border-[#2b313a] rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-rose-400 shrink-0" />
              <h3 id="reset-dialog-title" className="text-sm font-bold text-white">
                Reset Sandbox Data?
              </h3>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              This will truncate all sandbox tables and re-run the seed script.{' '}
              <strong className="text-white">Public production data is never touched.</strong> Any
              sandbox invoices, stock changes, or customer balances you've created will be lost.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setConfirmReset(false)}
                className="px-4 py-2 rounded-xl bg-[#171c23] border border-[#2b313a] text-gray-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReset}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Reset Sandbox
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
