import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Ban,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Circle,
  Loader2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ConfirmModal } from '../ConfirmModal';
import { TEST_GROUPS } from '../../sandbox/test-groups';
import { TEST_CASES, type TestCase } from '../../sandbox/test-cases';
import type { SandboxRunFilter } from '../../types/sandbox-runner';

type RunStatus = 'idle' | 'running' | 'passed' | 'failed';

const SCROLL_PIN_THRESHOLD_PX = 24;

function parseLine(line: string): { kind: 'pass' | 'fail' | 'neutral'; text: string } {
  if (line.startsWith('✓ ')) return { kind: 'pass', text: line.slice(2) };
  if (line.startsWith('FAIL ')) return { kind: 'fail', text: line.slice(5) };
  return { kind: 'neutral', text: line };
}

const StatusBadge: React.FC<{ status: RunStatus }> = ({ status }) => {
  const config = {
    idle: { label: 'Idle', dot: 'bg-gray-500', text: 'text-gray-400', icon: Circle },
    running: { label: 'Running', dot: 'bg-blue-400', text: 'text-blue-400', icon: Loader2 },
    passed: { label: 'Passed', dot: 'bg-emerald-400', text: 'text-emerald-400', icon: CheckCircle },
    failed: { label: 'Failed', dot: 'bg-rose-400', text: 'text-rose-400', icon: XCircle },
  }[status];

  const Icon = config.icon;

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1d222a] border border-[#2b313a] text-[10px] font-bold uppercase tracking-widest', config.text)}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          config.dot,
          status === 'running' && 'motion-safe:animate-pulse'
        )}
      />
      <Icon size={11} className={status === 'running' ? 'animate-spin' : undefined} />
      {config.label}
    </span>
  );
};

const CountPill: React.FC<{ count: number; color: 'blue' | 'violet' | 'amber'; label: string }> = ({
  count,
  color,
  label,
}) => {
  if (count === 0) return null;
  const colorClasses = {
    blue: 'bg-blue-900/20 text-blue-400 border-blue-700/30',
    violet: 'bg-violet-900/20 text-violet-400 border-violet-700/30',
    amber: 'bg-amber-900/20 text-amber-400 border-amber-700/30',
  }[color];
  return (
    <span
      className={cn('px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border', colorClasses)}
      title={label}
    >
      {count} {label}
    </span>
  );
};

const SECTION_LABELS: Record<TestCase['type'], string> = {
  unit: 'Unit tests',
  integration: 'Integration tests (real database)',
  e2e: 'End-to-end tests (Playwright)',
};

export const SandboxRunnerPanel: React.FC = () => {
  const [status, setStatus] = useState<RunStatus>('idle');
  const [lines, setLines] = useState<string[]>([]);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const [pinned, setPinned] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  const busy = status === 'running';
  const runner = (window as any).sandboxRunner as
    | {
        run: (type: 'unit' | 'e2e', filter?: SandboxRunFilter) => Promise<{ ok: boolean; code?: number; reason?: string }>;
        reset: () => Promise<{ ok: boolean; code?: number; reason?: string }>;
        cancel: () => Promise<{ ok: boolean; code?: number; reason?: string }>;
        onOutput: (cb: (line: string) => void) => () => void;
      }
    | undefined;

  useEffect(() => {
    if (!runner) return;
    const off = runner.onOutput(line => setLines(prev => [...prev, line]));
    return off;
  }, [runner]);

  useEffect(() => {
    if (pinned && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [lines, pinned]);

  const handleLogScroll = useCallback(() => {
    const el = logRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setPinned(distanceFromBottom <= SCROLL_PIN_THRESHOLD_PX);
  }, []);

  const beginRun = (label: string) => {
    setLines([]);
    setPinned(true);
    setStatus('running');
    setActiveLabel(label);
  };

  const finishRun = (results: Array<{ ok: boolean; code?: number }>) => {
    const passed = results.every(r => r.ok && (r.code ?? 0) === 0);
    setStatus(passed ? 'passed' : 'failed');
    setActiveLabel(null);
  };

  const runBroadUnit = async () => {
    if (!runner || busy) return;
    beginRun('Unit + Integration (all modules)');
    const result = await runner.run('unit');
    finishRun([result]);
  };

  const runBroadE2E = async () => {
    if (!runner || busy) return;
    const specs = Array.from(new Set(TEST_GROUPS.map(g => g.e2e).filter((s): s is string => !!s)));
    beginRun('End-to-end (all specs)');
    const results: Array<{ ok: boolean; code?: number }> = [];
    for (const spec of specs) {
      results.push(await runner.run('e2e', { spec }));
    }
    finishRun(results);
  };

  const runModuleUnit = async (groupLabel: string, files: string[]) => {
    if (!runner || busy || files.length === 0) return;
    beginRun(`${groupLabel} (unit)`);
    const result = await runner.run('unit', { files });
    finishRun([result]);
  };

  const runModuleE2E = async (groupLabel: string, spec: string) => {
    if (!runner || busy) return;
    beginRun(`${groupLabel} (e2e)`);
    const result = await runner.run('e2e', { spec });
    finishRun([result]);
  };

  const handleCancel = async () => {
    if (!runner) return;
    await runner.cancel();
  };

  const handleResetConfirm = async () => {
    if (!runner) return;
    beginRun('Reset Sandbox Data');
    const result = await runner.reset();
    finishRun([result]);
    setConfirmReset(false);
  };

  const groupCounts = useMemo(
    () =>
      TEST_GROUPS.map(group => {
        const cases = TEST_CASES[group.id] ?? [];
        return {
          group,
          cases,
          unit: cases.filter(c => c.type === 'unit').length,
          integration: cases.filter(c => c.type === 'integration').length,
          e2e: cases.filter(c => c.type === 'e2e').length,
        };
      }),
    []
  );

  if (!runner) return null;

  return (
    <div className="space-y-6" style={{ animation: 'posFadeIn 220ms ease' }}>
      {/* Header + status */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Sandbox Test Runner</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Run the automated test catalog against the sandbox schema, live, from inside the app.
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Broad actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={runBroadUnit}
          disabled={busy}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-black font-bold rounded-xl text-xs hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Play size={13} />
          Run Unit + Integration
        </button>
        <button
          onClick={runBroadE2E}
          disabled={busy}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1d222a] border border-[#2b313a] text-gray-300 font-bold rounded-xl text-xs hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Play size={13} />
          Run E2E
        </button>
        <button
          onClick={() => setConfirmReset(true)}
          disabled={busy}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-red-950/20 border border-red-500/30 text-red-400 hover:text-white font-bold rounded-xl text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <RotateCcw size={13} />
          Reset Sandbox Data
        </button>
        {busy && (
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1d222a] border border-rose-500/40 text-rose-400 hover:text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            <Ban size={13} />
            Cancel
          </button>
        )}
      </div>

      {busy && (
        <div className="px-4 py-2.5 bg-blue-950/20 border border-blue-500/20 rounded-xl text-xs text-blue-300 font-semibold flex items-center gap-2">
          <Loader2 size={13} className="animate-spin" />
          Tests are running{activeLabel ? `: ${activeLabel}` : ''}. Other modules are disabled until this finishes.
        </div>
      )}

      {/* Per-module grid */}
      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden divide-y divide-[#2b313a]">
        {groupCounts.map(({ group, cases, unit, integration, e2e }) => {
          const isExpanded = expanded === group.id;
          const hasCases = cases.length > 0;
          return (
            <div key={group.id}>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <button
                  onClick={() => setExpanded(isExpanded ? null : group.id)}
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
                    <CountPill count={unit} color="blue" label="unit" />
                    <CountPill count={integration} color="violet" label="db" />
                    <CountPill count={e2e} color="amber" label="e2e" />
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => runModuleUnit(group.label, group.vitestFiles)}
                    disabled={busy || group.vitestFiles.length === 0}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1d222a] border border-[#2b313a] text-gray-300 rounded-lg text-[10px] font-bold hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Play size={11} />
                    Run Tests
                  </button>
                  {group.e2e ? (
                    <button
                      onClick={() => runModuleE2E(group.label, group.e2e as string)}
                      disabled={busy}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1d222a] border border-[#2b313a] text-gray-300 rounded-lg text-[10px] font-bold hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Play size={11} />
                      Run E2E
                    </button>
                  ) : (
                    <span className="px-2.5 py-1.5 text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                      No E2E
                    </span>
                  )}
                </div>
              </div>

              {isExpanded && hasCases && (
                <div className="px-4 pb-4 pl-[34px] space-y-3">
                  {(['unit', 'integration', 'e2e'] as const).map(type => {
                    const typeCases = cases.filter(c => c.type === type);
                    if (typeCases.length === 0) return null;
                    return (
                      <div key={type}>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                          {SECTION_LABELS[type]}
                        </p>
                        <ul className="space-y-1">
                          {typeCases.map((c, i) => (
                            <li key={i} className="text-xs text-gray-400 leading-relaxed">
                              <span className="font-semibold text-gray-300">{c.name}</span> — {c.what}
                            </li>
                          ))}
                        </ul>
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
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Live Output</p>
        <div
          ref={logRef}
          onScroll={handleLogScroll}
          className="bg-[#0c0f13] border border-[#2b313a] rounded-2xl p-4 h-[280px] overflow-y-auto font-mono text-[11px] leading-relaxed"
        >
          {lines.length === 0 ? (
            <p className="text-gray-600">No output yet.</p>
          ) : (
            lines.map((line, i) => {
              const { kind, text } = parseLine(line);
              if (kind === 'pass') {
                return (
                  <div key={i} className="flex items-start gap-1.5 text-emerald-400">
                    <CheckCircle size={12} className="mt-0.5 shrink-0" />
                    <span>{text}</span>
                  </div>
                );
              }
              if (kind === 'fail') {
                return (
                  <div key={i} className="flex items-start gap-1.5 text-rose-400">
                    <XCircle size={12} className="mt-0.5 shrink-0" />
                    <span>{text}</span>
                  </div>
                );
              }
              return (
                <div key={i} className="text-gray-400">
                  {text}
                </div>
              );
            })
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleResetConfirm}
        title="Reset Sandbox Data"
        message="This wipes and reseeds the sandbox schema. It never touches public data, but any changes made in the sandbox this session will be lost."
        confirmText="Reset"
        variant="danger"
        isLoading={busy && activeLabel === 'Reset Sandbox Data'}
      />
    </div>
  );
};
