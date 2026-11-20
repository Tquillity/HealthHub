import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { addDaysToDateOnly } from '@/lib/date-only';

const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = Boolean(
  url &&
  ['localhost', '127.0.0.1'].includes(url.hostname) &&
  url.pathname === '/healthhub_e2e'
);

type DataModule = typeof import('./data');

// Friday 20 November 2026, 13:00 in Stockholm: cycle day 23 of a cycle that began on
// 29 October (late luteal).
const TODAY = '2026-11-20';
const NOW = new Date('2026-11-20T12:00:00Z');
const ALL_SOURCES = ['journal', 'cycle', 'meals', 'vitals'] as const;

const utcDay = (date: string) => new Date(`${date}T00:00:00Z`);
/** The meal planner saves items at local midnight (Stockholm is UTC+1 in November). */
const stockholmMidnight = (date: string) => new Date(`${date}T00:00:00+01:00`);

function days(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDaysToDateOnly(d, 1)) out.push(d);
  return out;
}

describe.skipIf(!isolated)(
  'daily briefing data against isolated PostgreSQL',
  () => {
    const run = randomUUID().slice(0, 8);
    const me = { id: `brf-me-${run}`, email: `brf-me-${run}@example.com` };
    const other = {
      id: `brf-other-${run}`,
      email: `brf-other-${run}@example.com`,
    };
    const myHome = `brf-home-${run}`;
    const otherHome = `brf-other-home-${run}`;
    const recipeIds = [`brf-r1-${run}`, `brf-r2-${run}`];
    let pool: Pool;
    let client: PrismaClient;
    let data: DataModule;

    const keys = async (options: { now?: Date; householdId?: string } = {}) => {
      const state = await data.loadBriefingState(me.id, {
        now: NOW,
        ...options,
      });
      if (state.status !== 'ready')
        throw new Error(`briefing is ${state.status}`);
      return state.briefing.suggestions.map((s) => s.key);
    };
    const setPreferences = (
      input: Parameters<DataModule['saveBriefingPreferences']>[1]
    ) => data.saveBriefingPreferences(me.id, input, NOW);
    const resetPreferences = () =>
      setPreferences({
        frequency: 'daily',
        sources: [...ALL_SOURCES],
        detail: 'brief',
      });

    beforeAll(async () => {
      pool = new Pool({ connectionString: process.env.DATABASE_URL });
      client = new PrismaClient({ adapter: new PrismaPg(pool) });
      data = await import('./data');

      await client.user.create({
        data: {
          ...me,
          name: 'Me',
          timezone: 'Europe/Stockholm',
          focusPreference: 'both',
          enableCycleTracking: true,
          cycleLength: 28,
          lastPeriodDate: utcDay('2026-10-29'),
          periodStarts: {
            create: [
              { date: utcDay('2026-10-01') },
              { date: utcDay('2026-10-29') },
            ],
          },
        },
      });
      await client.user.create({
        data: { ...other, name: 'Other', timezone: 'Europe/Stockholm' },
      });

      // My energy: about 7 in the luteal phase of last cycle, 4-5 over the last 3 days.
      await client.journalEntry.createMany({
        data: [
          ...days('2026-10-15', '2026-10-28').map((date) => ({
            userId: me.id,
            date: utcDay(date),
            energy: 7,
            mood: 7,
          })),
          { userId: me.id, date: utcDay('2026-11-18'), energy: 4, mood: 4 },
          { userId: me.id, date: utcDay('2026-11-19'), energy: 4, mood: 5 },
          { userId: me.id, date: utcDay('2026-11-20'), energy: 5, mood: 4 },
          // Someone else's very low days must not change my briefing.
          ...days('2026-11-18', TODAY).map((date) => ({
            userId: other.id,
            date: utcDay(date),
            energy: 1,
            mood: 1,
          })),
        ],
      });

      await client.organization.createMany({
        data: [
          { id: myHome, name: 'My home', slug: myHome },
          { id: otherHome, name: 'Other home', slug: otherHome },
        ],
      });
      await client.member.createMany({
        data: [
          {
            id: `brf-m1-${run}`,
            organizationId: myHome,
            userId: me.id,
            role: 'owner',
          },
          {
            id: `brf-m2-${run}`,
            organizationId: otherHome,
            userId: other.id,
            role: 'owner',
          },
        ],
      });
      await client.recipe.createMany({
        data: [
          { id: recipeIds[0], name: 'Porridge', organizationId: myHome },
          { id: recipeIds[1], name: 'Soup', organizationId: otherHome },
        ],
      });
      // My household planned (but did not mark cooked) one meal a day for the last 3 days
      // and nothing ahead. The other household planned ahead and marks meals cooked.
      await client.mealPlan.create({
        data: {
          id: `brf-plan-mine-${run}`,
          organizationId: myHome,
          startDate: stockholmMidnight('2026-11-16'),
          endDate: stockholmMidnight('2026-11-22'),
          items: {
            create: days('2026-11-17', '2026-11-19').map((date) => ({
              id: `brf-item-${date}-${run}`,
              recipeId: recipeIds[0],
              date: stockholmMidnight(date),
              mealType: 'dinner',
            })),
          },
        },
      });
      await client.mealPlan.create({
        data: {
          organizationId: otherHome,
          startDate: stockholmMidnight('2026-11-16'),
          endDate: stockholmMidnight('2026-11-22'),
          items: {
            create: days('2026-11-17', '2026-11-22').map((date) => ({
              recipeId: recipeIds[1],
              date: stockholmMidnight(date),
              mealType: 'dinner',
              isCooked: date < TODAY,
            })),
          },
        },
      });
    });

    afterAll(async () => {
      await client.organization.deleteMany({
        where: { id: { in: [myHome, otherHome] } },
      });
      await client.recipe.deleteMany({ where: { id: { in: recipeIds } } });
      await client.user.deleteMany({
        where: { id: { in: [me.id, other.id] } },
      });
      await client.$disconnect();
      await pool.end();
    });

    it('reads and saves preferences in canonical order', async () => {
      expect(await data.getBriefingSettings(me.id, NOW)).toEqual({
        preferences: {
          frequency: 'daily',
          sources: [...ALL_SOURCES],
          detail: 'brief',
        },
        timezone: 'Europe/Stockholm',
        nextBriefing: TODAY,
        trackVitals: false,
        cycleTracking: true,
      });

      const saved = await setPreferences({
        frequency: 'weekly',
        sources: ['meals', 'journal', 'meals'],
      });
      expect(saved.preferences).toEqual({
        frequency: 'weekly',
        sources: ['journal', 'meals'],
        detail: 'brief',
      });
      expect(saved.nextBriefing).toBe('2026-11-23');
      await resetPreferences();
    });

    it("follows the frequency on the user's own calendar day", async () => {
      await setPreferences({ frequency: 'never' });
      expect(await data.loadBriefingState(me.id, { now: NOW })).toEqual({
        status: 'off',
        date: TODAY,
      });

      await setPreferences({ frequency: 'weekly' });
      expect(await data.loadBriefingState(me.id, { now: NOW })).toEqual({
        status: 'not_due',
        date: TODAY,
      });
      // Still Sunday in UTC, already Monday in Stockholm.
      const mondayInStockholm = await data.loadBriefingState(me.id, {
        now: new Date('2026-11-22T23:30:00Z'),
      });
      expect(mondayInStockholm).toMatchObject({
        status: 'ready',
        date: '2026-11-23',
      });
      await resetPreferences();
    });

    it("builds the briefing from the user's own journal, cycle and household", async () => {
      const state = await data.loadBriefingState(me.id, { now: NOW });
      if (state.status !== 'ready') throw new Error(state.status);
      const { briefing } = state;
      expect(briefing.phase).toMatchObject({ phase: 'luteal', cycleDay: 23 });
      // The other household planned ahead and cooks; mine did neither.
      expect(briefing.suggestions.map((s) => s.key)).toEqual([
        'routine.ease-intensity',
        'meal.magnesium',
        'meal.plan-ahead',
      ]);
      expect(briefing.suggestions[0].evidence).toContain(
        'Energy: 4.3/10 on average over your last 3 check-ins.'
      );
    });

    it('uses the profile timezone for the day, and UTC when it is unknown', async () => {
      // 20:00 on Friday 20 November in New York is already Saturday in UTC.
      const fridayEveningInNewYork = new Date('2026-11-21T01:00:00Z');
      const setTimezone = (timezone: string) =>
        client.user.update({ where: { id: me.id }, data: { timezone } });
      try {
        await setTimezone('America/New_York');
        expect(
          (await data.loadBriefingState(me.id, { now: fridayEveningInNewYork }))
            .date
        ).toBe('2026-11-20');
        for (const unknown of ['UTC', 'Not/AZone', '']) {
          await setTimezone(unknown);
          expect(
            (
              await data.loadBriefingState(me.id, {
                now: fridayEveningInNewYork,
              })
            ).date
          ).toBe('2026-11-21');
        }
      } finally {
        await setTimezone('Europe/Stockholm');
      }
    });

    it('finds a hide stored for the day the card showed on every later load', async () => {
      // The card (server render or Refresh) shows the profile day; hiding stores that day.
      const shown = await data.loadBriefingState(me.id, { now: NOW });
      await data.dismissBriefing(me.id, shown.date, NOW);
      try {
        // A reload later the same evening still finds it.
        const later = new Date('2026-11-20T22:30:00Z');
        expect(await data.loadBriefingState(me.id, { now: later })).toEqual({
          status: 'dismissed',
          date: TODAY,
        });
      } finally {
        await data.restoreBriefing(me.id, shown.date, NOW);
      }
    });

    it('never reads sources the user switched off', async () => {
      await setPreferences({ sources: ['journal', 'cycle'] });
      expect((await keys()).some((key) => key.startsWith('meal.plan'))).toBe(
        false
      );

      await setPreferences({ sources: ['meals'] });
      const state = await data.loadBriefingState(me.id, { now: NOW });
      expect(state).toMatchObject({
        status: 'ready',
        briefing: { phase: null },
      });
      expect(await keys()).toEqual(['meal.plan-ahead']);
      await resetPreferences();
    });

    it('reads meals from the space the user has open, never from one they are not in', async () => {
      await setPreferences({ sources: ['meals'] });
      // Not a member of the other home: its plan (which plans ahead) is ignored.
      expect(await keys({ householdId: otherHome })).toEqual(['meal.plan-ahead']);

      await client.member.create({
        data: {
          id: `brf-m3-${run}`,
          organizationId: otherHome,
          userId: me.id,
          role: 'viewer',
        },
      });
      try {
        // Member now, and that space is open: its planned-ahead meals count.
        expect(await keys({ householdId: otherHome })).not.toContain('meal.plan-ahead');
        // No space named: the oldest membership (my home) is used.
        expect(await keys()).toEqual(['meal.plan-ahead']);
      } finally {
        await client.member.delete({ where: { id: `brf-m3-${run}` } });
        await resetPreferences();
      }
    });

    it('hides the card for the day and brings it back', async () => {
      await data.dismissBriefing(me.id, TODAY, NOW);
      await data.dismissBriefing(me.id, TODAY, NOW);
      expect(await data.loadBriefingState(me.id, { now: NOW })).toEqual({
        status: 'dismissed',
        date: TODAY,
      });
      expect(
        await client.briefingFeedback.count({ where: { userId: me.id } })
      ).toBe(1);

      await data.restoreBriefing(me.id, TODAY, NOW);
      expect((await data.loadBriefingState(me.id, { now: NOW })).status).toBe(
        'ready'
      );
      expect(
        await client.briefingFeedback.count({ where: { userId: me.id } })
      ).toBe(0);
    });

    it('stores one dismissal and one rating per suggestion, with encrypted keys', async () => {
      const dismiss = { date: TODAY, key: 'meal.magnesium' } as const;
      await data.dismissSuggestion(me.id, dismiss, NOW);
      await data.dismissSuggestion(me.id, dismiss, NOW);
      const rate = (rating: 'helpful' | 'not_helpful' | null) =>
        data.rateSuggestion(
          me.id,
          { date: TODAY, key: 'routine.ease-intensity', rating },
          NOW
        );
      await rate('helpful');
      await rate('not_helpful');

      const rows = await client.briefingFeedback.findMany({
        where: { userId: me.id },
        orderBy: { action: 'asc' },
      });
      expect(rows.map((row) => row.action)).toEqual([
        'dismissed',
        'not_helpful',
      ]);
      expect(JSON.stringify(rows)).not.toMatch(
        /magnesium|ease-intensity|meal\.|routine\./
      );

      // Dismissed today: hidden without a replacement. Rated today: shown with the rating.
      const state = await data.loadBriefingState(me.id, { now: NOW });
      if (state.status !== 'ready') throw new Error(state.status);
      expect(state.briefing.suggestions.map((s) => [s.key, s.rating])).toEqual([
        ['routine.ease-intensity', 'not_helpful'],
        ['meal.plan-ahead', null],
      ]);

      await rate(null);
      expect(
        await client.briefingFeedback.count({ where: { userId: me.id } })
      ).toBe(1);
    });

    it("rejects feedback for a day other than the user's today", async () => {
      await expect(
        data.dismissBriefing(me.id, '2026-11-17', NOW)
      ).rejects.toBeInstanceOf(data.BriefingDateError);
      await expect(
        data.rateSuggestion(
          me.id,
          { date: '2026-11-25', key: 'meal.iron', rating: 'helpful' },
          NOW
        )
      ).rejects.toBeInstanceOf(data.BriefingDateError);
      expect(
        await client.briefingFeedback.count({ where: { userId: me.id } })
      ).toBe(1);
    });

    it("shows the Vitals card's recovery score with the journal and cycle sources off", async () => {
      const metrics = await import('@/lib/daily-metrics');
      const { RECOVERY_ZONE_LABELS } = await import('@/lib/recovery');
      const vit = { id: `brf-vit-${run}`, email: `brf-vit-${run}@example.com` };
      await client.user.create({
        data: {
          ...vit,
          name: 'Vit',
          timezone: 'UTC',
          trackVitals: true,
          enableCycleTracking: true,
          cycleLength: 28,
          lastPeriodDate: utcDay('2026-10-29'),
          periodStarts: {
            create: [
              { date: utcDay('2026-10-01') },
              { date: utcDay('2026-10-29') },
            ],
          },
          // Only vitals: no journal analysis, no cycle phase in the briefing.
          briefingSources: ['vitals'],
        },
      });
      try {
        await client.journalEntry.createMany({
          data: [
            ...days('2026-08-20', '2026-11-19').map((date, i) => ({
              userId: vit.id,
              date: utcDay(date),
              restingHeartRate: 58 + (i % 5),
              heartRateVariability: 46 + (i % 7),
              sleepQuality: 7 + (i % 2),
              sleepHours: 7 + (i % 3) * 0.5,
            })),
            {
              userId: vit.id,
              date: utcDay(TODAY),
              restingHeartRate: 70,
              heartRateVariability: 30,
              sleepQuality: 3,
              sleepHours: 3,
            },
          ],
        });
        const card = await metrics.loadVitalsCardData(vit.id, TODAY);
        if (!card.trackVitals || !card.recovery) throw new Error('no score');

        const state = await data.loadBriefingState(vit.id, { now: NOW });
        if (state.status !== 'ready') throw new Error(state.status);
        const rest = state.briefing.suggestions.find(
          (s) => s.key === 'recovery.rest-day'
        );
        expect(rest?.evidence[0]).toBe(
          `Recovery today: ${card.recovery.score}/100 (${RECOVERY_ZONE_LABELS[card.recovery.zone]}).`
        );
        // The cycle source is off: the score uses the phase baseline, the text names none.
        expect(card.recovery.comparedWith).toBe('phase');
        expect(JSON.stringify(rest)).not.toMatch(/phase/i);
      } finally {
        await client.user.delete({ where: { id: vit.id } });
      }
    });

    it('reads energy check-ins by time of day only with circadian insights on', async () => {
      const tod = { id: `brf-tod-${run}`, email: `brf-tod-${run}@example.com` };
      await client.user.create({
        data: {
          ...tod,
          name: 'Tod',
          timezone: 'UTC',
          enableCircadianInsights: true,
        },
      });
      try {
        // Only dashboard check-ins: 7 on four weeks of mornings, then 5 on two evenings (an
        // ordinary evening dip) and 5 this morning. None for the afternoon (right now at
        // 12:00 UTC). Rated at different times of day, so they say nothing about whether
        // energy is down, and they never stand in for a daily energy rating.
        await client.journalEntry.createMany({
          data: [
            ...days('2026-10-21', '2026-11-17').map((date) => ({
              userId: tod.id,
              date: utcDay(date),
              energyMorning: 7,
            })),
            ...days('2026-11-18', '2026-11-19').map((date) => ({
              userId: tod.id,
              date: utcDay(date),
              energyEvening: 5,
            })),
            { userId: tod.id, date: utcDay(TODAY), energyMorning: 5 },
          ],
        });
        const briefing = async () => {
          const state = await data.loadBriefingState(tod.id, { now: NOW });
          if (state.status !== 'ready') throw new Error(state.status);
          return state.briefing;
        };

        const on = await briefing();
        expect(on.notes).toEqual([
          'Your last 3 days have only energy check-ins by time of day, so mood, sleep, symptoms and your daily energy are not part of this briefing. Log them in your journal to make it more personal.',
        ]);
        expect(on.headline).toBe(
          'Check in with your journal to make your briefing more personal.'
        );
        expect(on.suggestions.map((s) => s.key)).not.toContain(
          'routine.ease-intensity'
        );
        // The circadian card reads the same inputs, so it does not hold back either.
        const { loadEasyDay } = await import('@/lib/easy-day');
        expect(await loadEasyDay(tod.id, NOW)).toBeNull();

        await client.user.update({
          where: { id: tod.id },
          data: { enableCircadianInsights: false },
        });
        const off = await briefing();
        expect(off.notes[0]).toContain(
          'No journal check-ins in the last 3 days'
        );
        expect(off.headline).toBe(
          'Check in with your journal to make your briefing more personal.'
        );
      } finally {
        await client.user.delete({ where: { id: tod.id } });
      }
    });

    it('uses meal adherence only once the household marks meals cooked', async () => {
      await client.mealPlanItem.create({
        data: {
          mealPlanId: `brf-plan-mine-${run}`,
          recipeId: recipeIds[0],
          date: stockholmMidnight('2026-11-21'),
          mealType: 'dinner',
        },
      });
      const planned = await keys();
      expect(planned).not.toContain('meal.plan-ahead');
      expect(planned).not.toContain('meal.adherence-slipping');

      // 1 of the last 3 planned meals cooked.
      await client.mealPlanItem.update({
        where: { id: `brf-item-2026-11-18-${run}` },
        data: { isCooked: true },
      });
      expect(await keys()).toContain('meal.adherence-slipping');
    });
  }
);
