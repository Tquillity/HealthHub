import { describe, expect, it } from 'vitest';
import { getLocalDateKey, getLocalHour, resolveTimeZone } from './time-zone';

describe('time zone helpers', () => {
  const now = new Date('2026-11-20T23:30:00Z');

  it('keeps known zones and falls back to UTC for anything else', () => {
    expect(resolveTimeZone('Europe/Stockholm')).toBe('Europe/Stockholm');
    expect(resolveTimeZone('Not/AZone')).toBe('UTC');
    expect(resolveTimeZone('')).toBe('UTC');
    expect(resolveTimeZone(null)).toBe('UTC');
  });

  it('gives the local hour', () => {
    expect(getLocalHour(now, 'UTC')).toBe(23);
    expect(getLocalHour(now, 'Europe/Stockholm')).toBe(0);
    expect(getLocalHour(new Date('2026-11-20T00:15:00Z'), 'UTC')).toBe(0);
    expect(getLocalHour(now, 'Not/AZone')).toBe(23);
  });

  it('gives the local calendar day', () => {
    expect(getLocalDateKey(now, 'UTC')).toBe('2026-11-20');
    expect(getLocalDateKey(now, 'Europe/Stockholm')).toBe('2026-11-21');
    expect(getLocalDateKey(now, 'America/Los_Angeles')).toBe('2026-11-20');
  });
});
