import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Square,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { TEST_GROUPS } from '../../sandbox/test-groups';
import { TEST_CASES } from '../../sandbox/test-cases';
import type { TestCase } from '../../sandbox/test-cases';
import { ConfirmModal } from '../ConfirmModal';
import { cn } from '../../lib/utils';

type RunStatus = 'idle' | 'running' | 'passed' | 'failed';

const TYPE_SECTION_LABEL: Record<TestCase['type'], string> = {
  unit: 'Unit tests',
  integration: 'Integration tests (real database)',
  e2e: 'End-to-end tests (Playwright)',
};

const ALL_E2E_SPECS = TEST_GROUPS.map(g => g.e2e).filter((e): e is string => e !== null);

function groupCasesByType(cases: TestCase[]) {
  const byType: Record<TestCase['type'], TestCase[]> = { unit: [], integration: [], e2e: [] };
  cases.forEach(c => byType[c.type].push(c));
  return byType;
}

export const SandboxRunnerPanel: React.FC = () => {
  const [status, setStatus] = useState<RunStatus>('idle');
  const [lines, setLines] = useState<string[]>([]);
  const [hasRun, setHasRun] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmReset, setConfirmReset] = useState(false);
  const pinnedRef = useRef(true);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const runner = window.sandboxRunner;
    if (!runner) return;
    const off = runner.onOutput(line => setLines(prev => [...prev, line]));
    return off;
  }, []);

  useEffect(() => {
    const el = logRef.current;
    if (!el || !pinnedRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  const handleScroll = () => {
    const el = logRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };

  const running = status === 'running';

  const beginRun = () => {
    setHasRun(true);
    setLines([]);
    pinnedRef.current = true;
    setStatus('running');
  };

  const runUnit = useCallback(async (files?: string[]) => {
    const runner = window.sandboxRunner;
    if (!runner || running) return;
    beginRun();
    const result = await runner.run('unit', files ? { files } : undefined);
    setStatus(result.ok && result.code === 0 ? 'passed' : 'failed');
  }, [running]);

  const runE2e = useCallback(async (specs: string[]) => {
    const runner = window.sandboxRunner;
    if (!runner || running || specs.length === 0) return;
    beginRun();
    let allOk = true;
    for (const spec of specs) {
      const result = await runner.run('e2e', { spec });
      if (!result.ok || result.code !== 0) allOk = false;
    }
    setStatus(allOk ? 'passed' : 'failed');
  }, [running]);

  const handleReset = async () => {
    const runner = window.sandboxRunner;
    setConfirmReset(false);
    if (!runner) return;
    beginRun();
    const result = await runner.reset();
    setStatus(result.ok && result.code === 0 ? 'passed' : 'failed');
  };

  const handleCancel = async () => {
    const runner = window.sandboxRunner;
    if (!runner) return;
    await runner.cancel();
    setStatus('idle');
  };

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6" style={{ animation: 'posFadeIn 220ms ease' }}>
      {/* ── Header: title + status badge ── */}
      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-bold text-white">Sandbox Test Runner</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Run the real test suite against an isolated sandbox schema, right from the app.
            </p>
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
                'w-2 h-2 rounded-full',
                status === 'idle' && 'bg-gray-500',
                status === 'running' && 'bg-blue-400 animate-pulse motion-reduce:animate-none',
                status === 'passed' && 'bg-emerald-400',
                status === 'failed' && 'bg-red-400'
              )}
            />
            {status === 'idle' && 'Idle'}
            {status === 'running' && 'Running'}
            {status === 'passed' && 'Passed'}
            {status === 'failed' && 'Failed'}
          </div>
        </div>

        {/* ── Broad actions ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => runUnit()}
            disabled={running}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <Play size={13} />
            Run Unit + Integration
          </button>
          <button
            onClick={() => runE2e(ALL_E2E_SPECS)}
            disabled={running || ALL_E2E_SPECS.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <Play size={13} />
            Run E2E
          </button>
          <button
            onClick={() => setConfirmReset(true)}
            disabled={running}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-950/30 border border-red-500/30 hover:bg-red-950/50 disabled:opacity-40 disabled:cursor-not-allowed text-red-400 hover:text-red-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <RotateCcw size={13} />
            Reset Sandbox Data
          </button>
          {running && (
            <button
              onClick={handleCancel}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#1d222a] border border-[#2b313a] hover:text-white text-gray-400 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Square size={13} />
              Cancel
            </button>
          )}
        </div>

        {running && (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300">
            <Loader2 size={13} className="animate-spin motion-reduce:animate-none" />
            Tests are running — other modules are disabled until this finishes.
          </div>
        )}
      </div>

      {/* ── Per-module grid ── */}
      <div className="space-y-2">
        {TEST_GROUPS.map(group => {
          const cases = TEST_CASES[group.id] ?? [];
          const byType = groupCasesByType(cases);
          const isExpanded = expanded.has(group.id);
          const hasTests = group.vitestFiles.length > 0;
          const e2eSpec = group.e2e;

          return (
            <div key={group.id} className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between gap-3 p-4">
                <button
                  onClick={() => toggleExpanded(group.id)}
                  className="flex items-center gap-2 text-left flex-1 min-w-0 cursor-pointer"
                >
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-gray-500 shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-gray-500 shrink-0" />
                  )}
                  <span className="text-xs font-bold text-white truncate">{group.label}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {byType.unit.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {byType.unit.length} unit
                      </span>
                    )}
                    {byType.integration.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        {byType.integration.length} db
                      </span>
                    )}
                    {byType.e2e.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {byType.e2e.length} e2e
                      </span>
                    )}
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => runUnit(group.vitestFiles)}
                    disabled={running || !hasTests}
                    title={hasTests ? undefined : 'No automated tests in this module yet'}
                    className="px-2.5 py-1.5 bg-[#1d222a] border border-[#2b313a] disabled:opacity-30 disabled:cursor-not-allowed hover:text-white text-gray-400 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                  >
                    Run Tests
                  </button>
                  {e2eSpec ? (
                    <button
                      onClick={() => runE2e([e2eSpec])}
                      disabled={running}
                      className="px-2.5 py-1.5 bg-[#1d222a] border border-[#2b313a] disabled:opacity-30 disabled:cursor-not-allowed hover:text-white text-gray-400 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                    >
                      Run E2E
                    </button>
                  ) : (
                    <span className="px-2.5 py-1.5 text-[10px] font-bold text-gray-600">no E2E</span>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-[#2b313a] p-4 space-y-4" style={{ animation: 'posFadeIn 180ms ease' }}>
                  {cases.length === 0 ? (
                    <p className="text-xs text-gray-600">{group.unitDesc}</p>
                  ) : (
                    (['unit', 'integration', 'e2e'] as const).map(type =>
                      byType[type].length > 0 ? (
                        <div key={type}>
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                            {TYPE_SECTION_LABEL[type]}
                          </h4>
                          <ul className="space-y-1.5">
                            {byType[type].map((c, i) => (
                              <li key={i} className="text-xs text-gray-400">
                                <span className="font-bold text-gray-300">{c.name}</span>
                                <span className="text-gray-600"> — {c.what}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Streaming log panel ── */}
      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#2b313a]">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Live Output</h4>
        </div>
        <div
          ref={logRef}
          onScroll={handleScroll}
          className="h-[280px] overflow-y-auto p-4 font-mono text-[11px] leading-relaxed"
        >
          {!hasRun ? (
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
        message="This wipes and reseeds the sandbox schema. It never touches real (public) data, but any manual sandbox changes you made will be lost."
        confirmText="Reset Sandbox"
        variant="danger"
      />
    </div>
  );
};
