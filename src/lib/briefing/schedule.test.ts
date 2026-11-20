import { describe, expect, it } from 'vitest';
import {
  acceptBriefingDate,
  dateKeyInTimeZone,
  isBriefingDue,
  isValidTimeZone,
  nextBriefingDate,
  weekdayOfDateKey,
} from './schedule';

// Sunday 22 November 2026, 23:30 UTC.
const SUNDAY_LATE_UTC = new Date('2026-11-22T23:30:00Z');

describe('dateKeyInTimeZone', () => {
  it("returns the user's own calendar day", () => {
    expect(dateKeyInTimeZone(SUNDAY_LATE_UTC, 'UTC')).toBe('2026-11-22');
    // Stockholm is UTC+1 in November: already Monday.
    expect(dateKeyInTimeZone(SUNDAY_LATE_UTC, 'Europe/Stockholm')).toBe(
      '2026-11-23'
    );
    // Los Angeles is UTC-8: still Sunday afternoon.
    expect(dateKeyInTimeZone(SUNDAY_LATE_UTC, 'America/Los_Angeles')).toBe(
      '2026-11-22'
    );
    // UTC+14 is a day ahead for most of the UTC day.
    expect(
      dateKeyInTimeZone(new Date('2026-11-22T10:00:00Z'), 'Pacific/Kiritimati')
    ).toBe('2026-11-23');
  });

  it('falls back to UTC for an unknown or empty timezone', () => {
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(dateKeyInTimeZone(SUNDAY_LATE_UTC, 'Mars/Olympus_Mons')).toBe(
      '2026-11-22'
    );
    expect(dateKeyInTimeZone(SUNDAY_LATE_UTC, '')).toBe('2026-11-22');
  });
});

describe('isBriefingDue', () => {
  it('shows daily briefings every day and never ones never', () => {
    expect(isBriefingDue('daily', '2026-11-22')).toBe(true);
    expect(isBriefingDue('daily', '2026-11-23')).toBe(true);
    expect(isBriefingDue('never', '2026-11-23')).toBe(false);
  });

  it('shows weekly briefings on Mondays only', () => {
    expect(weekdayOfDateKey('2026-11-23')).toBe(1);
    expect(isBriefingDue('weekly', '2026-11-23')).toBe(true);
    expect(isBriefingDue('weekly', '2026-11-22')).toBe(false);
    expect(isBriefingDue('weekly', '2026-11-24')).toBe(false);
  });

  it("follows the user's timezone for the weekly day", () => {
    const due = (timeZone: string) =>
      isBriefingDue('weekly', dateKeyInTimeZone(SUNDAY_LATE_UTC, timeZone));
    expect(due('Europe/Stockholm')).toBe(true);
    expect(due('UTC')).toBe(false);
    expect(due('America/Los_Angeles')).toBe(false);
    // Monday 07:00 in Los Angeles is Monday 15:00 UTC: due there and in UTC.
    const mondayMorningLa = new Date('2026-11-23T15:00:00Z');
    expect(
      isBriefingDue(
        'weekly',
        dateKeyInTimeZone(mondayMorningLa, 'America/Los_Angeles')
      )
    ).toBe(true);
    // By then it is already Tuesday in Kiritimati (UTC+14).
    expect(
      isBriefingDue(
        'weekly',
        dateKeyInTimeZone(mondayMorningLa, 'Pacific/Kiritimati')
      )
    ).toBe(false);
  });
});

describe('nextBriefingDate', () => {
  it('finds the next due day', () => {
    expect(nextBriefingDate('daily', '2026-11-20')).toBe('2026-11-20');
    expect(nextBriefingDate('weekly', '2026-11-20')).toBe('2026-11-23');
    expect(nextBriefingDate('weekly', '2026-11-23')).toBe('2026-11-23');
    expect(nextBriefingDate('never', '2026-11-20')).toBeNull();
  });
});

describe('acceptBriefingDate', () => {
  it('accepts the client day within one day of the server day', () => {
    expect(acceptBriefingDate('2026-11-20', '2026-11-20')).toBe('2026-11-20');
    expect(acceptBriefingDate('2026-11-21', '2026-11-20')).toBe('2026-11-21');
    expect(acceptBriefingDate('2026-11-19', '2026-11-20')).toBe('2026-11-19');
    expect(acceptBriefingDate('2026-11-22', '2026-11-20')).toBeNull();
    expect(acceptBriefingDate('2025-11-20', '2026-11-20')).toBeNull();
  });
});
