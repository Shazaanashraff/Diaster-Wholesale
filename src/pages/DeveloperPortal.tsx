import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  MonitorSmartphone,
  Layout,
  Database,
  Activity,
  RefreshCw,
  AlertCircle,
  Search,
  CheckCircle,
  TrendingDown,
  TrendingUp,
  Receipt,
  Cpu,
  Trash2,
  HardDrive,
  Network,
  Play,
  FileCode,
  FlaskConical,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { usePermissions } from '../utils/permissions';
import { runAggregationAndUpload } from '../services/aggregator';
import { db } from '../services/auditDb';
import { cn } from '../lib/utils';
import { SandboxRunnerPanel } from '../components/sandbox/SandboxRunnerPanel';

type TimeRange = '24h' | '7d' | '30d';
type PortalTab = 'egress' | 'offline' | 'connection' | 'storage' | 'sysinfo' | 'loadtest' | 'sandbox';
type EgressTab = 'user' | 'device' | 'page' | 'query' | 'meta';
type QuerySortField = 'calls' | 'bytes' | 'duration';

interface AuditRecord {
  id: number;
  hour: string;
  user_id: string | null;
  role: string | null;
  location: string | null;
  device_id: string;
  page: string;
  client_kind: string;
  http_method: string;
  table_name: string | null;
  columns_key: string | null;
  filter_key: string | null;
  call_count: number;
  total_bytes: number;
  total_duration_ms: number;
  status_code: number;
  is_meta: boolean;
}

const COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb7185', '#22d3ee', '#cbd5e1'];

export const DeveloperPortal: React.FC = () => {
  const { role } = usePermissions();
  const [portalTab, setPortalTab] = useState<PortalTab>('egress');
  const [egressTab, setEgressTab] = useState<EgressTab>('user');
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [querySearch, setQuerySearch] = useState('');
  const [querySort, setQuerySort] = useState<QuerySortField>('bytes');

  // Diagnostics & Offline tab states
  const [offlineCount, setOfflineCount] = useState(0);
  const [rawOfflineLogs, setRawOfflineLogs] = useState<any[]>([]);
  const [dbPingStatus, setDbPingStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [dbPingTime, setDbPingTime] = useState<number | null>(null);
  const [dbPingError, setDbPingError] = useState<string | null>(null);

  // LocalStorage editor states
  const [lsKeys, setLsKeys] = useState<{ key: string; value: string }[]>([]);
  const [newLsKey, setNewLsKey] = useState('');
  const [newLsVal, setNewLsVal] = useState('');

  // Load Spammer States
  const [spammerLoading, setSpammerLoading] = useState(false);
  const [spammerCount, setSpammerCount] = useState(10);
  const [spammerResult, setSpammerResult] = useState<string | null>(null);

  // Load audit aggregates from DB
  const loadAuditData = async () => {
    setLoading(true);
    try {
      const startDate = new Date();
      if (timeRange === '24h') {
        startDate.setHours(startDate.getHours() - 24);
      } else if (timeRange === '7d') {
        startDate.setDate(startDate.getDate() - 7);
      } else {
        startDate.setDate(startDate.getDate() - 30);
      }

      const { data, error } = await supabase
        .from('audit_metrics_hourly')
        .select('*')
        .gte('hour', startDate.toISOString())
        .order('hour', { ascending: false });

      if (error) throw error;
      setRecords((data as AuditRecord[]) || []);
    } catch (err) {
      console.error('Failed to load audit metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load offline data details
  const loadOfflineStatus = useCallback(async () => {
    try {
      const count = await db.metricEvents.count();
      setOfflineCount(count);
      const logs = await db.metricEvents.orderBy('id').reverse().limit(10).toArray();
      setRawOfflineLogs(logs);
    } catch (err) {
      console.error('Failed to load offline db status:', err);
    }
  }, []);

  // Load localStorage variables
  const loadLocalStorageKeys = () => {
    const list: { key: string; value: string }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        list.push({ key, value: localStorage.getItem(key) || '' });
      }
    }
    setLsKeys(list);
  };

  useEffect(() => {
    if (role === 'developer') {
      loadAuditData();
      loadOfflineStatus();
      loadLocalStorageKeys();
    }
  }, [timeRange, role, loadOfflineStatus]);

  // Sync Offline cache to DB
  const handleForceSync = async () => {
    setSyncing(true);
    setSyncSuccess(false);
    try {
      await runAggregationAndUpload();
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
      await loadAuditData();
      await loadOfflineStatus();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  // SUPABASE PING TESTER
  const runSupabasePing = async () => {
    setDbPingStatus('testing');
    setDbPingError(null);
    const start = performance.now();
    try {
      const { error } = await supabase
        .from('products')
        .select('id')
        .limit(1);

      if (error) throw error;
      setDbPingTime(Math.round(performance.now() - start));
      setDbPingStatus('success');
    } catch (err: any) {
      setDbPingStatus('failed');
      setDbPingError(err.message || String(err));
    }
  };

  // LOAD GENERATOR (SPAMMER)
  const triggerSpamQueries = async () => {
    setSpammerLoading(true);
    setSpammerResult(null);
    let successCount = 0;
    let failCount = 0;
    const start = performance.now();

    for (let i = 0; i < spammerCount; i++) {
      try {
        // Trigger a simple lightweight query
        const { error } = await supabase
          .from('products')
          .select('id')
          .limit(1);
        
        if (error) throw error;
        successCount++;
      } catch (err) {
        failCount++;
      }
    }

    const elapsed = Math.round(performance.now() - start);
    setSpammerResult(`Triggered ${spammerCount} queries in ${elapsed}ms. (${successCount} successful, ${failCount} failed). Logs buffered in IndexedDB.`);
    setSpammerLoading(false);
    await loadOfflineStatus();
  };

  // LOCALSTORAGE MUTATORS
  const handleSetLsKey = () => {
    if (!newLsKey.trim()) return;
    localStorage.setItem(newLsKey.trim(), newLsVal);
    setNewLsKey('');
    setNewLsVal('');
    loadLocalStorageKeys();
  };

  const handleDelLsKey = (key: string) => {
    localStorage.removeItem(key);
    loadLocalStorageKeys();
  };

  const handleClearOfflineLogs = async () => {
    await db.metricEvents.clear();
    await loadOfflineStatus();
  };

  // Helper to format bytes nicely
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Gate access to Developer role
  if (role !== 'developer') {
    return (
      <div className="p-8 text-center min-h-[50vh] flex flex-col items-center justify-center bg-[#171c23] border border-[#2b313a] rounded-2xl m-6">
        <AlertCircle size={48} className="text-amber-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
        <p className="text-gray-400 max-w-md">
          The Developer Diagnostics and Analytics Portal is gated. Only accounts with the Developer role can access this console.
        </p>
      </div>
    );
  }

  // Split records into normal application queries and auditing overhead queries
  const appRecords = useMemo(() => records.filter(r => !r.is_meta), [records]);
  const metaRecords = useMemo(() => records.filter(r => r.is_meta), [records]);

  // General statistics cards
  const stats = useMemo(() => {
    let totalBytes = 0;
    let totalCalls = 0;
    let totalDuration = 0;
    appRecords.forEach(r => {
      totalBytes += r.total_bytes;
      totalCalls += r.call_count;
      totalDuration += r.total_duration_ms;
    });

    let metaBytes = 0;
    let metaCalls = 0;
    metaRecords.forEach(r => {
      metaBytes += r.total_bytes;
      metaCalls += r.call_count;
    });

    const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
    const overheadPercent = (totalBytes + metaBytes) > 0 ? (metaBytes / (totalBytes + metaBytes)) * 100 : 0;

    return {
      totalBytes,
      totalCalls,
      avgDuration,
      metaBytes,
      metaCalls,
      overheadPercent,
    };
  }, [appRecords, metaRecords]);

  // Tab calculations
  const userAggregates = userAggregatesCalc(appRecords);
  const deviceAggregates = deviceAggregatesCalc(appRecords);
  const pageAggregates = pageAggregatesCalc(appRecords);
  const queryAggregates = queryAggregatesCalc(appRecords, querySearch, querySort);

  const userChartData = userAggregates.slice(0, 8).map(u => ({
    name: u.user_id.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
    bytes: parseFloat((u.bytes / (1024 * 1024)).toFixed(3)),
    calls: u.calls,
  }));

  return (
    <div className="pos-standard-page p-6 space-y-6 relative">
      
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Cpu className="text-purple-400 animate-pulse" size={20} />
            Developer Diagnostics & Metrics Portal
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time client performance diagnostics, IndexedDB cache, load testing, and egress bandwidth audit console
          </p>
        </div>

        <div className="flex items-center gap-2">
          {portalTab === 'egress' && (
            <>
              <button
                onClick={handleForceSync}
                disabled={syncing}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 bg-[#1d222a] border border-[#2b313a] text-gray-400 rounded-xl hover:text-white transition-all text-xs font-bold cursor-pointer",
                  syncSuccess && "border-emerald-500 text-emerald-400"
                )}
              >
                {syncSuccess ? (
                  <>
                    <CheckCircle size={13} />
                    <span>Synced</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={13} className={cn(syncing && "animate-spin")} />
                    <span>{syncing ? 'Syncing...' : 'Sync'}</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-1 bg-[#1d222a] border border-[#2b313a] rounded-xl p-1">
                {(['24h', '7d', '30d'] as const).map(tr => (
                  <button
                    key={tr}
                    onClick={() => setTimeRange(tr)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                      timeRange === tr
                        ? "bg-[#f8fafc] text-black"
                        : "text-gray-500 hover:text-gray-300"
                    )}
                  >
                    {tr === '24h' ? '24H' : tr === '7d' ? '7D' : '30D'}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── PORTAL SUB-NAV TABS ── */}
      <div className="flex items-center gap-1 bg-[#1d222a] border border-[#2b313a] rounded-xl p-1">
        {(
          [
            { id: 'egress', label: 'Egress Bandwidth', icon: Activity },
            { id: 'offline', label: 'IndexedDB Logs', icon: HardDrive },
            { id: 'connection', label: 'Database Health', icon: Network },
            { id: 'storage', label: 'Local Settings', icon: FileCode },
            { id: 'sysinfo', label: 'System Environment', icon: Cpu },
            { id: 'loadtest', label: 'Load Generator', icon: Play },
            { id: 'sandbox', label: 'Sandbox', icon: FlaskConical },
          ] as const
        )
          .filter(tab => tab.id !== 'sandbox' || typeof (window as any).sandboxRunner !== 'undefined')
          .map(tab => (
          <button
            key={tab.id}
            onClick={() => setPortalTab(tab.id)}
            className={cn(
              "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all cursor-pointer",
              portalTab === tab.id ? "bg-[#f8fafc] text-black" : "text-gray-500 hover:text-gray-300"
            )}
          >
            <span className="flex items-center justify-center gap-1.5">
              <tab.icon size={12} />
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* ── METRICS EGRESS VIEW ── */}
      {portalTab === 'egress' && (
        <div className="space-y-6" style={{ animation: 'posFadeIn 220ms ease' }}>
          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Application Egress', value: formatBytes(stats.totalBytes), desc: 'Bandwidth consumed by app', accent: 'text-blue-400', icon: TrendingDown },
              { title: 'Database Queries', value: stats.totalCalls.toLocaleString(), desc: 'Logged database operations', accent: 'text-emerald-400', icon: Database },
              { title: 'Average Latency', value: `${stats.avgDuration} ms`, desc: 'Mean query response speed', accent: 'text-amber-400', icon: Receipt },
              { title: 'Audit System Cost', value: `${stats.overheadPercent.toFixed(2)}%`, desc: `Log overhead: ${formatBytes(stats.metaBytes)}`, accent: 'text-rose-400', icon: TrendingUp },
            ].map((item, idx) => (
              <div key={idx} className="bg-[#1d222a] border border-[#2b313a] rounded-2xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#2b313a] flex items-center justify-center">
                  <item.icon size={16} className={item.accent} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{item.title}</p>
                  <p className={cn("text-base font-bold font-mono mt-0.5", item.accent)}>{item.value}</p>
                  <p className="text-[9px] text-gray-600 mt-0.5 leading-none">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Audit tabs */}
          <div className="flex items-center gap-1 bg-[#1d222a] border border-[#2b313a] rounded-xl p-1">
            {(
              [
                { id: 'user', label: 'Users', icon: Users },
                { id: 'device', label: 'Terminals', icon: MonitorSmartphone },
                { id: 'page', label: 'Pages & Routes', icon: Layout },
                { id: 'query', label: 'Query Performance', icon: Database },
                { id: 'meta', label: 'Overhead Analysis', icon: Activity },
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                onClick={() => setEgressTab(tab.id)}
                className={cn(
                  "flex-1 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer",
                  egressTab === tab.id ? "bg-[#f8fafc] text-black" : "text-gray-500 hover:text-gray-300"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl p-5 min-h-[400px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 space-y-3">
                <RefreshCw className="animate-spin text-primary" size={24} />
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Loading Audit Logs...</p>
              </div>
            ) : (
              <>
                {egressTab === 'user' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-bold text-white mb-4">Egress Contribution by Role / User</h3>
                      <div className="h-[250px] w-full">
                        {userChartData.length === 0 ? (
                          <div className="flex items-center justify-center h-full text-gray-600 text-xs">No data for chart</div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={userChartData}>
                              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} label={{ value: 'Egress (MB)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                              <RechartsTooltip
                                contentStyle={{ background: '#1c222b', border: '1px solid #2b313a', borderRadius: '8px' }}
                                itemStyle={{ color: '#fff', fontSize: 11 }}
                                labelStyle={{ color: '#94a3b8', fontSize: 11 }}
                              />
                              <Bar dataKey="bytes" name="Egress (MB)">
                                {userChartData.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#1d222a] border-b border-[#2b313a]">
                            <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">User / Role</th>
                            <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">Primary Location</th>
                            <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">Call Count</th>
                            <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">Total Egress</th>
                            <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">Avg Latency</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2b313a]">
                          {userAggregates.map((u, i) => (
                            <tr key={i} className="hover:bg-[#1d222a] transition-colors">
                              <td className="px-5 py-3.5 text-xs font-bold text-white flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                {u.user_id.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                              </td>
                              <td className="px-5 py-3.5 text-xs text-gray-400 capitalize">{u.location}</td>
                              <td className="px-5 py-3.5 text-xs text-right font-semibold">{u.calls.toLocaleString()}</td>
                              <td className="px-5 py-3.5 text-xs text-right font-bold text-blue-400">{formatBytes(u.bytes)}</td>
                              <td className="px-5 py-3.5 text-xs text-right text-gray-400 font-mono">{Math.round(u.duration / u.calls)} ms</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {egressTab === 'device' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {deviceAggregates.map((dev, idx) => {
                      const percentage = stats.totalBytes > 0 ? (dev.bytes / stats.totalBytes) * 100 : 0;
                      return (
                        <div key={idx} className="p-4 bg-[#1d222a] border border-[#2b313a] rounded-xl flex flex-col justify-between space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-wider">Device UUID</p>
                              <h4 className="text-xs font-mono font-semibold text-white truncate max-w-[200px]">{dev.device_id}</h4>
                            </div>
                            <span className="text-[9px] font-bold bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 uppercase capitalize">
                              {dev.location}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-center bg-[#171c23] p-2 rounded-lg border border-[#2b313a]/50">
                            <div>
                              <p className="text-[8px] font-bold text-gray-600 uppercase">Egress</p>
                              <p className="text-[11px] font-bold text-blue-400 mt-0.5">{formatBytes(dev.bytes)}</p>
                            </div>
                            <div>
                              <p className="text-[8px] font-bold text-gray-600 uppercase">Queries</p>
                              <p className="text-[11px] font-bold text-white mt-0.5">{dev.calls}</p>
                            </div>
                            <div>
                              <p className="text-[8px] font-bold text-gray-600 uppercase">Avg Speed</p>
                              <p className="text-[11px] font-bold text-amber-400 mt-0.5">{Math.round(dev.duration / dev.calls)}ms</p>
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-[9px] text-gray-500 font-bold mb-1">
                              <span>Egress Contribution</span>
                              <span>{percentage.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-[#171c23] rounded-full h-1 overflow-hidden">
                              <div className="h-full bg-blue-400 rounded-full" style={{ width: `${percentage}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {egressTab === 'page' && (
                  <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#1d222a] border-b border-[#2b313a]">
                          <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">App Page / Layout Path</th>
                          <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">Queries Fired</th>
                          <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">Egress Bandwidth</th>
                          <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">Contribution %</th>
                          <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">Avg Response Latency</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2b313a]">
                        {pageAggregates.map((p, i) => {
                          const pct = stats.totalBytes > 0 ? (p.bytes / stats.totalBytes) * 100 : 0;
                          return (
                            <tr key={i} className="hover:bg-[#1d222a] transition-colors">
                              <td className="px-5 py-3.5 font-mono text-[11px] font-semibold text-white">{p.page}</td>
                              <td className="px-5 py-3.5 text-xs text-right font-medium">{p.calls.toLocaleString()}</td>
                              <td className="px-5 py-3.5 text-xs text-right font-bold text-blue-400">{formatBytes(p.bytes)}</td>
                              <td className="px-5 py-3.5 text-xs text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <span className="font-semibold text-gray-400">{pct.toFixed(1)}%</span>
                                  <div className="w-16 bg-[#1d222a] border border-[#2b313a] rounded-full h-1 overflow-hidden">
                                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-xs text-right text-gray-400 font-mono">{Math.round(p.duration / p.calls)} ms</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {egressTab === 'query' && (
                  <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-3 text-gray-500 pointer-events-none" size={13} />
                        <input
                          placeholder="Search query endpoint, columns or filters..."
                          value={querySearch}
                          onChange={e => setQuerySearch(e.target.value)}
                          className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl py-2.5 pl-9 pr-4 focus:outline-none focus:border-primary/40"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-600 uppercase">Sort Queries:</span>
                        <div className="flex bg-[#1d222a] border border-[#2b313a] p-1 rounded-xl">
                          {(['bytes', 'calls', 'duration'] as const).map(sort => (
                            <button
                              key={sort}
                              onClick={() => setQuerySort(sort)}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                                querySort === sort ? "bg-[#f8fafc] text-black" : "text-gray-500 hover:text-gray-300"
                              )}
                            >
                              {sort === 'bytes' ? 'Egress' : sort === 'calls' ? 'Calls' : 'Latency'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl overflow-hidden max-h-[400px] overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#1d222a] border-b border-[#2b313a] sticky top-0 z-[2]">
                            <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">Method</th>
                            <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">Table / RPC Endpoint</th>
                            <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">Select Columns</th>
                            <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">Filter Parameters (Keys)</th>
                            <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">Frequency</th>
                            <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">Total Egress</th>
                            <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">Avg Duration</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2b313a]">
                          {queryAggregates.map((q, idx) => (
                            <tr key={idx} className="hover:bg-[#1d222a] transition-colors">
                              <td className="px-5 py-3.5 text-xs">
                                <span className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider", q.method === 'GET' ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20")}>
                                  {q.method}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-xs font-mono font-bold text-white max-w-[120px] truncate">{q.table}</td>
                              <td className="px-5 py-3.5 text-xs font-mono text-[10px] text-slate-300 max-w-[200px] truncate">{q.columns}</td>
                              <td className="px-5 py-3.5 text-xs font-mono text-[10px] text-gray-400 max-w-[150px] truncate">{q.filters}</td>
                              <td className="px-5 py-3.5 text-xs text-right font-semibold">{q.calls.toLocaleString()}</td>
                              <td className="px-5 py-3.5 text-xs text-right font-black text-blue-400">{formatBytes(q.bytes)}</td>
                              <td className="px-5 py-3.5 text-xs text-right text-gray-400 font-mono">{Math.round(q.duration / q.calls)} ms</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {egressTab === 'meta' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-bold text-white mb-3">Self-Audit Cost Isolation</h3>
                      <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                        Raw logs are grouped hourly and pushed as free database ingress, preventing audit calls from creating billing egress.
                      </p>
                      <div className="space-y-3 bg-[#1d222a] p-4 rounded-xl border border-[#2b313a] text-xs">
                        <div className="flex justify-between"><span>Normal Data Calls:</span><span className="font-bold text-white">{stats.totalCalls}</span></div>
                        <div className="flex justify-between"><span>Audit Sync Calls:</span><span className="font-bold text-white">{stats.metaCalls}</span></div>
                        <div className="flex justify-between"><span>Normal Egress:</span><span className="font-bold text-blue-400">{formatBytes(stats.totalBytes)}</span></div>
                        <div className="flex justify-between"><span>Audit Dashboard Egress:</span><span className="font-bold text-rose-400">{formatBytes(stats.metaBytes)}</span></div>
                        <div className="border-t border-[#2b313a] pt-3 flex justify-between font-bold"><span>Total Overhead:</span><span className="text-amber-400 font-mono">{stats.overheadPercent.toFixed(3)}%</span></div>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white mb-4">Overhead Pie Chart</h3>
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={[{ name: 'App Egress', value: stats.totalBytes }, { name: 'Audit Egress', value: stats.metaBytes }]} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={5} dataKey="value">
                              <Cell fill="#60a5fa" /><Cell fill="#fb7185" />
                            </Pie>
                            <RechartsTooltip formatter={(v) => formatBytes(v as number)} contentStyle={{ background: '#1c222b', border: '1px solid #2b313a', borderRadius: '8px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── OFFLINE LOGS CACHE TAB ── */}
      {portalTab === 'offline' && (
        <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl p-5 space-y-6" style={{ animation: 'posFadeIn 220ms ease' }}>
          <div className="flex items-center justify-between border-b border-[#2b313a] pb-4">
            <div>
              <h3 className="text-sm font-bold text-white">IndexedDB Metric Log Buffer</h3>
              <p className="text-xs text-gray-500 mt-0.5">Buffered queries in `app-offline` database waiting for hourly aggregation</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleClearOfflineLogs} className="px-3 py-1.5 bg-red-950/20 border border-red-500/30 text-red-400 hover:text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5">
                <Trash2 size={13} />
                <span>Clear Cache</span>
              </button>
              <button onClick={loadOfflineStatus} className="p-2 bg-[#1d222a] border border-[#2b313a] text-gray-400 rounded-xl hover:text-white cursor-pointer">
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#1d222a] border border-[#2b313a] rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Offline Records Count</p>
                <p className="text-2xl font-mono font-bold text-purple-400 mt-1">{offlineCount}</p>
              </div>
              <HardDrive size={32} className="text-purple-500/20" />
            </div>
            <div className="bg-[#1d222a] border border-[#2b313a] rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">IndexedDB Table</p>
                <p className="text-sm font-bold text-white mt-2">`metricEvents`</p>
                <p className="text-[9px] text-gray-600 mt-0.5">Auto-increments id primary key</p>
              </div>
              <Database size={32} className="text-blue-500/20" />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white">Recent Raw Query Captures (Last 10)</h4>
            <div className="bg-[#1d222a] border border-[#2b313a] rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#171c23] border-b border-[#2b313a]">
                    <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest text-gray-500">ID</th>
                    <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest text-gray-500">Timestamp</th>
                    <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest text-gray-500">Method</th>
                    <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest text-gray-500">Endpoint</th>
                    <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest text-gray-500 text-right">Size</th>
                    <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest text-gray-500 text-right">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2b313a] font-mono text-[10px]">
                  {rawOfflineLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-600 font-sans">Offline cache is currently empty.</td>
                    </tr>
                  ) : (
                    rawOfflineLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#1c222b]">
                        <td className="px-4 py-2 text-white font-bold">{log.id}</td>
                        <td className="px-4 py-2 text-gray-400">{new Date(log.ts).toLocaleTimeString()}</td>
                        <td className="px-4 py-2 text-white font-bold">{log.http_method}</td>
                        <td className="px-4 py-2 text-purple-300 font-bold truncate max-w-[200px]" title={log.table_name}>{log.table_name || 'unknown'}</td>
                        <td className="px-4 py-2 text-right text-blue-400">{formatBytes(log.bytes)}</td>
                        <td className="px-4 py-2 text-right text-amber-400">{log.duration_ms} ms</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── DATABASE HEALTH TAB ── */}
      {portalTab === 'connection' && (
        <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl p-5 space-y-6" style={{ animation: 'posFadeIn 220ms ease' }}>
          <div>
            <h3 className="text-sm font-bold text-white">Supabase Connection Diagnostics</h3>
            <p className="text-xs text-gray-500 mt-0.5">Test latency and credential check for database connection</p>
          </div>

          <div className="bg-[#1d222a] border border-[#2b313a] rounded-xl p-4 space-y-4">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400">REST Client URL:</span>
              <span className="font-mono text-white text-[11px]">{import.meta.env.VITE_SUPABASE_URL}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400">Database Schema:</span>
              <span className="font-mono text-white text-[11px]">{import.meta.env.VITE_SUPABASE_SCHEMA || 'public'}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400">Current Auth Role:</span>
              <span className="font-mono text-white text-[11px] font-bold capitalize">{role}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={runSupabasePing}
              disabled={dbPingStatus === 'testing'}
              className="px-4 py-2 bg-primary text-black font-bold rounded-xl text-xs hover:bg-primary/90 transition-colors cursor-pointer"
            >
              {dbPingStatus === 'testing' ? 'Testing Connection...' : 'Test Connection Latency'}
            </button>
            
            {dbPingStatus === 'success' && (
              <div className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                <CheckCircle size={14} />
                <span>Connection online! Ping: {dbPingTime}ms</span>
              </div>
            )}

            {dbPingStatus === 'failed' && (
              <div className="text-xs text-rose-400 font-bold flex items-center gap-1.5">
                <AlertCircle size={14} />
                <span>Failed: {dbPingError}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── LOCAL SETTINGS TAB ── */}
      {portalTab === 'storage' && (
        <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl p-5 space-y-6" style={{ animation: 'posFadeIn 220ms ease' }}>
          <div>
            <h3 className="text-sm font-bold text-white">LocalStorage State Inspector</h3>
            <p className="text-xs text-gray-500 mt-0.5">Direct client-side configuration variables configuration</p>
          </div>

          <div className="bg-[#1d222a] border border-[#2b313a] rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#171c23] border-b border-[#2b313a]">
                  <th className="px-4 py-2.5 text-gray-500 font-bold">Config Key</th>
                  <th className="px-4 py-2.5 text-gray-500 font-bold">Value</th>
                  <th className="px-4 py-2.5 text-gray-500 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b313a] font-mono">
                {lsKeys.map((item) => (
                  <tr key={item.key} className="hover:bg-[#1c222b]">
                    <td className="px-4 py-2 text-white font-bold">{item.key}</td>
                    <td className="px-4 py-2 text-gray-400 max-w-sm truncate" title={item.value}>{item.value}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => handleDelLsKey(item.key)} className="p-1 text-gray-500 hover:text-red-400 rounded transition-colors cursor-pointer">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-[#2b313a] pt-4 space-y-3">
            <h4 className="text-xs font-bold text-white">Insert/Edit Configuration Variable</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                placeholder="Config Key"
                value={newLsKey}
                onChange={e => setNewLsKey(e.target.value)}
                className="bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none"
              />
              <input
                placeholder="Value"
                value={newLsVal}
                onChange={e => setNewLsVal(e.target.value)}
                className="bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none"
              />
              <button
                onClick={handleSetLsKey}
                className="px-4 py-2 bg-primary text-black font-bold rounded-xl text-xs hover:bg-primary/90 transition-colors cursor-pointer"
              >
                Set Variable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SYSTEM ENVIRONMENT TAB ── */}
      {portalTab === 'sysinfo' && (
        <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl p-5 space-y-6" style={{ animation: 'posFadeIn 220ms ease' }}>
          <div>
            <h3 className="text-sm font-bold text-white">System Runtime Specifications</h3>
            <p className="text-xs text-gray-500 mt-0.5">Desktop shell framework and runtime specifications</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#1d222a] border border-[#2b313a] rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-white border-b border-[#2b313a] pb-2">Hardware Shell Specs</h4>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Host Environment:</span>
                <span className="text-white font-bold">{(window as any).desktop ? 'Electron Native App' : 'Browser Mode'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Chrome Core:</span>
                <span className="text-white font-mono">{(window as any).desktop?.versions?.chrome || 'Browser Engine'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Node Engine:</span>
                <span className="text-white font-mono">{(window as any).desktop?.versions?.node || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Electron Build:</span>
                <span className="text-white font-mono">{(window as any).desktop?.versions?.electron || 'N/A'}</span>
              </div>
            </div>

            <div className="bg-[#1d222a] border border-[#2b313a] rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-white border-b border-[#2b313a] pb-2">Client Viewport Specs</h4>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Screen Resolution:</span>
                <span className="text-white font-mono">{window.screen.width} x {window.screen.height}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Viewport Dimension:</span>
                <span className="text-white font-mono">{window.innerWidth} x {window.innerHeight}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Display Density:</span>
                <span className="text-white font-mono">{window.devicePixelRatio}x (Retina/HIDPI)</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Protocol:</span>
                <span className="text-white font-mono">{window.location.protocol}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LOAD GENERATOR TAB ── */}
      {portalTab === 'loadtest' && (
        <div className="bg-[#171c23] border border-[#2b313a] rounded-2xl p-5 space-y-6" style={{ animation: 'posFadeIn 220ms ease' }}>
          <div>
            <h3 className="text-sm font-bold text-white">Database Query Spammer & Load Tester</h3>
            <p className="text-xs text-gray-500 mt-0.5">Fire batch queries to test fetch capture, IndexedDB latency, and aggregation overhead</p>
          </div>

          <div className="bg-[#1d222a] border border-[#2b313a] rounded-xl p-4 space-y-4">
            <h4 className="text-xs font-bold text-white">Configure Query Batch Size</h4>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {[10, 50, 100, 200].map(count => (
                  <button
                    key={count}
                    onClick={() => setSpammerCount(count)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                      spammerCount === count
                        ? "bg-purple-950 border-purple-500 text-purple-400"
                        : "bg-[#171c23] border-[#2b313a] text-gray-400"
                    )}
                  >
                    {count} Queries
                  </button>
                ))}
              </div>

              <button
                onClick={triggerSpamQueries}
                disabled={spammerLoading}
                className="px-5 py-2 bg-purple-600 text-white font-bold rounded-xl text-xs hover:bg-purple-700 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {spammerLoading ? 'Spamming...' : 'Fire Spammer'}
              </button>
            </div>

            {spammerResult && (
              <div className="p-3 bg-purple-950/20 border border-purple-500/20 rounded-xl text-xs text-purple-300 font-medium">
                {spammerResult}
              </div>
            )}
          </div>
        </div>
      )}

      {portalTab === 'sandbox' && (
        <div style={{ animation: 'posFadeIn 220ms ease' }}>
          <SandboxRunnerPanel />
        </div>
      )}

    </div>
  );
};

// --- DATA CALCULATION HELPER FUNCTIONS ---

function userAggregatesCalc(appRecords: AuditRecord[]) {
  const map: Record<string, { role: string; user_id: string; location: string; calls: number; bytes: number; duration: number }> = {};
  appRecords.forEach(r => {
    const userKey = r.user_id || r.role || 'Unknown';
    if (!map[userKey]) {
      map[userKey] = {
        role: r.role || 'anon',
        user_id: userKey,
        location: r.location || 'Shop',
        calls: 0,
        bytes: 0,
        duration: 0,
      };
    }
    map[userKey].calls += r.call_count;
    map[userKey].bytes += r.total_bytes;
    map[userKey].duration += r.total_duration_ms;
  });
  return Object.values(map).sort((a, b) => b.bytes - a.bytes);
}

function deviceAggregatesCalc(appRecords: AuditRecord[]) {
  const map: Record<string, { device_id: string; location: string; calls: number; bytes: number; duration: number }> = {};
  appRecords.forEach(r => {
    if (!map[r.device_id]) {
      map[r.device_id] = {
        device_id: r.device_id,
        location: r.location || 'Shop',
        calls: 0,
        bytes: 0,
        duration: 0,
      };
    }
    map[r.device_id].calls += r.call_count;
    map[r.device_id].bytes += r.total_bytes;
    map[r.device_id].duration += r.total_duration_ms;
  });
  return Object.values(map).sort((a, b) => b.bytes - a.bytes);
}

function pageAggregatesCalc(appRecords: AuditRecord[]) {
  const map: Record<string, { page: string; calls: number; bytes: number; duration: number }> = {};
  appRecords.forEach(r => {
    const pageKey = r.page || '/';
    if (!map[pageKey]) {
      map[pageKey] = {
        page: pageKey,
        calls: 0,
        bytes: 0,
        duration: 0,
      };
    }
    map[pageKey].calls += r.call_count;
    map[pageKey].bytes += r.total_bytes;
    map[pageKey].duration += r.total_duration_ms;
  });
  return Object.values(map).sort((a, b) => b.bytes - a.bytes);
}

function queryAggregatesCalc(appRecords: AuditRecord[], querySearch: string, querySort: QuerySortField) {
  const map: Record<string, { method: string; table: string; columns: string; filters: string; calls: number; bytes: number; duration: number }> = {};
  appRecords.forEach(r => {
    const qKey = `${r.http_method}|${r.table_name || 'unknown'}|${r.columns_key || ''}|${r.filter_key || ''}`;
    if (!map[qKey]) {
      map[qKey] = {
        method: r.http_method,
        table: r.table_name || 'general',
        columns: r.columns_key || 'All (*)',
        filters: r.filter_key || 'None',
        calls: 0,
        bytes: 0,
        duration: 0,
      };
    }
    map[qKey].calls += r.call_count;
    map[qKey].bytes += r.total_bytes;
    map[qKey].duration += r.total_duration_ms;
  });

  let list = Object.values(map);

  if (querySearch.trim()) {
    const queryLower = querySearch.toLowerCase();
    list = list.filter(
      q =>
        q.table.toLowerCase().includes(queryLower) ||
        q.columns.toLowerCase().includes(queryLower) ||
        q.filters.toLowerCase().includes(queryLower) ||
        q.method.toLowerCase().includes(queryLower)
    );
  }

  return list.sort((a, b) => {
    if (querySort === 'calls') return b.calls - a.calls;
    if (querySort === 'duration') return (b.duration / b.calls) - (a.duration / a.calls);
    return b.bytes - a.bytes;
  });
}
