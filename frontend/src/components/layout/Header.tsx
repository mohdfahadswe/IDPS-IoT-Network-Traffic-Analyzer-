import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Bell,
  Activity,
  ShieldAlert,
  AlertTriangle,
  ChevronRight,
  CheckCheck,
  Cpu,
  X,
  Radio,
  Menu,
  MoreVertical,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { useSimulation } from '../../contexts/SimulationContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useSidebar } from '../../contexts/SidebarContext';

export const Header: React.FC<{ pageTitle?: string }> = ({ pageTitle }) => {
  const { isConnected } = useWebSocket();
  const { isSimulating, loading: simLoading, toggleSimulation, speed } = useSimulation();
  const { isOpen, toggleSidebar } = useSidebar();
  const {
    alerts,
    unreadCount,
    isDropdownOpen,
    toggleDropdown,
    setIsDropdownOpen,
    markAllAsRead,
    markAsRead,
  } = useNotifications();
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getComputedTitle = () => {
    if (pageTitle) return pageTitle;
    const path = location.pathname;
    if (path.startsWith('/dashboard')) return 'Platform Overview';
    if (path.startsWith('/devices/')) return 'Device Node Dossier';
    if (path.startsWith('/devices')) return 'Fleet Asset Inventory';
    if (path.startsWith('/traffic')) return 'Network Telemetry & Flow Sniffer';
    if (path.startsWith('/alerts')) return 'Security Incident Center';
    if (path.startsWith('/domains')) return 'Contacted Domain Intelligence';
    if (path.startsWith('/blocking')) return 'Active Containment & Quarantines';
    if (path.startsWith('/analytics')) return 'Security Analytics & Intelligence';
    if (path.startsWith('/reports')) return 'Compliance & Forensic Reports';
    if (path.startsWith('/settings')) return 'System Policy Configuration';
    return 'Platform Monitor';
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isDropdownOpen, setIsDropdownOpen]);

  // Keyboard shortcut Ctrl+B / Cmd+B for sidebar slide toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    const term = searchTerm.trim();
    if (term.toLowerCase().startsWith('alt') || term.toLowerCase().includes('alert')) {
      navigate(`/alerts?search=${encodeURIComponent(term)}`);
    } else {
      navigate(`/devices?search=${encodeURIComponent(term)}`);
    }
  };

  const formatTimeAgo = (ts: string) => {
    try {
      const diffMs = Date.now() - new Date(ts).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return 'Just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      return `${Math.floor(diffHr / 24)}d ago`;
    } catch {
      return 'Recent';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'high':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'medium':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
      <div className="flex items-center gap-3">
        {/* Mobile-Only Drawer Toggle */}
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-slate-100 transition-all cursor-pointer border border-slate-200/80 shadow-2xs flex items-center justify-center"
          title="Open Navigation"
          aria-label="Toggle Menu"
        >
          <Menu className="w-5 h-5 text-slate-700" />
        </button>

        <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
          {getComputedTitle()}
        </h2>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <form onSubmit={handleSearch} className="relative w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search devices, IPs, alerts..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
          />
        </form>

        {/* Simulator Toggle Switch */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/80 shadow-2xs">
          <div className="flex items-center gap-1.5">
            <Activity className={`w-3.5 h-3.5 ${isSimulating ? 'text-indigo-600 animate-pulse' : 'text-slate-400'}`} />
            <span className="text-xs font-semibold text-slate-700">Simulator</span>
          </div>

          <button
            onClick={toggleSimulation}
            disabled={simLoading}
            role="switch"
            aria-checked={isSimulating}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
              isSimulating ? 'bg-indigo-600' : 'bg-slate-300'
            } ${simLoading ? 'opacity-50 cursor-wait' : ''}`}
            title={isSimulating ? `Simulator is ON (${speed} mode) - Click to Stop` : 'Simulator is OFF - Click to Start'}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                isSimulating ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>

          <span className={`text-[11px] font-bold uppercase tracking-wider ${isSimulating ? 'text-indigo-600' : 'text-slate-400'}`}>
            {isSimulating ? 'ON' : 'OFF'}
          </span>
        </div>

        {/* Live WebSocket Connection Status Dot */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600"
          title={isConnected ? 'Live WebSocket Connected' : 'Connecting to Platform WebSocket...'}
        >
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span className="text-[11px] font-medium hidden sm:inline">{isConnected ? 'Live' : 'Syncing'}</span>
        </div>

        {/* Notification Bell & Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={toggleDropdown}
            className={`relative p-2 rounded-lg transition-colors cursor-pointer ${
              isDropdownOpen
                ? 'bg-indigo-50 text-indigo-600'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title="View Security Alerts & Notifications"
          >
            <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'text-slate-800' : ''}`} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white rounded-full text-[10px] font-extrabold flex items-center justify-center shadow-xs animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Dropdown Header */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Security Alerts
                  </h4>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[10px] font-bold">
                      {unreadCount} New
                    </span>
                  )}
                </div>

                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              {/* Alerts List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {alerts.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    <ShieldAlert className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600">No active threats</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">All monitored devices are operating normally</p>
                  </div>
                ) : (
                  alerts.slice(0, 8).map((alert) => (
                    <div
                      key={alert.alert_id}
                      onClick={() => {
                        markAsRead(alert.alert_id);
                        setIsDropdownOpen(false);
                        navigate(`/alerts?search=${encodeURIComponent(alert.alert_id)}`);
                      }}
                      className="p-3.5 hover:bg-slate-50/80 cursor-pointer transition-colors group relative"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-slate-100 text-slate-700 shrink-0 mt-0.5 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                          <ShieldAlert className="w-4 h-4" />
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                              {alert.alert_type}
                            </span>
                            <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                              {formatTimeAgo(alert.timestamp)}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                            {alert.description}
                          </p>

                          <div className="pt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                            <span className={`px-1.5 py-0.2 rounded-full font-bold border ${getSeverityBadge(alert.severity)}`}>
                              {alert.severity}
                            </span>
                            {(alert.device_name || alert.device_id) && (
                              <span className="font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.2 rounded flex items-center gap-1">
                                <Cpu className="w-3 h-3 text-indigo-500" />
                                <span className="font-bold">{alert.device_name || alert.device_id}</span>
                              </span>
                            )}
                            {alert.action_taken && (
                              <span className="text-slate-600 font-semibold truncate max-w-[140px]">
                                • {alert.action_taken}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Dropdown Footer */}
              <div className="p-3 border-t border-slate-100 bg-slate-50/60 text-center">
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    navigate('/alerts');
                  }}
                  className="w-full text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                >
                  <span>Open Alerts Center</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

