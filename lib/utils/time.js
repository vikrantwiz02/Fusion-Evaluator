import config from '../config.js';

export function parseTimeToMinutes(value, fallback) {
  if (!value || typeof value !== 'string') return fallback;

  const raw = value.trim().toUpperCase();
  const m = raw.match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/);
  if (!m) return fallback;

  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const period = m[3];

  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) {
    return fallback;
  }

  if (period) {
    if (hour < 1 || hour > 12) return fallback;
    hour = period === 'AM' ? hour % 12 : (hour % 12) + 12;
  }

  if (hour < 0 || hour > 23) return fallback;
  return hour * 60 + minute;
}

export function getCurrentMinutesInTimezone(timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

export function isWithinLoginWindow(loginStart, loginEnd) {
  const startMin = parseTimeToMinutes(loginStart, 0);
  const endMin = parseTimeToMinutes(loginEnd, 23 * 60 + 59);
  const currentMin = getCurrentMinutesInTimezone(config.appTimezone);

  if (endMin < startMin) {
    return currentMin >= startMin || currentMin <= endMin;
  }
  return currentMin >= startMin && currentMin <= endMin;
}
