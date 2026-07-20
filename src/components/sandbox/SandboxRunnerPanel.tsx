import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  RotateCcw,
  Ban,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  CircleDot,
  FlaskConical,
} from 'lucide-react';
import { TEST_GROUPS } from '../../sandbox/test-groups';
import { TEST_CASES } from '../../sandbox/test-cases';
import type { TestCase } from '../../sandbox/test-cases';
import { cn } from '../../lib/utils';
import { ConfirmModal } from '../ConfirmModal';

type RunStatus = 'idle' | 'running' | 'passed' | 'failed';

const SECTION_LABELS: Record<TestCase['type'], string> = {
  unit: 'Unit tests',
  integration: 'Integration tests (real database)',
  e2e: 'End-to-end tests (Playwright)',
};

const SECTION_ORDER: TestCase['type'][] = ['unit', 'integration', 'e2e'];

function groupCasesByType(cases: TestCase[]): Record<TestCase['type'], TestCase[]> {
  const buckets: Record<TestCase['type'], TestCase[]> = { unit: [], integration: [], e2e: [] };
  cases.forEach(c => buckets[c.type].push(c));
  return buckets;
}

function isRunOk(result: { ok: boolean; code?: number } | null | undefined): boolean {
  return !!result && result.ok && (result.code === undefined || result.code === 0);
}

export const SandboxRunnerPanel: React.FC = () => {
  const [status, setStatus] = useState<RunStatus>('idle');
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [pinned, setPinned] = useState(true);

  const logRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  useEffect(() => {
    const runner = window.sandboxRunner;
    if (!runner) return;
    const off = runner.onOutput(line => setLines(prev => [...prev, line]));
    return off;
  }, []);

  useEffect(() => {
    const el = logRef.current;
    if (el && pinnedRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lines]);

  const handleLogScroll = useCallback(() => {
    const el = logRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    pinnedRef.current = atBottom;
    setPinned(atBottom);
  }, []);

  const allE2eSpecs = useMemo(() => {
    const specs = new Set<string>();
    TEST_GROUPS.forEach(g => {
      if (g.e2e) specs.add(g.e2e);
    });
    return Array.from(specs);
  }, []);

  const runGuard = status === 'running';

  const runUnit = useCallback(async (label: string, files?: string[]) => {
    if (runGuard || !window.sandboxRunner) return;
    setStatus('running');
    setActiveLabel(label);
    setLines([]);
    const result = await window.sandboxRunner.run('unit', files?.length ? { files } : undefined);
    setStatus(isRunOk(result) ? 'passed' : 'failed');
    setActiveLabel(null);
  }, [runGuard]);

  const runE2eSpec = useCallback(async (label: string, spec: string) => {
    if (runGuard || !window.sandboxRunner) return;
    setStatus('running');
    setActiveLabel(label);
    setLines([]);
    const result = await window.sandboxRunner.run('e2e', { spec });
    setStatus(isRunOk(result) ? 'passed' : 'failed');
    setActiveLabel(null);
  }, [runGuard]);

  const runAllE2e = useCallback(async () => {
    if (runGuard || !window.sandboxRunner) return;
    setStatus('running');
    setActiveLabel('Run E2E');
    setLines([]);
    let allOk = allE2eSpecs.length > 0;
    for (const spec of allE2eSpecs) {
      const result = await window.sandboxRunner.run('e2e', { spec });
      if (!isRunOk(result)) allOk = false;
    }
    setStatus(allOk ? 'passed' : 'failed');
    setActiveLabel(null);
  }, [runGuard, allE2eSpecs]);

  const handleReset = useCallback(async () => {
    if (!window.sandboxRunner) return;
    setConfirmResetOpen(false);
    setStatus('running');
    setActiveLabel('Reset Sandbox Data');
    setLines([]);
    const result = await window.sandboxRunner.reset();
    setStatus(isRunOk(result) ? 'passed' : 'failed');
    setActiveLabel(null);
  }, []);

  const handleCancel = useCallback(async () => {
    if (!window.sandboxRunner) return;
    await window.sandboxRunner.cancel();
  }, []);

  const toggleExpanded = (groupId: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const badge = {
    idle: { label: 'Idle', dotClass: 'bg-gray-500', textClass: 'text-gray-400' },
    running: { label: 'Running', dotClass: 'bg-amber-400 sandbox-status-dot--running', textClass: 'text-amber-400' },
    passed: { label: 'Passed', dotClass: 'bg-emerald-400', textClass: 'text-emerald-400' },
    failed: { label: 'Failed', dotClass: 'bg-red-400', textClass: 'text-red-400' },
  }[status];

  return (
    <div className="space-y-6 sandbox-panel-fade" style={{ animation: 'posFadeIn 220ms ease' }}>
      <div className="flex items-center justify-between bg-[#171c23] border border-[#2b313a] rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#2b313a] flex items-center justify-center">
            <FlaskConical size={16} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Sandbox Test Runner</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Run the automated test catalog against the isolated sandbox schema
            </p>
          </div>
        </div>

        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 bg-[#1d222a] border border-[#2b313a] rounded-xl px-3 py-1.5"
        >
          <span className={cn('w-2 h-2 rounded-full', badge.dotClass)} />
          <span className={cn('text-[10px] font-bold uppercase tracking-widest', badge.textClass)}>
            {badge.label}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => runUnit('Run Unit + Integration')}
          disabled={runGuard}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-black font-bold rounded-xl text-xs hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play size={13} />
          Run Unit + Integration
        </button>
        <button
          onClick={runAllE2e}
          disabled={runGuard}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1d222a] border border-[#2b313a] text-white font-bold rounded-xl text-xs hover:border-primary/40 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play size={13} />
          Run E2E
        </button>
        <button
          onClick={() => setConfirmResetOpen(true)}
          disabled={runGuard}
          className="flex items-center gap-1.5 px-4 py-2 bg-red-950/20 border border-red-500/30 text-red-400 hover:text-white rounded-xl text-xs font-bold cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw size={13} />
          Reset Sandbox Data
        </button>
        {runGuard && (
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1d222a] border border-[#2b313a] text-gray-300 font-bold rounded-xl text-xs hover:text-white hover:border-red-500/40 transition-colors cursor-pointer"
          >
            <Ban size={13} />
            Cancel
          </button>
        )}
      </div>

      {runGuard && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl px-4 py-2.5 text-xs font-bold">
          <CircleDot size={13} className="sandbox-status-dot--running" />
          Tests are running{activeLabel ? ` — ${activeLabel}` : ''}. Other modules are disabled until this finishes.
        </div>
      )}

      <div className="space-y-2">
        {TEST_GROUPS.map(group => {
          const cases = TEST_CASES[group.id] ?? [];
          const unitCount = cases.filter(c => c.type === 'unit').length;
          const integrationCount = cases.filter(c => c.type === 'integration').length;
          const e2eCount = cases.filter(c => c.type === 'e2e').length;
          const isExpanded = expanded.has(group.id);
          const sections = groupCasesByType(cases);
          const hasUnitFiles = group.vitestFiles.length > 0;

          return (
            <div key={group.id} className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => toggleExpanded(group.id)}
                  className="flex items-center gap-2 flex-1 text-left cursor-pointer"
                >
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-gray-500 shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-gray-500 shrink-0" />
                  )}
                  <span className="text-xs font-bold text-white">{group.label}</span>
                  <div className="flex items-center gap-1.5">
                    {unitCount > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {unitCount} unit
                      </span>
                    )}
                    {integrationCount > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        {integrationCount} db
                      </span>
                    )}
                    {e2eCount > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {e2eCount} e2e
                      </span>
                    )}
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => runUnit(`Run Tests — ${group.label}`, group.vitestFiles)}
                    disabled={runGuard || !hasUnitFiles}
                    className="px-2.5 py-1 bg-[#1d222a] border border-[#2b313a] text-gray-300 rounded-lg text-[10px] font-bold hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Run Tests
                  </button>
                  {group.e2e ? (
                    <button
                      onClick={() => runE2eSpec(`Run E2E — ${group.label}`, group.e2e as string)}
                      disabled={runGuard}
                      className="px-2.5 py-1 bg-[#1d222a] border border-[#2b313a] text-gray-300 rounded-lg text-[10px] font-bold hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Run E2E
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 text-[10px] font-bold text-gray-600">no E2E</span>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-[#2b313a] px-4 py-3 space-y-4">
                  {cases.length === 0 ? (
                    <p className="text-xs text-gray-500">{group.unitDesc}</p>
                  ) : (
                    SECTION_ORDER.map(type => {
                      const section = sections[type];
                      if (section.length === 0) return null;
                      return (
                        <div key={type}>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                            {SECTION_LABELS[type]}
                          </p>
                          <ul className="space-y-1">
                            {section.map((c, i) => (
                              <li key={i} className="text-xs text-gray-400 leading-relaxed">
                                <span className="text-gray-200 font-semibold">{c.name}</span> — {c.what}
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

      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
        <div className="border-b border-[#2b313a] px-4 py-2.5">
          <p className="text-xs font-bold text-white">Live Output</p>
        </div>
        <div
          ref={logRef}
          onScroll={handleLogScroll}
          className="h-64 overflow-y-auto font-mono text-[11px] px-4 py-3 space-y-1"
        >
          {lines.length === 0 ? (
            <p className="text-gray-600">No output yet</p>
          ) : (
            lines.map((line, i) => {
              const isPass = line.startsWith('✓');
              const isFail = line.startsWith('FAIL');
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-1.5',
                    isPass ? 'text-emerald-400' : isFail ? 'text-red-400' : 'text-gray-400'
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
        {!pinned && lines.length > 0 && (
          <div className="border-t border-[#2b313a] px-4 py-1.5 text-[10px] text-gray-500">
            Scrolled up — new output won't auto-scroll until you return to the bottom.
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        onConfirm={handleReset}
        title="Reset Sandbox Data"
        message="This wipes and reseeds the sandbox schema. It does not touch production data, but any in-progress sandbox test state will be lost. Continue?"
        confirmText="Reset Sandbox"
        variant="danger"
      />
    </div>
  );
};
