import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  RotateCcw,
  Ban,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  FlaskConical,
} from 'lucide-react';
import { TEST_GROUPS, type TestGroup } from '../../sandbox/test-groups';
import { TEST_CASES, type TestCase } from '../../sandbox/test-cases';
import { ConfirmModal } from '../ConfirmModal';
import { cn } from '../../lib/utils';

type RunStatus = 'idle' | 'running' | 'passed' | 'failed';

const FAIL_LINE = /fail|error|✗|✖/i;
const PASS_LINE = /pass|✓|✔/i;

function pillCounts(groupId: string) {
  const cases = TEST_CASES[groupId] ?? [];
  return {
    unit: cases.filter(c => c.type === 'unit').length,
    integration: cases.filter(c => c.type === 'integration').length,
    e2e: cases.filter(c => c.type === 'e2e').length,
  };
}

function casesByType(groupId: string, type: TestCase['type']) {
  return (TEST_CASES[groupId] ?? []).filter(c => c.type === type);
}

const SECTIONS: { type: TestCase['type']; label: string }[] = [
  { type: 'unit', label: 'Unit tests' },
  { type: 'integration', label: 'Integration tests (real database)' },
  { type: 'e2e', label: 'End-to-end tests (Playwright)' },
];

export const SandboxRunnerPanel: React.FC = () => {
  const [status, setStatus] = useState<RunStatus>('idle');
  const [lines, setLines] = useState<string[]>([]);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const [, forceRerender] = useState(0);

  const running = status === 'running';

  useEffect(() => {
    const runner = (window as any).sandboxRunner;
    if (!runner) return;
    const off = runner.onOutput((line: string) => {
      setLines(prev => [...prev, line]);
    });
    return off;
  }, []);

  useEffect(() => {
    const el = logRef.current;
    if (!el || !pinnedRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  const handleLogScroll = useCallback(() => {
    const el = logRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (pinnedRef.current !== atBottom) {
      pinnedRef.current = atBottom;
      forceRerender(n => n + 1);
    }
  }, []);

  const runner = () => (window as any).sandboxRunner;

  const startRun = useCallback((moduleId: string | null) => {
    setLines([]);
    pinnedRef.current = true;
    setActiveModule(moduleId);
    setStatus('running');
  }, []);

  const finishRun = useCallback((ok: boolean) => {
    setStatus(ok ? 'passed' : 'failed');
    setActiveModule(null);
  }, []);

  const runBroad = async (type: 'unit' | 'e2e') => {
    if (running) return;
    startRun('__broad__');
    const result = await runner().run(type);
    finishRun(result.ok);
  };

  const runModule = async (group: TestGroup) => {
    if (running || group.vitestFiles.length === 0) return;
    startRun(group.id);
    const result = await runner().run('unit', { files: group.vitestFiles });
    finishRun(result.ok);
  };

  const runModuleE2E = async (group: TestGroup) => {
    if (running || !group.e2e) return;
    startRun(group.id);
    const result = await runner().run('e2e', { spec: group.e2e });
    finishRun(result.ok);
  };

  const cancel = async () => {
    await runner().cancel();
    setStatus('idle');
    setActiveModule(null);
  };

  const doReset = async () => {
    setResetLoading(true);
    try {
      await runner().reset();
      setConfirmReset(false);
    } finally {
      setResetLoading(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const badgeConfig: Record<RunStatus, { label: string; className: string }> = {
    idle: { label: 'Idle', className: 'bg-[#1d222a] border-[#2b313a] text-gray-400' },
    running: { label: 'Running', className: 'bg-blue-500/10 border-blue-500/30 text-blue-400' },
    passed: { label: 'Passed', className: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
    failed: { label: 'Failed', className: 'bg-red-500/10 border-red-500/30 text-red-400' },
  };
  const badge = badgeConfig[status];

  return (
    <div className="space-y-6" style={{ animation: 'posFadeIn 220ms ease' }}>
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
            <FlaskConical size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Sandbox Test Runner</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Run the automated test suites against an isolated sandbox schema
            </p>
          </div>
        </div>

        <div
          role="status"
          aria-live="polite"
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest',
            badge.className
          )}
        >
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              status === 'running' && 'bg-blue-400 animate-pulse motion-reduce:animate-none',
              status === 'passed' && 'bg-emerald-400',
              status === 'failed' && 'bg-red-400',
              status === 'idle' && 'bg-gray-500'
            )}
          />
          {badge.label}
        </div>
      </div>

      {/* ── BROAD ACTIONS ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => runBroad('unit')}
          disabled={running}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#1d222a] border border-[#2b313a] text-gray-300 rounded-xl hover:text-white transition-all text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play size={13} />
          Run Unit + Integration
        </button>
        <button
          onClick={() => runBroad('e2e')}
          disabled={running}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#1d222a] border border-[#2b313a] text-gray-300 rounded-xl hover:text-white transition-all text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play size={13} />
          Run E2E
        </button>
        <button
          onClick={() => setConfirmReset(true)}
          disabled={running}
          className="flex items-center gap-1.5 px-3 py-2 bg-red-950/40 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-950/70 transition-all text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw size={13} />
          Reset Sandbox Data
        </button>
        {running && (
          <button
            onClick={cancel}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-950/40 border border-amber-500/30 text-amber-400 rounded-xl hover:bg-amber-950/70 transition-all text-xs font-bold cursor-pointer"
          >
            <Ban size={13} />
            Cancel
          </button>
        )}
      </div>

      {running && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 font-medium">
          <Loader2 size={13} className="animate-spin motion-reduce:animate-none" />
          Tests are running — module actions are disabled until this run finishes.
        </div>
      )}

      {/* ── MODULE GRID ── */}
      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl divide-y divide-[#2b313a] overflow-hidden">
        {TEST_GROUPS.map(group => {
          const counts = pillCounts(group.id);
          const isOpen = !!expanded[group.id];
          const isBusy = running && activeModule === group.id;
          return (
            <div key={group.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => toggleExpanded(group.id)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
                >
                  {isOpen ? (
                    <ChevronUp size={14} className="text-gray-500 shrink-0" />
                  ) : (
                    <ChevronDown size={14} className="text-gray-500 shrink-0" />
                  )}
                  <span className="text-xs font-bold text-white truncate">{group.label}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {counts.unit > 0 && (
                      <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-bold">
                        {counts.unit} unit
                      </span>
                    )}
                    {counts.integration > 0 && (
                      <span className="px-2 py-0.5 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 text-[9px] font-bold">
                        {counts.integration} integration
                      </span>
                    )}
                    {counts.e2e > 0 && (
                      <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold">
                        {counts.e2e} e2e
                      </span>
                    )}
                  </div>
                </button>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => runModule(group)}
                    disabled={running || group.vitestFiles.length === 0}
                    title={group.vitestFiles.length === 0 ? 'No automated tests yet' : undefined}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1d222a] border border-[#2b313a] text-gray-300 rounded-lg hover:text-white transition-all text-[10px] font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {isBusy && !group.e2e ? <Loader2 size={11} className="animate-spin motion-reduce:animate-none" /> : <Play size={11} />}
                    Run Tests
                  </button>
                  {group.e2e ? (
                    <button
                      onClick={() => runModuleE2E(group)}
                      disabled={running}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1d222a] border border-[#2b313a] text-gray-300 rounded-lg hover:text-white transition-all text-[10px] font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {isBusy && group.e2e ? <Loader2 size={11} className="animate-spin motion-reduce:animate-none" /> : <Play size={11} />}
                      Run E2E
                    </button>
                  ) : (
                    <span className="px-2.5 py-1.5 text-[10px] font-bold text-gray-600">no E2E</span>
                  )}
                </div>
              </div>

              {isOpen && (
                <div className="px-4 pb-4 pl-9 space-y-4" style={{ animation: 'posFadeIn 180ms ease' }}>
                  {SECTIONS.map(section => {
                    const cases = casesByType(group.id, section.type);
                    if (cases.length === 0) return null;
                    return (
                      <div key={section.type}>
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                          {section.label}
                        </h4>
                        <ul className="space-y-1">
                          {cases.map(c => (
                            <li key={c.name} className="text-xs text-gray-400 leading-relaxed">
                              <span className="text-gray-300 font-medium">{c.name}</span>
                              {' — '}
                              {c.what}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                  {counts.unit === 0 && counts.integration === 0 && counts.e2e === 0 && (
                    <p className="text-xs text-gray-500">{group.unitDesc}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── STREAMING LOG PANEL ── */}
      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#2b313a]">
          <h4 className="text-xs font-bold text-white">Output</h4>
        </div>
        <div
          ref={logRef}
          onScroll={handleLogScroll}
          className="h-64 overflow-y-auto px-4 py-3 font-mono text-[11px] leading-relaxed bg-[#10141a]"
        >
          {lines.length === 0 ? (
            <p className="text-gray-600">No output yet</p>
          ) : (
            lines.map((line, i) => {
              const isFail = FAIL_LINE.test(line);
              const isPass = !isFail && PASS_LINE.test(line);
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-1.5',
                    isFail ? 'text-red-400' : isPass ? 'text-emerald-400' : 'text-gray-400'
                  )}
                >
                  {isFail && <XCircle size={12} className="shrink-0 mt-0.5" />}
                  {isPass && <CheckCircle2 size={12} className="shrink-0 mt-0.5" />}
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
        title="Reset Sandbox Data"
        message="This wipes and reseeds the sandbox schema. It never touches your real data, but any in-progress sandbox test state will be lost."
        confirmText="Reset"
        variant="danger"
        isLoading={resetLoading}
      />
    </div>
  );
};
