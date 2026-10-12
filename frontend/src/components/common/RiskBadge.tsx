import React from 'react';

interface RiskBadgeProps {
  level: 'Low' | 'Medium' | 'High' | 'Critical' | string;
  score?: number;
  size?: 'sm' | 'md' | 'lg';
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level, score, size = 'md' }) => {
  const normalized = level?.toLowerCase() || 'low';

  let colors = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (normalized === 'medium') {
    colors = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (normalized === 'high') {
    colors = 'bg-orange-50 text-orange-700 border-orange-200';
  } else if (normalized === 'critical') {
    colors = 'bg-rose-50 text-rose-700 border-rose-200';
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : size === 'lg' ? 'px-3 py-1.5 text-sm font-semibold' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${colors} ${sizeClasses}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${
        normalized === 'critical' ? 'bg-rose-500' :
        normalized === 'high' ? 'bg-orange-500' :
        normalized === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
      }`} />
      <span>{level}</span>
      {score !== undefined && (
        <span className="font-mono opacity-80">({score.toFixed(0)})</span>
      )}
    </span>
  );
};
