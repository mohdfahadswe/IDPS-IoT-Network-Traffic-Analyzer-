import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  AlertTriangle,
  X,
  ChevronRight,
  ShieldCheck,
  BellRing,
  Cpu,
} from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';

export const NotificationPopup: React.FC = () => {
  const { activePopup, dismissPopup, toggleDropdown } = useNotifications();
  const navigate = useNavigate();

  if (!activePopup) return null;

  const getSeverityStyle = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return {
          border: 'border-rose-500/30',
          bgBadge: 'bg-rose-500 text-white',
          iconBg: 'bg-rose-100 text-rose-600',
          glow: 'shadow-rose-500/10 ring-1 ring-rose-500/20',
        };
      case 'high':
        return {
          border: 'border-amber-500/30',
          bgBadge: 'bg-amber-500 text-white',
          iconBg: 'bg-amber-100 text-amber-600',
          glow: 'shadow-amber-500/10 ring-1 ring-amber-500/20',
        };
      case 'medium':
        return {
          border: 'border-orange-500/30',
          bgBadge: 'bg-orange-500 text-white',
          iconBg: 'bg-orange-100 text-orange-600',
          glow: 'shadow-orange-500/10 ring-1 ring-orange-500/20',
        };
      default:
        return {
          border: 'border-indigo-500/30',
          bgBadge: 'bg-indigo-600 text-white',
          iconBg: 'bg-indigo-100 text-indigo-600',
          glow: 'shadow-indigo-500/10 ring-1 ring-indigo-500/20',
        };
    }
  };

  const style = getSeverityStyle(activePopup.severity);

  const handleClick = () => {
    dismissPopup();
    navigate(`/alerts?search=${encodeURIComponent(activePopup.alert_id)}`);
  };

  return (
    <div className="fixed top-5 right-5 z-50 max-w-sm sm:max-w-md w-full animate-in slide-in-from-top-6 fade-in duration-200">
      <div
        onClick={handleClick}
        className={`bg-white/95 backdrop-blur-md rounded-2xl border ${style.border} shadow-2xl ${style.glow} p-4 cursor-pointer hover:bg-white transition-all transform hover:-translate-y-0.5 group`}
      >
        {/* Header line: App Branding & Timestamp & Close */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
              NP
            </div>
            <span className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
              <span>NetPulse Security</span>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-medium">Just now</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismissPopup();
              }}
              className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Body content: Severity, Alert Title & Description */}
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl ${style.iconBg} shrink-0 mt-0.5 shadow-2xs`}>
            <ShieldAlert className="w-5 h-5 animate-pulse" />
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${style.bgBadge}`}>
                {activePopup.severity || 'Threat'}
              </span>
              <span className="text-xs font-bold text-slate-900 truncate">
                {activePopup.alert_type}
              </span>
            </div>

            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
              {activePopup.description || `Suspicious event detected on node ${activePopup.device_id || activePopup.source_ip}.`}
            </p>

            {/* Target device & Mitigation Action */}
            <div className="pt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
              {(activePopup.device_name || activePopup.device_id) && (
                <span className="inline-flex items-center gap-1.5 font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  <Cpu className="w-3 h-3 text-indigo-500 shrink-0" />
                  <span className="font-bold">{activePopup.device_name || activePopup.device_id}</span>
                  {activePopup.device_name && activePopup.device_id && (
                    <span className="font-mono text-[10px] text-indigo-500">({activePopup.device_id})</span>
                  )}
                </span>
              )}
              {activePopup.action_taken && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                  {activePopup.action_taken}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer Prompt */}
        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 group-hover:text-indigo-600 transition-colors">
          <span className="font-medium">Tap to view threat analysis in Alerts Center</span>
          <ChevronRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </div>
  );
};
