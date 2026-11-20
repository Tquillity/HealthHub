import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { JournalDayContent } from '@/lib/journal-content';
import { JournalAnalytics } from './journal-analytics';

type Entry = { date: Date } & JournalDayContent;

function entry(date: string, values: Partial<JournalDayContent> = {}): Entry {
  return {
    date: new Date(`${date}T00:00:00Z`),
    mood: null,
    energy: null,
    sleepHours: null,
    notes: null,
    gratitudeNotes: null,
    goalsNotes: null,
    symptomsNotes: null,
    temperature: null,
    cervicalMucus: null,
    restingHeartRate: null,
    heartRateVariability: null,
    sleepQuality: null,
    tags: [],
    gratitudeEntries: [],
    goalsAchieved: [],
    goalsProgress: [],
    symptomsPhysical: [],
    symptomsMental: [],
    energyMorning: null,
    energyAfternoon: null,
    energyEvening: null,
    ...values,
  };
}

/** The rendered text, tags removed. */
const text = (entries: Entry[]) =>
  renderToStaticMarkup(createElement(JournalAnalytics, { entries }))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

/** A day created by the dashboard's "How is your energy right now?" check-in. */
const checkInOnly = (date: string) => entry(date, { energyMorning: 3 });

describe('JournalAnalytics', () => {
  it('compares only the entries that have a value, after check-in-only days', () => {
    const out = text([
      checkInOnly('2026-11-01'),
      checkInOnly('2026-11-02'),
      entry('2026-11-03', { mood: 5, energy: 5, sleepHours: 7 }),
      entry('2026-11-04', { mood: 8, energy: 6, sleepHours: 8 }),
    ]);
    expect(out).not.toContain('NaN');
    expect(out).toContain('Average Mood 6.5');
    expect(out).toContain('📈 3.0 vs start');
    expect(out).toContain('📈 1.0 vs start');
    expect(out).toContain('📈 1.0h vs start');
    // Check-in-only days are not journal entries.
    expect(out).toContain('Total Entries 2');
  });

  it('shows no trend with fewer than two values, and none for a half without them', () => {
    const out = text([
      entry('2026-11-01', { notes: 'encrypted-note' }),
      entry('2026-11-02', { restingHeartRate: 60 }),
      entry('2026-11-03', { mood: 7 }),
      entry('2026-11-04', { sleepHours: 7 }),
    ]);
    expect(out).not.toContain('NaN');
    expect(out).not.toContain('vs start');
    // Notes-only and vitals-only days are still journal days.
    expect(out).toContain('Total Entries 4');
  });

  it('counts a day with a check-in and other journal data as an entry', () => {
    const out = text([
      entry('2026-11-01', { energyEvening: 4, tags: ['calm'] }),
      checkInOnly('2026-11-02'),
    ]);
    expect(out).toContain('Total Entries 1');
  });

  it('asks for more entries when there are only check-ins', () => {
    expect(text([checkInOnly('2026-11-01')])).toContain(
      'Not enough data for analytics.'
    );
  });
});
