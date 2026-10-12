/**
 * Robust date and timestamp formatters for NetPulse IoT
 */

export function parseUtcDate(dateStr: string | Date | undefined | null): Date {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;

  let s = String(dateStr).trim();
  // If string has no timezone indicator (no Z and no +/- offset), treat as UTC
  if (!s.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(s)) {
    s += 'Z';
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function formatLastSeen(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return 'Never';

  const d = parseUtcDate(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));

  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (diffSec < 10) {
    return `Just now (${timeStr})`;
  } else if (diffSec < 60) {
    return `${diffSec}s ago (${timeStr})`;
  } else if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    return `${mins}m ago (${timeStr})`;
  } else if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return `${hours}h ago (${timeStr})`;
  } else {
    const days = Math.floor(diffSec / 86400);
    return `${days}d ago (${d.toLocaleDateString([], { month: 'short', day: 'numeric' })})`;
  }
}

export function formatTimeOnly(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '--:--:--';
  const d = parseUtcDate(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDateTime(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return 'N/A';
  const d = parseUtcDate(dateStr);
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}
