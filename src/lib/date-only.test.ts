import { describe, expect, it } from 'vitest';
import {
  DateOnlyStringSchema,
  dateOnlyToLocalDate,
  dateOnlyToUtcDate,
  isDateOnlyString,
  parseMonthKey,
  toDateOnlyString,
} from '@/lib/date-only';

describe('isDateOnlyString / DateOnlyStringSchema', () => {
  it('accepts strict YYYY-MM-DD calendar dates', () => {
    expect(isDateOnlyString('2026-09-28')).toBe(true);
    expect(isDateOnlyString('2024-02-29')).toBe(true);
    expect(DateOnlyStringSchema.parse('2026-01-01')).toBe('2026-01-01');
  });

  it('rejects impossible dates and other formats', () => {
    for (const value of [
      '2026-02-29',
      '2026-02-30',
      '2026-13-01',
      '2026-00-10',
      '2026-04-31',
      '2026-9-28',
      '2026-09-28T00:00:00.000Z',
      '28/09/2026',
      '0099-01-01',
      '',
    ]) {
      expect(isDateOnlyString(value)).toBe(false);
      expect(DateOnlyStringSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe('dateOnlyToUtcDate', () => {
  it('returns UTC midnight for the given calendar day', () => {
    expect(dateOnlyToUtcDate('2026-09-28').toISOString()).toBe(
      '2026-09-28T00:00:00.000Z'
    );
    expect(dateOnlyToUtcDate('2026-12-31').toISOString()).toBe(
      '2026-12-31T00:00:00.000Z'
    );
  });

  it('throws on invalid input', () => {
    expect(() => dateOnlyToUtcDate('2026-02-30')).toThrow();
    expect(() => dateOnlyToUtcDate('not-a-date')).toThrow();
  });

  it('round-trips through toDateOnlyString', () => {
    for (const key of [
      '2026-01-01',
      '2024-02-29',
      '2026-09-28',
      '2026-12-31',
    ]) {
      expect(toDateOnlyString(dateOnlyToUtcDate(key))).toBe(key);
    }
  });
});

describe('dateOnlyToLocalDate', () => {
  it('returns local midnight on the same calendar day', () => {
    const date = dateOnlyToLocalDate('2026-03-05');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(5);
    expect(date.getHours()).toBe(0);
  });
});

describe('parseMonthKey', () => {
  it('returns the UTC range of the month', () => {
    const range = parseMonthKey('2026-02');
    expect(range?.year).toBe(2026);
    expect(range?.month).toBe(2);
    expect(range?.start.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(range?.end.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('rolls December over into the next year', () => {
    expect(parseMonthKey('2026-12')?.end.toISOString()).toBe(
      '2027-01-01T00:00:00.000Z'
    );
  });

  it('rejects invalid keys', () => {
    for (const value of [
      '2026-13',
      '2026-00',
      '2026-2',
      '2026-02-01',
      'abc',
      '',
      null,
      undefined,
    ]) {
      expect(parseMonthKey(value)).toBeNull();
    }
  });
});
