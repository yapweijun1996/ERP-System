export function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = n;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  const precision = unitIndex === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(precision)}${units[unitIndex]}`;
}

export function formatDuration(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return '-';
  const s = Math.floor(n / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (d > 0) return `${d}d${h}h`;
  if (h > 0) return `${h}h${m}m`;
  if (m > 0) return `${m}m${ss}s`;
  return `${ss}s`;
}

export function pad(str, width, align = 'left') {
  const s = String(str ?? '');
  if (s.length >= width) return s.slice(0, width);
  const spaces = ' '.repeat(width - s.length);
  return align === 'right' ? `${spaces}${s}` : `${s}${spaces}`;
}

