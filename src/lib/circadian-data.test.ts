import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { decrypt, decryptArray, encrypt, encryptArray } from './encryption';
import { addDaysToDateOnly } from './date-only';

// Recipe visibility follows the active space (hh_active_org cookie). No cookie here,
// so the user's oldest membership is used, as in a browser that never switched.
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}));

const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = Boolean(
  url &&
  ['localhost', '127.0.0.1'].includes(url.hostname) &&
  url.pathname === '/healthhub_e2e'
);

const day = (key: string) => new Date(`${key}T00:00:00.000Z`);

describe.skipIf(!isolated)(
  'circadian insights against isolated PostgreSQL',
  () => {
    const run = randomUUID().slice(0, 8);
    const userId = `cd-user-${run}`;
    const otherId = `cd-other-${run}`;
    const household = `cd-household-${run}`;
    const otherHousehold = `cd-other-household-${run}`;
    // 09:30 UTC = 10:30 in Stockholm (UTC+1 in November): the morning slot.
    const stockholmMorning = new Date('2026-11-20T09:30:00Z');
    let pool: Pool;
    let client: PrismaClient;
    let data: typeof import('./circadian-data');

    beforeAll(async () => {
      pool = new Pool({ connectionString: process.env.DATABASE_URL });
      client = new PrismaClient({ adapter: new PrismaPg(pool) });
      data = await import('./circadian-data');
      await client.user.createMany({
        data: [
          { id: userId, name: 'Me', email: `cd-${run}@example.com` },
          { id: otherId, name: 'Other', email: `cd-other-${run}@example.com` },
        ],
      });
      await client.organization.createMany({
        data: [
          { id: household, name: 'Home', slug: household },
          { id: otherHousehold, name: 'Next door', slug: otherHousehold },
        ],
      });
      await client.member.createMany({
        data: [
          {
            id: `cd-m1-${run}`,
            organizationId: household,
            userId,
            role: 'owner',
          },
          {
            id: `cd-m2-${run}`,
            organizationId: otherHousehold,
            userId: otherId,
            role: 'owner',
          },
        ],
      });
    });

    beforeEach(async () => {
      await client.journalEntry.deleteMany({
        where: { userId: { in: [userId, otherId] } },
      });
      await client.user.updateMany({
        where: { id: { in: [userId, otherId] } },
        data: { enableCircadianInsights: true, timezone: 'Europe/Stockholm' },
      });
    });

    afterAll(async () => {
      await client.recipe.deleteMany({
        where: { name: { startsWith: `cd-${run}` } },
      });
      await client.organization.deleteMany({
        where: { id: { in: [household, otherHousehold] } },
      });
      await client.user.deleteMany({
        where: { id: { in: [userId, otherId] } },
      });
      await client.$disconnect();
      await pool.end();
    });

    async function readEntry(dateKey: string) {
      return client.journalEntry.findUniqueOrThrow({
        where: { userId_date: { userId, date: day(dateKey) } },
      });
    }

    it('does nothing while the opt-in is off', async () => {
      await client.user.update({
        where: { id: userId },
        data: { enableCircadianInsights: false },
      });
      await expect(
        data.saveEnergyNow(userId, 7, stockholmMorning)
      ).rejects.toBeInstanceOf(data.CircadianNotEnabledError);
      expect(await data.loadCircadianInsights(userId, stockholmMorning)).toBe(
        null
      );
      expect(await data.loadCircadianCardData(userId, stockholmMorning)).toBe(
        null
      );
      expect(
        await data.loadLotteryCircadianTarget(userId, stockholmMorning)
      ).toBe(null);
      expect(
        await data.loadCircadianLotteryHint(userId, stockholmMorning)
      ).toBe(null);
      expect(
        await data.loadTimeOfDayEnergySummary(userId, stockholmMorning)
      ).toBe(null);
      expect(
        await data.allowedTimeOfDayEnergy(userId, { energyMorning: 6 })
      ).toEqual({});
      expect(await client.journalEntry.count({ where: { userId } })).toBe(0);
    });

    it('saves a check-in in the current slot of the local day, touching nothing else', async () => {
      await client.journalEntry.create({
        data: {
          userId,
          date: day('2026-11-20'),
          mood: 7,
          energy: 6,
          sleepHours: 7.5,
          notes: encrypt('Private note'),
          tags: ['calm'],
          gratitudeEntries: encryptArray(['Sunshine']) ?? [],
          symptomsPhysical: encryptArray(['Cramps']) ?? [],
          temperature: 36.4,
          restingHeartRate: 58,
          energyEvening: 4,
        },
      });

      expect(await data.saveEnergyNow(userId, 8, stockholmMorning)).toEqual({
        date: '2026-11-20',
        slot: 'morning',
        energy: 8,
      });
      // 13:30 UTC = 14:30 in Stockholm: the afternoon slot of the same day.
      await data.saveEnergyNow(userId, 5, new Date('2026-11-20T13:30:00Z'));

      const entry = await readEntry('2026-11-20');
      expect(entry).toMatchObject({
        energyMorning: 8,
        energyAfternoon: 5,
        energyEvening: 4,
        mood: 7,
        energy: 6,
        sleepHours: 7.5,
        tags: ['calm'],
        temperature: 36.4,
        restingHeartRate: 58,
      });
      expect(decrypt(entry.notes)).toBe('Private note');
      expect(decryptArray(entry.gratitudeEntries)).toEqual(['Sunshine']);
      expect(decryptArray(entry.symptomsPhysical)).toEqual(['Cramps']);
    });

    it('uses the profile time zone for the day and the slot', async () => {
      await client.user.update({
        where: { id: userId },
        data: { timezone: 'America/Los_Angeles' },
      });
      // 03:00 UTC on the 21st is 19:00 on the 20th in Los Angeles.
      expect(
        await data.saveEnergyNow(userId, 3, new Date('2026-11-21T03:00:00Z'))
      ).toEqual({ date: '2026-11-20', slot: 'evening', energy: 3 });
      expect((await readEntry('2026-11-20')).energyEvening).toBe(3);
    });

    it('falls back to UTC for an unknown time zone', async () => {
      await client.user.update({
        where: { id: userId },
        data: { timezone: 'Not/AZone' },
      });
      expect(
        await data.saveEnergyNow(userId, 6, new Date('2026-11-20T13:00:00Z'))
      ).toMatchObject({ slot: 'afternoon' });
      expect(await data.getCircadianSettings(userId)).toMatchObject({
        timeZone: 'Not/AZone',
        timeZoneValid: false,
      });
    });

    it('has no check-in slot at night', async () => {
      // 22:30 UTC = 23:30 in Stockholm.
      await expect(
        data.saveEnergyNow(userId, 6, new Date('2026-11-20T22:30:00Z'))
      ).rejects.toBeInstanceOf(data.EnergyCheckInClosedError);
      expect(await client.journalEntry.count({ where: { userId } })).toBe(0);
    });

    it('lets a full journal save write check-ins only with the opt-in on', async () => {
      expect(
        await data.allowedTimeOfDayEnergy(userId, {
          energyMorning: 6,
          energyAfternoon: null,
        })
      ).toEqual({ energyMorning: 6, energyAfternoon: null });
      expect(await data.allowedTimeOfDayEnergy(userId, {})).toEqual({});
    });

    it("builds insights from the user's own last 30 days", async () => {
      const today = '2026-11-20';
      const rows = [];
      for (let i = 1; i <= 6; i++) {
        rows.push({
          userId,
          date: day(addDaysToDateOnly(today, -i)),
          energyMorning: 5,
          energyAfternoon: 8,
          energyEvening: 4,
        });
      }
      await client.journalEntry.createMany({
        data: [
          ...rows,
          // Older than 30 days: ignored.
          {
            userId,
            date: day(addDaysToDateOnly(today, -30)),
            energyMorning: 10,
          },
          // A day without check-ins: not loaded.
          { userId, date: day(addDaysToDateOnly(today, -7)), mood: 5 },
          // Someone else's check-ins: never read.
          ...[1, 2, 3, 4, 5, 6].map((i) => ({
            userId: otherId,
            date: day(addDaysToDateOnly(today, -i)),
            energyMorning: 10,
            energyAfternoon: 1,
          })),
        ],
      });

      const loaded = await data.loadTimeOfDayEnergyRows(userId, today);
      expect(loaded).toHaveLength(6);
      expect(loaded[0]).toEqual({
        date: '2026-11-14',
        energyMorning: 5,
        energyAfternoon: 8,
        energyEvening: 4,
      });

      const insights = await data.loadCircadianInsights(
        userId,
        stockholmMorning
      );
      expect(insights).toMatchObject({
        dateKey: today,
        window: 'morning',
        slots: {
          morning: { average: 5, count: 6, personalized: true },
          afternoon: { average: 8, count: 6, personalized: true },
          evening: { average: 4, count: 6, personalized: true },
        },
        bestWindow: 'afternoon',
      });
      expect(
        await data.loadTimeOfDayEnergySummary(userId, stockholmMorning)
      ).toEqual({
        days: 30,
        slots: insights?.slots,
        bestWindow: 'afternoon',
      });
      expect(
        await data.loadLotteryCircadianTarget(userId, stockholmMorning)
      ).toEqual({ window: 'morning', intensity: insights?.intensityTarget });
      expect(
        await data.loadCircadianLotteryHint(userId, stockholmMorning)
      ).toEqual({
        windowLabel: 'Morning',
        recommendedIntensity: insights?.recommendedIntensity,
      });
    });

    it('clears only time-of-day check-ins, only for this user', async () => {
      await client.journalEntry.createMany({
        data: [
          {
            userId,
            date: day('2026-11-18'),
            mood: 6,
            energy: 5,
            energyMorning: 7,
          },
          { userId, date: day('2026-11-19'), energyEvening: 3 },
          { userId, date: day('2026-11-20'), mood: 4 },
          { userId: otherId, date: day('2026-11-19'), energyMorning: 9 },
        ],
      });
      expect(await data.getCircadianSettings(userId)).toEqual({
        enabled: true,
        timeZone: 'Europe/Stockholm',
        timeZoneValid: true,
        loggedDays: 2,
      });
      expect(await data.clearTimeOfDayEnergy(userId)).toBe(2);
      expect(await readEntry('2026-11-18')).toMatchObject({
        mood: 6,
        energy: 5,
        energyMorning: null,
      });
      expect((await readEntry('2026-11-19')).energyEvening).toBeNull();
      const other = await client.journalEntry.findFirstOrThrow({
        where: { userId: otherId },
      });
      expect(other.energyMorning).toBe(9);
    });

    it('turns the opt-in on and off', async () => {
      expect(
        await data.updateCircadianPreferences(userId, { enabled: false })
      ).toEqual({ enabled: false });
      expect((await data.getCircadianSettings(userId)).enabled).toBe(false);
    });

    it('suggests only visible recipes that fit the meal nudge', async () => {
      const name = (suffix: string) => `cd-${run} ${suffix}`;
      await client.recipe.createMany({
        data: [
          {
            name: name('household breakfast'),
            category: 'Breakfast',
            protein: 95,
            organizationId: household,
          },
          {
            name: name('system breakfast'),
            category: 'breakfast',
            protein: 90,
            isSystem: true,
          },
          {
            name: name('low-protein breakfast'),
            category: 'Breakfast',
            protein: 8,
            organizationId: household,
          },
          {
            name: name('other household breakfast'),
            category: 'Breakfast',
            protein: 99,
            organizationId: otherHousehold,
          },
          {
            name: name('secret breakfast'),
            category: 'Breakfast',
            protein: 99,
            isSystem: true,
            isSecret: true,
          },
          {
            name: name('private breakfast'),
            category: 'Breakfast',
            protein: 99,
            isSystem: true,
            isPrivate: true,
          },
          {
            name: name('light dinner'),
            category: 'Dinner',
            calories: 450,
            protein: 80,
            organizationId: household,
          },
          {
            name: name('heavy dinner'),
            category: 'Dinner',
            calories: 1200,
            protein: 99,
            organizationId: household,
          },
        ],
      });

      const breakfasts = await data.loadMealIdeas(userId, 'protein-breakfast');
      expect(breakfasts.map((r) => r.name)).toEqual([
        name('household breakfast'),
        name('system breakfast'),
      ]);
      expect(breakfasts[0]).toMatchObject({ protein: 95 });

      const dinners = await data.loadMealIdeas(userId, 'light-dinner');
      expect(dinners.map((r) => r.name)).toContain(name('light dinner'));
      expect(dinners.map((r) => r.name)).not.toContain(name('heavy dinner'));

      const card = await data.loadCircadianCardData(userId, stockholmMorning);
      expect(card?.insights.mealFocus).toBe('protein-breakfast');
      expect(card?.mealIdeas.map((r) => r.name)).toEqual([
        name('household breakfast'),
        name('system breakfast'),
      ]);
    });
  }
);
