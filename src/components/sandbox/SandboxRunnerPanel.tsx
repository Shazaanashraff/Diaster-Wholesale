import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Square, RotateCcw, ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { TEST_GROUPS } from '../../sandbox/test-groups';
import { TEST_CASES, type TestCase } from '../../sandbox/test-cases';
import { cn } from '../../lib/utils';

type RunStatus = 'idle' | 'running' | 'passed' | 'failed';
type LogLineKind = 'pass' | 'fail' | 'neutral';
interface LogLine {
  text: string;
  kind: LogLineKind;
}

function classifyLine(line: string): LogLineKind {
  const l = line.toLowerCase();
  if (/\bfail(ed|ure)?\b|\berror\b/.test(l)) return 'fail';
  if (/\bpass(ed)?\b|✓|\bok\b/.test(l)) return 'pass';
  return 'neutral';
}

const STATUS_LABEL: Record<RunStatus, string> = {
  idle: 'Idle',
  running: 'Running',
  passed: 'Passed',
  failed: 'Failed',
};

export const SandboxRunnerPanel: React.FC = () => {
  const [status, setStatus] = useState<RunStatus>('idle');
  const [lines, setLines] = useState<LogLine[]>([]);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const logRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  useEffect(() => {
    const runner = window.sandboxRunner;
    if (!runner) return;
    const off = runner.onOutput(line => {
      setLines(prev => [...prev, { text: line, kind: classifyLine(line) }]);
    });
    return off;
  }, []);

  useEffect(() => {
    if (pinnedRef.current && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [lines]);

  const handleLogScroll = () => {
    const el = logRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };

  const runAndTrack = useCallback(
    async (moduleKey: string, type: 'unit' | 'e2e', filter?: { files?: string[]; spec?: string }) => {
      const runner = window.sandboxRunner;
      if (!runner || status === 'running') return;
      setStatus('running');
      setActiveModule(moduleKey);
      pinnedRef.current = true;
      try {
        const result = await runner.run(type, filter);
        setStatus(result.ok ? 'passed' : 'failed');
      } catch {
        setStatus('failed');
      } finally {
        setActiveModule(null);
      }
    },
    [status]
  );

  const handleCancel = async () => {
    const runner = window.sandboxRunner;
    if (!runner) return;
    await runner.cancel();
    setStatus('idle');
    setActiveModule(null);
  };

  const handleResetConfirm = async () => {
    const runner = window.sandboxRunner;
    if (!runner) return;
    setResetting(true);
    try {
      await runner.reset();
    } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!window.sandboxRunner) return null;

  const isRunning = status === 'running';

  return (
    <div className="space-y-6" style={{ animation: 'posFadeIn 220ms ease' }}>
      {/* Header */}
      <div className="flex items-center justify-between bg-[#171c23] border border-[#2b313a] rounded-2xl p-5">
        <div>
          <h3 className="text-sm font-bold text-white">Sandbox Test Runner</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Run the automated test suites against the isolated sandbox schema.
          </p>
        </div>
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 px-3 py-1.5 bg-[#1d222a] border border-[#2b313a] rounded-xl"
        >
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              status === 'idle' && 'bg-gray-500',
              status === 'running' && 'bg-amber-400 sandbox-status-dot--running',
              status === 'passed' && 'bg-emerald-400',
              status === 'failed' && 'bg-rose-400'
            )}
          />
          <span
            className={cn(
              'text-[10px] font-bold uppercase tracking-widest',
              status === 'idle' && 'text-gray-400',
              status === 'running' && 'text-amber-400',
              status === 'passed' && 'text-emerald-400',
              status === 'failed' && 'text-rose-400'
            )}
          >
            {STATUS_LABEL[status]}
          </span>
        </div>
      </div>

      {/* Broad actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => runAndTrack('broad:unit', 'unit')}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-black font-bold rounded-xl text-xs hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play size={13} />
          Run Unit + Integration
        </button>
        <button
          onClick={() => runAndTrack('broad:e2e', 'e2e')}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1d222a] border border-[#2b313a] text-gray-300 font-bold rounded-xl text-xs hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play size={13} />
          Run E2E
        </button>
        <button
          onClick={() => setConfirmReset(true)}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-4 py-2 bg-red-950/20 border border-red-500/30 text-red-400 hover:text-white font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw size={13} />
          Reset Sandbox Data
        </button>
        {isRunning && (
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1d222a] border border-amber-500/40 text-amber-400 font-bold rounded-xl text-xs hover:text-white transition-colors cursor-pointer"
          >
            <Square size={13} />
            Cancel
          </button>
        )}
      </div>

      {isRunning && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-950/20 border border-amber-500/30 rounded-xl text-xs text-amber-300 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 sandbox-status-dot--running" />
          Tests are running — other modules are disabled until this finishes.
        </div>
      )}

      {/* Per-module grid */}
      <div className="space-y-2">
        {TEST_GROUPS.map(group => {
          const cases = TEST_CASES[group.id] ?? [];
          const unitCount = cases.filter(c => c.type === 'unit').length;
          const integrationCount = cases.filter(c => c.type === 'integration').length;
          const e2eCount = cases.filter(c => c.type === 'e2e').length;
          const isExpanded = expanded.has(group.id);
          const hasCases = cases.length > 0;

          return (
            <div key={group.id} className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between gap-3 p-4">
                <button
                  onClick={() => hasCases && toggleExpand(group.id)}
                  disabled={!hasCases}
                  className="flex items-center gap-2 text-left flex-1 min-w-0 cursor-pointer disabled:cursor-default"
                >
                  {hasCases ? (
                    isExpanded ? (
                      <ChevronDown size={14} className="text-gray-500 shrink-0" />
                    ) : (
                      <ChevronRight size={14} className="text-gray-500 shrink-0" />
                    )
                  ) : (
                    <span className="w-[14px] shrink-0" />
                  )}
                  <span className="text-xs font-bold text-white truncate">{group.label}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {unitCount > 0 && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {unitCount} unit
                      </span>
                    )}
                    {integrationCount > 0 && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-black bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        {integrationCount} integration
                      </span>
                    )}
                    {e2eCount > 0 && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {e2eCount} e2e
                      </span>
                    )}
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => runAndTrack(`${group.id}:unit`, 'unit', { files: group.vitestFiles })}
                    disabled={isRunning || group.vitestFiles.length === 0}
                    className="px-3 py-1.5 bg-[#1d222a] border border-[#2b313a] text-gray-300 rounded-lg text-[10px] font-bold hover:text-white transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Run Tests
                  </button>
                  {group.e2e ? (
                    <button
                      onClick={() => runAndTrack(`${group.id}:e2e`, 'e2e', { spec: group.e2e! })}
                      disabled={isRunning}
                      className="px-3 py-1.5 bg-[#1d222a] border border-[#2b313a] text-gray-300 rounded-lg text-[10px] font-bold hover:text-white transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Run E2E
                    </button>
                  ) : (
                    <span className="px-3 py-1.5 text-[10px] font-bold text-gray-600">no E2E</span>
                  )}
                </div>
              </div>

              {isExpanded && hasCases && (
                <div className="border-t border-[#2b313a] bg-[#12161c] px-4 py-3 space-y-4">
                  <SandboxCaseSection title="Unit tests" cases={cases.filter(c => c.type === 'unit')} />
                  <SandboxCaseSection
                    title="Integration tests (real database)"
                    cases={cases.filter(c => c.type === 'integration')}
                  />
                  <SandboxCaseSection
                    title="End-to-end tests (Playwright)"
                    cases={cases.filter(c => c.type === 'e2e')}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Streaming log panel */}
      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#2b313a] flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Live Output</span>
          {activeModule && <span className="text-[10px] font-mono text-gray-600">{activeModule}</span>}
        </div>
        <div
          ref={logRef}
          onScroll={handleLogScroll}
          className="h-64 overflow-y-auto px-4 py-3 font-mono text-[11px] leading-relaxed"
        >
          {lines.length === 0 ? (
            <p className="text-gray-600">No output yet.</p>
          ) : (
            lines.map((line, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex items-start gap-1.5',
                  line.kind === 'pass' && 'text-emerald-400',
                  line.kind === 'fail' && 'text-rose-400',
                  line.kind === 'neutral' && 'text-gray-400'
                )}
              >
                {line.kind === 'pass' && <CheckCircle2 size={12} className="shrink-0 mt-0.5" />}
                {line.kind === 'fail' && <XCircle size={12} className="shrink-0 mt-0.5" />}
                {line.kind === 'neutral' && <span className="w-[12px] shrink-0" />}
                <span className="whitespace-pre-wrap break-all">{line.text}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Reset confirm dialog */}
      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle size={18} />
              <h4 className="text-sm font-bold text-white">Reset Sandbox Data?</h4>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              This truncates and reseeds the <code className="font-mono text-gray-300">sandbox</code> schema. It
              never touches <code className="font-mono text-gray-300">public</code> data.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmReset(false)}
                className="px-4 py-2 bg-[#1d222a] border border-[#2b313a] text-gray-300 rounded-xl text-xs font-bold hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleResetConfirm}
                disabled={resetting}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {resetting ? 'Resetting...' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SandboxCaseSection: React.FC<{ title: string; cases: TestCase[] }> = ({ title, cases }) => {
  if (cases.length === 0) return null;
  return (
    <div>
      <h5 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">{title}</h5>
      <ul className="space-y-1">
        {cases.map((c, idx) => (
          <li key={idx} className="text-[11px] text-gray-400 leading-relaxed">
            <span className="font-semibold text-gray-300">{c.name}</span>
            {' — '}
            {c.what}
          </li>
        ))}
      </ul>
    </div>
  );
};
