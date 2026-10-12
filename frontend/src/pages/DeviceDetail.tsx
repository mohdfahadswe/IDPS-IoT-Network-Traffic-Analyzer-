import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Cpu,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Radio,
  Thermometer,
  Activity,
  AlertTriangle,
  Globe,
  Lock,
} from 'lucide-react';
import { deviceService } from '../services/api';
import { Device, DeviceEvent, Alert } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { RiskBadge } from '../components/common/RiskBadge';
import { Modal } from '../components/common/Modal';
import { useWebSocket } from '../contexts/WebSocketContext';

export const DeviceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { subscribe } = useWebSocket();
  const [device, setDevice] = useState<Device | null>(null);
  const [events, setEvents] = useState<DeviceEvent[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [connectedDomains, setConnectedDomains] = useState<any[]>([]);
  const [riskHistory, setRiskHistory] = useState<any[]>([]);
  const [blockHistory, setBlockHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal
  const [actionModalOpen, setActionModalOpen] = useState<boolean>(false);
  const [actionType, setActionType] = useState<string>('block');
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [reason, setReason] = useState<string>('Manual operator enforcement');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const fetchDeviceData = async (silent = false) => {
    if (!id) return;
    try {
      if (!silent) setLoading(true);
      const res = await deviceService.getDeviceDetail(id);
      setDevice(res.data.device);
      setEvents(res.data.recent_events || []);
      setAlerts(res.data.recent_alerts || []);
      setConnectedDomains(res.data.connected_domains || []);
      setRiskHistory(res.data.risk_history || []);
      setBlockHistory(res.data.block_history || []);
    } catch (err) {
      console.error('Failed to load device details:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeviceData();
  }, [id]);

  useEffect(() => {
    const unsubStatus = subscribe('DEVICE_STATUS_CHANGE', (data: any) => {
      if (!data?.device_id || data.device_id === id) {
        fetchDeviceData(true);
      }
    });

    const unsubEvent = subscribe('DEVICE_EVENT', (data: any) => {
      if (!data?.device_id || data.device_id === id) {
        fetchDeviceData(true);
      }
    });

    return () => {
      unsubStatus();
      unsubEvent();
    };
  }, [id, subscribe]);

  const handleExecuteAction = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await deviceService.executeAction(id, {
        action: actionType,
        duration_minutes: actionType === 'temp_block' ? durationMinutes : undefined,
        reason,
      });
      setActionModalOpen(false);
      fetchDeviceData();
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading node telemetry dossier...</div>;
  }

  if (!device) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Device not found.{' '}
        <Link to="/devices" className="text-indigo-600 font-semibold">
          Return to fleet
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back button & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            to="/devices"
            className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">{device.name}</h2>
              <span className="font-mono text-xs text-slate-400">({device.device_id})</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Asset Dossier & Behavioral Telemetry Stream</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {device.status === 'blocked' || device.status === 'temporarily_blocked' ? (
            <button
              onClick={() => {
                setActionType('unblock');
                setActionModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
            >
              Unblock Device
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setActionType('monitor');
                  setActionModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-300 transition-colors cursor-pointer"
              >
                Monitor Only
              </button>
              <button
                onClick={() => {
                  setActionType('temp_block');
                  setActionModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 font-semibold text-xs border border-orange-200 transition-colors cursor-pointer"
              >
                Temp Block
              </button>
              <button
                onClick={() => {
                  setActionType('block');
                  setActionModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
              >
                Permanent Block
              </button>
            </>
          )}
        </div>
      </div>

      {/* Device Information Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Device Identity</div>
          <div className="mt-2 text-sm font-bold text-slate-900">{device.type}</div>
          <div className="mt-2">
            <StatusBadge status={device.status} source={device.source} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Network Coordinates</div>
          <div className="mt-2 text-sm font-mono font-bold text-slate-900">{device.ip_address}</div>
          <div className="text-xs font-mono text-slate-400 mt-0.5">{device.mac_address || 'No MAC recorded'}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Multi-Factor Risk</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">{device.risk_score.toFixed(0)}</span>
            <RiskBadge level={device.risk_level} size="sm" />
          </div>
          <div className="text-xs text-slate-400 mt-1">Multi-factor heuristic</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Live Telemetry</div>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex items-center gap-1 text-slate-700 font-semibold text-sm">
              <Thermometer className="w-4 h-4 text-indigo-500" />
              <span>{device.latest_sensor_data?.temperature ? `${device.latest_sensor_data.temperature}°C` : '24.5°C'}</span>
            </div>
            <div className="flex items-center gap-1 text-slate-700 font-semibold text-sm">
              <Activity className="w-4 h-4 text-emerald-500" />
              <span>{device.latest_sensor_data?.humidity ? `${device.latest_sensor_data.humidity}%` : '55%'}</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Updated live</span>
          </div>
        </div>
      </div>

      {/* Grid: Events & Threat Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Events */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <h3 className="text-base font-bold text-slate-900 tracking-tight mb-4">Ingested Telemetry Events</h3>
          <div className="space-y-3">
            {events.length === 0 ? (
              <div className="text-center p-6 text-slate-400 text-xs">No telemetry records logged yet.</div>
            ) : (
              events.slice(0, 5).map((ev) => (
                <div key={ev.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">
                      {ev.protocol} Port {ev.port}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-slate-500 font-mono">
                    <span>Vol: {ev.traffic_volume} B</span>
                    <span>Packets: {ev.packet_count}</span>
                    <span>Risk: {ev.risk_score.toFixed(0)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Security Alerts */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <h3 className="text-base font-bold text-slate-900 tracking-tight mb-4">Triggered Security Incidents</h3>
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="text-center p-6 text-slate-400 text-xs">No active threats detected on this node.</div>
            ) : (
              alerts.map((alt) => (
                <div key={alt.id} className="p-3.5 bg-rose-50/50 rounded-xl border border-rose-200/80 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-900">{alt.alert_type}</span>
                    <RiskBadge level={alt.severity} size="sm" />
                  </div>
                  <p className="text-slate-600 mt-1 text-[11px]">{alt.description}</p>
                  {alt.action_taken && (
                    <div className="mt-1 font-semibold text-indigo-600 text-[10px]">
                      Policy: {alt.action_taken}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal for Device Enforcement Actions */}
      <Modal
        isOpen={actionModalOpen}
        onClose={() => setActionModalOpen(false)}
        title={
          actionType === 'block'
            ? `Permanent Quarantine: ${device.name}`
            : actionType === 'temp_block'
            ? `Temporary Containment: ${device.name}`
            : actionType === 'unblock'
            ? `Unblock Device: ${device.name}`
            : `Set Monitoring: ${device.name}`
        }
      >
        <div className="space-y-4 text-sm">
          {actionType === 'temp_block' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Containment Duration (Minutes)
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
              >
                <option value={5}>5 Minutes</option>
                <option value={15}>15 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={60}>60 Minutes (1 Hour)</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Enforcement Reason
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Unusual telemetry spike or manual isolation"
              className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              onClick={() => setActionModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteAction}
              disabled={actionLoading}
              className={`px-4 py-2 text-xs font-semibold rounded-xl text-white transition-all shadow-2xs cursor-pointer ${
                actionType === 'unblock'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : actionType === 'temp_block'
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : actionType === 'block'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {actionLoading ? 'Executing...' : 'Confirm Action'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
