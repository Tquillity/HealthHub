import { describe, expect, it } from 'vitest';
import { buildHeadline, phraseSuggestion } from './copy';
import {
  buildCandidates,
  isTakeItEasyDay,
  recentLogsSayTakeItEasy,
  suggestsGentleRoutines,
} from './rules';
import type { BriefingSignals, Comparison } from './signals';
import type { SuggestionKey } from './types';

const GENTLER = "A gentler day may suit you. Here's what your recent logs suggest.";
const LOW_NOW =
  'You rated your energy as low right now, so this briefing keeps things gentle.';
const LOW_EARLIER =
  'You rated your energy as low earlier today, so this briefing keeps things gentle.';
const DOING_WELL = "You've been doing well lately. Here's how to make the most of it.";

/** Suggestions that encourage harder training. */
const PUSH: SuggestionKey[] = ['routine.go-for-it', 'recovery.well-recovered'];
/** Suggestions that say to take it easy. */
const EASE: SuggestionKey[] = [
  'routine.ease-intensity',
  'recovery.rest-day',
  'recovery.sleep',
  'recovery.gentle-symptoms',
];

const comparison = (actual: number, expected: number): Comparison => ({
  actual,
  days: 3,
  expected,
  sd: 0,
  source: 'overall',
  gap: expected - actual,
  phase: null,
});

const ENERGY = {
  none: null,
  low: { comparison: comparison(4, 7), low: true, good: false },
  good: { comparison: comparison(8, 6), low: false, good: true },
  usual: { comparison: comparison(6, 6), low: false, good: false },
} satisfies Record<string, BriefingSignals['energy']>;

const recovery = (
  zone: 'green' | 'yellow' | 'red',
  low: boolean,
  good: boolean
): BriefingSignals['recovery'] => ({
  latest: {
    date: '2026-11-20',
    score: zone === 'green' ? 85 : zone === 'yellow' ? 60 : 40,
    zone,
    alert: zone === 'red',
    usualScore: 75,
    comparedWith: 'overall',
    phase: null,
  },
  scoredDays: 3,
  meanDrop: good ? -5 : low ? 20 : 0,
  low,
  good,
});

const RECOVERY = {
  none: null,
  low: recovery('red', true, false),
  good: recovery('green', false, true),
  usual: recovery('yellow', false, false),
} satisfies Record<string, BriefingSignals['recovery']>;

const SYMPTOMS = {
  none: null,
  elevated: { comparison: comparison(3, 1), elevated: true, top: ['Cramps'] },
  usual: { comparison: comparison(1, 1), elevated: false, top: [] },
} satisfies Record<string, BriefingSignals['symptoms']>;

const sleep = (meanHours: number): BriefingSignals['sleep'] => ({
  meanHours,
  nights: 3,
  short: meanHours < 7,
  veryShort: meanHours < 6,
});

const SLEEP = {
  none: null,
  enough: sleep(7.5),
  short: sleep(6.5),
  veryShort: sleep(5.5),
} satisfies Record<string, BriefingSignals['sleep']>;

function signals(overrides: Partial<BriefingSignals>): BriefingSignals {
  return {
    today: '2026-11-20',
    window: ['2026-11-18', '2026-11-19', '2026-11-20'],
    phase: null,
    checkInDays: 3,
    energyCheckInDays: 0,
    lowEnergyToday: null,
    energy: null,
    mood: null,
    symptoms: null,
    sleep: null,
    recovery: null,
    meals: null,
    ...overrides,
  };
}

describe('headline and suggestions', () => {
  it('never pair a gentler-day headline with "train harder", or the reverse', () => {
    let gentlerDays = 0;
    for (const energy of Object.values(ENERGY)) {
      for (const recoveryValue of Object.values(RECOVERY)) {
        for (const symptoms of Object.values(SYMPTOMS)) {
          for (const sleepValue of Object.values(SLEEP)) {
            for (const lowEnergyToday of [null, 'now', 'earlier'] as const) {
              const s = signals({
                energy,
                recovery: recoveryValue,
                symptoms,
                sleep: sleepValue,
                lowEnergyToday,
              });
              const headline = buildHeadline(s);
              const keys = buildCandidates(s).map((c) => c.key);
              const label = JSON.stringify({ headline, keys });
              if (
                headline === GENTLER ||
                headline === LOW_NOW ||
                headline === LOW_EARLIER
              ) {
                gentlerDays += 1;
                expect(isTakeItEasyDay(s)).toBe(true);
                expect(
                  keys.filter((k) => PUSH.includes(k)),
                  label
                ).toEqual([]);
                // Every gentler headline says why: a suggestion from the logs, or the
                // low check-in itself, called "right now" only for the current slot.
                if (headline === LOW_NOW || headline === LOW_EARLIER) {
                  expect(s.lowEnergyToday, label).toBe(
                    headline === LOW_NOW ? 'now' : 'earlier'
                  );
                  expect(recentLogsSayTakeItEasy(s), label).toBe(false);
                } else {
                  expect(
                    keys.filter((k) => EASE.includes(k)).length,
                    label
                  ).toBeGreaterThan(0);
                }
              } else {
                // "Doing well" or a neutral headline: nothing says go gently either.
                expect(
                  keys.filter((k) => EASE.includes(k)),
                  label
                ).toEqual([]);
              }
              if (keys.includes('routine.go-for-it')) {
                expect(headline).toBe(DOING_WELL);
              }
            }
          }
        }
      }
    }
    expect(gentlerDays).toBeGreaterThan(0);
  });

  it('takes it easy right after a low energy check-in, even on a good week', () => {
    // A good 3 days and good recovery, but the time-of-day check-in for right now is low.
    const good = signals({ energy: ENERGY.good, recovery: RECOVERY.good });
    expect(buildCandidates(good).map((c) => c.key)).toEqual([
      'recovery.well-recovered',
      'routine.go-for-it',
    ]);
    const lowNow = signals({
      energy: ENERGY.good,
      recovery: RECOVERY.good,
      lowEnergyToday: 'now',
    });
    expect(isTakeItEasyDay(lowNow)).toBe(true);
    // No suggestion explains it, so the headline names the check-in.
    expect(buildHeadline(lowNow)).toBe(LOW_NOW);
    expect(buildCandidates(lowNow)).toEqual([]);

    // A low check-in from an earlier slot, the current one not rated yet: still gentle,
    // but never called "right now", since it can be hours old.
    const lowEarlier = signals({
      energy: ENERGY.good,
      recovery: RECOVERY.good,
      lowEnergyToday: 'earlier',
    });
    expect(isTakeItEasyDay(lowEarlier)).toBe(true);
    expect(buildHeadline(lowEarlier)).toBe(LOW_EARLIER);
    expect(buildCandidates(lowEarlier)).toEqual([]);

    // With a reason in the logs as well, that reason's suggestion explains it.
    const alsoShortSleep = signals({
      energy: ENERGY.good,
      sleep: SLEEP.short,
      lowEnergyToday: 'now',
    });
    expect(buildHeadline(alsoShortSleep)).toBe(GENTLER);
    expect(buildCandidates(alsoShortSleep).map((c) => c.key)).toEqual([
      'recovery.sleep',
    ]);
  });

  it('drops "try a more challenging routine" after short (6-7 h) nights', () => {
    const s = signals({ energy: ENERGY.good, sleep: SLEEP.short });
    expect(buildHeadline(s)).toBe(GENTLER);
    expect(buildCandidates(s).map((c) => c.key)).toEqual(['recovery.sleep']);
  });

  it('says when its suggestions point to gentle routines', () => {
    for (const energy of Object.values(ENERGY)) {
      for (const recoveryValue of Object.values(RECOVERY)) {
        for (const symptoms of Object.values(SYMPTOMS)) {
          for (const sleepValue of Object.values(SLEEP)) {
            const s = signals({
              energy,
              recovery: recoveryValue,
              symptoms,
              sleep: sleepValue,
            });
            const keys = buildCandidates(s).map((c) => c.key);
            const linksToGentle = keys.some(
              (key) =>
                phraseSuggestion(key, s, 'brief').action?.href ===
                '/routines?energy=low'
            );
            expect(suggestsGentleRoutines(s), JSON.stringify(keys)).toBe(
              linksToGentle
            );
            if (suggestsGentleRoutines(s)) {
              expect(isTakeItEasyDay(s)).toBe(true);
            }
          }
        }
      }
    }
  });

  it('drops "great recovery" when symptoms are up or sleep is short', () => {
    const withSymptoms = signals({
      recovery: RECOVERY.good,
      symptoms: SYMPTOMS.elevated,
    });
    expect(buildCandidates(withSymptoms).map((c) => c.key)).toEqual([
      'recovery.gentle-symptoms',
    ]);
    const shortSleep = signals({ recovery: RECOVERY.good, sleep: SLEEP.short });
    expect(buildCandidates(shortSleep).map((c) => c.key)).toEqual([
      'recovery.sleep',
    ]);
    // Without either, good recovery is still encouraged.
    expect(
      buildCandidates(signals({ recovery: RECOVERY.good })).map((c) => c.key)
    ).toEqual(['recovery.well-recovered']);
  });
});
