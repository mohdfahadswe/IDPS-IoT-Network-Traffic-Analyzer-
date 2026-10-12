import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { RefreshCw, Activity, CheckCircle2, Cpu, Filter, ShieldAlert } from 'lucide-react';
import { TrafficPoint, Device } from '../../types';
import { trafficService, deviceService } from '../../services/api';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { useSimulation } from '../../contexts/SimulationContext';

interface ActiveDeviceStreamInfo {
  name: string;
  id: string;
  ip: string;
  timestamp: string;
}

interface TrafficChartProps {
  refreshTrigger?: number;
}

export const TrafficChart: React.FC<TrafficChartProps> = ({ refreshTrigger }) => {
  const [range, setRange] = useState<string>('30m');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('all');
  const [devices, setDevices] = useState<Device[]>([]);
  const [data, setData] = useState<TrafficPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastActiveDevice, setLastActiveDevice] = useState<ActiveDeviceStreamInfo | null>(null);

  const { subscribe } = useWebSocket();
  const { isSimulating, speed } = useSimulation();
  const pollingRef = useRef<any>(null);

  const loadDevices = useCallback(async () => {
    try {
      const res = await deviceService.getDevices({ limit: 50 });
      setDevices(res.data?.devices || res.data || []);
    } catch (err) {
      console.error('Failed to load devices for traffic filter:', err);
    }
  }, []);

  // Fetch device list on mount
  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  // Refresh device list when devices change
  useEffect(() => {
    const unsub = subscribe('DEVICE_STATUS_CHANGE', () => loadDevices());
    return () => unsub();
  }, [subscribe, loadDevices]);

  const fetchTraffic = useCallback(async (selectedRange: string, deviceId: string, isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setIsRefreshing(true);

      const res = await trafficService.getHistory(selectedRange, deviceId === 'all' ? undefined : deviceId);
      const points: TrafficPoint[] = (res.data?.points || []).map((pt: any) => {
        let formattedTime = pt.timestamp;
        try {
          const d = new Date(pt.timestamp);
          if (!isNaN(d.getTime())) {
            formattedTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          }
        } catch {
          // fallback
        }
        return {
          ...pt,
          timestamp: formattedTime,
          device_name: pt.device_name || 'IoT Node',
          device_id: pt.device_id || 'all',
        };
      });

      if (points.length > 0) {
        setData(points);
        // Set latest device info when a specific device is selected
        if (deviceId !== 'all') {
          const lastPt = points[points.length - 1];
          if (lastPt && lastPt.device_name) {
            setLastActiveDevice({
              name: lastPt.device_name,
              id: lastPt.device_id || '',
              ip: lastPt.source_ip || '',
              timestamp: lastPt.timestamp,
            });
          }
        } else {
          setLastActiveDevice(null);
        }
      } else {
        // Generate baseline points if brand new database
        const now = new Date();
        const fallbackPoints: TrafficPoint[] = Array.from({ length: 12 }).map((_, i) => {
          const t = new Date(now.getTime() - (12 - i) * 60000);
          return {
            timestamp: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            bytes_in: 320,
            bytes_out: 140,
            total_bytes: 460,
            packets: 3,
            is_suspicious: false,
            device_name: 'Aggregated IoT Nodes',
            source_ip: '192.168.1.100',
          };
        });
        setData(fallbackPoints);
      }
    } catch (err) {
      console.error('Failed to load traffic history:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial fetch on range, device, or external refresh trigger
  useEffect(() => {
    fetchTraffic(range, selectedDeviceId);
  }, [range, selectedDeviceId, refreshTrigger, fetchTraffic]);

  // Periodic fallback refresh every 15s to keep the timeline alive
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      fetchTraffic(range, selectedDeviceId, true);
    }, 15000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [range, selectedDeviceId, fetchTraffic]);

  // Subscribe to live WebSocket device events and add real-time ticks
  useEffect(() => {
    const unsubscribe = subscribe('DEVICE_EVENT', (eventData: any) => {
      // If a specific device is filtered, only process matching events
      if (selectedDeviceId !== 'all' && eventData.device_id !== selectedDeviceId) {
        return;
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      // Update focused device state only when inspecting a specific device
      if (selectedDeviceId !== 'all') {
        setLastActiveDevice({
          name: eventData.device_name || `Node (${eventData.device_id})`,
          id: eventData.device_id || '',
          ip: eventData.source_ip || '192.168.1.1',
          timestamp: timeStr,
        });
      }

      setData((prev) => {
        const newPoint: TrafficPoint = {
          timestamp: timeStr,
          bytes_in: Math.round((eventData.traffic_volume || 300) * 0.7),
          bytes_out: Math.round((eventData.traffic_volume || 300) * 0.3),
          total_bytes: eventData.traffic_volume || 300,
          packets: eventData.packet_count || 3,
          is_suspicious: !!eventData.is_suspicious,
          device_name: eventData.device_name || `Node (${eventData.device_id})`,
          device_id: eventData.device_id,
          source_ip: eventData.source_ip,
          protocol: eventData.protocol || 'TCP',
        };

        const updated = [...prev, newPoint];
        if (updated.length > 35) {
          return updated.slice(updated.length - 35);
        }
        return updated;
      });
    });

    return () => unsubscribe();
  }, [subscribe, selectedDeviceId]);

  const ranges = [
    { label: 'Last 30 Min', value: '30m' },
    { label: 'Last Hour', value: '1h' },
    { label: 'Last 24 Hours', value: '24h' },
    { label: 'Last 7 Days', value: '7d' },
  ];

  // Custom rich tooltip showing device name, IP, and throughput
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const pointData = payload[0].payload as TrafficPoint;
      const totalBytes = (pointData.bytes_in || 0) + (pointData.bytes_out || 0);
      const formatBytes = (bytes: number) => {
        if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
        if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} kB`;
        return `${bytes} B`;
      };

      return (
        <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-700 shadow-xl text-xs space-y-2 max-w-xs z-50">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
            <span className="font-semibold text-slate-300 font-mono">{label}</span>
            {pointData.is_suspicious ? (
              <span className="flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-800">
                <ShieldAlert className="w-3 h-3" />
                Suspicious
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
                Normal Flow
              </span>
            )}
          </div>

          {/* Device Name Display */}
          <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/60 space-y-1">
            <div className="flex items-center gap-1.5 text-indigo-300 font-bold text-xs">
              <Cpu className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="truncate">{pointData.device_name || 'Aggregated Network'}</span>
            </div>
            {pointData.source_ip && (
              <div className="text-[11px] text-slate-400 font-mono pl-5">
                IP: <span className="text-slate-200">{pointData.source_ip}</span> {pointData.protocol && `• ${pointData.protocol}`}
              </div>
            )}
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
            <div>
              <span className="text-slate-400 block text-[10px]">Inbound Traffic</span>
              <span className="font-semibold text-indigo-400">{formatBytes(pointData.bytes_in || 0)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Outbound Telemetry</span>
              <span className="font-semibold text-cyan-400">{formatBytes(pointData.bytes_out || 0)}</span>
            </div>
          </div>

          <div className="border-t border-slate-700/60 pt-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>Total Bandwidth:</span>
            <span className="font-bold text-white">{formatBytes(totalBytes)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderAttackDot = (props: any) => {
    const { cx, cy, payload, index } = props;
    if (
      payload &&
      payload.is_suspicious &&
      typeof cx === 'number' &&
      typeof cy === 'number' &&
      !isNaN(cx) &&
      !isNaN(cy)
    ) {
      return (
        <g key={`suspicious-dot-${index}-${payload.timestamp}`}>
          {/* Static glowing halo without ping/blinking */}
          <circle cx={cx} cy={cy} r={7} fill="#e11d48" fillOpacity={0.25} />
          {/* Solid prominent threat marker */}
          <circle cx={cx} cy={cy} r={4} fill="#e11d48" stroke="#ffffff" strokeWidth={1.5} />
        </g>
      );
    }
    return null;
  };

  const selectedDeviceObj = devices.find((d) => d.device_id === selectedDeviceId);

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Real-Time Network Activity</h3>

            {/* Live Streaming Badge */}
            {isSimulating ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="flex h-1.5 w-1.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-600" />
                </span>
                <span>STREAMING LIVE ({speed.toUpperCase()})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                <span>LIVE TELEMETRY READY</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-500">
            {selectedDeviceId === 'all' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-700">
                <Activity className="w-3.5 h-3.5 text-indigo-600" />
                <span>Aggregated Fleet: <strong className="font-semibold text-slate-900">{devices.length > 0 ? `${devices.length} Monitored Devices` : 'All Devices'}</strong></span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-[11px] font-medium text-indigo-700">
                <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                <span>Focused Device: <strong className="font-semibold text-indigo-900">{selectedDeviceObj?.name || selectedDeviceId}</strong> {selectedDeviceObj?.ip_address && <span className="text-indigo-600 font-mono text-[10px]">({selectedDeviceObj.ip_address})</span>}</span>
              </span>
            )}
          </div>
        </div>

        {/* Device Selector & Range Filters */}
        <div className="flex flex-wrap items-center gap-2 self-start">
          {/* Device Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="bg-transparent text-slate-700 font-medium text-xs focus:outline-hidden cursor-pointer max-w-[180px] sm:max-w-[220px] truncate"
            >
              <option value="all">🌐 All Devices (Aggregated)</option>
              {devices.map((dev) => (
                <option key={dev.device_id} value={dev.device_id}>
                  {dev.name} ({dev.ip_address})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              loadDevices();
              fetchTraffic(range, selectedDeviceId, false);
            }}
            disabled={loading || isRefreshing}
            className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
            title="Refresh network telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>

          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-medium">
            {ranges.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`px-3 py-1 rounded-md transition-all ${
                  range === r.value
                    ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 w-full">
        {loading && data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">Loading network telemetry...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="timestamp" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                tickFormatter={(val) => `${val > 1000 ? (val / 1000).toFixed(0) + 'k' : val}B`}
              />
              <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
              <Area
                type="monotone"
                dataKey="bytes_in"
                name="Inbound Bytes"
                stroke="#4f46e5"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorIn)"
                isAnimationActive={false}
                dot={renderAttackDot}
              />
              <Area
                type="monotone"
                dataKey="bytes_out"
                name="Outbound Bytes"
                stroke="#06b6d4"
                strokeWidth={1.5}
                fillOpacity={1}
                fill="url(#colorOut)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer Legend */}
      <div className="flex flex-wrap items-center justify-between border-t border-slate-100 pt-4 mt-2 text-xs text-slate-500 gap-3">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600" />
            <span>Inbound Traffic</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-cyan-500" />
            <span>Outbound Telemetry</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {selectedDeviceId !== 'all' && (
            <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
              Filtered: {selectedDeviceObj?.name || selectedDeviceId}
            </span>
          )}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Hover points to view device name & packet breakdown</span>
          </div>
        </div>
      </div>
    </div>
  );
};

