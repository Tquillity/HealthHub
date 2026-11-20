import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { addDaysToDateOnly } from './date-only';
import { buildDailyBriefing, takeItEasyOf } from './briefing/engine';
import type { BriefingJournalDay } from './briefing/types';
import {
  bestWindowAdvice,
  buildCircadianInsights,
  ENERGY_SLOTS,
  localTimeIn,
  lowCheckInToday,
  type TimeOfDayEnergyRow,
} from './circadian-recommendations';

// Recipe ideas on the circadian card follow the active space cookie; none here.
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}));

const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = Boolean(
  url &&
  ['localhost', '127.0.0.1'].includes(url.hostname) &&
  url.pathname === '/healthhub_e2e'
);

const TODAY = '2026-11-20';
const GENTLER =
  "A gentler day may suit you. Here's what your recent logs suggest.";
/** The gentler headline when a low check-in right now is the only reason. */
const LOW_NOW =
  'You rated your energy as low right now, so this briefing keeps things gentle.';
/** The same for a low check-in from an earlier slot, the current one not rated yet. */
const LOW_EARLIER =
  'You rated your energy as low earlier today, so this briefing keeps things gentle.';
const GENTLE_HEADLINES = [GENTLER, LOW_NOW, LOW_EARLIER];
const DOING_WELL =
  "You've been doing well lately. Here's how to make the most of it.";
/** Circadian card suggestions that push harder work. */
const CARD_PUSH = [
  'morning.warm-up',
  'morning.training',
  'afternoon.training-later',
  'afternoon.training',
  'personal.high-now',
];
/** Briefing suggestions that push harder work. */
const BRIEFING_PUSH = ['routine.go-for-it', 'recovery.well-recovered'];

function days(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDaysToDateOnly(d, 1)) out.push(d);
  return out;
}

type DayValues = { energy: number; sleepHours: number; symptoms?: string[] };

/** Four weeks of usual days, then the last 3 days (the briefing's window). */
function journal(usual: DayValues, recent: DayValues): BriefingJournalDay[] {
  const day = (date: string, values: DayValues): BriefingJournalDay => ({
    date,
    mood: null,
    symptoms: [],
    checkIn: true,
    ...values,
  });
  return [
    ...days('2026-10-21', '2026-11-17').map((date) => day(date, usual)),
    ...days('2026-11-18', TODAY).map((date) => day(date, recent)),
  ];
}

const JOURNALS = {
  none: [],
  goodWeek: journal({ energy: 5, sleepHours: 8 }, { energy: 8, sleepHours: 8 }),
  lowWeek: journal({ energy: 7, sleepHours: 8 }, { energy: 3, sleepHours: 8 }),
  shortSleep: journal(
    { energy: 6, sleepHours: 8 },
    { energy: 6, sleepHours: 5 }
  ),
  moreSymptoms: journal(
    { energy: 6, sleepHours: 8, symptoms: [] },
    { energy: 6, sleepHours: 8, symptoms: ['Cramps', 'Headache', 'Fatigue'] }
  ),
} satisfies Record<string, BriefingJournalDay[]>;

type TodayCheckIns = [number | null, number | null, number | null];

/** A usual time-of-day pattern (afternoons best) and today's morning, afternoon and evening. */
function checkIns(today: TodayCheckIns | null): TimeOfDayEnergyRow[] {
  const pattern = days('2026-11-14', '2026-11-19').map((date) => ({
    date,
    energyMorning: 5,
    energyAfternoon: 8,
    energyEvening: 4,
  }));
  if (today === null) return pattern;
  const [energyMorning, energyAfternoon, energyEvening] = today;
  return [
    ...pattern,
    { date: TODAY, energyMorning, energyAfternoon, energyEvening },
  ];
}

/** The briefing and the circadian card for the same user, inputs and moment. */
function dashboard(
  journalDays: BriefingJournalDay[],
  rows: TimeOfDayEnergyRow[],
  now: Date
) {
  const timeZone = 'UTC';
  const inputs = {
    today: localTimeIn(now, timeZone).dateKey,
    journal: journalDays,
    cycle: null,
    vitals: null,
    lowEnergyToday: lowCheckInToday(rows, now, timeZone),
  };
  const briefing = buildDailyBriefing({
    ...inputs,
    focus: 'both',
    detail: 'detailed',
    meals: null,
    feedback: [],
  });
  const card = buildCircadianInsights({
    now,
    timeZone,
    rows,
    easyDay: takeItEasyOf(inputs),
  });
  return {
    briefing,
    keys: briefing.suggestions.map((s) => s.key),
    card,
    cardKeys: card.suggestions.map((s) => s.key),
  };
}

describe('the daily briefing and the circadian card agree', () => {
  const at = (hour: number) => new Date(Date.UTC(2026, 10, 20, hour, 30));

  it('fixes both directions on the same dashboard', () => {
    // A good week, then 2/10 on the circadian card at 10:30: the briefing goes gentle.
    const lowNow = dashboard(JOURNALS.goodWeek, checkIns([2, 2, 2]), at(10));
    expect(lowNow.cardKeys[0]).toBe('personal.low-now');
    expect(lowNow.briefing.headline).toBe(LOW_NOW);
    expect(lowNow.keys).not.toContain('routine.go-for-it');

    // A low week in the briefing at 16:30: the card pushes no harder training.
    const easy = dashboard(JOURNALS.lowWeek, checkIns(null), at(16));
    expect(easy.briefing.headline).toBe(GENTLER);
    expect(easy.cardKeys[0]).toBe('personal.easy-day');
    expect(easy.cardKeys).not.toContain('afternoon.training');
    expect(easy.card.recommendedIntensity).toBe('medium');
  });

  it('never has one card say "go gently" while the other says "train harder"', () => {
    const advice = ENERGY_SLOTS.flatMap((slot) => [
      bestWindowAdvice(slot, 'now'),
      bestWindowAdvice(slot, 'later'),
    ]).filter((text) => /demanding|harder/.test(text));
    let gentle = 0;
    let pushing = 0;
    let gentleRoutines = 0;
    const todays: (TodayCheckIns | null)[] = [
      null,
      [2, 2, 2],
      [6, 6, 6],
      [9, 9, 9],
      // A low morning, then the afternoon not rated yet, rated fine, or rated low.
      [2, null, null],
      [2, 7, null],
      [9, 2, null],
    ];
    for (const journalDays of Object.values(JOURNALS)) {
      for (const today of todays) {
        for (const hour of [7, 10, 13, 16, 19, 23]) {
          const { briefing, keys, card, cardKeys } = dashboard(
            journalDays,
            checkIns(today),
            at(hour)
          );
          const label = JSON.stringify({ today, hour, keys, cardKeys });
          if (GENTLE_HEADLINES.includes(briefing.headline)) {
            gentle += 1;
            expect(
              cardKeys.filter((k) => CARD_PUSH.includes(k)),
              label
            ).toEqual([]);
            for (const suggestion of card.suggestions) {
              for (const text of advice) {
                expect(suggestion.body, label).not.toContain(text);
              }
            }
            expect(card.recommendedIntensity, label).not.toBe('high');
          }
          // The card holds back after a low check-in today or on a take-it-easy day.
          if (
            card.lowCheckIn !== null ||
            card.easyDay ||
            cardKeys.includes('personal.low-now') ||
            cardKeys.includes('personal.easy-day')
          ) {
            expect(GENTLE_HEADLINES, label).toContain(briefing.headline);
            expect(
              keys.filter((k) => BRIEFING_PUSH.includes(k)),
              label
            ).toEqual([]);
          }
          // "Right now" only for a rating of the current slot.
          if (briefing.headline === LOW_NOW) {
            expect(cardKeys[0], label).toBe('personal.low-now');
          }
          // A rest day or going gently links to gentle routines: the card leans low too.
          if (
            keys.includes('recovery.rest-day') ||
            keys.includes('recovery.gentle-symptoms')
          ) {
            gentleRoutines += 1;
            expect(card.recommendedIntensity, label).toBe('low');
          }
          if (keys.includes('routine.go-for-it')) {
            pushing += 1;
            expect(briefing.headline, label).toBe(DOING_WELL);
          }
        }
      }
    }
    expect(gentle).toBeGreaterThan(0);
    expect(pushing).toBeGreaterThan(0);
    expect(gentleRoutines).toBeGreaterThan(0);
  });
});

describe('module graph', () => {
  const src = path.resolve(__dirname, '..');
  const lib = path.join(src, 'lib');
  const cache = new Map<string, string[]>();

  function resolveImport(from: string, spec: string): string | null {
    let base: string;
    if (spec.startsWith('@/')) base = path.join(src, spec.slice(2));
    else if (spec.startsWith('.'))
      base = path.resolve(path.dirname(from), spec);
    else return null;
    for (const candidate of [
      `${base}.ts`,
      `${base}.tsx`,
      path.join(base, 'index.ts'),
    ]) {
      if (existsSync(candidate)) return candidate;
    }
    return null;
  }

  function importsOf(file: string): string[] {
    const cached = cache.get(file);
    if (cached) return cached;
    const source = readFileSync(file, 'utf8');
    const found = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].flatMap(
      ([, spec]) => resolveImport(file, spec) ?? []
    );
    cache.set(file, found);
    return found;
  }

  function reachableFrom(start: string): Set<string> {
    const seen = new Set<string>();
    const queue = [...importsOf(start)];
    while (queue.length > 0) {
      const next = queue.pop() as string;
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(...importsOf(next));
    }
    return seen;
  }

  it('has no import cycle through the briefing, circadian and easy-day modules', () => {
    const modules = [
      ...readdirSync(path.join(lib, 'briefing')).map((f) =>
        path.join(lib, 'briefing', f)
      ),
      ...readdirSync(lib)
        .filter((f) => f.startsWith('circadian-'))
        .map((f) => path.join(lib, f)),
      path.join(lib, 'easy-day.ts'),
    ].filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    expect(modules.length).toBeGreaterThan(10);
    for (const file of modules) {
      expect(reachableFrom(file).has(file), path.relative(src, file)).toBe(
        false
      );
    }
  });
});

describe.skipIf(!isolated)(
  'take-it-easy days on the dashboard against isolated PostgreSQL',
  () => {
    const run = randomUUID().slice(0, 8);
    const userId = `easy-${run}`;
    /** `HH:mm` today in Stockholm (UTC+1 in November). */
    const stockholm = (time: string) => new Date(`${TODAY}T${time}:00+01:00`);
    const morning = stockholm('10:30');
    const afternoon = stockholm('15:30');
    const lateAfternoon = stockholm('16:10');
    let pool: Pool;
    let client: PrismaClient;
    let easyDay: typeof import('./easy-day');
    let briefingData: typeof import('./briefing/data');
    let circadian: typeof import('./circadian-data');

    beforeAll(async () => {
      pool = new Pool({ connectionString: process.env.DATABASE_URL });
      client = new PrismaClient({ adapter: new PrismaPg(pool) });
      easyDay = await import('./easy-day');
      briefingData = await import('./briefing/data');
      circadian = await import('./circadian-data');
      await client.user.create({
        data: { id: userId, name: 'Easy', email: `easy-${run}@example.com` },
      });
    });

    beforeEach(async () => {
      await client.journalEntry.deleteMany({ where: { userId } });
      await client.user.update({
        where: { id: userId },
        data: {
          timezone: 'Europe/Stockholm',
          enableCircadianInsights: true,
          trackVitals: false,
          briefingFrequency: 'daily',
          briefingSources: ['journal', 'cycle', 'meals', 'vitals'],
        },
      });
    });

    afterAll(async () => {
      await client.user.deleteMany({ where: { id: userId } });
      await client.$disconnect();
      await pool.end();
    });

    async function writeJournal(usual: DayValues, recent: DayValues) {
      await client.journalEntry.createMany({
        data: journal(usual, recent).map((entry) => ({
          userId,
          date: new Date(`${entry.date}T00:00:00Z`),
          energy: entry.energy,
          sleepHours: entry.sleepHours,
        })),
      });
    }

    /** Mornings usually 5, afternoons 8 and evenings 4 over the 6 days before today. */
    async function writeCheckInPattern() {
      await client.journalEntry.updateMany({
        where: {
          userId,
          date: {
            gte: new Date('2026-11-14T00:00:00Z'),
            lte: new Date('2026-11-19T00:00:00Z'),
          },
        },
        data: { energyMorning: 5, energyAfternoon: 8, energyEvening: 4 },
      });
    }

    /** What the dashboard's two cards load for the user at `now`. */
    async function loadDashboard(now: Date) {
      const state = await briefingData.loadBriefingState(userId, { now });
      if (state.status !== 'ready') throw new Error(state.status);
      const card = await circadian.loadCircadianCardData(userId, now);
      if (!card) throw new Error('no circadian card');
      return {
        briefing: state.briefing,
        keys: state.briefing.suggestions.map((s) => s.key),
        card: card.insights,
        cardKeys: card.insights.suggestions.map((s) => s.key),
      };
    }

    it('turns the briefing gentle right after a low check-in on the circadian card', async () => {
      await writeJournal(
        { energy: 5, sleepHours: 8 },
        { energy: 8, sleepHours: 8 }
      );
      const before = await loadDashboard(morning);
      expect(before.briefing.headline).toBe(DOING_WELL);
      expect(before.keys).toContain('routine.go-for-it');
      expect(before.cardKeys).toContain('morning.training');

      await circadian.saveEnergyNow(userId, 2, morning);
      const after = await loadDashboard(morning);
      expect(after.cardKeys[0]).toBe('personal.low-now');
      expect(after.cardKeys).not.toContain('morning.training');
      expect(after.briefing.headline).toBe(LOW_NOW);
      expect(after.keys).not.toContain('routine.go-for-it');

      // The afternoon has its own check-in, not made yet: the morning's is no longer
      // "right now", but both cards still hold back on it.
      const later = await loadDashboard(afternoon);
      expect(later.cardKeys).not.toContain('personal.low-now');
      expect(later.card.lowCheckIn).toBe('earlier');
      expect(later.briefing.headline).toBe(LOW_EARLIER);
      expect(later.keys).not.toContain('routine.go-for-it');
    });

    it('keeps both cards gentle after a low check-in until the next slot is rated', async () => {
      await writeJournal(
        { energy: 5, sleepHours: 8 },
        { energy: 8, sleepHours: 8 }
      );
      await writeCheckInPattern();
      await circadian.saveEnergyNow(userId, 2, stockholm('10:30'));

      // The afternoon (from 12:00) and the evening (from 18:00) not rated yet.
      for (const time of ['12:05', '15:30', '18:30']) {
        const now = stockholm(time);
        const { briefing, keys, card, cardKeys } = await loadDashboard(now);
        expect(briefing.headline, time).toBe(LOW_EARLIER);
        expect(
          keys.filter((k) => BRIEFING_PUSH.includes(k)),
          time
        ).toEqual([]);
        expect(card.lowCheckIn, time).toBe('earlier');
        // Not "right now", and not "your recent logs" either.
        expect(cardKeys, time).not.toContain('personal.low-now');
        expect(cardKeys, time).not.toContain('personal.easy-day');
        expect(
          cardKeys.filter((k) => CARD_PUSH.includes(k)),
          time
        ).toEqual([]);
        for (const suggestion of card.suggestions) {
          expect(suggestion.body, time).not.toMatch(
            /demanding|harder training/
          );
        }
        expect(card.recommendedIntensity, time).not.toBe('high');
        const target = await circadian.loadLotteryCircadianTarget(userId, now);
        expect(target?.intensity, time).toBeLessThanOrEqual(1);
      }

      // Rating the afternoon fine brings the push back on both cards.
      await circadian.saveEnergyNow(userId, 7, stockholm('15:30'));
      const rated = await loadDashboard(stockholm('15:30'));
      expect(rated.briefing.headline).toBe(DOING_WELL);
      expect(rated.keys).toContain('routine.go-for-it');
      expect(rated.card.lowCheckIn).toBeNull();
      expect(rated.cardKeys).toContain('afternoon.training');
      expect(rated.card.recommendedIntensity).toBe('high');
    });

    it('reads that check-in only with circadian insights on, whatever the journal source', async () => {
      await writeJournal(
        { energy: 5, sleepHours: 8 },
        { energy: 8, sleepHours: 8 }
      );
      await circadian.saveEnergyNow(userId, 2, morning);
      expect(await easyDay.loadEasyDay(userId, morning)).toEqual({
        fromLogs: false,
        maxRoutineEnergy: 'medium',
      });

      // The circadian opt-in covers the check-in, so the journal source does not matter.
      await client.user.update({
        where: { id: userId },
        data: { briefingSources: ['cycle', 'meals', 'vitals'] },
      });
      expect(await easyDay.loadEasyDay(userId, morning)).toEqual({
        fromLogs: false,
        maxRoutineEnergy: 'medium',
      });

      await client.user.update({
        where: { id: userId },
        data: {
          briefingSources: ['journal', 'cycle', 'meals', 'vitals'],
          enableCircadianInsights: false,
        },
      });
      expect(await easyDay.loadEasyDay(userId, morning)).toBeNull();
      const state = await briefingData.loadBriefingState(userId, {
        now: morning,
      });
      if (state.status !== 'ready') throw new Error(state.status);
      expect(state.briefing.suggestions.map((s) => s.key)).toContain(
        'routine.go-for-it'
      );
    });

    it('keeps the briefing gentle after a low check-in with the journal source off', async () => {
      // Recovery better over the last 3 days than in the 4 weeks before.
      await client.user.update({
        where: { id: userId },
        data: {
          trackVitals: true,
          briefingSources: ['cycle', 'meals', 'vitals'],
        },
      });
      await client.journalEntry.createMany({
        data: [
          ...days('2026-10-21', '2026-11-17').map((date) => ({
            userId,
            date: new Date(`${date}T00:00:00Z`),
            restingHeartRate: 62,
            heartRateVariability: 50,
            sleepQuality: 6,
          })),
          ...days('2026-11-18', TODAY).map((date) => ({
            userId,
            date: new Date(`${date}T00:00:00Z`),
            restingHeartRate: 52,
            heartRateVariability: 80,
            sleepQuality: 9,
          })),
        ],
      });
      const now = stockholm('16:30');
      const before = await loadDashboard(now);
      expect(before.briefing.headline).toBe(DOING_WELL);
      expect(before.keys).toContain('recovery.well-recovered');

      await circadian.saveEnergyNow(userId, 2, now);
      const after = await loadDashboard(now);
      expect(after.cardKeys[0]).toBe('personal.low-now');
      expect(after.briefing.headline).toBe(LOW_NOW);
      expect(after.keys.filter((k) => BRIEFING_PUSH.includes(k))).toEqual([]);
    });

    it('leans the card and the lottery low when the briefing suggests a rest day', async () => {
      // Recovery down over the last 3 days: the briefing suggests a rest day or gentle
      // movement and links to gentle routines.
      await client.user.update({
        where: { id: userId },
        data: { trackVitals: true },
      });
      await client.journalEntry.createMany({
        data: [
          ...days('2026-10-21', '2026-11-17').map((date) => ({
            userId,
            date: new Date(`${date}T00:00:00Z`),
            restingHeartRate: 55,
            heartRateVariability: 70,
            sleepQuality: 8,
          })),
          ...days('2026-11-18', TODAY).map((date) => ({
            userId,
            date: new Date(`${date}T00:00:00Z`),
            restingHeartRate: 72,
            heartRateVariability: 35,
            sleepQuality: 3,
          })),
        ],
      });
      const { briefing, keys, card, cardKeys } =
        await loadDashboard(lateAfternoon);
      expect(briefing.headline).toBe(GENTLER);
      const rest = briefing.suggestions.find(
        (s) => s.key === 'recovery.rest-day'
      );
      expect(rest?.action?.href).toBe('/routines?energy=low');
      expect(keys.filter((k) => BRIEFING_PUSH.includes(k))).toEqual([]);
      expect(await easyDay.loadEasyDay(userId, lateAfternoon)).toEqual({
        fromLogs: true,
        maxRoutineEnergy: 'low',
      });
      expect(cardKeys[0]).toBe('personal.easy-day');
      expect(card.recommendedIntensity).toBe('low');
      expect(
        await circadian.loadLotteryCircadianTarget(userId, lateAfternoon)
      ).toEqual({ window: 'afternoon', intensity: 0 });
      expect(
        await circadian.loadCircadianLotteryHint(userId, lateAfternoon)
      ).toEqual({ windowLabel: 'Afternoon', recommendedIntensity: 'low' });
    });

    it('holds back the circadian card and the lottery on a take-it-easy day', async () => {
      // Energy and sleep down over the last 3 days.
      await writeJournal(
        { energy: 7, sleepHours: 8 },
        { energy: 3, sleepHours: 5 }
      );
      const { briefing, keys, card, cardKeys } =
        await loadDashboard(lateAfternoon);
      expect(briefing.headline).toBe(GENTLER);
      expect(keys).toContain('routine.ease-intensity');
      expect(card.easyDay).toBe(true);
      expect(cardKeys[0]).toBe('personal.easy-day');
      expect(cardKeys).not.toContain('afternoon.training');
      expect(card.recommendedIntensity).toBe('medium');
      expect(await easyDay.loadEasyDay(userId, lateAfternoon)).toEqual({
        fromLogs: true,
        maxRoutineEnergy: 'medium',
      });
      expect(
        await circadian.loadLotteryCircadianTarget(userId, lateAfternoon)
      ).toEqual({ window: 'afternoon', intensity: 1 });
      expect(
        await circadian.loadCircadianLotteryHint(userId, lateAfternoon)
      ).toEqual({ windowLabel: 'Afternoon', recommendedIntensity: 'medium' });

      // The same with the briefing card turned off: the card still does not push.
      await client.user.update({
        where: { id: userId },
        data: { briefingFrequency: 'never' },
      });
      expect(
        (await circadian.loadCircadianInsights(userId, lateAfternoon))?.easyDay
      ).toBe(true);
    });
  }
);
