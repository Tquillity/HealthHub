import { describe, expect, it } from 'vitest';
import {
  deviceTimeZone,
  getLocalDateKey,
  getLocalHour,
  isUnsetTimeZone,
  resolveTimeZone,
  timeZoneFieldAfterSavedChange,
  timeZoneToAdopt,
} from './time-zone';

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

  it('gives the local calendar day east and west of UTC', () => {
    // 20:00 UTC is already the next morning in Auckland.
    expect(getLocalDateKey(new Date('2026-06-15T20:00:00Z'), 'Pacific/Auckland')).toBe('2026-06-16');
    // 03:00 UTC is still the previous evening in Los Angeles.
    expect(getLocalDateKey(new Date('2026-06-16T03:00:00Z'), 'America/Los_Angeles')).toBe(
      '2026-06-15'
    );
  });

  it('fills in the device zone only while the profile still has the default', () => {
    expect(timeZoneToAdopt('UTC', 'Australia/Sydney')).toBe('Australia/Sydney');
    expect(timeZoneToAdopt('', 'Australia/Sydney')).toBe('Australia/Sydney');
    expect(timeZoneToAdopt(null, 'America/New_York')).toBe('America/New_York');
    expect(timeZoneToAdopt('Not/AZone', 'Europe/Stockholm')).toBe('Europe/Stockholm');
    // A zone the person chose is kept.
    expect(timeZoneToAdopt('Europe/Stockholm', 'Australia/Sydney')).toBeNull();
    // Nothing to change, or nothing usable from the device.
    expect(timeZoneToAdopt('UTC', 'UTC')).toBeNull();
    expect(timeZoneToAdopt('UTC', 'Not/AZone')).toBeNull();
    expect(timeZoneToAdopt('UTC', undefined)).toBeNull();
    expect(timeZoneToAdopt('UTC', '')).toBeNull();
  });

  it("reads the device's zone from the runtime", () => {
    expect(deviceTimeZone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('treats the UTC default, an empty zone and an unknown zone as unset', () => {
    for (const stored of ['UTC', '', null, undefined, 'Not/AZone']) {
      expect(isUnsetTimeZone(stored)).toBe(true);
    }
    for (const stored of ['Europe/Stockholm', 'America/Los_Angeles', 'Australia/Sydney']) {
      expect(isUnsetTimeZone(stored)).toBe(false);
    }
  });

  it('moves an untouched time zone field to a zone saved elsewhere, and keeps an edited one', () => {
    // Sharing filled in the device zone while the field still showed the saved default.
    expect(timeZoneFieldAfterSavedChange('UTC', 'UTC', 'Australia/Sydney')).toBe(
      'Australia/Sydney'
    );
    expect(timeZoneFieldAfterSavedChange('UTC', null, 'Australia/Sydney')).toBe('Australia/Sydney');
    // The person had typed a zone of their own: it stays for them to save.
    expect(timeZoneFieldAfterSavedChange('Europe/Paris', 'UTC', 'Australia/Sydney')).toBe(
      'Europe/Paris'
    );
    expect(timeZoneFieldAfterSavedChange('Australia/Sydney', 'Australia/Sydney', null)).toBe('UTC');
  });
});
