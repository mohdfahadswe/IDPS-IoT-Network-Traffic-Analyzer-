import React, { useState, useEffect } from 'react';
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Eye,
  ShieldAlert,
  Cpu,
} from 'lucide-react';
import { alertService } from '../services/api';
import { Alert } from '../types';
import { RiskBadge } from '../components/common/RiskBadge';
import { Modal } from '../components/common/Modal';
import { useSearchParams } from 'react-router-dom';
import { useWebSocket } from '../contexts/WebSocketContext';

export const Alerts: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [search, setSearch] = useState<string>(searchParams.get('search') || '');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);

  // Detail Modal
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const { subscribe } = useWebSocket();

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await alertService.getAlerts({
        page,
        limit: 10,
        search: search || undefined,
        severity: severityFilter,
        status: statusFilter,
      });
      setAlerts(res.data?.alerts || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [page, severityFilter, statusFilter]);

  // Real-time listener for incoming alerts
  useEffect(() => {
    const unsub = subscribe('NEW_ALERT', (newAlert: Alert) => {
      // If we are on page 1 and no strict filter mismatch, prepend
      if (page === 1) {
        if (severityFilter !== 'all' && newAlert.severity !== severityFilter) return;
        if (statusFilter !== 'all' && newAlert.status !== statusFilter) return;
        setAlerts((prev) => [newAlert, ...prev.filter((a) => a.alert_id !== newAlert.alert_id).slice(0, 9)]);
        setTotal((prev) => prev + 1);
      }
    });
    return () => unsub();
  }, [subscribe, page, severityFilter, statusFilter]);

  const handleUpdateStatus = async (alertId: string, newStatus: string) => {
    try {
      await alertService.updateStatus(alertId, newStatus);
      setAlerts((prev) =>
        prev.map((a) => (a.alert_id === alertId ? { ...a, status: newStatus as any } : a))
      );
      if (selectedAlert && selectedAlert.alert_id === alertId) {
        setSelectedAlert({ ...selectedAlert, status: newStatus as any });
      }
    } catch (err) {
      console.error('Failed to update alert status:', err);
    }
  };

  const totalPages = Math.ceil(total / 10) || 1;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight">Security Incident Center</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated multi-factor anomaly correlation and threat alerts
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchAlerts()}
              placeholder="Search alert, device, IP, or type..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          <select
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-hidden cursor-pointer"
          >
            <option value="all">All Severities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-hidden cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="New">New</option>
            <option value="Acknowledged">Acknowledged</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <th className="px-6 py-3.5">Alert Identity</th>
                <th className="px-6 py-3.5">Threat Classification</th>
                <th className="px-6 py-3.5">Source Entity / Device</th>
                <th className="px-6 py-3.5">Severity</th>
                <th className="px-6 py-3.5">Action Taken</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && alerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">Loading security incident queue...</td>
                </tr>
              ) : alerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">No active incidents found.</td>
                </tr>
              ) : (
                alerts.map((a) => (
                  <tr key={a.alert_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-mono font-bold text-slate-900">{a.alert_id}</div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(a.timestamp).toLocaleString()}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{a.alert_type}</div>
                      <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{a.description}</div>
                    </td>

                    <td className="px-6 py-4 text-slate-700">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>{a.device_name || a.device_id || 'Unknown Device'}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono pl-5">
                        {a.device_name && a.device_id && <span>{a.device_id} • </span>}
                        {a.source_ip}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <RiskBadge level={a.severity} score={a.risk_score} size="sm" />
                    </td>

                    <td className="px-6 py-4 font-medium text-slate-700">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px]">
                        {a.action_taken}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        a.status === 'New' ? 'bg-rose-50 text-rose-700' :
                        a.status === 'Acknowledged' ? 'bg-amber-50 text-amber-700' :
                        'bg-emerald-50 text-emerald-700'
                      }`}>
                        {a.status}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedAlert(a)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <Modal
          isOpen={!!selectedAlert}
          onClose={() => setSelectedAlert(null)}
          title={`Incident Dossier: ${selectedAlert.alert_id}`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{selectedAlert.alert_type}</h4>
                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium mt-1">
                  <Cpu className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Target Device: <strong className="text-slate-900">{selectedAlert.device_name || selectedAlert.device_id || 'Unknown Device'}</strong></span>
                  <span className="text-slate-400 font-mono text-[11px]">({selectedAlert.device_id ? `${selectedAlert.device_id} • ` : ''}{selectedAlert.source_ip})</span>
                </div>
              </div>
              <RiskBadge level={selectedAlert.severity} score={selectedAlert.risk_score} size="lg" />
            </div>

            <div>
              <h5 className="text-xs font-semibold uppercase text-slate-500 tracking-wider mb-1">
                Detailed Incident Analysis
              </h5>
              <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 leading-relaxed font-mono">
                {selectedAlert.description}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block font-semibold uppercase text-[10px]">Action Enforced</span>
                <span className="font-bold text-slate-800">{selectedAlert.action_taken}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block font-semibold uppercase text-[10px]">Incident Timestamp</span>
                <span className="font-bold text-slate-800 font-mono">{new Date(selectedAlert.timestamp).toLocaleString()}</span>
              </div>
            </div>

            {/* Status Workflow Buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="text-xs font-medium text-slate-600">Update Disposition:</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleUpdateStatus(selectedAlert.alert_id, 'Acknowledged')}
                  className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100"
                >
                  Acknowledge
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedAlert.alert_id, 'Resolved')}
                  className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100"
                >
                  Resolve Incident
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
