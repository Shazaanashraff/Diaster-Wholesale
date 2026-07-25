import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  StopCircle,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  FlaskConical,
  Loader2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ConfirmModal } from '../ConfirmModal';
import { TEST_GROUPS, type TestGroup } from '../../sandbox/test-groups';
import { TEST_CASES, type TestCase } from '../../sandbox/test-cases';

type RunStatus = 'idle' | 'running' | 'passed' | 'failed';
type CaseType = TestCase['type'];

const PILL_STYLES: Record<CaseType, string> = {
  unit: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  integration: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  e2e: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

const PILL_LABEL: Record<CaseType, string> = {
  unit: 'Unit',
  integration: 'DB',
  e2e: 'E2E',
};

const SECTION_LABEL: Record<CaseType, string> = {
  unit: 'Unit tests',
  integration: 'Integration tests (real database)',
  e2e: 'End-to-end tests (Playwright)',
};

const CASE_TYPES: CaseType[] = ['unit', 'integration', 'e2e'];

function countByType(cases: TestCase[]) {
  return {
    unit: cases.filter(c => c.type === 'unit').length,
    integration: cases.filter(c => c.type === 'integration').length,
    e2e: cases.filter(c => c.type === 'e2e').length,
  };
}

export const SandboxRunnerPanel: React.FC = () => {
  const [status, setStatus] = useState<RunStatus>('idle');
  const [lines, setLines] = useState<string[]>([]);
  const [runningLabel, setRunningLabel] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const cancelledRef = useRef(false);

  const runner = window.sandboxRunner;

  useEffect(() => {
    if (!runner) return;
    const off = runner.onOutput(line => {
      setLines(prev => [...prev, line]);
    });
    return off;
  }, [runner]);

  useEffect(() => {
    if (!pinnedRef.current || !logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines]);

  if (!runner) return null;

  const handleLogScroll = () => {
    const el = logRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    pinnedRef.current = distanceFromBottom < 24;
  };

  const runOne = async (
    label: string,
    type: 'unit' | 'e2e',
    filter?: { files?: string[]; spec?: string }
  ): Promise<boolean> => {
    setRunningLabel(label);
    const result = await runner.run(type, filter);
    if (!result.ok) {
      setLines(prev => [...prev, `FAIL ${result.reason ?? 'run failed'}`]);
    }
    return result.ok && (result.code === undefined || result.code === 0);
  };

  const runSequence = async (steps: Array<() => Promise<boolean>>) => {
    if (status === 'running' || steps.length === 0) return;
    cancelledRef.current = false;
    pinnedRef.current = true;
    setStatus('running');
    let allOk = true;
    for (const step of steps) {
      if (cancelledRef.current) {
        allOk = false;
        break;
      }
      const ok = await step();
      allOk = allOk && ok;
    }
    setRunningLabel(null);
    setStatus(cancelledRef.current ? 'idle' : allOk ? 'passed' : 'failed');
  };

  const runBroadUnit = () => runSequence([() => runOne('Unit + Integration', 'unit')]);

  const runBroadE2E = () => {
    const specs = TEST_GROUPS.filter(g => g.e2e);
    runSequence(specs.map(g => () => runOne(`${g.label} — E2E`, 'e2e', { spec: g.e2e as string })));
  };

  const runModuleUnit = (group: TestGroup) => {
    if (!group.vitestFiles.length) return;
    runSequence([() => runOne(`${group.label} — Unit`, 'unit', { files: group.vitestFiles })]);
  };

  const runModuleE2E = (group: TestGroup) => {
    if (!group.e2e) return;
    runSequence([() => runOne(`${group.label} — E2E`, 'e2e', { spec: group.e2e as string })]);
  };

  const cancelRun = async () => {
    cancelledRef.current = true;
    await runner.cancel();
  };

  const doReset = async () => {
    setResetting(true);
    setLines(prev => [...prev, '— resetting sandbox data —']);
    await runner.reset();
    setResetting(false);
    setConfirmReset(false);
  };

  const toggleExpanded = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isRunning = status === 'running';

  return (
    <div className="space-y-6" style={{ animation: 'posFadeIn 220ms ease' }}>
      {/* Header + status badge */}
      <div className="flex items-center justify-between bg-[#171c23] border border-[#2b313a] rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#2b313a] flex items-center justify-center">
            <FlaskConical size={16} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Sandbox Test Runner</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Runs the automated test suites against the sandbox schema. Dev builds only.
            </p>
          </div>
        </div>

        <div
          role="status"
          aria-live="polite"
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest',
            status === 'idle' && 'bg-[#1d222a] border-[#2b313a] text-gray-400',
            status === 'running' && 'bg-blue-500/10 border-blue-500/20 text-blue-400',
            status === 'passed' && 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
            status === 'failed' && 'bg-red-500/10 border-red-500/20 text-red-400'
          )}
        >
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              status === 'idle' && 'bg-gray-500',
              status === 'running' && 'bg-blue-400 sandbox-status-dot--running',
              status === 'passed' && 'bg-emerald-400',
              status === 'failed' && 'bg-red-400'
            )}
          />
          <span>
            {status === 'idle' && 'Idle'}
            {status === 'running' && (runningLabel ? `Running — ${runningLabel}` : 'Running')}
            {status === 'passed' && 'Passed'}
            {status === 'failed' && 'Failed'}
          </span>
        </div>
      </div>

      {/* Broad actions */}
      <div className="flex flex-wrap items-center gap-3 bg-[#171c23] border border-[#2b313a] rounded-2xl p-5">
        <button
          onClick={runBroadUnit}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1d222a] border border-[#2b313a] text-gray-300 rounded-xl hover:text-white transition-all text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play size={13} />
          <span>Run Unit + Integration</span>
        </button>
        <button
          onClick={runBroadE2E}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1d222a] border border-[#2b313a] text-gray-300 rounded-xl hover:text-white transition-all text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play size={13} />
          <span>Run E2E</span>
        </button>
        <button
          onClick={() => setConfirmReset(true)}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-4 py-2 bg-red-950/20 border border-red-500/30 text-red-400 hover:text-white rounded-xl transition-all text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw size={13} />
          <span>Reset Sandbox Data</span>
        </button>
        {isRunning && (
          <button
            onClick={cancelRun}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-950/20 border border-amber-500/30 text-amber-400 hover:text-white rounded-xl transition-all text-xs font-bold cursor-pointer"
          >
            <StopCircle size={13} />
            <span>Cancel</span>
          </button>
        )}
      </div>

      {/* Per-module grid */}
      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
        {isRunning && (
          <div className="px-5 py-2.5 bg-blue-500/10 border-b border-blue-500/20 text-[10px] font-bold uppercase tracking-widest text-blue-400 flex items-center gap-2">
            <Loader2 size={12} className="animate-spin" />
            <span>Tests are running — other modules are disabled</span>
          </div>
        )}
        <div className="divide-y divide-[#2b313a]">
          {TEST_GROUPS.map(group => {
            const cases = TEST_CASES[group.id] ?? [];
            const counts = countByType(cases);
            const isOpen = !!expanded[group.id];

            return (
              <div key={group.id}>
                <div className="flex items-center justify-between px-5 py-3.5 gap-4">
                  <button
                    onClick={() => toggleExpanded(group.id)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
                  >
                    {isOpen ? (
                      <ChevronDown size={14} className="text-gray-500 shrink-0" />
                    ) : (
                      <ChevronRight size={14} className="text-gray-500 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-white truncate">{group.label}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {CASE_TYPES.filter(t => counts[t] > 0).map(t => (
                        <span
                          key={t}
                          className={cn(
                            'px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border',
                            PILL_STYLES[t]
                          )}
                        >
                          {PILL_LABEL[t]} {counts[t]}
                        </span>
                      ))}
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => runModuleUnit(group)}
                      disabled={isRunning || group.vitestFiles.length === 0}
                      className="px-2.5 py-1.5 bg-[#1d222a] border border-[#2b313a] text-gray-400 rounded-lg text-[10px] font-bold hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Run Tests
                    </button>
                    {group.e2e ? (
                      <button
                        onClick={() => runModuleE2E(group)}
                        disabled={isRunning}
                        className="px-2.5 py-1.5 bg-[#1d222a] border border-[#2b313a] text-gray-400 rounded-lg text-[10px] font-bold hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Run E2E
                      </button>
                    ) : (
                      <span className="px-2.5 py-1.5 text-[10px] font-bold text-gray-600">no E2E</span>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="px-5 pb-4 space-y-3 bg-[#14181f]">
                    {cases.length === 0 ? (
                      <p className="text-[11px] text-gray-600">
                        No automated tests yet — covered manually for now.
                      </p>
                    ) : (
                      CASE_TYPES.map(t => {
                        const items = cases.filter(c => c.type === t);
                        if (items.length === 0) return null;
                        return (
                          <div key={t}>
                            <h5 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                              {SECTION_LABEL[t]}
                            </h5>
                            <ul className="space-y-1">
                              {items.map((c, i) => (
                                <li key={i} className="text-[11px] text-gray-400 leading-relaxed">
                                  <span className="text-gray-300 font-semibold">{c.name}</span> — {c.what}
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
      </div>

      {/* Streaming log panel */}
      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#2b313a] flex items-center justify-between">
          <h4 className="text-xs font-bold text-white">Output Log</h4>
          <button
            onClick={() => setLines([])}
            className="text-[10px] font-bold text-gray-500 hover:text-white cursor-pointer"
          >
            Clear
          </button>
        </div>
        <div
          ref={logRef}
          onScroll={handleLogScroll}
          className="h-72 overflow-y-auto p-4 font-mono text-[11px] space-y-1 bg-[#0f1319]"
        >
          {lines.length === 0 ? (
            <p className="text-gray-600">No output yet.</p>
          ) : (
            lines.map((line, i) => {
              const isPass = line.startsWith('✓');
              const isFail = line.startsWith('FAIL');
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-1.5',
                    isPass && 'text-emerald-400',
                    isFail && 'text-red-400',
                    !isPass && !isFail && 'text-gray-400'
                  )}
                >
                  {isPass && <CheckCircle2 size={12} className="mt-0.5 shrink-0" />}
                  {isFail && <XCircle size={12} className="mt-0.5 shrink-0" />}
                  <span className="whitespace-pre-wrap break-all">{line}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={doReset}
        title="Reset Sandbox Data?"
        message="This truncates every sandbox-schema table and reseeds it. It never touches the real (public) data."
        confirmText="Reset Sandbox"
        variant="danger"
        isLoading={resetting}
      />
    </div>
  );
};
