import React, { useState, useEffect } from 'react';
import { Globe, Search, Info, ExternalLink } from 'lucide-react';
import { domainService } from '../services/api';
import { DomainItem } from '../types';
import { RiskBadge } from '../components/common/RiskBadge';
import { Modal } from '../components/common/Modal';
import { formatLastSeen } from '../utils/formatters';

export const Domains: React.FC = () => {
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<DomainItem | null>(null);
  const [search, setSearch] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);

  const fetchDomains = async () => {
    try {
      setLoading(true);
      const res = await domainService.getDomains({
        risk_level: riskFilter !== 'all' ? riskFilter : undefined,
      });
      setDomains(res.data || []);
    } catch (err) {
      console.error('Failed to load domains:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, [riskFilter]);

  const filtered = domains.filter((d) =>
    d.domain_name.toLowerCase().includes(search.toLowerCase()) ||
    d.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Contacted Domain Intelligence</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            External DNS queries, command & control heuristic assessment, and transparent risk scoring
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by domain or category..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200/80 rounded-xl font-medium text-slate-700 focus:outline-hidden cursor-pointer"
          >
            <option value="all">All Risk Levels</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      {/* Grid of Domain Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((dom) => {
          const radius = 32;
          const circumference = 2 * Math.PI * radius;
          const strokeDashoffset = circumference - (dom.overall_risk_score / 100) * circumference;

          return (
            <div
              key={dom.id}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between card-minimal"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-2">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      {dom.category}
                    </span>
                    <h4 className="font-mono font-bold text-slate-900 text-sm mt-0.5 truncate">
                      {dom.domain_name}
                    </h4>
                  </div>
                  <RiskBadge level={dom.risk_level} size="sm" />
                </div>

                {/* Mini Radial Gauge */}
                <div className="flex items-center gap-4 my-4 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r={radius} stroke="#e2e8f0" strokeWidth="6" fill="transparent" />
                      <circle
                        cx="40"
                        cy="40"
                        r={radius}
                        stroke={dom.overall_risk_score >= 81 ? '#e11d48' : dom.overall_risk_score >= 61 ? '#f97316' : dom.overall_risk_score >= 31 ? '#f59e0b' : '#10b981'}
                        strokeWidth="6"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                    <span className="absolute font-bold text-xs text-slate-900">
                      {dom.overall_risk_score.toFixed(0)}
                    </span>
                  </div>

                  <div className="text-xs space-y-0.5 truncate">
                    <div className="font-semibold text-slate-700">Total Queries: {dom.request_count}</div>
                    <div className="text-slate-400 text-[11px]">
                      Last: {formatLastSeen(dom.last_seen)}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {dom.risk_explanation || 'Assigned based on query velocity and device association heuristics.'}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setSelectedDomain(dom)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>Scoring Breakdown</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
                <span className="text-[11px] font-mono text-slate-400">
                  {dom.connected_devices?.length || 1} Nodes
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Heuristic Breakdown Modal */}
      {selectedDomain && (
        <Modal
          isOpen={!!selectedDomain}
          onClose={() => setSelectedDomain(null)}
          title={`Domain Risk Analysis: ${selectedDomain.domain_name}`}
        >
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 uppercase font-bold">Category</span>
                <div className="text-sm font-semibold text-slate-900">{selectedDomain.category}</div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 uppercase font-bold">Risk Posture</span>
                <div className="text-base font-bold text-rose-600">
                  {selectedDomain.overall_risk_score.toFixed(0)} / 100 ({selectedDomain.risk_level})
                </div>
              </div>
            </div>

            <div>
              <h5 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-1">
                Transparent Decision Factors
              </h5>
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-950 leading-relaxed font-mono">
                {selectedDomain.risk_explanation || 'High risk was assigned because this domain was contacted frequently during suspicious network activity.'}
              </div>
            </div>

            <div className="text-xs space-y-1 text-slate-600 font-mono">
              <div><strong>First Seen:</strong> {new Date(selectedDomain.first_seen).toLocaleString()}</div>
              <div><strong>Last Query:</strong> {new Date(selectedDomain.last_seen).toLocaleString()}</div>
              <div><strong>Associated Fleet Nodes:</strong> {selectedDomain.connected_devices?.join(', ') || 'esp32-001'}</div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
