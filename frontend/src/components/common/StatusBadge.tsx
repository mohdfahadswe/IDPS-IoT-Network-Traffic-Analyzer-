import React from 'react';

interface StatusBadgeProps {
  status: 'online' | 'offline' | 'suspicious' | 'temporarily_blocked' | 'blocked' | string;
  source?: 'real' | 'simulated';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, source }) => {
  const norm = status?.toLowerCase() || 'online';

  let config = {
    label: 'Online',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    pulse: true,
  };

  if (norm === 'offline') {
    config = {
      label: 'Offline',
      bg: 'bg-slate-100',
      text: 'text-slate-600',
      border: 'border-slate-300',
      dot: 'bg-slate-400',
      pulse: false,
    };
  } else if (norm === 'suspicious') {
    config = {
      label: 'Suspicious',
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-300',
      dot: 'bg-amber-500',
      pulse: true,
    };
  } else if (norm === 'temporarily_blocked' || norm === 'temporary_block') {
    config = {
      label: 'Temp Blocked',
      bg: 'bg-orange-50',
      text: 'text-orange-700',
      border: 'border-orange-300',
      dot: 'bg-orange-500',
      pulse: false,
    };
  } else if (norm === 'blocked') {
    config = {
      label: 'Blocked',
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-300',
      dot: 'bg-rose-600',
      pulse: false,
    };
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bg} ${config.text} ${config.border}`}>
        <span className="relative flex h-2 w-2">
          {config.pulse && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dot} opacity-75`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot}`} />
        </span>
        {config.label}
      </span>
      {source && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
          source === 'real' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
        }`}>
          {source === 'real' ? 'Real Hardware' : 'Simulated'}
        </span>
      )}
    </div>
  );
};
