import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Cpu,
  Activity,
  AlertTriangle,
  ShieldBan,
  ChevronRight,
} from 'lucide-react';
import { MetricCard } from '../components/dashboard/MetricCard';
import { TrafficChart } from '../components/dashboard/TrafficChart';
import { ThreatSummary } from '../components/dashboard/ThreatSummary';
import { DomainRiskRadar } from '../components/dashboard/DomainRiskRadar';
import { RecentAlertsList } from '../components/dashboard/RecentAlertsList';
import { QuickActions } from '../components/dashboard/QuickActions';
import { StatusBadge } from '../components/common/StatusBadge';
import { RiskBadge } from '../components/common/RiskBadge';
import { deviceService, alertService, domainService, analyticsService } from '../services/api';
import { Device, Alert, DomainItem, AnalyticsData } from '../types';
import { useWebSocket } from '../contexts/WebSocketContext';

export const Dashboard: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const { subscribe } = useWebSocket();

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [devRes, alertRes, domRes, anaRes] = await Promise.all([
        deviceService.getDevices({ limit: 10 }),
        alertService.getAlerts({ limit: 10 }),
        domainService.getDomains(),
        analyticsService.getAnalytics(7),
      ]);
      setDevices(devRes.data.devices || []);
      setAlerts(alertRes.data.alerts || []);
      setDomains(domRes.data || []);
      setAnalytics(anaRes.data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // WebSocket Live Listeners for Instant Updates
  useEffect(() => {
    // 1. New Alert generated
    const unsubAlert = subscribe('NEW_ALERT', (newAlert: Alert) => {
      setAlerts((prev) => [newAlert, ...prev.filter((a) => a.alert_id !== newAlert.alert_id).slice(0, 9)]);
      setAnalytics((prev) => {
        if (!prev) return prev;
        const sev = newAlert.severity || 'Medium';
        return {
          ...prev,
          kpis: {
            ...prev.kpis,
            threats_detected: (prev.kpis?.threats_detected || 0) + 1,
          },
          severity_distribution: {
            ...prev.severity_distribution,
            [sev]: (prev.severity_distribution?.[sev] || 0) + 1,
          },
        };
      });
    });

    // 2. Device Event / State Change / Rogue Device
    const unsubEvent = subscribe('DEVICE_EVENT', (eventData: any) => {
      setDevices((prev) => {
        const idx = prev.findIndex((d) => d.device_id === eventData.device_id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            name: eventData.device_name || updated[idx].name,
            status: eventData.status || updated[idx].status,
            risk_score: eventData.risk_score ?? updated[idx].risk_score,
            risk_level: eventData.risk_level || updated[idx].risk_level,
            latest_sensor_data: eventData.sensor_data || updated[idx].latest_sensor_data,
            last_seen: eventData.timestamp || updated[idx].last_seen,
          };
          return updated;
        } else {
          // New device discovered (e.g. Rogue Device)
          const newDev: Device = {
            id: Date.now(),
            device_id: eventData.device_id,
            name: eventData.device_name || `Node ${eventData.device_id}`,
            type: eventData.device_type || 'Rogue Device',
            ip_address: eventData.source_ip || '192.168.1.200',
            mac_address: eventData.mac_address || 'EE:FF:11:22:33:44',
            status: eventData.status || 'online',
            risk_level: eventData.risk_level || 'High',
            risk_score: eventData.risk_score || 75.0,
            source: eventData.source || 'simulated',
            sensor_type: 'Telemetry',
            latest_sensor_data: eventData.sensor_data,
            first_seen: eventData.timestamp || new Date().toISOString(),
            last_seen: eventData.timestamp || new Date().toISOString(),
          };
          return [...prev, newDev];
        }
      });
    });

    // 3. Block status change
    const unsubBlock = subscribe('BLOCK_UPDATE', () => {
      loadData(true);
    });

    // 4. Device status change
    const unsubStatus = subscribe('DEVICE_STATUS_CHANGE', (statusData: any) => {
      if (statusData?.device_id) {
        setDevices((prev) =>
          prev.map((d) =>
            d.device_id === statusData.device_id
              ? { ...d, status: statusData.status || d.status }
              : d
          )
        );
      } else {
        loadData(true);
      }
    });

    // 5. Simulation status toggle
    const unsubSim = subscribe('SIMULATION_STATUS', () => {
      loadData(true);
    });

    return () => {
      unsubAlert();
      unsubEvent();
      unsubBlock();
      unsubStatus();
      unsubSim();
    };
  }, [subscribe]);

  const kpis = analytics?.kpis || {
    total_devices: 0,
    active_devices: 0,
    threats_detected: 0,
    blocked_entities: 0,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ROW 1: TOP SUMMARY CARDS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          title="Total Devices"
          value={kpis.total_devices}
          icon={Cpu}
          trendDirection="up"
          accentColor="indigo"
          to="/devices"
        />
        <MetricCard
          title="Active Devices"
          value={kpis.active_devices}
          icon={Activity}
          trendDirection="neutral"
          accentColor="emerald"
          to="/devices?status=active"
        />
        <MetricCard
          title="Threats Detected"
          value={kpis.threats_detected}
          icon={AlertTriangle}
          trendDirection={kpis.threats_detected > 0 ? 'down' : 'up'}
          accentColor="rose"
          to="/alerts"
        />
        <MetricCard
          title="Blocked Entities"
          value={kpis.blocked_entities}
          icon={ShieldBan}
          trendDirection="neutral"
          accentColor="amber"
          to="/blocked-entities"
        />
      </section>

      {/* ROW 2: REAL-TIME TRAFFIC & THREAT SUMMARY */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="lg:col-span-2 flex flex-col">
          <TrafficChart />
        </div>
        <div className="lg:col-span-1 flex flex-col">
          <ThreatSummary
            threatDistribution={analytics?.severity_distribution || { Low: 2, Medium: 1, High: 1, Critical: 0 }}
            totalThreats={kpis.threats_detected}
          />
        </div>
      </section>

      {/* ROW 3: CONNECTED DEVICES & RECENT ALERTS */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Connected Devices Table Preview */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col h-full transition-all duration-300 hover:border-slate-300 card-minimal">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Connected IoT Nodes</h3>
              <p className="text-xs text-slate-500 mt-0.5">Physical hardware & simulated endpoint fleet</p>
            </div>
            <Link
              to="/devices"
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5 transition-colors"
            >
              <span>View All ({kpis.total_devices})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex-1 overflow-x-auto pt-2">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase font-semibold text-[11px]">
                  <th className="pb-2.5">Device</th>
                  <th className="pb-2.5">Type</th>
                  <th className="pb-2.5">Status</th>
                  <th className="pb-2.5">Risk Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {devices.map((d) => (
                  <tr key={d.device_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5">
                      <Link to={`/devices/${d.device_id}`} className="font-semibold text-slate-900 hover:text-indigo-600 block">
                        {d.name}
                      </Link>
                      <span className="text-[11px] text-slate-400 font-mono">{d.ip_address}</span>
                    </td>
                    <td className="py-2.5 text-slate-600">{d.type}</td>
                    <td className="py-2.5">
                      <StatusBadge status={d.status} source={d.source} />
                    </td>
                    <td className="py-2.5">
                      <RiskBadge level={d.risk_level} score={d.risk_score} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Alerts List */}
        <div className="flex flex-col h-full">
          <RecentAlertsList alerts={alerts} />
        </div>
      </section>

      {/* ROW 4: TOP DOMAINS & QUICK ACTIONS */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Domain Risk Radar & Heuristics */}
        <div className="flex flex-col h-full">
          <DomainRiskRadar topDomains={domains} />
        </div>

        {/* Simulator & Security Quick Actions */}
        <div className="flex flex-col h-full">
          <QuickActions onActionComplete={loadData} />
        </div>
      </section>
    </div>
  );
};
