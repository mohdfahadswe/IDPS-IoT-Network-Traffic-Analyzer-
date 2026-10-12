import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  Cpu,
  Globe,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Zap,
  Radio,
  Layers,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import { analyticsService } from '../services/api';
import { AnalyticsData } from '../types';
import { RiskBadge } from '../components/common/RiskBadge';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatLastSeen, formatDateTime } from '../utils/formatters';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useSimulation } from '../contexts/SimulationContext';

export const Analytics: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [days, setDays] = useState<number>(7);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [currentLiveTime, setCurrentLiveTime] = useState<Date>(new Date());

  const { subscribe } = useWebSocket();
  const { isSimulating } = useSimulation();

  // Keep a 1-second live clock ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentLiveTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchAnalytics = useCallback(async (selectedDays: number, isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setIsRefreshing(true);

      const res = await analyticsService.getAnalytics(selectedDays);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(days);
  }, [days, fetchAnalytics]);

  // Live auto-refresh on new alerts and periodic 20s interval (no chart flickering)
  useEffect(() => {
    let alertTimer: any = null;
    const unsubAlert = subscribe('NEW_ALERT', () => {
      if (alertTimer) clearTimeout(alertTimer);
      alertTimer = setTimeout(() => {
        fetchAnalytics(days, true);
      }, 1500);
    });

    const interval = setInterval(() => {
      fetchAnalytics(days, true);
    }, 20000);

    return () => {
      unsubAlert();
      if (alertTimer) clearTimeout(alertTimer);
      clearInterval(interval);
    };
  }, [subscribe, days, fetchAnalytics]);

  const severityPieData = [
    { name: 'Critical', value: data?.severity_distribution?.Critical || 0, color: '#e11d48' },
    { name: 'High', value: data?.severity_distribution?.High || 0, color: '#f97316' },
    { name: 'Medium', value: data?.severity_distribution?.Medium || 0, color: '#f59e0b' },
    { name: 'Low', value: data?.severity_distribution?.Low || 0, color: '#10b981' },
  ].filter((item) => item.value > 0);

  const formatVolume = (bytes?: number) => {
    if (!bytes) return '0 B';
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} kB`;
    return `${bytes} B`;
  };

  const totalAlertsInWindow = Object.values(data?.severity_distribution || {}).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Real-time Header & Live Clock */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Security Analytics & Intelligence</h2>
            {isSimulating ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>REAL-TIME STREAMING</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>STANDBY / HISTORICAL SYNC</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Comprehensive telemetry forensics, attack vector velocity, and device risk distribution
          </p>
        </div>

        {/* Live Date/Time Display & Window Filter */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Real-time Date and Clock */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-mono text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="font-semibold text-slate-900">
              {currentLiveTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-indigo-600 font-bold">
              {currentLiveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          <button
            onClick={() => fetchAnalytics(days, false)}
            disabled={loading || isRefreshing}
            className="p-2 rounded-xl border border-slate-200/80 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>

          {/* Time Range Filter */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-medium">
            {[
              { label: '24 Hours', val: 1 },
              { label: '7 Days', val: 7 },
              { label: '30 Days', val: 30 },
            ].map((btn) => (
              <button
                key={btn.val}
                onClick={() => setDays(btn.val)}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  days === btn.val
                    ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4 Primary Analytics KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Incidents */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Threats Detected</span>
            <span className="p-2 bg-rose-50 rounded-xl text-rose-600 border border-rose-100">
              <ShieldAlert className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono mt-2">
            {data?.kpis.threats_detected ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
            <span className="font-semibold text-rose-600">{data?.severity_distribution?.Critical || 0} Critical</span>
            <span>in {days === 1 ? 'past 24 hours' : `past ${days} days`}</span>
          </div>
        </div>

        {/* Network Telemetry Volume */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Telemetry Volume</span>
            <span className="p-2 bg-cyan-50 rounded-xl text-cyan-600 border border-cyan-100">
              <Activity className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono mt-2">
            {formatVolume(data?.kpis.total_traffic_bytes)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>Inbound & Outbound flows analyzed</span>
          </div>
        </div>

        {/* Active IoT Fleet */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Fleet Nodes Active</span>
            <span className="p-2 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
              <Cpu className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono mt-2">
            {data?.kpis.active_devices ?? 0} / {data?.kpis.total_devices ?? 0}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{data?.kpis.active_devices === data?.kpis.total_devices ? '100% Fleet Online' : 'Active IoT Nodes'}</span>
          </div>
        </div>

        {/* Average Fleet Risk Index */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Fleet Avg Risk</span>
            <span className="p-2 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100">
              <Zap className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono mt-2 flex items-baseline gap-1">
            <span>{data?.kpis.avg_fleet_risk ?? 0}</span>
            <span className="text-xs text-slate-400 font-normal">/ 100</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            <span>{data?.kpis.blocked_entities || 0} entities actively blocked</span>
          </div>
        </div>
      </div>

      {/* Primary Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Incident Velocity & Throughput Trends (2 Cols) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Threat Velocity & Network Activity</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Incident timestamps and network volume over {days === 1 ? 'the last 24 hours' : `the last ${days} days`}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600" />
                <span className="text-slate-600">Total Incidents</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" />
                <span className="text-slate-600">High / Critical</span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            {loading && !data ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">Loading timeline...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.daily_trends || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: 'none',
                      borderRadius: '0.75rem',
                      color: '#fff',
                      fontSize: '0.75rem',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
                    }}
                    formatter={(val: any, name: any) => [
                      val,
                      name === 'total_threats' ? 'Total Incidents' : name === 'critical_threats' ? 'Critical Threats' : name,
                    ]}
                    labelFormatter={(label) => `Time: ${label}`}
                  />
                  <Bar dataKey="total_threats" name="total_threats" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="critical_threats" name="critical_threats" fill="#e11d48" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Threat Severity Breakdown (1 Col) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Severity Breakdown</h3>
                <p className="text-xs text-slate-500 mt-0.5">Categorized risk distribution</p>
              </div>
              <BarChart3 className="w-4 h-4 text-indigo-600" />
            </div>

            <div className="h-44 w-full flex items-center justify-center">
              {severityPieData.length === 0 ? (
                <div className="text-xs text-slate-400">No incident data in selected window.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={severityPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {severityPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: 'none',
                        borderRadius: '0.5rem',
                        color: '#fff',
                        fontSize: '0.75rem',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
            {severityPieData.map((item) => (
              <div key={item.name} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600 font-medium">{item.name}</span>
                </div>
                <span className="font-bold text-slate-900 font-mono">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Threat Types & Protocol Analysis Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Threat Categories & Attack Types */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Detected Threat Categories</h3>
              <p className="text-xs text-slate-500 mt-0.5">Classification breakdown from real-time alert engine</p>
            </div>
            <ShieldAlert className="w-4 h-4 text-indigo-600" />
          </div>

          <div className="space-y-3 mt-4">
            {(data?.threat_types && data.threat_types.length > 0) ? (
              data.threat_types.map((tt, idx) => {
                const maxCount = data.threat_types![0].count || 1;
                const pct = Math.round((tt.count / maxCount) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{tt.name}</span>
                      <span className="font-mono text-slate-500 font-medium">{tt.count} incidents</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-rose-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No threat patterns detected in the selected time window.
              </div>
            )}
          </div>
        </div>

        {/* Network Protocol & Transport Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Transport Protocol Distribution</h3>
              <p className="text-xs text-slate-500 mt-0.5">Network traffic volume by protocol</p>
            </div>
            <Radio className="w-4 h-4 text-cyan-600" />
          </div>

          <div className="space-y-3 mt-4">
            {(data?.protocols && data.protocols.length > 0) ? (
              data.protocols.map((p, idx) => (
                <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-1 bg-white border border-slate-200/80 rounded-lg font-mono font-bold text-indigo-700">
                      {p.protocol}
                    </span>
                    <div>
                      <div className="font-semibold text-slate-800">{p.count} Flow Samples</div>
                      <div className="text-[11px] text-slate-400">Packets inspected</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900 font-mono">{formatVolume(p.bytes)}</div>
                    <div className="text-[11px] text-slate-500">Transferred</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No protocol telemetry recorded in this time range.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Forensics: Top Flagged IoT Nodes & High-Risk External Domains */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Highest Risk IoT Nodes */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-4 h-4 text-rose-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Highest-Risk IoT Nodes</h3>
              <p className="text-xs text-slate-500 mt-0.5">Devices sorted by risk score index</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {(data?.suspicious_devices || []).map((d) => (
              <div key={d.device_id} className="py-3.5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span>{d.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                      {d.ip_address || d.device_id}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                    <span>{d.type}</span>
                    <span>•</span>
                    <span>Last active: {formatLastSeen(d.last_seen)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={d.status as any} />
                  <RiskBadge level={d.risk_level as any} score={d.risk_score} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Highest Risk External Domains */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-indigo-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">High-Risk External Domains</h3>
              <p className="text-xs text-slate-500 mt-0.5">Endpoints contacted by IoT devices</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {(data?.top_risk_domains || []).map((dom, i) => (
              <div key={i} className="py-3.5 flex items-center justify-between">
                <div>
                  <div className="font-mono font-bold text-slate-900">{dom.domain_name}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <span>{dom.category}</span>
                    <span>•</span>
                    <span>{dom.request_count} queries</span>
                    <span>•</span>
                    <span>Last query: {formatLastSeen(dom.last_seen)}</span>
                  </div>
                </div>
                <RiskBadge level={dom.risk_level as any} score={dom.risk_score} size="sm" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

