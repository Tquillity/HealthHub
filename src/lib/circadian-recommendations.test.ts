import { describe, expect, it } from 'vitest';
import {
  bestWindowAdvice,
  buildCircadianInsights,
  detectBestWindow,
  ENERGY_HISTORY_DAYS,
  energyNowFrom,
  intensityLabel,
  isLowEnergy,
  leadingEarlyEstimate,
  LOW_ENERGY_RATING,
  localTimeIn,
  lowCheckInToday,
  lotteryHintFromInsights,
  lotteryTargetFromInsights,
  MAX_SUGGESTIONS,
  mealFocusForMoment,
  momentForHour,
  routineIntensityTarget,
  slotForWindow,
  summarizeSlotEnergy,
  typicalIntensityForHour,
  windowForHour,
  type SlotEnergySummary,
  type TimeOfDayEnergyRow,
} from './circadian-recommendations';
import type { TakeItEasy } from './briefing/types';
import { addDaysToDateOnly } from './date-only';

function row(
  date: string,
  morning: number | null,
  afternoon: number | null,
  evening: number | null
): TimeOfDayEnergyRow {
  return {
    date,
    energyMorning: morning,
    energyAfternoon: afternoon,
    energyEvening: evening,
  };
}

/** `days` consecutive days ending on `today`, each with the same ratings. */
function history(
  today: string,
  days: number,
  ratings: [number | null, number | null, number | null]
): TimeOfDayEnergyRow[] {
  return Array.from({ length: days }, (_, i) =>
    row(addDaysToDateOnly(today, -i), ...ratings)
  );
}

describe('localTimeIn', () => {
  it('reads the wall clock in the profile time zone', () => {
    // 05:30 UTC on a winter day is 06:30 in Stockholm (UTC+1).
    expect(
      localTimeIn(new Date('2026-11-20T05:30:00Z'), 'Europe/Stockholm')
    ).toEqual({
      dateKey: '2026-11-20',
      hour: 6,
      minute: 30,
      timeZone: 'Europe/Stockholm',
      timeZoneValid: true,
    });
  });

  it('uses the local calendar day, not the UTC one', () => {
    // 03:30 UTC is still the previous evening in New York (UTC-5).
    expect(
      localTimeIn(new Date('2026-11-20T03:30:00Z'), 'America/New_York')
    ).toMatchObject({ dateKey: '2026-11-19', hour: 22, minute: 30 });
  });

  it('follows daylight saving time', () => {
    // Stockholm is UTC+2 in summer.
    expect(
      localTimeIn(new Date('2026-07-01T10:00:00Z'), 'Europe/Stockholm')
    ).toMatchObject({ hour: 12 });
  });

  it('reports midnight as hour 0', () => {
    expect(localTimeIn(new Date('2026-11-20T00:05:00Z'), 'UTC')).toMatchObject({
      dateKey: '2026-11-20',
      hour: 0,
      minute: 5,
    });
  });

  it('falls back to UTC for an unknown or empty time zone', () => {
    for (const zone of ['Mars/Olympus_Mons', '', 'not a zone']) {
      expect(localTimeIn(new Date('2026-11-20T14:45:00Z'), zone)).toMatchObject(
        {
          hour: 14,
          minute: 45,
          timeZone: 'UTC',
          timeZoneValid: false,
        }
      );
    }
  });
});

describe('windows and moments', () => {
  it('maps hours to the morning, afternoon, evening and night windows', () => {
    const expected: [number, string][] = [
      [0, 'night'],
      [5, 'night'],
      [6, 'morning'],
      [11, 'morning'],
      [12, 'afternoon'],
      [17, 'afternoon'],
      [18, 'evening'],
      [21, 'evening'],
      [22, 'night'],
      [23, 'night'],
    ];
    for (const [hour, window] of expected) {
      expect(windowForHour(hour)).toBe(window);
    }
  });

  it('has no check-in slot at night', () => {
    expect(slotForWindow('night')).toBeNull();
    expect(slotForWindow('afternoon')).toBe('afternoon');
  });

  it('splits the morning and afternoon into early and late parts', () => {
    expect(momentForHour(7)).toBe('early-morning');
    expect(momentForHour(9)).toBe('late-morning');
    expect(momentForHour(13)).toBe('early-afternoon');
    expect(momentForHour(15)).toBe('late-afternoon');
    expect(momentForHour(19)).toBe('evening');
    expect(momentForHour(3)).toBe('night');
  });
});

describe('summarizeSlotEnergy', () => {
  const today = '2026-11-20';

  it('averages each slot over the last 30 days only', () => {
    const rows = [
      row(today, 8, 5, null),
      row('2026-11-19', 6, null, 3),
      // Day 30 counts, day 31 does not.
      row(addDaysToDateOnly(today, -(ENERGY_HISTORY_DAYS - 1)), 7, null, null),
      row(addDaysToDateOnly(today, -ENERGY_HISTORY_DAYS), 1, 1, 1),
      // Future rows (another time zone's tomorrow) are ignored.
      row('2026-11-21', 1, 1, 1),
    ];
    expect(summarizeSlotEnergy(rows, today)).toEqual({
      morning: { average: 7, count: 3, personalized: false },
      afternoon: { average: 5, count: 1, personalized: false },
      evening: { average: 3, count: 1, personalized: false },
    });
  });

  it('personalises a slot from 5 check-ins and rounds to one decimal', () => {
    const rows = [
      ...history(today, 4, [7, null, null]),
      row('2026-11-01', 8, null, null),
      row('2026-11-02', null, 4, null),
    ];
    const summary = summarizeSlotEnergy(rows, today);
    expect(summary.morning).toEqual({
      average: 7.2,
      count: 5,
      personalized: true,
    });
    expect(summary.afternoon.personalized).toBe(false);
    expect(summary.evening).toEqual({
      average: null,
      count: 0,
      personalized: false,
    });
  });

  it('ignores values outside the 1-10 scale', () => {
    const rows = [row(today, 0, 11, 2.5), row('2026-11-19', 5, null, null)];
    expect(summarizeSlotEnergy(rows, today).morning).toEqual({
      average: 5,
      count: 1,
      personalized: false,
    });
  });
});

describe('detectBestWindow', () => {
  const slot = (average: number | null, count: number) => ({
    average,
    count,
    personalized: count >= 5,
  });

  it('needs at least two personalised slots', () => {
    const summary: SlotEnergySummary = {
      morning: slot(9, 10),
      afternoon: slot(4, 4),
      evening: slot(null, 0),
    };
    expect(detectBestWindow(summary)).toBeNull();
  });

  it('picks the highest slot when it leads by at least half a point', () => {
    expect(
      detectBestWindow({
        morning: slot(6.5, 6),
        afternoon: slot(7, 5),
        evening: slot(4, 8),
      })
    ).toBe('afternoon');
  });

  it('reports no best window when the top two are too close', () => {
    expect(
      detectBestWindow({
        morning: slot(6.6, 6),
        afternoon: slot(7, 5),
        evening: slot(4, 8),
      })
    ).toBeNull();
  });

  it('names no best window while a slot with fewer check-ins looks as high', () => {
    // The journal shows the evening's 9/10 next to the morning's 7/10.
    const higher: SlotEnergySummary = {
      morning: slot(7, 6),
      afternoon: slot(6, 6),
      evening: slot(9, 3),
    };
    expect(leadingEarlyEstimate(higher)).toBe('evening');
    expect(detectBestWindow(higher)).toBeNull();

    const level = { ...higher, evening: slot(7, 2) };
    expect(leadingEarlyEstimate(level)).toBe('evening');
    expect(detectBestWindow(level)).toBeNull();

    const lower = { ...higher, evening: slot(6.9, 3) };
    expect(leadingEarlyEstimate(lower)).toBeNull();
    expect(detectBestWindow(lower)).toBe('morning');
  });

  it('has no leading early estimate without a personalised slot to compare', () => {
    expect(
      leadingEarlyEstimate({
        morning: slot(9, 3),
        afternoon: slot(null, 0),
        evening: slot(4, 1),
      })
    ).toBeNull();
  });
});

describe('routine intensity', () => {
  it('favours harder sessions late morning and late afternoon, recovery later', () => {
    expect(typicalIntensityForHour(7)).toBe(1.5);
    expect(typicalIntensityForHour(10)).toBe(2);
    expect(typicalIntensityForHour(13)).toBe(0.5);
    expect(typicalIntensityForHour(16)).toBe(2);
    expect(typicalIntensityForHour(20)).toBe(0);
    expect(typicalIntensityForHour(2)).toBe(0);
  });

  it('pulls the target halfway towards how the user feels', () => {
    expect(routineIntensityTarget(10, null)).toBe(2);
    // Energy 1/10 = intensity 0: a tired late morning lands on medium.
    expect(routineIntensityTarget(10, 1)).toBe(1);
    expect(intensityLabel(routineIntensityTarget(10, 1))).toBe('medium');
    // Energy 10/10 in the evening: medium, never high.
    expect(routineIntensityTarget(20, 10)).toBe(1);
    // Out-of-range input is clamped.
    expect(routineIntensityTarget(20, 50)).toBe(1);
  });

  it('labels the 0-2 scale, halfway values with the lighter label', () => {
    expect(intensityLabel(-1)).toBe('low');
    expect(intensityLabel(0)).toBe('low');
    expect(intensityLabel(0.4)).toBe('low');
    expect(intensityLabel(0.5)).toBe('low');
    expect(intensityLabel(0.6)).toBe('medium');
    expect(intensityLabel(1)).toBe('medium');
    expect(intensityLabel(1.5)).toBe('medium');
    expect(intensityLabel(1.5000000000000002)).toBe('medium');
    expect(intensityLabel(1.6)).toBe('high');
    expect(intensityLabel(5)).toBe('high');
  });

  it('gives just-above-halfway targets the heavier label', () => {
    expect(intensityLabel(0.5000000000000001)).toBe('low');
    expect(intensityLabel(0.52)).toBe('medium');
    expect(intensityLabel(0.549)).toBe('medium');
    expect(intensityLabel(1.4999999999999998)).toBe('medium');
    expect(intensityLabel(1.51)).toBe('high');
    expect(intensityLabel(1.53)).toBe('high');
    expect(intensityLabel(1.549)).toBe('high');
  });

  it('labels a high early-morning check-in high, next to its suggestion', () => {
    // 07:15 with 8/10 this morning: (1.5 + 14/9) / 2 is about 1.53.
    const insights = buildCircadianInsights({
      now: new Date('2026-11-20T07:15:00Z'),
      timeZone: 'UTC',
      rows: [row('2026-11-20', 8, null, null)],
    });
    expect(insights.intensityTarget).toBeCloseTo(1.528, 3);
    expect(insights.suggestions[0].key).toBe('personal.high-now');
    expect(insights.recommendedIntensity).toBe('high');
    expect(lotteryHintFromInsights(insights).recommendedIntensity).toBe('high');
  });

  it('labels a personal usual just above halfway with the heavier label', () => {
    // No check-in today: a usual morning of 8/10 at 07:00 is high.
    const early = buildCircadianInsights({
      now: new Date('2026-11-20T07:00:00Z'),
      timeZone: 'UTC',
      rows: history('2026-11-19', 6, [8, 5, 5]),
    });
    expect(early.currentEnergy).toBeNull();
    expect(early.recommendedIntensity).toBe('high');
    // A usual late morning of 5.6/10 is high; exactly 5.5/10 is halfway, so medium.
    const usual = (morning: number[]) =>
      buildCircadianInsights({
        now: new Date('2026-11-20T10:00:00Z'),
        timeZone: 'UTC',
        rows: morning.map((rating, i) =>
          row(addDaysToDateOnly('2026-11-19', -i), rating, null, null)
        ),
      });
    expect(usual([6, 6, 6, 5, 5]).slots.morning.average).toBe(5.6);
    expect(usual([6, 6, 6, 5, 5]).recommendedIntensity).toBe('high');
    expect(usual([6, 6, 6, 5, 5, 5]).slots.morning.average).toBe(5.5);
    expect(usual([6, 6, 6, 5, 5, 5]).recommendedIntensity).toBe('medium');
  });

  it("matches the label to the moment's suggestions without a check-in", () => {
    const at = (utc: string) =>
      buildCircadianInsights({ now: new Date(utc), timeZone: 'UTC', rows: [] });

    // 07:00: harder sessions feel best from late morning, so not high yet.
    const early = at('2026-11-20T07:00:00Z');
    expect(early.suggestions.map((s) => s.key)).toContain('morning.warm-up');
    expect(early.recommendedIntensity).toBe('medium');
    expect(lotteryHintFromInsights(early).recommendedIntensity).toBe('medium');

    // 13:00: the dip suggestion offers a low-energy routine.
    const dip = at('2026-11-20T13:00:00Z');
    const dipText = dip.suggestions.find((s) => s.key === 'afternoon.dip');
    expect(dipText?.body).toContain('low-energy routine');
    expect(dip.recommendedIntensity).toBe('low');

    // Late morning and late afternoon stay high; the evening stays low.
    expect(at('2026-11-20T10:00:00Z').recommendedIntensity).toBe('high');
    expect(at('2026-11-20T16:00:00Z').recommendedIntensity).toBe('high');
    expect(at('2026-11-20T19:00:00Z').recommendedIntensity).toBe('low');
  });
});

describe('mealFocusForMoment', () => {
  it('suggests breakfast in the morning and a lighter dinner from late afternoon', () => {
    expect(mealFocusForMoment('early-morning')).toBe('protein-breakfast');
    expect(mealFocusForMoment('late-morning')).toBe('protein-breakfast');
    expect(mealFocusForMoment('early-afternoon')).toBeNull();
    expect(mealFocusForMoment('late-afternoon')).toBe('light-dinner');
    expect(mealFocusForMoment('evening')).toBe('light-dinner');
    expect(mealFocusForMoment('night')).toBeNull();
  });
});

describe('buildCircadianInsights', () => {
  /** A take-it-easy day the daily briefing explains with the recent logs. */
  const EASY_DAY: TakeItEasy = { fromLogs: true, maxRoutineEnergy: 'medium' };
  // 09:30 UTC = 10:30 in Stockholm (late morning).
  const lateMorning = new Date('2026-11-20T09:30:00Z');
  const zone = 'Europe/Stockholm';

  it('gives typical suggestions for the window without any check-ins', () => {
    const insights = buildCircadianInsights({
      now: lateMorning,
      timeZone: zone,
      rows: [],
    });
    expect(insights).toMatchObject({
      dateKey: '2026-11-20',
      localTime: '10:30',
      hour: 10,
      timeZone: zone,
      timeZoneFallback: false,
      window: 'morning',
      moment: 'late-morning',
      slot: 'morning',
      todayEnergy: { morning: null, afternoon: null, evening: null },
      currentEnergy: null,
      bestWindow: null,
      intensityTarget: 2,
      recommendedIntensity: 'high',
      mealFocus: 'protein-breakfast',
    });
    expect(insights.suggestions.map((s) => s.key)).toEqual([
      'morning.training',
      'morning.hormones',
      'morning.light',
    ]);
  });

  it("uses today's check-in for the current slot", () => {
    const insights = buildCircadianInsights({
      now: lateMorning,
      timeZone: zone,
      rows: [row('2026-11-20', 2, null, null), row('2026-11-19', 9, 9, 9)],
    });
    expect(insights.todayEnergy).toEqual({
      morning: 2,
      afternoon: null,
      evening: null,
    });
    expect(insights.currentEnergy).toBe(2);
    expect(insights.recommendedIntensity).toBe('medium');
    // Low energy: a gentle note first and no push for a hard session.
    const keys = insights.suggestions.map((s) => s.key);
    expect(keys[0]).toBe('personal.low-now');
    expect(keys).not.toContain('morning.training');
    expect(insights.suggestions[0].body).toContain('2/10 this morning');
  });

  it('encourages a harder session on a high-energy morning, not in the evening', () => {
    const morning = buildCircadianInsights({
      now: lateMorning,
      timeZone: zone,
      rows: [row('2026-11-20', 9, null, null)],
    });
    expect(morning.suggestions[0].key).toBe('personal.high-now');

    const evening = buildCircadianInsights({
      // 19:00 in Stockholm
      now: new Date('2026-11-20T18:00:00Z'),
      timeZone: zone,
      rows: [row('2026-11-20', null, null, 9)],
    });
    expect(evening.window).toBe('evening');
    expect(evening.suggestions.map((s) => s.key)).not.toContain(
      'personal.high-now'
    );
    expect(evening.suggestions[0].key).toBe('evening.recovery');
  });

  it("falls back to the user's usual energy for the slot for the routine target", () => {
    const rows = history('2026-11-19', 6, [2, 7, 5]);
    const insights = buildCircadianInsights({
      now: lateMorning,
      timeZone: zone,
      rows,
    });
    expect(insights.currentEnergy).toBeNull();
    // Usual morning energy 2/10 pulls the high late-morning target down.
    expect(insights.intensityTarget).toBeCloseTo((2 + 2 / 9) / 2);
  });

  it('points to the personal best window once there is enough data', () => {
    const rows = history('2026-11-19', 6, [5, 8, 4]);
    const now = buildCircadianInsights({
      now: lateMorning,
      timeZone: zone,
      rows,
    });
    expect(now.bestWindow).toBe('afternoon');
    const best = now.suggestions.find((s) => s.key === 'personal.best-later');
    expect(best?.title).toBe('Your best window is the afternoon');
    expect(best?.body).toContain('8/10 in the afternoon');
    expect(best?.body).toContain('compared with 5/10 in the morning');

    const afternoon = buildCircadianInsights({
      now: new Date('2026-11-20T15:30:00Z'),
      timeZone: zone,
      rows,
    });
    expect(afternoon.suggestions[0].key).toBe('personal.best-now');
    expect(afternoon.suggestions[0].body).toContain(
      bestWindowAdvice('afternoon', 'now')
    );
  });

  it('points past the early-afternoon dip instead of calling it the best time now', () => {
    const rows = history('2026-11-19', 6, [5, 8, 4]);
    // 14:30 in Stockholm: the dip, inside an afternoon best window.
    const dip = buildCircadianInsights({
      now: new Date('2026-11-20T13:30:00Z'),
      timeZone: zone,
      rows,
    });
    expect(dip.moment).toBe('early-afternoon');
    const bestNow = dip.suggestions.find((s) => s.key === 'personal.best-now');
    expect(bestNow?.body).toBe(
      'Over the last 30 days your afternoon energy has averaged 8/10, your highest of the day. Later this afternoon, after the usual early dip, is a good time for your most demanding tasks or training.'
    );
    expect(bestNow?.body).not.toContain(bestWindowAdvice('afternoon', 'now'));
  });

  it('shows the best window without a training push right after a low rating', () => {
    // Mornings usually 8 and afternoons 5, but today's morning check-in is 2/10.
    const rows = [
      ...history('2026-11-19', 6, [8, 5, null]),
      row('2026-11-20', 2, null, null),
    ];
    const now = buildCircadianInsights({
      now: lateMorning,
      timeZone: zone,
      rows,
    });
    expect(now.bestWindow).toBe('morning');
    const keys = now.suggestions.map((s) => s.key);
    expect(keys.slice(0, 2)).toEqual(['personal.low-now', 'personal.best-now']);
    const bestNow = now.suggestions[1];
    expect(bestNow.body).toBe(
      'Over the last 30 days your morning energy has averaged 7.1/10, your highest of the day.'
    );
    for (const suggestion of now.suggestions.slice(1)) {
      expect(suggestion.body).not.toMatch(/training|demanding/i);
    }

    // The same low rating with the best window later in the day.
    const later = buildCircadianInsights({
      now: lateMorning,
      timeZone: zone,
      rows: [
        ...history('2026-11-19', 6, [5, 8, null]),
        row('2026-11-20', 2, null, null),
      ],
    });
    const bestLater = later.suggestions.find(
      (s) => s.key === 'personal.best-later'
    );
    expect(bestLater?.body).toBe(
      'Over the last 30 days your energy has averaged 8/10 in the afternoon, compared with 4.6/10 in the morning.'
    );
  });

  it('holds back harder training on a day the briefing calls a take-it-easy day', () => {
    // 16:10 in Stockholm: late afternoon, usually the time for harder sessions.
    const lateAfternoon = new Date('2026-11-20T15:10:00Z');
    const usual = buildCircadianInsights({
      now: lateAfternoon,
      timeZone: zone,
      rows: [],
    });
    expect(usual.suggestions.map((s) => s.key)).toContain('afternoon.training');
    expect(usual.recommendedIntensity).toBe('high');

    const easy = buildCircadianInsights({
      now: lateAfternoon,
      timeZone: zone,
      rows: [],
      easyDay: EASY_DAY,
    });
    expect(easy.easyDay).toBe(true);
    expect(easy.suggestions.map((s) => s.key)).toEqual([
      'personal.easy-day',
      'afternoon.caffeine',
    ]);
    expect(easy.suggestions[0]).toMatchObject({
      title: 'A gentler day may suit you',
      body: 'Your recent logs point to an easier day, so harder training is left out for now.',
    });
    // Medium at most, so the lottery leans the same way as the briefing.
    expect(easy.recommendedIntensity).toBe('medium');
    expect(lotteryTargetFromInsights(easy).intensity).toBe(1);
    expect(lotteryHintFromInsights(easy).recommendedIntensity).toBe('medium');
  });

  it('suggests low-energy routines when the briefing suggests rest or going gently', () => {
    // A rest day for low recovery, or going gently for more symptoms: the briefing links
    // to gentle routines, so the card and the lottery lean low, whatever the hour.
    const gentle: TakeItEasy = { fromLogs: true, maxRoutineEnergy: 'low' };
    const afterLowRating = [row('2026-11-20', 2, null, null)];
    for (let hour = 6; hour < 22; hour++) {
      for (const rows of [
        [],
        history('2026-11-19', 6, [9, 9, 9]),
        afterLowRating,
      ]) {
        const insights = buildCircadianInsights({
          now: new Date(Date.UTC(2026, 10, 20, hour, 30)),
          timeZone: 'UTC',
          rows,
          easyDay: gentle,
        });
        expect(insights.recommendedIntensity).toBe('low');
        expect(lotteryTargetFromInsights(insights).intensity).toBe(0);
        expect(lotteryHintFromInsights(insights).recommendedIntensity).toBe(
          'low'
        );
      }
    }
  });

  it('gives no best-window or high-energy push on a take-it-easy day', () => {
    // Mornings usually 8, afternoons 5; 9/10 this morning.
    const rows = [
      ...history('2026-11-19', 6, [8, 5, null]),
      row('2026-11-20', 9, null, null),
    ];
    const easy = buildCircadianInsights({
      now: lateMorning,
      timeZone: zone,
      rows,
      easyDay: EASY_DAY,
    });
    const keys = easy.suggestions.map((s) => s.key);
    expect(keys).toEqual([
      'personal.easy-day',
      'personal.best-now',
      'morning.hormones',
      'morning.light',
    ]);
    for (const suggestion of easy.suggestions) {
      expect(suggestion.body).not.toMatch(/demanding|harder session/i);
    }
    expect(easy.recommendedIntensity).toBe('medium');

    // A low check-in right now already says why: no second note.
    const lowNow = buildCircadianInsights({
      now: lateMorning,
      timeZone: zone,
      rows: [row('2026-11-20', 2, null, null)],
      easyDay: EASY_DAY,
    });
    expect(lowNow.suggestions.map((s) => s.key)).not.toContain(
      'personal.easy-day'
    );
    expect(lowNow.suggestions[0].key).toBe('personal.low-now');

    // Lighter moments keep their lighter target.
    const evening = buildCircadianInsights({
      now: new Date('2026-11-20T18:30:00Z'),
      timeZone: zone,
      rows: [],
      easyDay: EASY_DAY,
    });
    expect(evening.intensityTarget).toBe(0);
  });

  it('reads "right now" the same way for the card and the briefing', () => {
    // Today's check-ins in every slot, in UTC; the card's current energy for every hour.
    const rows = [row('2026-11-20', 2, 6, 9), row('2026-11-19', 1, 1, 1)];
    for (let hour = 0; hour < 24; hour++) {
      const now = new Date(Date.UTC(2026, 10, 20, hour, 30));
      expect(energyNowFrom(rows, now, 'UTC')).toBe(
        buildCircadianInsights({ now, timeZone: 'UTC', rows }).currentEnergy
      );
    }
    expect(energyNowFrom(rows, new Date('2026-11-20T08:00:00Z'), 'UTC')).toBe(
      2
    );
    expect(energyNowFrom(rows, new Date('2026-11-20T23:00:00Z'), 'UTC')).toBe(
      null
    );
    // The profile time zone decides the slot: 08:00 UTC is 03:00 in New York (night, no
    // slot), and 14:00 UTC is 09:00 there, the morning of the 20th.
    expect(
      energyNowFrom(rows, new Date('2026-11-20T08:00:00Z'), 'America/New_York')
    ).toBe(null);
    expect(
      energyNowFrom(rows, new Date('2026-11-20T14:00:00Z'), 'America/New_York')
    ).toBe(2);
    expect(isLowEnergy(LOW_ENERGY_RATING)).toBe(true);
    expect(isLowEnergy(LOW_ENERGY_RATING + 1)).toBe(false);
    expect(isLowEnergy(null)).toBe(false);
  });

  it("holds back the push after a low rating once the next slot starts, until it's rated", () => {
    // Mornings usually 5, afternoons 8; 2/10 this morning, at 11:50.
    const rows = [
      ...history('2026-11-19', 6, [5, 8, null]),
      row('2026-11-20', 2, null, null),
    ];
    const at = (time: string, todayRows = rows) =>
      buildCircadianInsights({
        now: new Date(`2026-11-20T${time}:00Z`),
        timeZone: 'UTC',
        rows: todayRows,
      });
    const pushes = (insights: ReturnType<typeof buildCircadianInsights>) =>
      insights.suggestions.filter((s) =>
        /training|demanding|harder/i.test(`${s.title} ${s.body}`)
      );

    const beforeNoon = at('11:50');
    expect(beforeNoon.suggestions[0].key).toBe('personal.low-now');
    expect(pushes(beforeNoon)).toEqual([]);

    // 12:05: the afternoon slot, not rated yet. The morning's 2/10 may be hours old, so
    // it is not "right now", but there is no push for harder work either.
    const afterNoon = at('12:05');
    expect(afterNoon.currentEnergy).toBeNull();
    expect(afterNoon.suggestions.map((s) => s.key)).not.toContain(
      'personal.low-now'
    );
    expect(afterNoon.suggestions[0].key).toBe('personal.best-now');
    expect(pushes(afterNoon)).toEqual([]);

    // 15:30: past the dip, usually the time for harder sessions. Still unrated, so the
    // card's "Good fit right now" and the lottery stay at medium too.
    const lateAfternoon = at('15:30');
    expect(lateAfternoon.currentEnergy).toBeNull();
    expect(pushes(lateAfternoon)).toEqual([]);
    expect(lateAfternoon.recommendedIntensity).toBe('medium');
    expect(lotteryTargetFromInsights(lateAfternoon).intensity).toBe(1);
    expect(lotteryHintFromInsights(lateAfternoon).recommendedIntensity).toBe(
      'medium'
    );

    // Rating the afternoon brings the push back.
    const ratedRows = [
      ...history('2026-11-19', 6, [5, 8, null]),
      row('2026-11-20', 2, 8, null),
    ];
    const rated = at('12:05', ratedRows);
    expect(pushes(rated).length).toBeGreaterThan(0);
    const ratedLate = at('15:30', ratedRows);
    expect(pushes(ratedLate).length).toBeGreaterThan(0);
    expect(ratedLate.recommendedIntensity).toBe('high');
    expect(lotteryTargetFromInsights(ratedLate).intensity).toBeGreaterThan(1);
    // A fine morning holds nothing back.
    const fineMorning = at('12:05', [
      ...history('2026-11-19', 6, [5, 8, null]),
      row('2026-11-20', 6, null, null),
    ]);
    expect(pushes(fineMorning).length).toBeGreaterThan(0);

    // The daily briefing takes it easy after the same check-in. The recent logs are not
    // why, so the card adds no "your recent logs" note and holds back as before.
    const withBriefing = buildCircadianInsights({
      now: new Date('2026-11-20T15:30:00Z'),
      timeZone: 'UTC',
      rows,
      easyDay: { fromLogs: false, maxRoutineEnergy: 'medium' },
    });
    expect(withBriefing.suggestions).toEqual(lateAfternoon.suggestions);
    expect(withBriefing.intensityTarget).toBe(lateAfternoon.intensityTarget);
  });

  it('has one rule for a low check-in today, "now" or "earlier", for the card and the briefing', () => {
    const at = (time: string) => new Date(`2026-11-20T${time}:00Z`);
    const today = (
      morning: number | null,
      afternoon: number | null,
      evening: number | null
    ) => [
      row('2026-11-19', 1, 1, 1),
      row('2026-11-20', morning, afternoon, evening),
    ];

    // The current slot's own rating decides, low or not.
    expect(lowCheckInToday(today(9, 2, null), at('12:00'), 'UTC')).toBe('now');
    expect(lowCheckInToday(today(2, 7, null), at('12:00'), 'UTC')).toBeNull();
    // Until the current slot is rated, today's most recent earlier rating decides.
    expect(lowCheckInToday(today(2, null, null), at('11:59'), 'UTC')).toBe(
      'now'
    );
    expect(lowCheckInToday(today(2, null, null), at('12:00'), 'UTC')).toBe(
      'earlier'
    );
    expect(lowCheckInToday(today(2, null, null), at('18:30'), 'UTC')).toBe(
      'earlier'
    );
    expect(lowCheckInToday(today(2, 7, null), at('18:30'), 'UTC')).toBeNull();
    expect(lowCheckInToday(today(7, 2, null), at('18:30'), 'UTC')).toBe(
      'earlier'
    );
    expect(
      lowCheckInToday(today(6, null, null), at('12:00'), 'UTC')
    ).toBeNull();
    // Yesterday's ratings never count, and the night has no slot.
    expect(
      lowCheckInToday([row('2026-11-19', 1, 1, 1)], at('12:00'), 'UTC')
    ).toBeNull();
    expect(lowCheckInToday(today(2, 2, 2), at('22:00'), 'UTC')).toBeNull();
    expect(lowCheckInToday(today(2, 2, 2), at('05:59'), 'UTC')).toBeNull();
    // The profile time zone decides the slot: 18:30 UTC is the UTC evening, but 10:30 in
    // Los Angeles, the morning of the 20th.
    expect(lowCheckInToday(today(2, null, 7), at('18:30'), 'UTC')).toBeNull();
    expect(
      lowCheckInToday(today(2, null, 7), at('18:30'), 'America/Los_Angeles')
    ).toBe('now');

    // The card holds back on exactly this rule, and says "right now" only for 'now'.
    for (const rows of [
      today(2, null, null),
      today(2, 7, null),
      today(7, 2, null),
      today(9, null, 2),
      today(null, null, null),
    ]) {
      for (let hour = 0; hour < 24; hour++) {
        const now = new Date(Date.UTC(2026, 10, 20, hour, 30));
        const insights = buildCircadianInsights({ now, timeZone: 'UTC', rows });
        const kind = lowCheckInToday(rows, now, 'UTC');
        expect(insights.lowCheckIn).toBe(kind);
        expect(
          insights.suggestions.some((s) => s.key === 'personal.low-now')
        ).toBe(kind === 'now');
        if (kind !== null) {
          expect(insights.intensityTarget).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('never pushes hard training for an evening best window', () => {
    const rows = history('2026-11-19', 6, [5, 5, 8]);
    // 21:30 in Stockholm: late in the evening, the best window.
    const evening = buildCircadianInsights({
      now: new Date('2026-11-20T20:30:00Z'),
      timeZone: zone,
      rows,
    });
    expect(evening.bestWindow).toBe('evening');
    const bestNow = evening.suggestions.find(
      (s) => s.key === 'personal.best-now'
    );
    expect(bestNow?.body).toContain('keep hard training well before bed');
    for (const suggestion of evening.suggestions) {
      expect(suggestion.body).not.toMatch(
        /most demanding|harder training|demanding tasks/i
      );
    }

    // Earlier in the day, the pointer to the evening does not plan hard training either.
    const morning = buildCircadianInsights({
      now: lateMorning,
      timeZone: zone,
      rows,
    });
    const bestLater = morning.suggestions.find(
      (s) => s.key === 'personal.best-later'
    );
    expect(bestLater?.body).toContain(bestWindowAdvice('evening', 'later'));
    expect(bestLater?.body).not.toMatch(/harder training|demanding tasks/i);
  });

  it('names no best window on the card while an early estimate looks higher', () => {
    // Morning 7 and afternoon 6 from 6 check-ins each, evening 9 from 3.
    const rows = history('2026-11-19', 6, [7, 6, null]).map((r, i) =>
      i < 3 ? { ...r, energyEvening: 9 } : r
    );
    const insights = buildCircadianInsights({
      now: lateMorning,
      timeZone: zone,
      rows,
    });
    expect(insights.slots.evening).toEqual({
      average: 9,
      count: 3,
      personalized: false,
    });
    expect(insights.bestWindow).toBeNull();
    expect(
      insights.suggestions.filter((s) => s.key.startsWith('personal.best'))
    ).toEqual([]);
  });

  it('keeps the night calm: wind-down only, no check-in slot or meal nudge', () => {
    const insights = buildCircadianInsights({
      // 23:30 in Stockholm
      now: new Date('2026-11-20T22:30:00Z'),
      timeZone: zone,
      rows: history('2026-11-20', 6, [5, 8, 4]),
    });
    expect(insights).toMatchObject({
      window: 'night',
      slot: null,
      currentEnergy: null,
      mealFocus: null,
      recommendedIntensity: 'low',
    });
    expect(insights.suggestions.map((s) => s.key)).toEqual([
      'night.wind-down',
      'night.dark-cool',
    ]);
  });

  it('shows at most a few suggestions', () => {
    const insights = buildCircadianInsights({
      now: new Date('2026-11-20T06:30:00Z'),
      timeZone: zone,
      rows: [
        ...history('2026-11-19', 6, [5, 8, 4]),
        row('2026-11-20', 9, null, null),
      ],
    });
    expect(insights.suggestions.length).toBe(MAX_SUGGESTIONS);
  });

  it('flags an invalid profile time zone and uses UTC', () => {
    const insights = buildCircadianInsights({
      now: lateMorning,
      timeZone: 'Somewhere/Else',
      rows: [],
    });
    expect(insights).toMatchObject({
      timeZone: 'UTC',
      timeZoneFallback: true,
      localTime: '09:30',
    });
  });

  it('keeps every suggestion non-diagnostic', () => {
    const texts: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
      const now = new Date(Date.UTC(2026, 10, 20, hour, 0));
      for (const rows of [
        [],
        [row('2026-11-20', 2, 2, 2)],
        history('2026-11-20', 6, [9, 5, 3]),
      ]) {
        const insights = buildCircadianInsights({ now, timeZone: 'UTC', rows });
        texts.push(...insights.suggestions.flatMap((s) => [s.title, s.body]));
      }
    }
    for (const text of texts) {
      expect(text).not.toMatch(/diagnos|deficien|disorder|treat|cure|low t\b/i);
    }
  });

  it('exposes the lottery target', () => {
    const insights = buildCircadianInsights({
      now: lateMorning,
      timeZone: zone,
      rows: [],
    });
    expect(lotteryTargetFromInsights(insights)).toEqual({
      window: 'morning',
      intensity: 2,
    });
    expect(lotteryHintFromInsights(insights)).toEqual({
      windowLabel: 'Morning',
      recommendedIntensity: 'high',
    });
  });
});
