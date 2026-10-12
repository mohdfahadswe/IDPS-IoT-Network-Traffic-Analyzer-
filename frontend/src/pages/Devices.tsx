import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Filter,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Cpu,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { deviceService, blockingService } from '../services/api';
import { useSearchParams } from 'react-router-dom';
import { Device } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { RiskBadge } from '../components/common/RiskBadge';
import { Modal } from '../components/common/Modal';
import { useWebSocket } from '../contexts/WebSocketContext';
import { formatLastSeen } from '../utils/formatters';

export const Devices: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [devices, setDevices] = useState<Device[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [search, setSearch] = useState<string>(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);

  // Sync URL query params if user clicked direct deep link
  useEffect(() => {
    const urlStatus = searchParams.get('status');
    if (urlStatus) {
      setStatusFilter(urlStatus);
    }
    const urlSearch = searchParams.get('search');
    if (urlSearch !== null) {
      setSearch(urlSearch);
    }
  }, [searchParams]);

  // Action modal state
  const [actionModalOpen, setActionModalOpen] = useState<boolean>(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [actionType, setActionType] = useState<'block' | 'temp_block' | 'unblock' | 'monitor'>('block');
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [reason, setReason] = useState<string>('Operator security intervention');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const { subscribe } = useWebSocket();

  const fetchDevices = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await deviceService.getDevices({
        page,
        limit: 10,
        search: search.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        source: sourceFilter !== 'all' ? sourceFilter : undefined,
      });
      setDevices(res.data.devices || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to load devices:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchDevices();
    }, 200);
    return () => clearTimeout(debounceTimer);
  }, [page, statusFilter, sourceFilter, search]);

  // Live in-place state updates (zero table flashing)
  useEffect(() => {
    const unsubStatus = subscribe('DEVICE_STATUS_CHANGE', (data: any) => {
      if (data?.device_id) {
        setDevices((prev) =>
          prev.map((d) =>
            d.device_id === data.device_id ? { ...d, status: data.status || d.status } : d
          )
        );
      } else {
        fetchDevices(true);
      }
    });

    const unsubEvent = subscribe('DEVICE_EVENT', (data: any) => {
      setDevices((prev) =>
        prev.map((d) =>
          d.device_id === data.device_id
            ? {
                ...d,
                name: data.device_name || d.name,
                status: data.status || d.status,
                risk_score: data.risk_score ?? d.risk_score,
                risk_level: data.risk_level || d.risk_level,
                latest_sensor_data: data.sensor_data || d.latest_sensor_data,
                last_seen: data.timestamp || d.last_seen,
              }
            : d
        )
      );
    });

    return () => {
      unsubStatus();
      unsubEvent();
    };
  }, [subscribe]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchDevices();
  };

  const openActionModal = (dev: Device, action: 'block' | 'temp_block' | 'unblock' | 'monitor') => {
    setSelectedDevice(dev);
    setActionType(action);
    setActionModalOpen(true);
  };

  const handleExecuteAction = async () => {
    if (!selectedDevice) return;
    setActionLoading(true);
    try {
      await deviceService.executeAction(selectedDevice.device_id, {
        action: actionType,
        duration_minutes: actionType === 'temp_block' ? durationMinutes : undefined,
        reason,
      });
      setActionModalOpen(false);
      fetchDevices();
    } catch (err) {
      console.error('Failed to execute action:', err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Connected Devices Fleet</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor, inspect, and enforce security policies across physical ESP32 and simulated nodes
          </p>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ID, name, or IP..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </form>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200/80 rounded-xl font-medium text-slate-700 focus:outline-hidden cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active (Online & Suspicious)</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="suspicious">Suspicious</option>
            <option value="temporarily_blocked">Temp Blocked</option>
            <option value="blocked">Blocked</option>
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200/80 rounded-xl font-medium text-slate-700 focus:outline-hidden cursor-pointer"
          >
            <option value="all">All Sources</option>
            <option value="real">Real Physical ESP32</option>
            <option value="simulated">Simulated Devices</option>
          </select>
        </div>
      </div>

      {/* Devices Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <th className="px-6 py-3.5">Device Identity</th>
                <th className="px-6 py-3.5">Type & Source</th>
                <th className="px-6 py-3.5">Network Coordinates</th>
                <th className="px-6 py-3.5">Current Status</th>
                <th className="px-6 py-3.5">Risk Score</th>
                <th className="px-6 py-3.5">Last Seen</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">Loading devices...</td>
                </tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">No matching devices found.</td>
                </tr>
              ) : (
                devices.map((d) => (
                  <tr key={d.device_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4">
                      <Link
                        to={`/devices/${d.device_id}`}
                        className="font-bold text-slate-900 hover:text-indigo-600 flex items-center gap-1.5 transition-colors"
                      >
                        <span>{d.name}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </Link>
                      <span className="text-[11px] text-slate-400 font-mono">{d.device_id}</span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{d.type}</div>
                      <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                        d.source === 'real' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {d.source}
                      </span>
                    </td>

                    <td className="px-6 py-4 font-mono text-slate-600">
                      <div>{d.ip_address}</div>
                      <div className="text-[11px] text-slate-400">{d.mac_address || 'N/A'}</div>
                    </td>

                    <td className="px-6 py-4">
                      <StatusBadge status={d.status} />
                    </td>

                    <td className="px-6 py-4">
                      <RiskBadge level={d.risk_level} score={d.risk_score} size="md" />
                    </td>

                    <td className="px-6 py-4 text-slate-500 font-medium text-xs">
                      {formatLastSeen(d.last_seen)}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {d.status === 'blocked' || d.status === 'temporarily_blocked' ? (
                          <button
                            onClick={() => openActionModal(d, 'unblock')}
                            className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Unblock
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => openActionModal(d, 'temp_block')}
                              title="Temporary Block"
                              className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Clock className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openActionModal(d, 'block')}
                              title="Permanent Block"
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <ShieldAlert className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-slate-200/80 bg-slate-50/50 flex items-center justify-between text-xs text-slate-600">
          <div>
            Showing <span className="font-semibold text-slate-900">{devices.length}</span> of{' '}
            <span className="font-semibold text-slate-900">{total}</span> total devices
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold">Page {page}</span>
            <button
              disabled={page * 10 >= total}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Action Confirmation Modal */}
      {selectedDevice && (
        <Modal
          isOpen={actionModalOpen}
          onClose={() => setActionModalOpen(false)}
          title={`Enforce Action on Node: ${selectedDevice.name}`}
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
              <span className="font-semibold text-slate-900">Selected Device:</span> {selectedDevice.name} ({selectedDevice.device_id})
              <div className="text-slate-500 font-mono mt-0.5">IP: {selectedDevice.ip_address}</div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Action Policy
              </label>
              <div className="text-sm font-bold text-slate-900 capitalize">
                {actionType.replace('_', ' ')}
              </div>
            </div>

            {actionType === 'temp_block' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Temporary Quarantine Duration
                </label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value={5}>5 Minutes</option>
                  <option value={15}>15 Minutes (Default)</option>
                  <option value={30}>30 Minutes</option>
                  <option value={60}>1 Hour</option>
                  <option value={1440}>24 Hours</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Policy Reason
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setActionModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteAction}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
              >
                {actionLoading ? 'Processing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
