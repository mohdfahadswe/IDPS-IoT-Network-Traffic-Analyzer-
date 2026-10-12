import React from 'react';
import { AlertTriangle, ChevronRight, Cpu, ShieldCheck, ShieldAlert, Clock, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert } from '../../types';
import { RiskBadge } from '../common/RiskBadge';

interface RecentAlertsListProps {
  alerts: Alert[];
}

export const RecentAlertsList: React.FC<RecentAlertsListProps> = ({ alerts }) => {
  const formatTime = (ts: string) => {
    try {
      const date = new Date(ts);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return ts;
    }
  };

  const getSeverityIcon = (sev?: string) => {
    const s = sev?.toLowerCase();
    if (s === 'critical' || s === 'high') {
      return (
        <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100/80 shrink-0">
          <ShieldAlert className="w-4 h-4" />
        </div>
      );
    }
    if (s === 'medium') {
      return (
        <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100/80 shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100/80 shrink-0">
        <AlertTriangle className="w-4 h-4" />
      </div>
    );
  };

  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col h-full transition-all duration-300 hover:border-slate-300 card-minimal">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Recent Incident Alerts</h3>
            {alerts.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/70 animate-pulse-subtle">
                {alerts.length} New
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Automated multi-factor anomaly & intrusion logs</p>
        </div>
        <Link
          to="/alerts"
          className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 group transition-colors"
        >
          <span>View All</span>
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Incident Alert List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pt-3 pr-1 max-h-[460px]">
        {alerts.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="font-semibold text-slate-700">All Nodes Operating Securely</span>
            <span className="text-[11px] text-slate-400">No unaddressed security incidents in the monitoring queue</span>
          </div>
        ) : (
          alerts.slice(0, 8).map((a) => (
            <div
              key={a.id || a.alert_id}
              className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/40 hover:bg-slate-50 hover:border-slate-200/90 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {getSeverityIcon(a.severity)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-xs font-bold text-slate-900 truncate">{a.alert_type}</span>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">#{a.alert_id}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <RiskBadge level={a.severity} score={a.risk_score} size="sm" />
                        <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatTime(a.timestamp)}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed">
                      {a.description}
                    </p>

                    {/* Metadata Footer */}
                    <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-slate-100/80 text-[11px]">
                      {/* Device identifier pill */}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-slate-200/80 font-medium text-slate-800 text-[11px]">
                        <Cpu className="w-3 h-3 text-indigo-600 shrink-0" />
                        <span className="font-semibold">{a.device_name || a.device_id || 'IoT Node'}</span>
                        {a.device_name && a.device_id && (
                          <span className="text-[10px] font-mono text-slate-400">({a.device_id})</span>
                        )}
                      </span>

                      {/* Source IP */}
                      {a.source_ip && (
                        <span className="font-mono text-[10px] text-slate-500 bg-slate-100/80 px-1.5 py-0.5 rounded">
                          {a.source_ip}
                        </span>
                      )}

                      {/* Action taken pill */}
                      {a.action_taken && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-indigo-50/80 text-indigo-700 border border-indigo-100 font-semibold text-[10px]">
                          Policy: {a.action_taken}
                        </span>
                      )}

                      {/* Status tag */}
                      <span
                        className={`ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          a.status === 'New'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : a.status === 'Acknowledged'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {a.status || 'New'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

