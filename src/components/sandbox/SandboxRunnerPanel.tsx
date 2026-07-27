import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  RefreshCw,
  Square,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  FlaskConical,
} from 'lucide-react';
import { TEST_GROUPS, type TestGroup } from '../../sandbox/test-groups';
import { TEST_CASES, type TestCase } from '../../sandbox/test-cases';
import { cn } from '../../lib/utils';
import { ConfirmModal } from '../ConfirmModal';

type RunStatus = 'idle' | 'running' | 'passed' | 'failed';

const SECTION_LABELS: Record<TestCase['type'], string> = {
  unit: 'Unit tests',
  integration: 'Integration tests (real database)',
  e2e: 'End-to-end tests (Playwright)',
};

const PILL_STYLES: Record<'blue' | 'violet' | 'amber', string> = {
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

const Pill: React.FC<{ color: keyof typeof PILL_STYLES; label: string }> = ({ color, label }) => (
  <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-black border shrink-0', PILL_STYLES[color])}>
    {label}
  </span>
);

const STATUS_META: Record<RunStatus, { label: string; badge: string; dot: string }> = {
  idle: { label: 'Idle', badge: 'bg-[#1d222a] border-[#2b313a] text-gray-400', dot: 'bg-gray-500' },
  running: { label: 'Running', badge: 'bg-blue-500/10 border-blue-500/20 text-blue-400', dot: 'bg-blue-400' },
  passed: { label: 'Passed', badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', dot: 'bg-emerald-400' },
  failed: { label: 'Failed', badge: 'bg-red-500/10 border-red-500/20 text-red-400', dot: 'bg-red-400' },
};

export const SandboxRunnerPanel: React.FC = () => {
  const runner = window.sandboxRunner;

  const [status, setStatus] = useState<RunStatus>('idle');
  const [lines, setLines] = useState<string[]>([]);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const cancelledRef = useRef(false);
  const logRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true);

  useEffect(() => {
    if (!runner) return;
    const off = runner.onOutput((line) => setLines((prev) => [...prev, line]));
    return off;
  }, [runner]);

  useEffect(() => {
    if (pinnedRef.current && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [lines]);

  const handleLogScroll = useCallback(() => {
    const el = logRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    pinnedRef.current = distanceFromBottom < 24;
  }, []);

  const e2eGroups = useMemo(() => TEST_GROUPS.filter((g) => g.e2e), []);

  const execute = useCallback(
    async (label: string, fn: () => Promise<{ ok: boolean; code?: number; reason?: string }>) => {
      if (!runner || status === 'running') return;
      cancelledRef.current = false;
      setActiveLabel(label);
      setStatus('running');
      const result = await fn();
      if (cancelledRef.current) {
        setStatus('idle');
      } else if (result.ok && (result.code === undefined || result.code === 0)) {
        setStatus('passed');
      } else {
        setStatus('failed');
      }
      setActiveLabel(null);
    },
    [runner, status]
  );

  if (!runner) return null;

  const runUnitAll = () => execute('Unit + Integration', () => runner.run('unit'));

  const runE2eAll = () =>
    execute('End-to-end', async () => {
      let failed = false;
      for (const group of e2eGroups) {
        if (cancelledRef.current) break;
        const result = await runner.run('e2e', { spec: group.e2e as string });
        if (!(result.ok && (result.code === undefined || result.code === 0))) failed = true;
      }
      return { ok: !failed };
    });

  const runModuleUnit = (group: TestGroup) =>
    execute(`${group.label} — Unit`, () => runner.run('unit', { files: group.vitestFiles }));

  const runModuleE2e = (group: TestGroup) => {
    if (!group.e2e) return;
    execute(`${group.label} — E2E`, () => runner.run('e2e', { spec: group.e2e as string }));
  };

  const handleCancel = async () => {
    cancelledRef.current = true;
    await runner.cancel();
  };

  const handleReset = async () => {
    setResetting(true);
    await runner.reset();
    setResetting(false);
    setConfirmReset(false);
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isRunning = status === 'running';
  const meta = STATUS_META[status];

  return (
    <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl p-5 space-y-6" style={{ animation: 'posFadeIn 220ms ease' }}>
      {/* ── HEADER ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2b313a] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#1d222a] flex items-center justify-center">
            <FlaskConical size={16} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Sandbox Test Runner</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Run the automated test catalog against an isolated database, live
            </p>
          </div>
        </div>

        <div
          role="status"
          aria-live="polite"
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest',
            meta.badge
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot, isRunning && 'sandbox-status-dot--running')} />
          <span>{meta.label}</span>
        </div>
      </div>

      {/* ── BROAD ACTIONS ── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={runUnitAll}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1d222a] border border-[#2b313a] text-gray-300 rounded-xl text-xs font-bold hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Play size={13} />
          <span>Run Unit + Integration</span>
        </button>
        <button
          onClick={runE2eAll}
          disabled={isRunning || e2eGroups.length === 0}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1d222a] border border-[#2b313a] text-gray-300 rounded-xl text-xs font-bold hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Play size={13} />
          <span>Run E2E</span>
        </button>
        <button
          onClick={() => setConfirmReset(true)}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-4 py-2 bg-red-950/20 border border-red-500/30 text-red-400 rounded-xl text-xs font-bold hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <RefreshCw size={13} />
          <span>Reset Sandbox Data</span>
        </button>
        {isRunning && (
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-950/20 border border-amber-500/30 text-amber-400 rounded-xl text-xs font-bold hover:text-white transition-all cursor-pointer"
          >
            <Square size={13} />
            <span>Cancel</span>
          </button>
        )}
      </div>

      {isRunning && (
        <div className="px-4 py-2.5 bg-blue-500/5 border border-blue-500/20 rounded-xl text-xs text-blue-300 flex items-center gap-2">
          <RefreshCw size={13} className="animate-spin shrink-0" />
          <span>
            Tests are running{activeLabel ? ` — ${activeLabel}` : ''}. Other modules are disabled until this finishes.
          </span>
        </div>
      )}

      {/* ── PER-MODULE GRID ── */}
      <div className="space-y-2">
        {TEST_GROUPS.map((group) => {
          const cases = TEST_CASES[group.id] ?? [];
          const unitCount = cases.filter((c) => c.type === 'unit').length;
          const integrationCount = cases.filter((c) => c.type === 'integration').length;
          const e2eCount = cases.filter((c) => c.type === 'e2e').length;
          const isExpanded = expanded.has(group.id);
          const isActiveRow = activeLabel?.startsWith(group.label) ?? false;

          return (
            <div key={group.id} className="bg-[#1d222a] border border-[#2b313a] rounded-xl overflow-hidden">
              <div className={cn('flex flex-wrap items-center justify-between gap-3 px-4 py-3', isRunning && !isActiveRow && 'opacity-50')}>
                <button
                  onClick={() => toggleExpand(group.id)}
                  className="flex items-center gap-2 text-left flex-1 min-w-[220px] cursor-pointer"
                >
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-gray-500 shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-gray-500 shrink-0" />
                  )}
                  <span className="text-xs font-bold text-white truncate">{group.label}</span>
                  {isActiveRow && <RefreshCw size={11} className="text-blue-400 animate-spin shrink-0" />}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {unitCount > 0 && <Pill color="blue" label={`${unitCount} unit`} />}
                    {integrationCount > 0 && <Pill color="violet" label={`${integrationCount} integration`} />}
                    {e2eCount > 0 && <Pill color="amber" label={`${e2eCount} e2e`} />}
                  </div>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => runModuleUnit(group)}
                    disabled={isRunning || group.vitestFiles.length === 0}
                    className="px-2.5 py-1.5 bg-[#171c23] border border-[#2b313a] text-gray-300 rounded-lg text-[10px] font-bold hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Run Tests
                  </button>
                  {group.e2e ? (
                    <button
                      onClick={() => runModuleE2e(group)}
                      disabled={isRunning}
                      className="px-2.5 py-1.5 bg-[#171c23] border border-[#2b313a] text-gray-300 rounded-lg text-[10px] font-bold hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Run E2E
                    </button>
                  ) : (
                    <span className="text-[10px] text-gray-600 font-bold px-2.5">no E2E</span>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-[#2b313a] px-4 py-3 space-y-3 bg-[#171c23]">
                  {cases.length === 0 ? (
                    <p className="text-xs text-gray-600 italic">{group.unitDesc}</p>
                  ) : (
                    (['unit', 'integration', 'e2e'] as const).map((t) => {
                      const rows = cases.filter((c) => c.type === t);
                      if (rows.length === 0) return null;
                      return (
                        <div key={t}>
                          <h5 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                            {SECTION_LABELS[t]}
                          </h5>
                          <ul className="space-y-1">
                            {rows.map((c, i) => (
                              <li key={i} className="text-xs text-gray-400 leading-relaxed">
                                <span className="font-semibold text-gray-300">{c.name}</span>
                                <span className="text-gray-600"> — {c.what}</span>
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

      {/* ── STREAMING LOG PANEL ── */}
      <div>
        <h4 className="text-xs font-bold text-white mb-2">Live Output</h4>
        <div
          ref={logRef}
          onScroll={handleLogScroll}
          className="bg-black/40 border border-[#2b313a] rounded-xl h-64 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed"
        >
          {lines.length === 0 ? (
            <p className="text-gray-600">No output yet — run a test suite to see live output here.</p>
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
                  {isPass && <CheckCircle2 size={12} className="shrink-0 mt-0.5" />}
                  {isFail && <XCircle size={12} className="shrink-0 mt-0.5" />}
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
        onConfirm={handleReset}
        title="Reset Sandbox Data?"
        message="This wipes and reseeds the sandbox schema used by integration tests. It never touches the real (public) data."
        confirmText="Reset"
        variant="danger"
        isLoading={resetting}
      />
    </div>
  );
};
