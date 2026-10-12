import React, { useState } from 'react';
import { Globe, Info, ExternalLink } from 'lucide-react';
import { DomainItem } from '../../types';
import { Modal } from '../common/Modal';

interface DomainRiskRadarProps {
  topDomains: DomainItem[];
}

export const DomainRiskRadar: React.FC<DomainRiskRadarProps> = ({ topDomains }) => {
  const [selectedDomain, setSelectedDomain] = useState<DomainItem | null>(null);

  // Highest risk domain as spotlight
  const spotlight = topDomains.length > 0 ? topDomains[0] : {
    domain_name: 'malicious-c2-server.ru',
    overall_risk_score: 88.0,
    risk_level: 'Critical',
    category: 'Command & Control',
    request_count: 14,
    risk_explanation: 'High risk was assigned because this domain was contacted frequently during suspicious network activity.',
  } as DomainItem;

  // Compute SVG radial circumference
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (spotlight.overall_risk_score / 100) * circumference;

  const getScoreColor = (score: number) => {
    if (score >= 81) return '#e11d48'; // rose-600
    if (score >= 61) return '#f97316'; // orange-500
    if (score >= 31) return '#f59e0b'; // amber-500
    return '#10b981'; // emerald-500
  };

  return (
    <>
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between h-full transition-all duration-300 hover:border-slate-300">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Domain Risk Analysis</h3>
              <p className="text-xs text-slate-500 mt-0.5">Contacted endpoints & heuristic risk posture</p>
            </div>
            <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-slate-600">
              <Globe className="w-4 h-4" />
            </div>
          </div>

          {/* Radial Circular Gauge */}
          <div className="flex flex-col items-center justify-center my-4">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 140 140">
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  stroke="#f1f5f9"
                  strokeWidth="10"
                  fill="transparent"
                />
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  stroke={getScoreColor(spotlight.overall_risk_score)}
                  strokeWidth="10"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>

              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {spotlight.overall_risk_score.toFixed(0)}
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Risk Score
                </span>
              </div>
            </div>

            <div className="mt-2 text-center">
              <h4 className="text-xs font-bold text-slate-900 font-mono">{spotlight.domain_name}</h4>
              <p className="text-[11px] text-slate-500">{spotlight.category}</p>
            </div>
          </div>

          {/* Transparent Scoring Summary */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
            <div className="flex items-center gap-1 font-semibold text-slate-800">
              <Info className="w-3.5 h-3.5 text-indigo-600" />
              <span>Transparent Scoring Factor:</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px] line-clamp-2">
              {spotlight.risk_explanation || 'High risk was assigned because this domain was contacted frequently during suspicious network activity.'}
            </p>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3 mt-4 flex items-center justify-between">
          <button
            onClick={() => setSelectedDomain(spotlight)}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
          >
            <span>Inspect Scoring Heuristics</span>
            <ExternalLink className="w-3 h-3" />
          </button>
          <span className="text-[11px] text-slate-400">{spotlight.request_count} Queries</span>
        </div>
      </div>

      {/* Heuristic Explanation Modal */}
      {selectedDomain && (
        <Modal
          isOpen={!!selectedDomain}
          onClose={() => setSelectedDomain(null)}
          title={`Domain Heuristic Analysis: ${selectedDomain.domain_name}`}
        >
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <div className="text-xs text-slate-500 uppercase font-semibold">Category</div>
                <div className="text-slate-900 font-medium">{selectedDomain.category}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500 uppercase font-semibold">Assigned Risk</div>
                <div className="text-rose-600 font-bold">{selectedDomain.overall_risk_score.toFixed(0)} / 100 ({selectedDomain.risk_level})</div>
              </div>
            </div>

            <div>
              <h5 className="font-semibold text-slate-900 text-xs uppercase tracking-wider mb-2">Transparent Rule Logic</h5>
              <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-lg text-indigo-950 text-xs leading-relaxed">
                {selectedDomain.risk_explanation || 'High risk was assigned because this domain was contacted frequently during suspicious network activity.'}
              </div>
            </div>

            <div>
              <h5 className="font-semibold text-slate-900 text-xs uppercase tracking-wider mb-1.5">Connected IoT Nodes</h5>
              <p className="text-xs text-slate-600">
                Queried by: <span className="font-mono font-medium text-slate-800">{selectedDomain.connected_devices?.join(', ') || 'esp32-001, sim-cam-02'}</span>
              </p>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
