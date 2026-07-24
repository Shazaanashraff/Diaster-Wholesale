import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Ban,
  Trash2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  FlaskConical,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ConfirmModal } from '../ConfirmModal';
import { TEST_GROUPS, type TestGroup } from '../../sandbox/test-groups';
import { TEST_CASES, type TestCase } from '../../sandbox/test-cases';

type RunStatus = 'idle' | 'running' | 'passed' | 'failed';

type LineKind = 'pass' | 'fail' | 'neutral';

const SECTION_LABELS: Record<TestCase['type'], string> = {
  unit: 'Unit tests',
  integration: 'Integration tests (real database)',
  e2e: 'End-to-end tests (Playwright)',
};

function classifyLine(line: string): LineKind {
  if (/^\s*[✓✔]/.test(line) || /\bPASS(ED)?\b/i.test(line)) return 'pass';
  if (/^\s*[✗✕×]/.test(line) || /\bFAIL(ED)?\b/i.test(line) || /\berror\b/i.test(line)) return 'fail';
  return 'neutral';
}

export const SandboxRunnerPanel: React.FC = () => {
  const runner = window.sandboxRunner;

  const [status, setStatus] = useState<RunStatus>('idle');
  const [lines, setLines] = useState<string[]>([]);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const logRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true);

  useEffect(() => {
    if (!runner) return;
    const off = runner.onOutput(line => setLines(prev => [...prev, line]));
    return off;
  }, [runner]);

  useEffect(() => {
    if (!pinnedRef.current || !logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines]);

  const handleLogScroll = () => {
    const el = logRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    pinnedRef.current = distanceFromBottom < 24;
  };

  const isRunning = status === 'running';

  const runAction = async (actionKey: string, task: () => Promise<{ ok: boolean; reason?: string }>) => {
    if (!runner || isRunning) return;
    setActiveAction(actionKey);
    setStatus('running');
    setLines([]);
    pinnedRef.current = true;
    try {
      const result = await task();
      setStatus(result.ok ? 'passed' : 'failed');
      if (!result.ok && result.reason) {
        setLines(prev => [...prev, result.reason as string]);
      }
    } catch (err) {
      setStatus('failed');
      setLines(prev => [...prev, `Error: ${err instanceof Error ? err.message : String(err)}`]);
    } finally {
      setActiveAction(null);
    }
  };

  const runBroadUnit = () => runAction('broad-unit', () => runner!.run('unit'));
  const runBroadE2e = () => runAction('broad-e2e', () => runner!.run('e2e'));
  const runGroupUnit = (group: TestGroup) =>
    runAction(`${group.id}-unit`, () => runner!.run('unit', { files: group.vitestFiles }));
  const runGroupE2e = (group: TestGroup) =>
    runAction(`${group.id}-e2e`, () => runner!.run('e2e', { spec: group.e2e as string }));

  const handleCancel = async () => {
    if (!runner || cancelling) return;
    setCancelling(true);
    try {
      await runner.cancel();
    } finally {
      setCancelling(false);
    }
  };

  const handleResetConfirm = async () => {
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
    } catch (err) {
      setResetError(err instanceof Error ? err.message : String(err));
    } finally {
      setResetLoading(false);
    }
  };

  const toggleExpanded = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const groupCounts = useMemo(() => {
    const map: Record<string, { unit: number; integration: number; e2e: number }> = {};
    TEST_GROUPS.forEach(g => {
      const cases = TEST_CASES[g.id] ?? [];
      map[g.id] = {
        unit: cases.filter(c => c.type === 'unit').length,
        integration: cases.filter(c => c.type === 'integration').length,
        e2e: cases.filter(c => c.type === 'e2e').length,
      };
    });
    return map;
  }, []);

  if (!runner) return null;

  const badgeLabel = status === 'idle' ? 'Idle' : status === 'running' ? 'Running' : status === 'passed' ? 'Passed' : 'Failed';

  return (
    <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl p-5 space-y-6" style={{ animation: 'posFadeIn 220ms ease' }}>
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-[#2b313a] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#2b313a] flex items-center justify-center">
            <FlaskConical size={16} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Sandbox Test Runner</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Run the automated test suite against an isolated sandbox database — dev builds only
            </p>
          </div>
        </div>

        <div
          role="status"
          aria-live="polite"
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest',
            status === 'idle' && 'bg-[#1d222a] border-[#2b313a] text-gray-400',
            status === 'running' && 'bg-blue-500/10 border-blue-500/30 text-blue-400',
            status === 'passed' && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
            status === 'failed' && 'bg-red-500/10 border-red-500/30 text-red-400'
          )}
        >
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              status === 'idle' && 'bg-gray-500',
              status === 'running' && 'bg-blue-400 motion-safe:animate-pulse',
              status === 'passed' && 'bg-emerald-400',
              status === 'failed' && 'bg-red-400'
            )}
          />
          {badgeLabel}
        </div>
      </div>

      {/* ── BROAD ACTIONS ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={runBroadUnit}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-black font-bold rounded-xl text-xs hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play size={13} />
          Run Unit + Integration
        </button>
        <button
          onClick={runBroadE2e}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1d222a] border border-[#2b313a] text-gray-300 font-bold rounded-xl text-xs hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play size={13} />
          Run E2E
        </button>
        <button
          onClick={() => setConfirmReset(true)}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-4 py-2 bg-red-950/20 border border-red-500/30 text-red-400 hover:text-white rounded-xl text-xs font-bold cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 size={13} />
          Reset Sandbox Data
        </button>
        {isRunning && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1d222a] border border-amber-500/30 text-amber-400 hover:text-white rounded-xl text-xs font-bold cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Ban size={13} />
            {cancelling ? 'Cancelling...' : 'Cancel'}
          </button>
        )}
      </div>

      {isRunning && (
        <div className="px-4 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 font-semibold">
          Tests are running — other modules are locked until this run finishes.
        </div>
      )}

      {/* ── PER-MODULE GRID ── */}
      <div className="space-y-2">
        {TEST_GROUPS.map(group => {
          const counts = groupCounts[group.id];
          const cases = TEST_CASES[group.id] ?? [];
          const expanded = expandedGroups.has(group.id);
          const groupBusy = activeAction === `${group.id}-unit` || activeAction === `${group.id}-e2e`;

          return (
            <div key={group.id} className="bg-[#1d222a] border border-[#2b313a] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <button
                  onClick={() => toggleExpanded(group.id)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
                >
                  {expanded ? (
                    <ChevronDown size={14} className="text-gray-500 shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-gray-500 shrink-0" />
                  )}
                  <span className="text-xs font-bold text-white truncate">{group.label}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {counts.unit > 0 && (
                      <span className="text-[9px] font-bold bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">
                        {counts.unit} unit
                      </span>
                    )}
                    {counts.integration > 0 && (
                      <span className="text-[9px] font-bold bg-violet-500/10 text-violet-400 px-1.5 py-0.5 rounded border border-violet-500/20">
                        {counts.integration} db
                      </span>
                    )}
                    {counts.e2e > 0 && (
                      <span className="text-[9px] font-bold bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">
                        {counts.e2e} e2e
                      </span>
                    )}
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => runGroupUnit(group)}
                    disabled={isRunning}
                    className="px-2.5 py-1 bg-[#171c23] border border-[#2b313a] text-gray-300 hover:text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {groupBusy && activeAction === `${group.id}-unit` ? 'Running...' : 'Run Tests'}
                  </button>
                  {group.e2e ? (
                    <button
                      onClick={() => runGroupE2e(group)}
                      disabled={isRunning}
                      className="px-2.5 py-1 bg-[#171c23] border border-[#2b313a] text-gray-300 hover:text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {groupBusy && activeAction === `${group.id}-e2e` ? 'Running...' : 'Run E2E'}
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 text-[10px] font-bold text-gray-600">no E2E</span>
                  )}
                </div>
              </div>

              {expanded && (
                <div className="px-4 pb-4 pt-1 border-t border-[#2b313a] space-y-3">
                  {cases.length === 0 ? (
                    <p className="text-[11px] text-gray-500 italic">{group.unitDesc}</p>
                  ) : (
                    (['unit', 'integration', 'e2e'] as const).map(type => {
                      const items = cases.filter(c => c.type === type);
                      if (items.length === 0) return null;
                      return (
                        <div key={type}>
                          <h5 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                            {SECTION_LABELS[type]}
                          </h5>
                          <ul className="space-y-1">
                            {items.map(c => (
                              <li key={c.name} className="text-[11px] text-gray-400 leading-relaxed">
                                <span className="font-semibold text-gray-300">{c.name}</span> — {c.what}
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
        <h4 className="text-xs font-bold text-white mb-2">Output</h4>
        <div
          ref={logRef}
          onScroll={handleLogScroll}
          className="bg-[#0f1217] border border-[#2b313a] rounded-xl p-3 h-64 overflow-y-auto font-mono text-[11px] space-y-1"
        >
          {lines.length === 0 ? (
            <p className="text-gray-600">No output yet.</p>
          ) : (
            lines.map((line, idx) => {
              const kind = classifyLine(line);
              return (
                <div
                  key={idx}
                  className={cn(
                    'flex items-start gap-1.5',
                    kind === 'pass' && 'text-emerald-400',
                    kind === 'fail' && 'text-red-400',
                    kind === 'neutral' && 'text-gray-400'
                  )}
                >
                  {kind === 'pass' && <CheckCircle2 size={12} className="shrink-0 mt-0.5" />}
                  {kind === 'fail' && <XCircle size={12} className="shrink-0 mt-0.5" />}
                  <span className="whitespace-pre-wrap break-all">
                    {kind !== 'neutral' && <span className="font-bold mr-1">[{kind === 'pass' ? 'PASS' : 'FAIL'}]</span>}
                    {line}
                  </span>
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
        title="Reset Sandbox Data?"
        message="This wipes and reseeds the sandbox schema back to its baseline fixtures. The real (public) data is never touched."
        confirmText="Reset"
        variant="danger"
        isLoading={resetLoading}
        error={resetError}
      />
    </div>
  );
};
