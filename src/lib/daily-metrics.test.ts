import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { decrypt, decryptArray, encrypt, encryptArray } from './encryption';
import { addDaysToDateOnly } from './date-only';

const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = Boolean(
  url &&
  ['localhost', '127.0.0.1'].includes(url.hostname) &&
  url.pathname === '/healthhub_e2e'
);

const day = (key: string) => new Date(`${key}T00:00:00.000Z`);

describe.skipIf(!isolated)(
  'BBT, vitals and period history against isolated PostgreSQL',
  () => {
    const run = randomUUID().slice(0, 8);
    const userId = `dm-user-${run}`;
    const otherId = `dm-other-${run}`;
    let pool: Pool;
    let client: PrismaClient;
    let metrics: typeof import('./daily-metrics');
    let periods: typeof import('./period-starts');

    beforeAll(async () => {
      pool = new Pool({ connectionString: process.env.DATABASE_URL });
      client = new PrismaClient({ adapter: new PrismaPg(pool) });
      metrics = await import('./daily-metrics');
      periods = await import('./period-starts');
      await client.user.createMany({
        data: [
          { id: userId, name: 'Me', email: `dm-${run}@example.com` },
          { id: otherId, name: 'Other', email: `dm-other-${run}@example.com` },
        ],
      });
    });

    beforeEach(async () => {
      await client.journalEntry.deleteMany({
        where: { userId: { in: [userId, otherId] } },
      });
      await client.periodStart.deleteMany({
        where: { userId: { in: [userId, otherId] } },
      });
      await client.user.updateMany({
        where: { id: { in: [userId, otherId] } },
        data: {
          trackVitals: false,
          lastPeriodDate: null,
          temperatureUnit: 'C',
        },
      });
    });

    afterAll(async () => {
      await client.user.deleteMany({
        where: { id: { in: [userId, otherId] } },
      });
      await client.$disconnect();
      await pool.end();
    });

    /** A full journal entry written the way logJournalEntry stores it. */
    async function createFullEntry(dateKey: string) {
      await client.journalEntry.create({
        data: {
          userId,
          date: day(dateKey),
          mood: 7,
          energy: 6,
          sleepHours: 7.5,
          notes: encrypt('Private note'),
          tags: ['calm'],
          gratitudeEntries: encryptArray(['Sunshine']) ?? [],
          gratitudeNotes: encrypt('Grateful'),
          goalsAchieved: encryptArray(['Walk']) ?? [],
          goalsProgress: encryptArray(['Read']) ?? [],
          goalsNotes: encrypt('Goals'),
          symptomsPhysical: encryptArray(['Cramps']) ?? [],
          symptomsMental: encryptArray(['Calm']) ?? [],
          symptomsNotes: encrypt('Mild'),
          temperature: 36.4,
          cervicalMucus: encrypt('creamy'),
          restingHeartRate: 58,
          heartRateVariability: 52.5,
          sleepQuality: 8,
        },
      });
    }

    async function readEntry(dateKey: string) {
      return client.journalEntry.findUniqueOrThrow({
        where: { userId_date: { userId, date: day(dateKey) } },
      });
    }

    function expectJournalFieldsUntouched(
      entry: Awaited<ReturnType<typeof readEntry>>
    ) {
      expect(entry).toMatchObject({
        mood: 7,
        energy: 6,
        sleepHours: 7.5,
        tags: ['calm'],
      });
      expect(decrypt(entry.notes)).toBe('Private note');
      expect(decryptArray(entry.gratitudeEntries)).toEqual(['Sunshine']);
      expect(decrypt(entry.gratitudeNotes)).toBe('Grateful');
      expect(decryptArray(entry.goalsAchieved)).toEqual(['Walk']);
      expect(decryptArray(entry.goalsProgress)).toEqual(['Read']);
      expect(decrypt(entry.goalsNotes)).toBe('Goals');
      expect(decryptArray(entry.symptomsPhysical)).toEqual(['Cramps']);
      expect(decryptArray(entry.symptomsMental)).toEqual(['Calm']);
      expect(decrypt(entry.symptomsNotes)).toBe('Mild');
    }

    describe('saveBbtReading', () => {
      it('updates only temperature and mucus, converting °F to stored °C', async () => {
        await createFullEntry('2026-03-10');
        const saved = await metrics.saveBbtReading(userId, {
          date: '2026-03-10',
          temperature: 97.7,
          unit: 'F',
          cervicalMucus: 'egg-white',
        });
        expect(saved).toMatchObject({
          date: '2026-03-10',
          temperature: 36.5,
          cervicalMucus: 'egg-white',
        });

        const entry = await readEntry('2026-03-10');
        expectJournalFieldsUntouched(entry);
        expect(entry).toMatchObject({
          temperature: 36.5,
          restingHeartRate: 58,
          heartRateVariability: 52.5,
          sleepQuality: 8,
        });
        // Cervical mucus is encrypted at rest.
        expect(entry.cervicalMucus).not.toBe('egg-white');
        expect(decrypt(entry.cervicalMucus)).toBe('egg-white');
      });

      it('leaves omitted fields alone and clears fields sent as null', async () => {
        await createFullEntry('2026-03-11');
        await metrics.saveBbtReading(userId, {
          date: '2026-03-11',
          temperature: null,
          unit: 'C',
        });
        let entry = await readEntry('2026-03-11');
        expect(entry.temperature).toBeNull();
        expect(decrypt(entry.cervicalMucus)).toBe('creamy');
        expectJournalFieldsUntouched(entry);

        await metrics.saveBbtReading(userId, {
          date: '2026-03-11',
          unit: 'C',
          cervicalMucus: null,
        });
        entry = await readEntry('2026-03-11');
        expect(entry.cervicalMucus).toBeNull();
        expectJournalFieldsUntouched(entry);
      });

      it('creates an entry for a new day and rounds to 2 decimals', async () => {
        const saved = await metrics.saveBbtReading(userId, {
          date: '2026-03-12',
          temperature: 36.456,
          unit: 'C',
        });
        expect(saved.temperature).toBe(36.46);
        const entry = await readEntry('2026-03-12');
        expect(entry).toMatchObject({ temperature: 36.46, mood: null });
      });

      it('does not create an empty entry when only clearing', async () => {
        const saved = await metrics.saveBbtReading(userId, {
          date: '2026-03-13',
          temperature: null,
          unit: 'C',
          cervicalMucus: null,
        });
        expect(saved).toMatchObject({ temperature: null, cervicalMucus: null });
        expect(
          await client.journalEntry.count({
            where: { userId, date: day('2026-03-13') },
          })
        ).toBe(0);
      });
    });

    describe('saveVitals', () => {
      it('refuses to save while the vitals opt-in is off', async () => {
        await expect(
          metrics.saveVitals(userId, {
            date: '2026-03-10',
            restingHeartRate: 60,
          })
        ).rejects.toBeInstanceOf(metrics.VitalsNotEnabledError);
        expect(await client.journalEntry.count({ where: { userId } })).toBe(0);
      });

      it('updates only the vitals it is given, without clobbering the journal', async () => {
        await client.user.update({
          where: { id: userId },
          data: { trackVitals: true },
        });
        await createFullEntry('2026-03-10');

        await metrics.saveVitals(userId, {
          date: '2026-03-10',
          restingHeartRate: 61,
          heartRateVariability: 47.26,
        });
        let entry = await readEntry('2026-03-10');
        expectJournalFieldsUntouched(entry);
        expect(entry).toMatchObject({
          restingHeartRate: 61,
          heartRateVariability: 47.3,
          sleepQuality: 8, // omitted: unchanged
          temperature: 36.4,
        });
        expect(decrypt(entry.cervicalMucus)).toBe('creamy');

        await metrics.saveVitals(userId, {
          date: '2026-03-10',
          sleepQuality: null,
        });
        entry = await readEntry('2026-03-10');
        expect(entry).toMatchObject({
          sleepQuality: null,
          restingHeartRate: 61,
        });
        expectJournalFieldsUntouched(entry);
      });
    });

    describe('privacy controls', () => {
      it('deletes all vitals or all temperature data for this user only', async () => {
        await createFullEntry('2026-03-10');
        await createFullEntry('2026-03-11');
        await client.journalEntry.create({
          data: {
            userId: otherId,
            date: day('2026-03-10'),
            restingHeartRate: 70,
            temperature: 36.6,
          },
        });

        expect(await metrics.getVitalsPrivacySummary(userId)).toEqual({
          trackVitals: false,
          temperatureUnit: 'C',
          vitalsDays: 2,
          bbtDays: 2,
        });

        expect(await metrics.clearVitalsData(userId)).toBe(2);
        const entry = await readEntry('2026-03-10');
        expect(entry).toMatchObject({
          restingHeartRate: null,
          heartRateVariability: null,
          sleepQuality: null,
          temperature: 36.4,
        });
        expectJournalFieldsUntouched(entry);

        expect(await metrics.clearBbtData(userId)).toBe(2);
        const cleared = await readEntry('2026-03-11');
        expect(cleared).toMatchObject({
          temperature: null,
          cervicalMucus: null,
        });
        expectJournalFieldsUntouched(cleared);

        expect(await metrics.getVitalsPrivacySummary(userId)).toMatchObject({
          vitalsDays: 0,
          bbtDays: 0,
        });
        // The other user's data is untouched.
        expect(
          await client.journalEntry.findFirstOrThrow({
            where: { userId: otherId },
          })
        ).toMatchObject({ restingHeartRate: 70, temperature: 36.6 });
      });

      it('saves the unit preference and the vitals opt-in', async () => {
        expect(
          await metrics.updateVitalsPreferences(userId, {
            temperatureUnit: 'F',
          })
        ).toEqual({ trackVitals: false, temperatureUnit: 'F' });
        expect(
          await metrics.updateVitalsPreferences(userId, { trackVitals: true })
        ).toEqual({ trackVitals: true, temperatureUnit: 'F' });
      });
    });

    describe('period history', () => {
      async function lastPeriodDate() {
        const user = await client.user.findUniqueOrThrow({
          where: { id: userId },
          select: { lastPeriodDate: true },
        });
        return user.lastPeriodDate?.toISOString().slice(0, 10) ?? null;
      }

      it('moves lastPeriodDate forward only for newer starts', async () => {
        expect(await periods.recordPeriodStart(userId, '2026-03-01')).toEqual({
          lastPeriodDate: '2026-03-01',
        });
        expect(await periods.recordPeriodStart(userId, '2026-03-29')).toEqual({
          lastPeriodDate: '2026-03-29',
        });
        // Logging a past period adds history without rewinding the current cycle.
        expect(await periods.recordPeriodStart(userId, '2026-02-01')).toEqual({
          lastPeriodDate: '2026-03-29',
        });
        // Logging the same day twice is harmless.
        await periods.recordPeriodStart(userId, '2026-03-29');
        expect(await periods.listPeriodStartDates(userId)).toEqual([
          '2026-02-01',
          '2026-03-01',
          '2026-03-29',
        ]);
        expect(await lastPeriodDate()).toBe('2026-03-29');
      });

      it('falls back to the latest remaining start when the current one is removed', async () => {
        for (const d of ['2026-02-01', '2026-03-01', '2026-03-29']) {
          await periods.recordPeriodStart(userId, d);
        }
        // Removing an older start keeps the current one.
        expect(await periods.removePeriodStart(userId, '2026-03-01')).toEqual({
          removed: true,
          lastPeriodDate: '2026-03-29',
        });
        // Removing the current start falls back to the previous one.
        expect(await periods.removePeriodStart(userId, '2026-03-29')).toEqual({
          removed: true,
          lastPeriodDate: '2026-02-01',
        });
        expect(await lastPeriodDate()).toBe('2026-02-01');
        // Unknown dates are reported, not errors.
        expect(await periods.removePeriodStart(userId, '2026-01-01')).toEqual({
          removed: false,
          lastPeriodDate: '2026-02-01',
        });
        // Removing the last one clears lastPeriodDate.
        expect(await periods.removePeriodStart(userId, '2026-02-01')).toEqual({
          removed: true,
          lastPeriodDate: null,
        });
        expect(await lastPeriodDate()).toBeNull();
      });

      it('profile edits add a newer start and correct the current one when earlier', async () => {
        const setFromProfile = (dateKey: string) =>
          client.$transaction(async (tx) => {
            const latest = await periods.setLatestPeriodStartFromProfile(
              tx,
              userId,
              dateKey
            );
            await tx.user.update({
              where: { id: userId },
              data: { lastPeriodDate: latest },
            });
          });

        await setFromProfile('2026-03-01');
        await setFromProfile('2026-03-30'); // new period
        expect(await periods.listPeriodStartDates(userId)).toEqual([
          '2026-03-01',
          '2026-03-30',
        ]);
        await setFromProfile('2026-03-29'); // typo fix: replaces 03-30
        expect(await periods.listPeriodStartDates(userId)).toEqual([
          '2026-03-01',
          '2026-03-29',
        ]);
        expect(await lastPeriodDate()).toBe('2026-03-29');
        await setFromProfile('2026-03-29'); // unchanged save
        expect(await periods.listPeriodStartDates(userId)).toHaveLength(2);
      });

      it('keeps period starts per user', async () => {
        await periods.recordPeriodStart(userId, '2026-03-01');
        await client.user.update({
          where: { id: otherId },
          data: { lastPeriodDate: day('2026-03-05') },
        });
        await client.periodStart.create({
          data: { userId: otherId, date: day('2026-03-05') },
        });
        expect(await periods.listPeriodStartDates(userId)).toEqual([
          '2026-03-01',
        ]);
        await periods.removePeriodStart(userId, '2026-03-05');
        expect(await periods.listPeriodStartDates(otherId)).toEqual([
          '2026-03-05',
        ]);
      });

      it('cascades with the user', async () => {
        const temp = `dm-temp-${run}`;
        await client.user.create({
          data: { id: temp, name: 'Temp', email: `${temp}@example.com` },
        });
        await client.periodStart.create({
          data: { userId: temp, date: day('2026-03-01') },
        });
        await client.user.delete({ where: { id: temp } });
        expect(
          await client.periodStart.count({ where: { userId: temp } })
        ).toBe(0);
      });
    });

    describe('loaders', () => {
      const CYCLE = [
        36.3, 36.2, 36.25, 36.3, 36.2, 36.3, 36.25, 36.2, 36.3, 36.25, 36.3,
        36.3, 36.6, 36.65, 36.7, 36.7, 36.75,
      ];

      it('builds the cycle page data: thermal shift, BBT points, no recovery without opt-in', async () => {
        await periods.recordPeriodStart(userId, '2026-03-01');
        await client.journalEntry.createMany({
          data: CYCLE.map((temperature, i) => ({
            userId,
            date: day(addDaysToDateOnly('2026-03-01', i)),
            temperature,
            restingHeartRate: 60,
          })),
        });
        await client.journalEntry.update({
          where: { userId_date: { userId, date: day('2026-03-17') } },
          data: { cervicalMucus: encrypt('sticky') },
        });

        const insights = await metrics.loadCycleDashboardInsights(userId, {
          today: '2026-03-17',
          cycleLength: 28,
          daysIntoCycle: 17,
          lastPeriodDate: day('2026-03-01'),
          temperatureUnit: 'F',
          trackVitals: false,
        });

        expect(insights.quickLog).toMatchObject({
          today: '2026-03-17',
          temperatureUnit: 'F',
          todayLog: { temperature: 36.75, cervicalMucus: 'sticky' },
          recentPeriodStarts: ['2026-03-01'],
        });
        expect(insights.quickLog.shift).toMatchObject({
          detected: true,
          ovulationDate: '2026-03-12',
        });
        expect(insights.overlays.bbt.points).toHaveLength(17);
        expect(insights.overlays.bbt.ovulationDay).toBe(12);
        expect(insights.overlays.recovery).toBeNull();
      });

      it('loads the dashboard vitals card only with the opt-in', async () => {
        expect(await metrics.loadVitalsCardData(userId, '2026-03-17')).toEqual({
          trackVitals: false,
          today: '2026-03-17',
        });

        await client.user.update({
          where: { id: userId },
          data: { trackVitals: true },
        });
        await client.journalEntry.createMany({
          data: Array.from({ length: 10 }, (_, i) => ({
            userId,
            date: day(addDaysToDateOnly('2026-03-07', i)),
            restingHeartRate: 60,
            heartRateVariability: 50,
            sleepQuality: 7,
          })),
        });
        await client.journalEntry.create({
          data: {
            userId,
            date: day('2026-03-17'),
            restingHeartRate: 66,
            heartRateVariability: 38,
            sleepQuality: 4,
          },
        });

        const card = await metrics.loadVitalsCardData(userId, '2026-03-17');
        expect(card.trackVitals).toBe(true);
        if (!card.trackVitals) return;
        expect(card.todayLog).toMatchObject({
          restingHeartRate: 66,
          heartRateVariability: 38,
          sleepQuality: 4,
        });
        expect(card.recovery).toMatchObject({
          date: '2026-03-17',
          zone: 'red',
          alert: true,
          comparedWith: 'overall', // no cycle tracking: overall baseline
        });
      });
    });
  }
);
