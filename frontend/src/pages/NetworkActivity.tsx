import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Search,
  Radio,
  Zap,
  Filter,
} from 'lucide-react';
import { TrafficChart } from '../components/dashboard/TrafficChart';
import { trafficService } from '../services/api';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useSimulation } from '../contexts/SimulationContext';

export const NetworkActivity: React.FC = () => {
  const [packets, setPackets] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);
  const [refreshCount, setRefreshCount] = useState<number>(0);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [protocolFilter, setProtocolFilter] = useState<string>('all');

  const { subscribe } = useWebSocket();
  const { isSimulating } = useSimulation();
  const autoRefreshTimerRef = useRef<any>(null);

  const fetchPackets = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await trafficService.getRecentPackets(35);
      setPackets(res.data || []);
    } catch (err) {
      console.error('Failed to load recent packets:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  const handleManualRefresh = () => {
    fetchPackets(false);
    setRefreshCount((c) => c + 1);
  };

  useEffect(() => {
    fetchPackets();
  }, [fetchPackets]);

  // Auto-refresh interval (every 8 seconds when enabled)
  useEffect(() => {
    if (isAutoRefresh) {
      autoRefreshTimerRef.current = setInterval(() => {
        fetchPackets(true);
      }, 8000);
    }

    return () => {
      if (autoRefreshTimerRef.current) clearInterval(autoRefreshTimerRef.current);
    };
  }, [isAutoRefresh, fetchPackets]);

  // Live packet stream subscription
  useEffect(() => {
    const unsub = subscribe('DEVICE_EVENT', (data: any) => {
      setPackets((prev) => [
        {
          id: Date.now() + Math.random(),
          timestamp: new Date().toISOString(),
          device_name: data.device_name || data.device_id || 'IoT Node',
          source_ip: data.source_ip || '192.168.1.150',
          destination_ip: `192.168.1.1:${data.destination_port || 80}`,
          protocol: data.protocol || 'TCP',
          bytes_in: Math.round((data.traffic_volume || 300) * 0.7),
          bytes_out: Math.round((data.traffic_volume || 300) * 0.3),
          packets_count: data.packet_count || 4,
          is_suspicious: !!data.is_suspicious,
        },
        ...prev.slice(0, 34),
      ]);
    });
    return () => unsub();
  }, [subscribe]);

  // Filtered packets
  const filteredPackets = packets.filter((p) => {
    const matchesSearch =
      !searchFilter ||
      p.device_name?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.source_ip?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.destination_ip?.toLowerCase().includes(searchFilter.toLowerCase());

    const matchesProtocol = protocolFilter === 'all' || p.protocol === protocolFilter;
    return matchesSearch && matchesProtocol;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header with Auto-Refresh Toggle and Refresh Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Real-Time Network Activity</h2>
            {isSimulating ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>LIVE FEED</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                <span>STANDBY</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Deep packet throughput inspection, flow velocity, and behavioral deviation monitoring
          </p>
        </div>

        {/* Global Refresh Controls */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Auto Refresh Toggle */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 text-xs font-medium">
            <span className="text-slate-600 font-semibold">Auto-Refresh:</span>
            <button
              type="button"
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                isAutoRefresh ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  isAutoRefresh ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-[11px] font-bold ${isAutoRefresh ? 'text-indigo-700' : 'text-slate-500'}`}>
              {isAutoRefresh ? 'ON (8s)' : 'OFF'}
            </span>
          </div>

          {/* Manual Refresh Button */}
          <button
            onClick={handleManualRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold border border-indigo-200 transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
            title="Refresh packet flow & network telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Refresh Now</span>
          </button>
        </div>
      </div>

      {/* Main Traffic Chart */}
      <TrafficChart refreshTrigger={refreshCount} />

      {/* Live Stream Packet Inspector */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Live Network Flow Inspector</h3>
              <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-full">
                {filteredPackets.length} Packets
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Packet headers and throughput rates streamed via Scapy / Simulation engine</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search filter */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search device, IP..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200/80 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-44"
              />
            </div>

            {/* Protocol selector */}
            <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/80 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={protocolFilter}
                onChange={(e) => setProtocolFilter(e.target.value)}
                className="bg-transparent text-slate-700 font-medium text-xs focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Protocols</option>
                <option value="TCP">TCP</option>
                <option value="UDP">UDP</option>
                <option value="HTTP">HTTP</option>
              </select>
            </div>

            <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold px-2.5 py-1 bg-emerald-50 rounded-full border border-emerald-100">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Sniffer Active</span>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <th className="px-6 py-3.5">Timestamp</th>
                <th className="px-6 py-3.5">Device Name</th>
                <th className="px-6 py-3.5">Source IP</th>
                <th className="px-6 py-3.5">Destination IP</th>
                <th className="px-6 py-3.5">Protocol</th>
                <th className="px-6 py-3.5">Volume</th>
                <th className="px-6 py-3.5">Packets</th>
                <th className="px-6 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredPackets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-400 font-sans">
                    No matching packet flows found.
                  </td>
                </tr>
              ) : (
                filteredPackets.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-3 text-slate-400 font-sans">
                      {new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-6 py-3 font-semibold text-indigo-700 font-sans">
                      {p.device_name || 'IoT Node'}
                    </td>
                    <td className="px-6 py-3 font-semibold text-slate-900">{p.source_ip}</td>
                    <td className="px-6 py-3 text-slate-600">{p.destination_ip}</td>
                    <td className="px-6 py-3 font-sans">
                      <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-semibold text-slate-700">
                        {p.protocol}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-800 font-semibold font-sans">
                      {(p.bytes_in + p.bytes_out).toLocaleString()} B
                    </td>
                    <td className="px-6 py-3 text-slate-600 font-sans">{p.packets_count}</td>
                    <td className="px-6 py-3 text-right font-sans">
                      {p.is_suspicious ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Suspicious</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Normal</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
