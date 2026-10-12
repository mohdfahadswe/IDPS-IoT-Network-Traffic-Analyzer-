import React from 'react';
import { ShieldCheck, Cpu, AlertOctagon, AlertTriangle, Activity, ShieldAlert, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ThreatSummaryProps {
  threatDistribution: Record<string, number>;
  totalThreats: number;
}

export const ThreatSummary: React.FC<ThreatSummaryProps> = ({
  threatDistribution,
  totalThreats,
}) => {
  const severities = [
    {
      label: 'Critical',
      key: 'Critical',
      color: 'bg-rose-600',
      text: 'text-rose-700',
      bgCard: 'bg-rose-50/70 hover:bg-rose-100/70 border-rose-200/80',
      iconColor: 'text-rose-600',
      icon: AlertOctagon,
    },
    {
      label: 'High',
      key: 'High',
      color: 'bg-amber-500',
      text: 'text-amber-800',
      bgCard: 'bg-amber-50/70 hover:bg-amber-100/70 border-amber-200/80',
      iconColor: 'text-amber-600',
      icon: AlertTriangle,
    },
    {
      label: 'Medium',
      key: 'Medium',
      color: 'bg-orange-500',
      text: 'text-orange-800',
      bgCard: 'bg-orange-50/70 hover:bg-orange-100/70 border-orange-200/80',
      iconColor: 'text-orange-600',
      icon: Activity,
    },
    {
      label: 'Low',
      key: 'Low',
      color: 'bg-emerald-500',
      text: 'text-emerald-800',
      bgCard: 'bg-emerald-50/70 hover:bg-emerald-100/70 border-emerald-200/80',
      iconColor: 'text-emerald-600',
      icon: ShieldCheck,
    },
  ];

  const sumThreats = totalThreats > 0 ? totalThreats : Object.values(threatDistribution).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between h-full transition-all duration-300 hover:border-slate-300">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Threat Summary</h3>
            <p className="text-xs text-slate-500 mt-0.5">Multi-factor anomaly classification</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50/80 text-indigo-700 rounded-full text-[11px] font-semibold border border-indigo-100/80 shrink-0">
            <Cpu className="w-3.5 h-3.5 text-indigo-600" />
            <span>AI Risk Engine</span>
          </div>
        </div>

        {/* 2x2 Severity Tile Grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          {severities.map((sev) => {
            const count = threatDistribution[sev.key] || 0;
            const percentage = sumThreats > 0 ? Math.round((count / sumThreats) * 100) : 0;
            const Icon = sev.icon;

            return (
              <Link
                key={sev.key}
                to={`/alerts?severity=${sev.key}`}
                className={`p-3 rounded-xl border transition-all duration-150 flex flex-col justify-between ${sev.bgCard} group shadow-2xs`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`w-4 h-4 ${sev.iconColor} group-hover:scale-110 transition-transform`} />
                    <span className="text-xs font-bold text-slate-900">{sev.label}</span>
                  </div>
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${sev.text} bg-white/80 border border-slate-200/60`}>
                    {percentage}%
                  </span>
                </div>

                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-lg font-black text-slate-900 tracking-tight">{count}</span>
                  <span className="text-[10px] text-slate-500 font-medium group-hover:text-indigo-600 transition-colors flex items-center gap-0.5">
                    View <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Proportional Stacked Spectrum Bar */}
        <div className="mb-4 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
            <span>Threat Severity Ratio</span>
            <span className="text-slate-400 font-normal">{sumThreats} Total Incidents</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
            {severities.map((sev) => {
              const count = threatDistribution[sev.key] || 0;
              const percentage = sumThreats > 0 ? (count / sumThreats) * 100 : 0;
              if (percentage <= 0) return null;
              return (
                <div
                  key={sev.key}
                  className={`${sev.color} transition-all duration-500 h-full`}
                  style={{ width: `${percentage}%` }}
                  title={`${sev.label}: ${count} (${Math.round(percentage)}%)`}
                />
              );
            })}
          </div>
        </div>

        {/* Detailed Horizontal Breakdown Meters */}
        <div className="space-y-2.5">
          {severities.map((sev) => {
            const count = threatDistribution[sev.key] || 0;
            const percentage = sumThreats > 0 ? Math.round((count / sumThreats) * 100) : 0;
            return (
              <div key={sev.key} className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-medium">
                  <span className="text-slate-700 font-semibold">{sev.label} Risk</span>
                  <span className="text-slate-600 text-xs font-bold font-mono">
                    {count} <span className="text-slate-400 text-[10px] font-normal font-sans">({percentage}%)</span>
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${sev.color} rounded-full transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Card Footer */}
      <div className="border-t border-slate-100 pt-3.5 mt-4 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-[11px] font-medium">Automated Policy Guard</span>
        </div>
        <span className="font-bold text-slate-800 text-[11px]">{sumThreats} Incidents Triaged</span>
      </div>
    </div>
  );
};

