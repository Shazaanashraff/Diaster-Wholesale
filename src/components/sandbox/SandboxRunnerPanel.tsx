import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlaskConical,
  Play,
  RotateCcw,
  Square,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { TEST_GROUPS } from '../../sandbox/test-groups';
import { TEST_CASES, type TestCase } from '../../sandbox/test-cases';
import { cn } from '../../lib/utils';

type RunStatus = 'idle' | 'running' | 'passed' | 'failed';

const SECTION_ORDER: { type: TestCase['type']; label: string }[] = [
  { type: 'unit', label: 'Unit tests' },
  { type: 'integration', label: 'Integration tests (real database)' },
  { type: 'e2e', label: 'End-to-end tests (Playwright)' },
];

function countByType(cases: TestCase[]) {
  return {
    unit: cases.filter(c => c.type === 'unit').length,
    integration: cases.filter(c => c.type === 'integration').length,
    e2e: cases.filter(c => c.type === 'e2e').length,
  };
}

export const SandboxRunnerPanel: React.FC = () => {
  const runner = window.sandboxRunner;

  const [status, setStatus] = useState<RunStatus>('idle');
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmReset, setConfirmReset] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  const running = status === 'running';

  const e2eSpecs = useMemo(
    () => Array.from(new Set(TEST_GROUPS.map(g => g.e2e).filter((s): s is string => !!s))),
    []
  );

  useEffect(() => {
    if (!runner) return;
    const off = runner.onOutput(line => {
      setLines(prev => [...prev, line]);
    });
    return off;
  }, [runner]);

  useEffect(() => {
    if (pinnedRef.current && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [lines]);

  const handleLogScroll = () => {
    const el = logRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    pinnedRef.current = atBottom;
  };

  const runOne = async (moduleId: string, type: 'unit' | 'e2e', filter?: { files?: string[]; spec?: string }) => {
    if (!runner || running) return;
    setStatus('running');
    setActiveModule(moduleId);
    const result = await runner.run(type, filter);
    setStatus(result.ok && result.code === 0 ? 'passed' : 'failed');
    setActiveModule(null);
  };

  const runAllE2e = async () => {
    if (!runner || running || !e2eSpecs.length) return;
    setStatus('running');
    setActiveModule('broad-e2e');
    let allPassed = true;
    for (const spec of e2eSpecs) {
      const result = await runner.run('e2e', { spec });
      if (!result.ok || result.code !== 0) allPassed = false;
    }
    setStatus(allPassed ? 'passed' : 'failed');
    setActiveModule(null);
  };

  const handleReset = async () => {
    if (!runner) return;
    setConfirmReset(false);
    setStatus('running');
    setActiveModule('reset');
    const result = await runner.reset();
    setStatus(result.ok && result.code === 0 ? 'passed' : 'failed');
    setActiveModule(null);
  };

  const handleCancel = async () => {
    if (!runner) return;
    await runner.cancel();
    setStatus('idle');
    setActiveModule(null);
  };

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const badge = {
    idle: { label: 'Idle', dot: 'bg-gray-500', text: 'text-gray-400' },
    running: { label: 'Running', dot: 'bg-amber-400 sandbox-pulse-dot', text: 'text-amber-400' },
    passed: { label: 'Passed', dot: 'bg-emerald-400', text: 'text-emerald-400' },
    failed: { label: 'Failed', dot: 'bg-red-400', text: 'text-red-400' },
  }[status];

  return (
    <div className="space-y-6 sandbox-panel-fade">
      {/* ── HEADER + STATUS BADGE ── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FlaskConical size={16} className="text-purple-400" />
            Sandbox Test Runner
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Run the automated test catalog and reset sandbox data without leaving the app
          </p>
        </div>

        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 px-3 py-1.5 bg-[#1d222a] border border-[#2b313a] rounded-xl"
        >
          <span className={cn('w-2 h-2 rounded-full', badge.dot)} />
          <span className={cn('text-xs font-bold uppercase tracking-wider', badge.text)}>{badge.label}</span>
        </div>
      </div>

      {/* ── BROAD ACTIONS ── */}
      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl p-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => runOne('broad-unit', 'unit')}
          disabled={!runner || running}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play size={13} />
          Run Unit + Integration
        </button>

        <button
          onClick={runAllE2e}
          disabled={!runner || running || !e2eSpecs.length}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white font-bold rounded-xl text-xs hover:bg-amber-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play size={13} />
          Run E2E
        </button>

        <button
          onClick={() => setConfirmReset(true)}
          disabled={!runner || running}
          className="flex items-center gap-1.5 px-4 py-2 bg-red-950/40 border border-red-500/40 text-red-400 font-bold rounded-xl text-xs hover:bg-red-950/70 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw size={13} />
          Reset Sandbox Data
        </button>

        {running && (
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1d222a] border border-[#2b313a] text-gray-300 font-bold rounded-xl text-xs hover:text-white transition-colors cursor-pointer"
          >
            <Square size={13} />
            Cancel
          </button>
        )}
      </div>

      {running && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-950/20 border border-amber-500/20 rounded-xl text-xs text-amber-300 font-medium">
          <AlertTriangle size={13} />
          Tests are running{activeModule ? ` (${activeModule})` : ''} — other modules are disabled
          until this run finishes.
        </div>
      )}

      {/* ── PER-MODULE GRID ── */}
      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl divide-y divide-[#2b313a]">
        {TEST_GROUPS.map(group => {
          const cases = TEST_CASES[group.id] ?? [];
          const counts = countByType(cases);
          const isExpanded = expanded.has(group.id);
          const hasUnitFiles = group.vitestFiles.length > 0;

          return (
            <div key={group.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => toggleExpanded(group.id)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
                >
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-gray-500 shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-gray-500 shrink-0" />
                  )}
                  <span className="text-xs font-bold text-white truncate">{group.label}</span>

                  <div className="flex items-center gap-1.5 ml-2">
                    {counts.unit > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-950/40 border border-blue-500/30 text-blue-400">
                        {counts.unit} unit
                      </span>
                    )}
                    {counts.integration > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-violet-950/40 border border-violet-500/30 text-violet-400">
                        {counts.integration} db
                      </span>
                    )}
                    {counts.e2e > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-950/40 border border-amber-500/30 text-amber-400">
                        {counts.e2e} e2e
                      </span>
                    )}
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => runOne(group.id, 'unit', { files: group.vitestFiles })}
                    disabled={!runner || running || !hasUnitFiles}
                    className="px-3 py-1.5 bg-[#1d222a] border border-[#2b313a] text-gray-300 rounded-lg text-[10px] font-bold hover:text-white transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Run Tests
                  </button>
                  {group.e2e ? (
                    <button
                      onClick={() => runOne(group.id, 'e2e', { spec: group.e2e! })}
                      disabled={!runner || running}
                      className="px-3 py-1.5 bg-[#1d222a] border border-[#2b313a] text-gray-300 rounded-lg text-[10px] font-bold hover:text-white transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Run E2E
                    </button>
                  ) : (
                    <span className="px-3 py-1.5 text-[10px] font-bold text-gray-600">no E2E</span>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 pl-9 space-y-3">
                  {cases.length === 0 && (
                    <p className="text-[11px] text-gray-500">{group.unitDesc}</p>
                  )}
                  {SECTION_ORDER.map(section => {
                    const sectionCases = cases.filter(c => c.type === section.type);
                    if (!sectionCases.length) return null;
                    return (
                      <div key={section.type}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                          {section.label}
                        </p>
                        <ul className="space-y-1">
                          {sectionCases.map(c => (
                            <li key={c.name} className="text-[11px] text-gray-400">
                              <span className="text-gray-300 font-semibold">{c.name}</span> — {c.what}
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

      {/* ── STREAMING LOG PANEL ── */}
      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl p-4 space-y-2">
        <h4 className="text-xs font-bold text-white">Live Output</h4>
        <div
          ref={logRef}
          onScroll={handleLogScroll}
          className="bg-black/40 border border-[#2b313a] rounded-xl p-3 h-64 overflow-y-auto font-mono text-[11px] leading-relaxed"
        >
          {lines.length === 0 ? (
            <p className="text-gray-600">No output yet — run a test to see live output here.</p>
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

      {/* ── RESET CONFIRM DIALOG ── */}
      {confirmReset && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl w-full max-w-md shadow-2xl sandbox-panel-fade">
            <div className="px-6 py-4 border-b border-[#2b313a]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle size={15} className="text-red-400" />
                Reset Sandbox Data?
              </h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-xs text-gray-400">
                This truncates every table in the <code className="text-gray-300">sandbox</code> schema and
                reseeds it. It never touches <code className="text-gray-300">public</code> data.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-[#2b313a] flex justify-end gap-2">
              <button
                onClick={() => setConfirmReset(false)}
                className="px-4 py-2 bg-[#1d222a] border border-[#2b313a] text-gray-300 rounded-xl text-xs font-bold hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors cursor-pointer"
              >
                Yes, reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
