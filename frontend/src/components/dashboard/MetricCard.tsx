import React from 'react';
import { Link } from 'react-router-dom';
import { LucideIcon, ArrowUpRight } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  statusText?: string;
  accentColor?: 'indigo' | 'emerald' | 'amber' | 'rose';
  to?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  trendDirection = 'up',
  statusText,
  accentColor = 'indigo',
  to,
}) => {
  const colorMap = {
    indigo: {
      badge: 'bg-indigo-50/80 text-indigo-600 border-indigo-100/80 group-hover:bg-indigo-600 group-hover:text-white',
      borderHover: 'hover:border-indigo-200 hover:shadow-indigo-50/40',
      textHover: 'group-hover:text-indigo-600',
      accentDot: 'bg-indigo-500',
    },
    emerald: {
      badge: 'bg-emerald-50/80 text-emerald-600 border-emerald-100/80 group-hover:bg-emerald-600 group-hover:text-white',
      borderHover: 'hover:border-emerald-200 hover:shadow-emerald-50/40',
      textHover: 'group-hover:text-emerald-600',
      accentDot: 'bg-emerald-500',
    },
    amber: {
      badge: 'bg-amber-50/80 text-amber-600 border-amber-100/80 group-hover:bg-amber-600 group-hover:text-white',
      borderHover: 'hover:border-amber-200 hover:shadow-amber-50/40',
      textHover: 'group-hover:text-amber-600',
      accentDot: 'bg-amber-500',
    },
    rose: {
      badge: 'bg-rose-50/80 text-rose-600 border-rose-100/80 group-hover:bg-rose-600 group-hover:text-white',
      borderHover: 'hover:border-rose-200 hover:shadow-rose-50/40',
      textHover: 'group-hover:text-rose-600',
      accentDot: 'bg-rose-500',
    },
  };

  const scheme = colorMap[accentColor] || colorMap.indigo;

  const cardContent = (
    <div
      className={`bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between transition-all duration-300 h-full relative overflow-hidden group ${
        to ? `cursor-pointer hover:shadow-md hover:-translate-y-1 hover:border-slate-300 ${scheme.borderHover}` : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${scheme.accentDot}`} />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
        </div>
        <div className={`p-2 rounded-xl border transition-all duration-300 ${scheme.badge}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-4">
        <div className={`text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-sans transition-colors ${scheme.textHover}`}>
          {value}
        </div>
        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            {trend && (
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                  trendDirection === 'up'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : trendDirection === 'down'
                    ? 'bg-rose-50 text-rose-700 border border-rose-100'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                {trend}
              </span>
            )}
            {statusText && <span className="text-xs text-slate-400 font-medium">{statusText}</span>}
          </div>
          {to && (
            <span className="text-xs font-semibold text-slate-400 group-hover:text-indigo-600 flex items-center gap-0.5 transition-colors">
              <span>View</span>
              <ArrowUpRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="group block h-full focus:outline-hidden">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
};

