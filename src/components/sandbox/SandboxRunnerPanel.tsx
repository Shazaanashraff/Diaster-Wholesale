import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle, XCircle, Loader2, Play, RotateCcw, Square, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { TEST_GROUPS, type TestGroup } from '../../sandbox/test-groups';
import { TEST_CASES } from '../../sandbox/test-cases';

type RunStatus = 'idle' | 'running' | 'passed' | 'failed';

const runner = () => (window as any).sandboxRunner as NonNullable<Window['sandboxRunner']>;

export const SandboxRunnerPanel: React.FC = () => {
  const [status, setStatus] = useState<RunStatus>('idle');
  const [lines, setLines] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [confirmReset, setConfirmReset] = useState(false);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const off = runner().onOutput((line) => setLines((prev) => [...prev, line]));
    return off;
  }, []);

  useEffect(() => {
    if (pinnedToBottom && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [lines, pinnedToBottom]);

  const handleScroll = () => {
    const el = logRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
    setPinnedToBottom(atBottom);
  };

  const startRun = async (type: 'unit' | 'e2e', filter?: { files?: string[]; spec?: string }) => {
    setStatus('running');
    setPinnedToBottom(true);
    const res = await runner().run(type, filter);
    setStatus(res.ok && res.code === 0 ? 'passed' : 'failed');
  };

  const handleCancel = async () => {
    await runner().cancel();
    setStatus('idle');
  };

  const handleReset = async () => {
    setConfirmReset(false);
    setStatus('running');
    setPinnedToBottom(true);
    const res = await runner().reset();
    setStatus(res.ok && res.code === 0 ? 'passed' : 'failed');
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const pillCount = (group: TestGroup, type: 'unit' | 'e2e' | 'integration') =>
    (TEST_CASES[group.id] ?? []).filter((c) => c.type === type).length;

  return (
    <div className="space-y-4" style={{ animation: 'posFadeIn 220ms ease' }}>

      {/* ── Header + Status Badge ── */}
      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl p-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Sandbox Test Runner</h3>
          <p className="text-xs text-gray-500 mt-0.5">Execute unit, integration, and E2E tests against the isolated sandbox schema</p>
        </div>
        <div
          role="status"
          aria-live="polite"
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold',
            status === 'idle'    && 'border-[#2b313a] text-gray-400 bg-[#1d222a]',
            status === 'running' && 'border-blue-500/40 text-blue-400 bg-blue-500/10',
            status === 'passed'  && 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
            status === 'failed'  && 'border-red-500/40 text-red-400 bg-red-500/10',
          )}
        >
          {status === 'idle'    && <span className="w-2 h-2 rounded-full bg-gray-500" />}
          {status === 'running' && (
            <span
              className="w-2 h-2 rounded-full bg-blue-400 motion-safe:animate-pulse"
            />
          )}
          {status === 'passed'  && <CheckCircle size={12} />}
          {status === 'failed'  && <XCircle size={12} />}
          <span className="capitalize">{status}</span>
        </div>
      </div>

      {/* ── Broad Action Buttons ── */}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={status === 'running'}
          onClick={() => startRun('unit')}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
        >
          <Play size={12} />
          Run Unit &amp; Integration
        </button>
        <button
          disabled={status === 'running'}
          onClick={() => startRun('e2e', { spec: 'pos-checkout' })}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
        >
          <Play size={12} />
          Run E2E
        </button>
        <button
          disabled={status === 'running'}
          onClick={() => setConfirmReset(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-rose-950/40 border border-rose-500/40 hover:bg-rose-950/60 disabled:opacity-40 disabled:cursor-not-allowed text-rose-400 font-bold rounded-xl text-xs transition-colors cursor-pointer"
        >
          <RotateCcw size={12} />
          Reset Sandbox Data
        </button>
        {status === 'running' && (
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1d222a] border border-[#2b313a] hover:border-red-500/40 text-gray-400 hover:text-red-400 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            <Square size={12} />
            Cancel
          </button>
        )}
      </div>

      {/* ── Reset Confirm Dialog ── */}
      {confirmReset && (
        <div className="bg-rose-950/20 border border-rose-500/30 rounded-2xl p-4 flex items-center gap-4">
          <AlertTriangle size={20} className="text-rose-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-white">Reset all sandbox data?</p>
            <p className="text-xs text-gray-400 mt-0.5">This will truncate all sandbox tables (except app_meta) and replay the baseline seed. Production data is never touched.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setConfirmReset(false)} className="px-3 py-1.5 text-xs font-bold text-gray-400 border border-[#2b313a] rounded-xl hover:text-white cursor-pointer">Cancel</button>
            <button onClick={handleReset} className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer">Yes, Reset</button>
          </div>
        </div>
      )}

      {/* ── Running Banner ── */}
      {status === 'running' && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-400 font-bold">
          <Loader2 size={12} className="animate-spin" />
          Tests are running — per-module actions are disabled
        </div>
      )}

      {/* ── Per-Module Grid ── */}
      <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2b313a]">
          <h4 className="text-xs font-bold text-white uppercase tracking-widest">Test Modules</h4>
        </div>
        <div className="divide-y divide-[#2b313a]">
          {TEST_GROUPS.map((group) => {
            const unitCount = pillCount(group, 'unit');
            const integCount = pillCount(group, 'integration');
            const e2eCount = pillCount(group, 'e2e');
            const hasTests = group.vitestFiles.length > 0;
            const isExpanded = expandedGroups.has(group.id);
            const groupCases = TEST_CASES[group.id] ?? [];

            return (
              <div key={group.id}>
                <div
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 hover:bg-[#1d222a] transition-colors',
                    hasTests && 'cursor-pointer',
                  )}
                  onClick={hasTests ? () => toggleGroup(group.id) : undefined}
                >
                  {/* Expand icon */}
                  <span className="text-gray-600 w-4 shrink-0">
                    {hasTests && (isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
                  </span>

                  {/* Label */}
                  <span className="text-sm font-bold text-white flex-1">{group.label}</span>

                  {/* Count pills */}
                  <div className="flex items-center gap-1.5">
                    {unitCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold">
                        {unitCount} Unit
                      </span>
                    )}
                    {integCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-bold">
                        {integCount} DB
                      </span>
                    )}
                    {e2eCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold">
                        {e2eCount} E2E
                      </span>
                    )}
                    {!hasTests && (
                      <span className="text-[10px] text-gray-600 font-medium">No tests yet</span>
                    )}
                  </div>

                  {/* Per-row actions */}
                  {hasTests && (
                    <div className="flex gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {group.vitestFiles.length > 0 && (
                        <button
                          disabled={status === 'running'}
                          onClick={() => startRun('unit', { files: group.vitestFiles })}
                          className="px-2.5 py-1 bg-[#1d222a] border border-[#2b313a] text-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          Run Tests
                        </button>
                      )}
                      {group.e2e ? (
                        <button
                          disabled={status === 'running'}
                          onClick={() => startRun('e2e', { spec: group.e2e! })}
                          className="px-2.5 py-1 bg-[#1d222a] border border-[#2b313a] text-amber-400 hover:text-amber-300 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          Run E2E
                        </button>
                      ) : (
                        <span className="px-2.5 py-1 text-gray-600 text-[10px] font-medium">no E2E</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Expanded test case list */}
                {isExpanded && groupCases.length > 0 && (
                  <div className="bg-[#0f1318] border-t border-[#2b313a] px-4 py-3 space-y-4">
                    {(['unit', 'integration', 'e2e'] as const).map((type) => {
                      const cases = groupCases.filter((c) => c.type === type);
                      if (!cases.length) return null;
                      const typeLabel =
                        type === 'unit' ? 'Unit tests' :
                        type === 'integration' ? 'Integration tests (real database)' :
                        'End-to-end tests (Playwright)';
                      return (
                        <div key={type}>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">{typeLabel}</p>
                          <div className="space-y-1.5">
                            {cases.map((tc, i) => (
                              <div key={i} className="text-xs text-gray-400">
                                <span className="font-semibold text-gray-300">{tc.name}</span>
                                <span className="text-gray-600"> — </span>
                                {tc.what}
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
      </div>

      {/* ── Streaming Log Panel ── */}
      <div className="bg-[#0f1318] border border-[#2b313a] rounded-2xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#2b313a] flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Output Log</span>
          {lines.length > 0 && (
            <button
              onClick={() => { setLines([]); setPinnedToBottom(true); }}
              className="text-[10px] text-gray-600 hover:text-gray-400 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
        <div
          ref={logRef}
          onScroll={handleScroll}
          className="h-52 overflow-y-auto p-3 font-mono text-[11px] space-y-0.5 scroll-smooth"
        >
          {lines.length === 0 ? (
            <p className="text-gray-600 italic">No output yet — run a test suite to see results here.</p>
          ) : (
            lines.map((line, i) => {
              const isPass = line.startsWith('✓');
              const isFail = line.startsWith('FAIL') || line.toLowerCase().startsWith('error');
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-1.5',
                    isPass && 'text-emerald-400',
                    isFail && 'text-red-400',
                    !isPass && !isFail && 'text-gray-400',
                  )}
                >
                  {isPass && <CheckCircle size={10} className="mt-0.5 shrink-0" aria-label="pass" />}
                  {isFail && <XCircle size={10} className="mt-0.5 shrink-0" aria-label="fail" />}
                  {!isPass && !isFail && <span className="w-2.5 shrink-0" />}
                  <span>{line}</span>
                </div>
              );
            })
          )}
        </div>
        {!pinnedToBottom && (
          <button
            onClick={() => {
              setPinnedToBottom(true);
              if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
            }}
            className="w-full text-[10px] text-center text-gray-500 hover:text-gray-300 py-1.5 border-t border-[#2b313a] bg-[#1d222a] cursor-pointer"
          >
            ↓ Scroll to latest
          </button>
        )}
      </div>
    </div>
  );
};
