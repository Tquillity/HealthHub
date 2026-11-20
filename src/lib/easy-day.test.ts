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
import { buildDailyBriefing, isTakeItEasyInput } from './briefing/engine';
import type { BriefingJournalDay } from './briefing/types';
import {
  bestWindowAdvice,
  buildCircadianInsights,
  energyNowFrom,
  ENERGY_SLOTS,
  isLowEnergy,
  localTimeIn,
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

type DayValues = { energy: number; sleepHours: number };

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
} satisfies Record<string, BriefingJournalDay[]>;

/** A usual time-of-day pattern (afternoons best) and today's check-ins. */
function checkIns(today: number | null): TimeOfDayEnergyRow[] {
  const pattern = days('2026-11-14', '2026-11-19').map((date) => ({
    date,
    energyMorning: 5,
    energyAfternoon: 8,
    energyEvening: 4,
  }));
  return today === null
    ? pattern
    : [
        ...pattern,
        {
          date: TODAY,
          energyMorning: today,
          energyAfternoon: today,
          energyEvening: today,
        },
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
    lowEnergyNow: isLowEnergy(energyNowFrom(rows, now, timeZone)),
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
    easyDay: isTakeItEasyInput(inputs),
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
    const lowNow = dashboard(JOURNALS.goodWeek, checkIns(2), at(10));
    expect(lowNow.cardKeys[0]).toBe('personal.low-now');
    expect(lowNow.briefing.headline).toBe(GENTLER);
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
    for (const journalDays of Object.values(JOURNALS)) {
      for (const today of [null, 2, 6, 9]) {
        for (const hour of [7, 10, 13, 16, 19, 23]) {
          const { briefing, keys, card, cardKeys } = dashboard(
            journalDays,
            checkIns(today),
            at(hour)
          );
          const label = JSON.stringify({ today, hour, keys, cardKeys });
          if (briefing.headline === GENTLER) {
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
          if (
            cardKeys.includes('personal.low-now') ||
            cardKeys.includes('personal.easy-day')
          ) {
            expect(briefing.headline, label).toBe(GENTLER);
            expect(
              keys.filter((k) => BRIEFING_PUSH.includes(k)),
              label
            ).toEqual([]);
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
    // 09:30 UTC is 10:30 in Stockholm (morning), 14:30 UTC is 15:30 (afternoon) and
    // 15:10 UTC is 16:10 (late afternoon).
    const morning = new Date('2026-11-20T09:30:00Z');
    const afternoon = new Date('2026-11-20T14:30:00Z');
    const lateAfternoon = new Date('2026-11-20T15:10:00Z');
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
      expect(after.briefing.headline).toBe(GENTLER);
      expect(after.keys).not.toContain('routine.go-for-it');

      // The afternoon has its own check-in, not made yet: the morning's no longer counts
      // as "right now" for either card.
      const later = await loadDashboard(afternoon);
      expect(later.cardKeys).not.toContain('personal.low-now');
      expect(later.keys).toContain('routine.go-for-it');
    });

    it('reads that check-in only with the journal source and circadian insights on', async () => {
      await writeJournal(
        { energy: 5, sleepHours: 8 },
        { energy: 8, sleepHours: 8 }
      );
      await circadian.saveEnergyNow(userId, 2, morning);
      expect(await easyDay.loadEasyDay(userId, morning)).toBe(true);

      await client.user.update({
        where: { id: userId },
        data: { briefingSources: ['cycle', 'meals', 'vitals'] },
      });
      expect(await easyDay.loadEasyDay(userId, morning)).toBe(false);

      await client.user.update({
        where: { id: userId },
        data: {
          briefingSources: ['journal', 'cycle', 'meals', 'vitals'],
          enableCircadianInsights: false,
        },
      });
      expect(await easyDay.loadEasyDay(userId, morning)).toBe(false);
      const state = await briefingData.loadBriefingState(userId, {
        now: morning,
      });
      if (state.status !== 'ready') throw new Error(state.status);
      expect(state.briefing.suggestions.map((s) => s.key)).toContain(
        'routine.go-for-it'
      );
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
