import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Clock,
  Unlock,
  ShieldBan,
  History,
  Plus,
} from 'lucide-react';
import { blockingService } from '../services/api';
import { BlockedEntity } from '../types';
import { Modal } from '../components/common/Modal';
import { useWebSocket } from '../contexts/WebSocketContext';

export const BlockedEntities: React.FC = () => {
  const [entities, setEntities] = useState<BlockedEntity[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Manual Block Modal
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [entityType, setEntityType] = useState<'device' | 'ip'>('ip');
  const [entityId, setEntityId] = useState<string>('');
  const [isTemporary, setIsTemporary] = useState<boolean>(true);
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [reason, setReason] = useState<string>('Identified as anomalous threat actor');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const { subscribe } = useWebSocket();

  const loadBlockedData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [blockRes, logRes] = await Promise.all([
        blockingService.getBlockedEntities(true),
        blockingService.getAuditLog(20),
      ]);
      setEntities(blockRes.data || []);
      setAuditLogs(logRes.data || []);
    } catch (err) {
      console.error('Failed to load blocked entities:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadBlockedData();
  }, []);

  // WebSocket Live Updates (silent background updates, no blinking)
  useEffect(() => {
    const unsubBlock = subscribe('BLOCK_UPDATE', () => loadBlockedData(true));
    const unsubExpired = subscribe('BLOCK_EXPIRED', () => loadBlockedData(true));
    return () => {
      unsubBlock();
      unsubExpired();
    };
  }, [subscribe]);

  // Live countdown ticker every second
  useEffect(() => {
    const timer = setInterval(() => {
      setEntities((prev) =>
        prev.map((e) => {
          if (e.is_temporary && e.time_remaining_seconds && e.time_remaining_seconds > 0) {
            return {
              ...e,
              time_remaining_seconds: Math.max(0, e.time_remaining_seconds - 1),
            };
          }
          return e;
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleUnblock = async (id: string) => {
    try {
      await blockingService.unblockEntity(id);
      loadBlockedData();
    } catch (err) {
      console.error('Failed to unblock entity:', err);
    }
  };

  const handleCreateBlock = async () => {
    if (!entityId.trim()) return;
    setSubmitting(true);
    try {
      await blockingService.blockEntity({
        entity_type: entityType,
        entity_id: entityId.trim(),
        ip_address: entityType === 'ip' ? entityId.trim() : undefined,
        reason,
        is_temporary: isTemporary,
        duration_minutes: isTemporary ? durationMinutes : undefined,
      });
      setModalOpen(false);
      setEntityId('');
      loadBlockedData();
    } catch (err) {
      console.error('Block failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatCountdown = (secs?: number) => {
    if (secs === undefined || secs === null) return 'N/A';
    if (secs <= 0) return 'Expired';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const activeEntities = entities.filter((e) => e.is_active);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Active Containment & Blocked Entities</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quarantined device fleet nodes and isolated network IPs with automated expiration tracking
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Deploy Block Policy</span>
        </button>
      </div>

      {/* Active Blocks Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200/80 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 tracking-tight">Active Quarantines ({activeEntities.length})</h3>
          <span className="text-xs text-slate-400">Application & Simulation Level Containment Active</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <th className="px-6 py-3.5">Quarantined Entity</th>
                <th className="px-6 py-3.5">Policy Type</th>
                <th className="px-6 py-3.5">Containment Reason</th>
                <th className="px-6 py-3.5">Block Start</th>
                <th className="px-6 py-3.5">Expiration / Countdown</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && entities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">Loading quarantine state...</td>
                </tr>
              ) : activeEntities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    No active quarantined entities. All nodes operating normally.
                  </td>
                </tr>
              ) : (
                activeEntities.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-mono font-bold text-slate-900">{b.entity_id}</div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Type: {b.entity_type}</span>
                    </td>

                    <td className="px-6 py-4">
                      {b.is_temporary ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Temporary Block</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                          <ShieldBan className="w-3.5 h-3.5" />
                          <span>Permanent Block</span>
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-slate-700 max-w-xs truncate">{b.reason}</td>

                    <td className="px-6 py-4 text-slate-500 font-mono">
                      {new Date(b.block_start).toLocaleTimeString()}
                    </td>

                    <td className="px-6 py-4">
                      {b.is_temporary ? (
                        <div className="font-mono font-bold text-orange-600 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                          <span>{formatCountdown(b.time_remaining_seconds)}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono text-xs">Permanent</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleUnblock(b.entity_id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Unblock</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Action Audit Trail */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200/80 flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-600" />
          <h3 className="text-base font-bold text-slate-900 tracking-tight">Security Policy Audit History</h3>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {auditLogs.slice(0, 8).map((log) => (
            <div key={log.id} className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
              <div>
                <div className="flex items-center gap-2 font-semibold text-slate-800">
                  <span>{log.action_type} on</span>
                  <span className="font-mono text-indigo-600">{log.target_entity}</span>
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-normal">
                    {log.triggered_by}
                  </span>
                </div>
                <div className="text-slate-500 text-[11px] mt-0.5">{log.reason}</div>
              </div>
              <div className="text-slate-400 font-mono text-[11px]">
                {new Date(log.timestamp).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Deploy Block Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Deploy Security Containment Policy"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Target Entity Identifier
            </label>
            <input
              type="text"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder="e.g. 192.168.1.105 or esp32-001"
              className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Entity Type
              </label>
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
              >
                <option value="ip">IP Address</option>
                <option value="device">Device ID</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Containment Mode
              </label>
              <select
                value={isTemporary ? 'temp' : 'perm'}
                onChange={(e) => setIsTemporary(e.target.value === 'temp')}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
              >
                <option value="temp">Temporary Quarantine</option>
                <option value="perm">Permanent Block</option>
              </select>
            </div>
          </div>

          {isTemporary && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Temporary Duration
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
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
              Mitigation Rationale
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateBlock}
              disabled={submitting || !entityId.trim()}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
            >
              {submitting ? 'Applying Policy...' : 'Enforce Quarantine'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
