import React, { useState, useEffect, useRef } from 'react';
import {
  FlaskConical,
  Play,
  RotateCcw,
  Square,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { TEST_GROUPS } from '../../sandbox/test-groups';
import { TEST_CASES } from '../../sandbox/test-cases';
import { cn } from '../../lib/utils';

type RunStatus = 'idle' | 'running' | 'passed' | 'failed';

export const SandboxRunnerPanel: React.FC = () => {
  const [status, setStatus] = useState<RunStatus>('idle');
  const [lines, setLines] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [confirmReset, setConfirmReset] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);
  const runner = window.sandboxRunner!;

  useEffect(() => {
    const off = runner.onOutput((line) => {
      setLines((prev) => [...prev, line]);
    });
    return off;
  }, [runner]);

  useEffect(() => {
    if (isAtBottom && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [lines, isAtBottom]);

  const handleScroll = () => {
    if (!logRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logRef.current;
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < 30);
  };

  async function runSuite(type: 'unit' | 'e2e', filter?: { files?: string[]; spec?: string }) {
    setStatus('running');
    setLines([]);
    try {
      const result = await runner.run(type, filter);
      setStatus(result.ok ? 'passed' : 'failed');
    } catch {
      setStatus('failed');
    }
  }

  async function handleReset() {
    setConfirmReset(false);
    setStatus('running');
    setLines([]);
    try {
      const result = await runner.reset();
      setStatus(result.ok ? 'passed' : 'failed');
    } catch {
      setStatus('failed');
    }
  }

  function toggleGroup(id: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const isRunning = status === 'running';

  return (
    <div className="space-y-5">
      {/* Status badge */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FlaskConical size={15} className="text-violet-400" />
            Sandbox Test Runner
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Run vitest and Playwright suites against the isolated sandbox schema
          </p>
        </div>
        <div
          role="status"
          aria-live="polite"
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold',
            status === 'idle'    && 'bg-[#1d222a] border-[#2b313a] text-gray-500',
            status === 'running' && 'bg-blue-950/30 border-blue-500/30 text-blue-400',
            status === 'passed'  && 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400',
            status === 'failed'  && 'bg-rose-950/30 border-rose-500/30 text-rose-400',
          )}
        >
          {status === 'running' && (
            <span className="w-2 h-2 rounded-full bg-blue-400 motion-safe:animate-pulse" />
          )}
          {status === 'passed' && <CheckCircle2 size={12} />}
          {status === 'failed' && <XCircle size={12} />}
          {status === 'idle' && <span className="w-2 h-2 rounded-full bg-gray-600" />}
          {status === 'idle' ? 'Idle' : status === 'running' ? 'Running…' : status === 'passed' ? 'Passed' : 'Failed'}
        </div>
      </div>

      {/* Broad action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => runSuite('unit')}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play size={12} />
          Run Unit + Integration
        </button>
        <button
          onClick={() => runSuite('e2e', { spec: 'pos-checkout' })}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white font-bold rounded-xl text-xs hover:bg-amber-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Zap size={12} />
          Run E2E
        </button>
        <button
          onClick={() => setConfirmReset(true)}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-4 py-2 bg-rose-950/40 border border-rose-500/30 text-rose-400 font-bold rounded-xl text-xs hover:bg-rose-950/60 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RotateCcw size={12} />
          Reset Sandbox Data
        </button>
        {isRunning && (
          <button
            onClick={() => runner.cancel()}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1d222a] border border-[#2b313a] text-gray-400 font-bold rounded-xl text-xs hover:text-white transition-colors cursor-pointer"
          >
            <Square size={12} />
            Cancel
          </button>
        )}
      </div>

      {/* Confirm reset dialog */}
      {confirmReset && (
        <div className="p-4 bg-rose-950/20 border border-rose-500/30 rounded-xl flex items-center justify-between gap-4">
          <p className="text-xs text-rose-300 font-medium">
            This will truncate all sandbox tables (except app_meta) and replay the baseline seed.
            Public production data is never touched.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleReset}
              className="px-3 py-1.5 bg-rose-600 text-white font-bold text-xs rounded-xl cursor-pointer hover:bg-rose-700"
            >
              Confirm Reset
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              className="px-3 py-1.5 bg-[#1d222a] border border-[#2b313a] text-gray-400 font-bold text-xs rounded-xl cursor-pointer hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Running banner */}
      {isRunning && (
        <div className="p-3 bg-blue-950/20 border border-blue-500/20 rounded-xl text-xs text-blue-400 font-medium">
          Tests are running — per-module actions are disabled until the run completes.
        </div>
      )}

      {/* Per-module grid */}
      <div className="space-y-2">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Test Modules</h4>
        {TEST_GROUPS.map((group) => {
          const cases = TEST_CASES[group.id] ?? [];
          const unitCount = cases.filter((c) => c.type === 'unit').length;
          const integrationCount = cases.filter((c) => c.type === 'integration').length;
          const e2eCount = cases.filter((c) => c.type === 'e2e').length;
          const expanded = expandedGroups.has(group.id);

          return (
            <div key={group.id} className="bg-[#1d222a] border border-[#2b313a] rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="flex items-center gap-2 flex-1 text-left cursor-pointer min-w-0"
                >
                  {expanded
                    ? <ChevronDown size={13} className="text-gray-400 shrink-0" />
                    : <ChevronRight size={13} className="text-gray-400 shrink-0" />}
                  <span className="text-xs font-bold text-white truncate">{group.label}</span>
                  <div className="flex items-center gap-1.5 ml-1 shrink-0">
                    {unitCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {unitCount} unit
                      </span>
                    )}
                    {integrationCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        {integrationCount} db
                      </span>
                    )}
                    {e2eCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {e2eCount} e2e
                      </span>
                    )}
                  </div>
                </button>

                <div className="flex items-center gap-1.5 shrink-0">
                  {group.vitestFiles.length > 0 ? (
                    <button
                      onClick={() => runSuite('unit', { files: group.vitestFiles })}
                      disabled={isRunning}
                      className="px-2.5 py-1 bg-blue-600/20 border border-blue-500/20 text-blue-400 font-bold text-[9px] rounded-lg cursor-pointer hover:bg-blue-600/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Run Tests
                    </button>
                  ) : null}
                  {group.e2e ? (
                    <button
                      onClick={() => runSuite('e2e', { spec: group.e2e! })}
                      disabled={isRunning}
                      className="px-2.5 py-1 bg-amber-600/20 border border-amber-500/20 text-amber-400 font-bold text-[9px] rounded-lg cursor-pointer hover:bg-amber-600/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Run E2E
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 text-gray-600 text-[9px] font-bold">no E2E</span>
                  )}
                </div>
              </div>

              {expanded && (
                <div className="border-t border-[#2b313a] px-4 py-3 space-y-4">
                  <p className="text-[10px] text-gray-500 leading-relaxed">{group.unitDesc}</p>
                  {(['unit', 'integration', 'e2e'] as const).map((type) => {
                    const typeCases = cases.filter((c) => c.type === type);
                    if (typeCases.length === 0) return null;
                    const sectionLabel =
                      type === 'unit'        ? 'Unit tests' :
                      type === 'integration' ? 'Integration tests (real database)' :
                                               'End-to-end tests (Playwright)';
                    return (
                      <div key={type}>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-2">
                          {sectionLabel}
                        </p>
                        <div className="space-y-1">
                          {typeCases.map((tc, i) => (
                            <div key={i} className="flex gap-2 text-[10px]">
                              <span className="text-gray-600 mt-0.5 shrink-0">›</span>
                              <span>
                                <span className="font-semibold text-gray-300">{tc.name}</span>
                                {' — '}
                                <span className="text-gray-500">{tc.what}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Streaming log panel */}
      <div className="space-y-2">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Output Log</h4>
        <div
          ref={logRef}
          onScroll={handleScroll}
          className="h-56 overflow-y-auto font-mono text-[10px] bg-[#0e1117] border border-[#2b313a] rounded-xl p-3 space-y-0.5"
        >
          {lines.length === 0 ? (
            <span className="text-gray-600">No output yet — run a test suite to see results here.</span>
          ) : (
            lines.map((line, i) => {
              const isPass = /^[✓√]/.test(line) || /✓ done$/.test(line);
              const isFail = /^[×✗]/.test(line) || /^FAIL\b/.test(line);
              return (
                <div
                  key={i}
                  className={cn(
                    'whitespace-pre-wrap break-all leading-relaxed',
                    isPass && 'text-emerald-400',
                    isFail && 'text-rose-400',
                    !isPass && !isFail && 'text-gray-400',
                  )}
                  aria-label={isPass ? `Pass: ${line}` : isFail ? `Fail: ${line}` : undefined}
                >
                  <span aria-hidden="true">{isPass ? '✓ ' : isFail ? '✗ ' : '  '}</span>
                  {line}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
