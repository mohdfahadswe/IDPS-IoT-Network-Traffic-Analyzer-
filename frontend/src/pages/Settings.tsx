import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Shield,
  Sliders,
  Save,
  CheckCircle2,
  RotateCcw,
  Activity,
  Cpu,
  Mail,
  AlertTriangle,
  Radio,
  Zap,
} from 'lucide-react';
import { settingsService } from '../services/api';
import { SystemSettings } from '../types';
import { useSimulation } from '../contexts/SimulationContext';
import { useSettings } from '../contexts/SettingsContext';

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { isSimulating, speed: simCtxSpeed, changeSpeed } = useSimulation();
  const { updatePlatformName } = useSettings();

  // Form State
  const [platformName, setPlatformName] = useState<string>('NetPulse IoT Security Platform');
  const [analystEmail, setAnalystEmail] = useState<string>('security-ops@netpulse-iot.local');
  const [trafficThresholdBytes, setTrafficThresholdBytes] = useState<number>(25000);
  const [detectionSensitivity, setDetectionSensitivity] = useState<string>('High');
  const [autoResponseEnabled, setAutoResponseEnabled] = useState<boolean>(true);
  const [highRiskThreshold, setHighRiskThreshold] = useState<number>(61);
  const [criticalRiskThreshold, setCriticalRiskThreshold] = useState<number>(81);
  const [defaultTempBlockMinutes, setDefaultTempBlockMinutes] = useState<number>(15);
  const [simulationSpeed, setSimulationSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await settingsService.getSettings();
      const s: any = res.data;
      setSettings(s);
      if (s.general?.platform_name) {
        setPlatformName(s.general.platform_name);
        updatePlatformName(s.general.platform_name);
      }
      if (s.general?.analyst_email) setAnalystEmail(s.general.analyst_email);
      if (s.detection?.traffic_threshold_bytes) setTrafficThresholdBytes(s.detection.traffic_threshold_bytes);
      if (s.detection?.detection_sensitivity) setDetectionSensitivity(s.detection.detection_sensitivity);
      if (s.automatic_response?.enabled !== undefined) setAutoResponseEnabled(s.automatic_response.enabled);
      if (s.automatic_response?.high_risk_threshold) setHighRiskThreshold(s.automatic_response.high_risk_threshold);
      if (s.automatic_response?.critical_risk_threshold) setCriticalRiskThreshold(s.automatic_response.critical_risk_threshold);
      if (s.automatic_response?.default_temp_block_minutes) setDefaultTempBlockMinutes(s.automatic_response.default_temp_block_minutes);
      if (s.simulation?.speed) setSimulationSpeed(s.simulation.speed);
    } catch (err) {
      console.error('Failed to load settings:', err);
      setErrorMessage('Failed to load system settings from backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSavedMessage(null);
    setErrorMessage(null);

    // Validation
    if (highRiskThreshold >= criticalRiskThreshold) {
      setErrorMessage('High Risk Threshold must be lower than Critical Risk Threshold.');
      setSaving(false);
      return;
    }

    try {
      await settingsService.updateSettings({
        platform_name: platformName.trim(),
        analyst_email: analystEmail.trim(),
        traffic_threshold_bytes: trafficThresholdBytes,
        detection_sensitivity: detectionSensitivity,
        auto_response_enabled: autoResponseEnabled,
        high_risk_threshold: highRiskThreshold,
        critical_risk_threshold: criticalRiskThreshold,
        default_temp_block_minutes: defaultTempBlockMinutes,
        simulation_speed: simulationSpeed,
      });

      updatePlatformName(platformName.trim());

      if (simulationSpeed !== simCtxSpeed) {
        await changeSpeed(simulationSpeed);
      }

      setSavedMessage('Settings and platform identity updated successfully.');
      setTimeout(() => setSavedMessage(null), 3500);
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      setErrorMessage(err.response?.data?.detail || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!window.confirm('Reset security thresholds and platform configurations to defaults?')) {
      return;
    }

    setResetting(true);
    setSavedMessage(null);
    setErrorMessage(null);
    try {
      await settingsService.resetDefaults();
      await fetchSettings();
      updatePlatformName('NetPulse IoT Security Platform');
      setSavedMessage('Default configurations restored.');
      setTimeout(() => setSavedMessage(null), 3500);
    } catch (err: any) {
      console.error('Failed to reset defaults:', err);
      setErrorMessage('Failed to reset defaults.');
    } finally {
      setResetting(false);
    }
  };

  if (loading && !settings) {
    return (
      <div className="p-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3">
        <Activity className="w-5 h-5 text-indigo-600 animate-spin" />
        <span>Loading configurations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full animate-fade-in pb-8">
      {/* Page Header with Balanced Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">System Settings</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage platform branding, threat detection thresholds, and automated quarantine policies
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={resetting || saving}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            title="Reset to factory defaults"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saving || resetting}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-4.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* Status Notifications */}
      {savedMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2.5 shadow-2xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{savedMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold flex items-center gap-2.5 shadow-2xs animate-fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Row 1: Platform Identity & Threat Detection Engine */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Card 1: Platform Identity */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs card-minimal flex flex-col justify-between h-full">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <SettingsIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Platform Identity</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Platform Display Name
                  </label>
                  <input
                    type="text"
                    value={platformName}
                    onChange={(e) => setPlatformName(e.target.value)}
                    required
                    placeholder="e.g. NetPulse IoT Security Platform"
                    className="w-full h-10 px-3.5 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Updates the sidebar branding, page titles, and system header live
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Analyst Notification Email
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={analystEmail}
                      onChange={(e) => setAnalystEmail(e.target.value)}
                      placeholder="analyst@netpulse-iot.local"
                      className="w-full h-10 pl-9 pr-3.5 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Primary contact for automated high-severity incident dispatch
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3.5 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Security Event Broadcasts</span>
              <span className="text-emerald-600 font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                WebSocket Active
              </span>
            </div>
          </div>

          {/* Card 2: Detection Engine */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs card-minimal flex flex-col justify-between h-full">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Cpu className="w-4 h-4 text-indigo-600 shrink-0" />
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Detection Engine</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Detection Sensitivity
                  </label>
                  <select
                    value={detectionSensitivity}
                    onChange={(e) => setDetectionSensitivity(e.target.value)}
                    className="w-full h-10 px-3.5 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                  >
                    <option value="Balanced">Balanced (Standard Thresholds)</option>
                    <option value="High">High (Heightened Vigilance)</option>
                    <option value="Aggressive">Aggressive (Zero-Tolerance Heuristics)</option>
                  </select>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Adjusts baseline anomaly classification tolerance
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Traffic Volume Spike Trigger
                    </label>
                    <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                      {trafficThresholdBytes.toLocaleString()} B
                    </span>
                  </div>
                  <div className="h-10 flex items-center">
                    <input
                      type="range"
                      min={5000}
                      max={100000}
                      step={5000}
                      value={trafficThresholdBytes}
                      onChange={(e) => setTrafficThresholdBytes(Number(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 block">
                    Flags bursts exceeding byte limit within a 5-second interval
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3.5 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
              <span>ML Classifier</span>
              <span className="font-mono text-slate-700 font-semibold">Random Forest (98.4% Acc)</span>
            </div>
          </div>
        </div>

        {/* Row 2: Automated Containment Policy */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 card-minimal">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-rose-600 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Automated Containment Policies</h3>
                <p className="text-xs text-slate-500 mt-0.5">Automated quarantine actions based on model risk scoring</p>
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-3.5 py-1.5 rounded-xl border border-slate-200/80 self-start sm:self-auto transition-colors">
              <input
                type="checkbox"
                checked={autoResponseEnabled}
                onChange={(e) => setAutoResponseEnabled(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded-sm cursor-pointer accent-indigo-600"
              />
              <span className="text-xs font-bold text-slate-800">
                {autoResponseEnabled ? 'Auto-Mitigation Active' : 'Auto-Mitigation Disabled'}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 items-stretch">
            {/* High Risk Slider */}
            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/70 flex flex-col justify-between min-h-[148px]">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-amber-900">
                    High Risk Threshold
                  </label>
                  <span className="text-xs font-mono font-bold text-amber-800 bg-white px-2 py-0.5 rounded-md border border-amber-300 shadow-2xs">
                    ≥ {highRiskThreshold}%
                  </span>
                </div>
                <div className="h-9 flex items-center">
                  <input
                    type="range"
                    min={31}
                    max={79}
                    value={highRiskThreshold}
                    onChange={(e) => setHighRiskThreshold(Number(e.target.value))}
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                </div>
              </div>
              <div className="pt-2 border-t border-amber-200/50 flex items-center justify-between text-[11px] text-amber-900 font-medium">
                <span>Action:</span>
                <span className="font-bold bg-amber-100/80 px-2 py-0.5 rounded text-amber-900">Temporary Quarantine</span>
              </div>
            </div>

            {/* Critical Risk Slider */}
            <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-200/70 flex flex-col justify-between min-h-[148px]">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-rose-900">
                    Critical Risk Threshold
                  </label>
                  <span className="text-xs font-mono font-bold text-rose-800 bg-white px-2 py-0.5 rounded-md border border-rose-300 shadow-2xs">
                    ≥ {criticalRiskThreshold}%
                  </span>
                </div>
                <div className="h-9 flex items-center">
                  <input
                    type="range"
                    min={80}
                    max={100}
                    value={criticalRiskThreshold}
                    onChange={(e) => setCriticalRiskThreshold(Number(e.target.value))}
                    className="w-full accent-rose-600 cursor-pointer"
                  />
                </div>
              </div>
              <div className="pt-2 border-t border-rose-200/50 flex items-center justify-between text-[11px] text-rose-900 font-medium">
                <span>Action:</span>
                <span className="font-bold bg-rose-100/80 px-2 py-0.5 rounded text-rose-900">Permanent Policy Block</span>
              </div>
            </div>

            {/* Quarantine Duration */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between min-h-[148px]">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Quarantine Duration
                  </label>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    Auto-Expire
                  </span>
                </div>
                <div className="h-9 flex items-center">
                  <select
                    value={defaultTempBlockMinutes}
                    onChange={(e) => setDefaultTempBlockMinutes(Number(e.target.value))}
                    className="w-full h-8 px-2.5 text-xs font-medium border border-slate-200 rounded-lg bg-white cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value={5}>5 Minutes</option>
                    <option value={15}>15 Minutes (Default)</option>
                    <option value={30}>30 Minutes</option>
                    <option value={60}>1 Hour</option>
                    <option value={1440}>24 Hours</option>
                  </select>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Behavior:</span>
                <span className="font-semibold text-slate-700">Auto-restores on timeout</span>
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Simulation Controls */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 card-minimal">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Simulator Velocity</h3>
                <p className="text-xs text-slate-500 mt-0.5">Control background traffic simulation and flow rate</p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
              isSimulating ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isSimulating ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span>{isSimulating ? 'Engine Running' : 'Engine Idle'}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 items-stretch">
            {[
              { id: 'slow', label: 'Slow (~8.0s)', desc: 'Low telemetry rate for detailed debugging' },
              { id: 'normal', label: 'Normal (~4.0s)', desc: 'Standard lab test and realistic traffic flow' },
              { id: 'fast', label: 'Fast (~1.8s)', desc: 'High stress flow for rapid threat assessment' },
            ].map((spd) => (
              <button
                key={spd.id}
                type="button"
                onClick={() => setSimulationSpeed(spd.id as any)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-center min-h-[72px] ${
                  simulationSpeed === spd.id
                    ? 'border-indigo-600 bg-indigo-50/70 shadow-2xs text-indigo-950 ring-1 ring-indigo-600'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">{spd.label}</span>
                  {simulationSpeed === spd.id && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">{spd.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
};
