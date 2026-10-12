import React, { useState } from 'react';
import {
  ShieldAlert,
  Clock,
  Activity,
  Flame,
  FileSpreadsheet,
  Radio,
  Zap,
  Globe,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { blockingService } from '../../services/api';
import { useSimulation } from '../../contexts/SimulationContext';
import { Modal } from '../common/Modal';

interface QuickActionsProps {
  onActionComplete?: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onActionComplete }) => {
  const navigate = useNavigate();
  const {
    isSimulating,
    speed,
    loading: simLoading,
    simulatedDevices,
    toggleSimulation,
    changeSpeed,
    triggerScenario,
  } = useSimulation();

  const [targetDeviceId, setTargetDeviceId] = useState<string>('auto');
  const [blockModalOpen, setBlockModalOpen] = useState<boolean>(false);
  const [isTempBlock, setIsTempBlock] = useState<boolean>(false);
  const [targetIp, setTargetIp] = useState<string>('');
  const [reason, setReason] = useState<string>('Analyst manual containment');
  const [duration, setDuration] = useState<number>(15);
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [scenarioFeedback, setScenarioFeedback] = useState<string | null>(null);

  const handleOpenBlockModal = (temp: boolean) => {
    setIsTempBlock(temp);
    setBlockModalOpen(true);
    setFeedback(null);
  };

  const handleExecuteBlock = async () => {
    if (!targetIp.trim()) return;
    setLoading(true);
    try {
      await blockingService.blockEntity({
        entity_type: 'ip',
        entity_id: targetIp.trim(),
        ip_address: targetIp.trim(),
        reason,
        is_temporary: isTempBlock,
        duration_minutes: isTempBlock ? duration : undefined,
      });
      setFeedback(`Successfully applied ${isTempBlock ? 'Temporary' : 'Permanent'} Block on ${targetIp}`);
      setTimeout(() => {
        setBlockModalOpen(false);
        setTargetIp('');
        if (onActionComplete) onActionComplete();
      }, 1200);
    } catch (err: any) {
      setFeedback(err.response?.data?.detail || 'Failed to block entity');
    } finally {
      setLoading(false);
    }
  };

  const handleInjectScenario = async (scenario: string, label: string) => {
    try {
      const selectedName = targetDeviceId !== 'auto'
        ? simulatedDevices.find((d) => d.device_id === targetDeviceId)?.name || targetDeviceId
        : 'Auto Target';
      setScenarioFeedback(`Injecting ${label} on ${selectedName}...`);
      const res = await triggerScenario(scenario, targetDeviceId === 'auto' ? undefined : targetDeviceId);
      const actionMsg = res?.action_taken ? ` -> ${res.action_taken}` : '';
      const devMsg = res?.device_id ? `[${res.device_id}]` : '';
      setScenarioFeedback(`Injected ${label} ${devMsg} (${res?.classification || 'Processed'}, Risk: ${res?.risk_score || 0}${actionMsg})`);
      setTimeout(() => setScenarioFeedback(null), 5000);
      if (onActionComplete) onActionComplete();
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || `Failed to inject scenario: ${label}`;
      setScenarioFeedback(errMsg);
      setTimeout(() => setScenarioFeedback(null), 4000);
    }
  };

  return (
    <>
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4 transition-all duration-300 hover:border-slate-300">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Simulator & Quick Actions</h3>
              <p className="text-xs text-slate-500 mt-0.5">Control live simulation stream and trigger security policies</p>
            </div>
          </div>

          {/* MINIMAL TOGGLE CONTROLS */}
          <div className="mt-3.5 space-y-2.5">
            {/* Master IoT Simulation Toggle */}
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Radio className={`w-4 h-4 ${isSimulating ? 'text-indigo-600 animate-pulse' : 'text-slate-400'}`} />
                <div>
                  <span className="text-xs font-semibold text-slate-800">IoT Simulation Stream</span>
                  <span
                    className={`ml-2 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      isSimulating ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isSimulating ? 'ACTIVE' : 'OFF'}
                  </span>
                </div>
              </div>

              {/* Simulation Switch */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSimulation}
                  disabled={simLoading}
                  role="switch"
                  aria-checked={isSimulating}
                  className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    isSimulating ? 'bg-indigo-600' : 'bg-slate-300'
                  } ${simLoading ? 'opacity-50 cursor-wait' : ''}`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      isSimulating ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-[11px] font-bold text-slate-700 w-6">
                  {isSimulating ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>

            {/* Speed Selector (Compact) */}
            <div className="px-1 flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px] font-medium">Stream Speed:</span>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md">
                {(['slow', 'normal', 'fast'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => changeSpeed(s)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize transition-all ${
                      speed === s
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SCENARIO INJECTION VECTORS */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Test Scenario Injection</span>
                <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60 font-semibold">
                  Instant Vector Test
                </span>
              </div>
              {scenarioFeedback && (
                <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded animate-fade-in flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                  {scenarioFeedback}
                </span>
              )}
            </div>

            {/* Target Device Dropdown Selector */}
            <div className="mb-3 bg-slate-50/90 p-2.5 rounded-lg border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <label htmlFor="target-sim-device" className="text-slate-700 font-medium flex items-center gap-1.5 shrink-0">
                <Radio className="w-3.5 h-3.5 text-indigo-600" />
                <span>Target Node:</span>
              </label>
              <select
                id="target-sim-device"
                value={targetDeviceId}
                onChange={(e) => setTargetDeviceId(e.target.value)}
                className="w-full sm:w-auto bg-white border border-slate-200 text-slate-800 text-xs rounded-md px-2.5 py-1 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs cursor-pointer hover:border-indigo-300"
              >
                <option value="auto">⚡ Auto-Select Active Node</option>
                <option value="esp32-001">📟 ESP32 Sensor (esp32-001)</option>
                {simulatedDevices.map((d) => (
                  <option key={d.device_id} value={d.device_id}>
                    {d.name} ({d.device_id})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => handleInjectScenario('suspicious_activity', 'Port Scan Attack')}
                className="flex items-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition-all group border-amber-200 bg-amber-50/70 hover:bg-amber-100 text-amber-900 shadow-2xs cursor-pointer active:scale-95"
                title="Inject port scan / brute force sweep"
              >
                <Flame className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform" />
                <span className="truncate font-semibold">Port Scan</span>
              </button>

              <button
                onClick={() => handleInjectScenario('high_traffic', 'Traffic Burst')}
                className="flex items-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition-all group border-purple-200 bg-purple-50/70 hover:bg-purple-100 text-purple-900 shadow-2xs cursor-pointer active:scale-95"
                title="Inject high throughput traffic burst spike"
              >
                <Zap className="w-3.5 h-3.5 text-purple-600 group-hover:scale-110 transition-transform" />
                <span className="truncate font-semibold">Traffic Burst</span>
              </button>

              <button
                onClick={() => handleInjectScenario('suspicious_domain', 'C2 Domain DNS')}
                className="flex items-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition-all group border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-900 shadow-2xs cursor-pointer active:scale-95"
                title="Inject malicious C2 domain exfiltration query"
              >
                <Globe className="w-3.5 h-3.5 text-rose-600 group-hover:scale-110 transition-transform" />
                <span className="truncate font-semibold">C2 Domain</span>
              </button>

              <button
                onClick={() => handleInjectScenario('unknown_device', 'Rogue IoT Node')}
                className="flex items-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition-all group border-cyan-200 bg-cyan-50/70 hover:bg-cyan-100 text-cyan-900 shadow-2xs cursor-pointer active:scale-95"
                title="Inject unauthorized rogue IoT node"
              >
                <HelpCircle className="w-3.5 h-3.5 text-cyan-600 group-hover:scale-110 transition-transform" />
                <span className="truncate font-semibold">Rogue Device</span>
              </button>
            </div>
          </div>

          {/* POLICY ENFORCEMENT & REPORTS */}
          <div className="grid grid-cols-3 gap-2.5 mt-3">
            <button
              onClick={() => handleOpenBlockModal(false)}
              className="flex items-center justify-center gap-1.5 p-2.5 rounded-lg border border-rose-200 bg-rose-50/40 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-all shadow-2xs group"
            >
              <ShieldAlert className="w-4 h-4 text-rose-600 group-hover:scale-110 transition-transform" />
              <span>Block IP</span>
            </button>

            <button
              onClick={() => handleOpenBlockModal(true)}
              className="flex items-center justify-center gap-1.5 p-2.5 rounded-lg border border-orange-200 bg-orange-50/40 hover:bg-orange-100 text-orange-700 text-xs font-semibold transition-all shadow-2xs group"
            >
              <Clock className="w-4 h-4 text-orange-600 group-hover:scale-110 transition-transform" />
              <span>Temp Block</span>
            </button>

            <button
              onClick={() => navigate('/reports')}
              className="flex items-center justify-center gap-1.5 p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/40 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition-all shadow-2xs group"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
              <span>Reports</span>
            </button>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-3 flex items-center justify-between">
          <span>All simulation & security events are broadcast live to connected analysts.</span>
        </div>
      </div>

      {/* Manual / Temporary Block Modal */}
      <Modal
        isOpen={blockModalOpen}
        onClose={() => setBlockModalOpen(false)}
        title={isTempBlock ? 'Deploy Temporary Block Policy' : 'Deploy Permanent Block Policy'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Target IP Address or Device ID
            </label>
            <input
              type="text"
              value={targetIp}
              onChange={(e) => setTargetIp(e.target.value)}
              placeholder="e.g. 192.168.1.105 or sim-cam-02"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {isTempBlock && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Containment Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
              Security Rationale / Justification
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Repeated anomalous port scan spikes"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {feedback && (
            <div className={`p-3 rounded-lg text-xs font-medium ${feedback.includes('Successfully') ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
              {feedback}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              onClick={() => setBlockModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteBlock}
              disabled={loading || !targetIp.trim()}
              className={`px-4 py-2 text-xs font-semibold rounded-lg text-white transition-all ${
                isTempBlock
                  ? 'bg-orange-600 hover:bg-orange-700 disabled:opacity-50'
                  : 'bg-rose-600 hover:bg-rose-700 disabled:opacity-50'
              }`}
            >
              {loading ? 'Applying Policy...' : isTempBlock ? 'Apply Temporary Block' : 'Apply Permanent Block'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
