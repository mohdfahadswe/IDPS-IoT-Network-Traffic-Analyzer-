import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, Calendar, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { reportService } from '../services/api';

export const Reports: React.FC = () => {
  const [days, setDays] = useState<number>(30);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await reportService.getSummary(days);
      setSummary(res.data);
    } catch (err) {
      console.error('Failed to load reports summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [days]);

  const handleDownloadCsv = (reportType: string) => {
    setDownloading(reportType);
    const downloadUrl = reportService.getExportUrl(reportType, days);
    
    // Direct link trigger ensures seamless browser download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', `netpulse_${reportType}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloading(null);
    }, 1200);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Compliance & Forensic Reports</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Export structured forensic logs, device inventories, and incident audits in CSV format
          </p>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200/80 text-xs text-slate-700">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="font-semibold">Audit Window:</span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-transparent font-medium text-indigo-600 focus:outline-hidden cursor-pointer"
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
            <option value={365}>Last 365 Days</option>
          </select>
        </div>
      </div>

      {/* Available Reports Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(summary?.available_reports || [
          { id: 'alerts', name: 'Security Incidents & Alerts Audit', record_count: 15, format: 'CSV' },
          { id: 'devices', name: 'Connected Device Inventory & Risk Posture', record_count: 6, format: 'CSV' },
          { id: 'traffic', name: 'Network Flow & Telemetry Activity Log', record_count: 85, format: 'CSV' },
        ]).map((rep: any) => (
          <div
            key={rep.id}
            className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-all card-minimal"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 leading-snug">{rep.name}</h3>
              <p className="text-xs text-slate-500 mt-1">
                Detailed audit trail covering timestamps, risk classifications, and response policies.
              </p>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-mono">
                <span>Available Records:</span>
                <span className="font-bold text-slate-900">{rep.record_count.toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={() => handleDownloadCsv(rep.id)}
                disabled={downloading === rep.id}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                {downloading === rep.id ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300 animate-pulse" />
                    <span>Exporting CSV...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download CSV Export</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Compliance Guarantee Banner */}
      <div className="p-4.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-center gap-3 text-xs text-emerald-900 shadow-2xs">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
        <div>
          <span className="font-bold">100% Deterministic Forensic Export:</span> All generated CSV logs strictly reflect historical SQLite/PostgreSQL relational data with immutable timestamps, feature extractions, and model scoring outputs.
        </div>
      </div>
    </div>
  );
};
