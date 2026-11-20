import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { encrypt, encryptArray } from './encryption';
import { addDaysToDateOnly, dateOnlyToUtcDate, toDateOnlyString } from './date-only';
import type { ClinicalReportOptions } from './validation/clinical-report-schemas';

const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = Boolean(
  url &&
  ['localhost', '127.0.0.1'].includes(url.hostname) &&
  url.pathname === '/healthhub_e2e'
);

const NOW = new Date();
const TODAY = toDateOnlyString(NOW);
const ago = (days: number) => dateOnlyToUtcDate(addDaysToDateOnly(TODAY, -days));

const NONE: ClinicalReportOptions = {
  months: 3,
  includeName: false,
  includeNotes: false,
  includeBbt: false,
  includeSymptoms: false,
  includeVitals: false,
};
const ALL: ClinicalReportOptions = {
  months: 3,
  includeName: true,
  includeNotes: true,
  includeBbt: true,
  includeSymptoms: true,
  includeVitals: true,
};

describe.skipIf(!isolated)(
  'Clinical report loading against isolated PostgreSQL',
  () => {
    const run = randomUUID().slice(0, 8);
    const userId = `cr-user-${run}`;
    const otherId = `cr-other-${run}`;
    const noCycleId = `cr-nocycle-${run}`;
    let pool: Pool;
    let client: PrismaClient;
    let data: typeof import('./clinical-report-data');

    beforeAll(async () => {
      pool = new Pool({ connectionString: process.env.DATABASE_URL });
      client = new PrismaClient({ adapter: new PrismaPg(pool) });
      data = await import('./clinical-report-data');
      await client.user.createMany({
        data: [
          {
            id: userId,
            name: 'Report Person',
            email: `cr-${run}@example.com`,
            enableCycleTracking: true,
            cycleLength: 28,
            lastPeriodDate: ago(14),
            temperatureUnit: 'F',
            trackVitals: true,
          },
          {
            id: otherId,
            name: 'Other Person',
            email: `cr-other-${run}@example.com`,
            enableCycleTracking: true,
            lastPeriodDate: ago(20),
          },
          {
            id: noCycleId,
            name: 'No Cycle',
            email: `cr-nocycle-${run}@example.com`,
          },
        ],
      });
      await client.periodStart.createMany({
        data: [
          { userId, date: ago(70) },
          { userId, date: ago(42) },
          { userId, date: ago(14) },
          { userId: otherId, date: ago(48) },
          { userId: otherId, date: ago(20) },
        ],
      });
      await client.journalEntry.createMany({
        data: [
          {
            userId,
            date: ago(70),
            mood: 4,
            energy: 3,
            notes: encrypt('Private note about travel'),
            tags: ['travel'],
            symptomsPhysical: encryptArray(['Cramps']) ?? [],
            symptomsMental: encryptArray(['Tired']) ?? [],
            gratitudeEntries: encryptArray(['Sunshine']) ?? [],
            temperature: 36.3,
          },
          {
            userId,
            date: ago(69),
            mood: 5,
            symptomsPhysical: encryptArray(['cramps', 'Headache']) ?? [],
            symptomsMental: encryptArray(['Tired']) ?? [],
            symptomsNotes: encrypt('Worse in the evening'),
          },
          // Quick-log only: a temperature, not a journal check-in.
          { userId, date: ago(68), temperature: 36.35 },
          // Vitals only.
          {
            userId,
            date: ago(60),
            restingHeartRate: 60,
            heartRateVariability: 50,
            sleepQuality: 7,
          },
          // Outside the 3-month range.
          {
            userId,
            date: ago(200),
            mood: 2,
            notes: encrypt('Old note outside range'),
            symptomsPhysical: encryptArray(['Old symptom']) ?? [],
          },
          {
            userId: otherId,
            date: ago(30),
            mood: 6,
            notes: encrypt('Other user secret'),
            tags: ['other-tag'],
            symptomsPhysical: encryptArray(['Other symptom']) ?? [],
            temperature: 37.1,
          },
        ],
      });
    });

    afterAll(async () => {
      await client.user.deleteMany({
        where: { id: { in: [userId, otherId, noCycleId] } },
      });
      await client.$disconnect();
      await pool.end();
    });

    it('returns only cycle data when no optional section is requested', async () => {
      const report = await data.loadClinicalReport(userId, NONE, NOW);
      expect(Object.keys(report).sort()).toEqual(['cycles', 'meta', 'phases']);
      expect(report.meta.name).toBeNull();
      expect(report.meta.rangeEnd).toBe(TODAY);
      expect(report.cycles.count).toBe(2);
      expect(report.cycles.completed.map((cycle) => cycle.length)).toEqual([28, 28]);
      expect(report.cycles.current?.day).toBe(15);
      const json = JSON.stringify(report);
      for (const hidden of [
        'Report Person',
        'Private note',
        'travel',
        'Cramps',
        'Tired',
        'evening',
        'Sunshine',
      ]) {
        expect(json).not.toContain(hidden);
      }
    });

    it('decrypts and includes every requested section, for this user only', async () => {
      const report = await data.loadClinicalReport(userId, ALL, NOW);
      expect(report.meta.name).toBe('Report Person');
      expect(report.meta.temperatureUnit).toBe('F');
      expect(report.meta.sections).toEqual({
        name: true,
        bbt: true,
        symptoms: true,
        vitals: true,
        notes: true,
      });

      expect(report.symptoms?.checkInDays).toBe(2);
      expect(
        report.symptoms?.physical.map((stat) => [stat.label, stat.days])
      ).toEqual([
        ['Cramps', 2],
        ['Headache', 1],
      ]);
      expect(report.symptoms?.mental.map((stat) => stat.label)).toEqual(['Tired']);
      expect(report.symptoms?.pairs).toContainEqual({
        a: 'Cramps',
        b: 'Tired',
        days: 2,
      });

      expect(report.bbt?.readings.map((r) => r.celsius)).toEqual([36.3, 36.35]);
      expect(report.vitals?.overall).toMatchObject({
        days: 1,
        restingHeartRate: 60,
        heartRateVariability: 50,
        sleepQuality: 7,
      });

      expect(report.notes?.entries).toEqual([
        {
          date: addDaysToDateOnly(TODAY, -70),
          phase: 'menstrual',
          note: 'Private note about travel',
          symptomNote: null,
          tags: ['Travel'],
        },
        {
          date: addDaysToDateOnly(TODAY, -69),
          phase: 'menstrual',
          note: null,
          symptomNote: 'Worse in the evening',
          tags: [],
        },
      ]);

      const json = JSON.stringify(report);
      for (const hidden of [
        'Other user secret',
        'Other symptom',
        'other-tag',
        'Other Person',
        'Old note outside range',
        'Old symptom',
        // Gratitude is never part of the report.
        'Sunshine',
      ]) {
        expect(json).not.toContain(hidden);
      }
    });

    it('leaves vitals out while vitals tracking is off', async () => {
      await client.user.update({
        where: { id: userId },
        data: { trackVitals: false },
      });
      try {
        const report = await data.loadClinicalReport(userId, ALL, NOW);
        expect(report.vitals).toBeUndefined();
        expect(report.meta.sections.vitals).toBe(false);
        expect(report.bbt).toBeDefined();
      } finally {
        await client.user.update({
          where: { id: userId },
          data: { trackVitals: true },
        });
      }
    });

    it('refuses a report while cycle tracking is off', async () => {
      await expect(
        data.loadClinicalReport(noCycleId, NONE, NOW)
      ).rejects.toBeInstanceOf(data.ClinicalReportUnavailableError);
    });
  }
);
