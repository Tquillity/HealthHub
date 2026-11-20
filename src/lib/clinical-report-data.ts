import { prisma } from '@/lib/db';
import { decrypt, decryptArray } from '@/lib/encryption';
import {
  addDaysToDateOnly,
  dateOnlyToUtcDate,
  toDateOnlyString,
} from '@/lib/date-only';
import { parseTemperatureUnit, type BbtReading } from '@/lib/bbt';
import {
  buildCycleHistory,
  findCycleForDate,
  normalizePeriodStarts,
} from '@/lib/cycle-history';
import { loadDailyMetricsRows, todayDateKey } from '@/lib/daily-metrics';
import { listPeriodStartDates } from '@/lib/period-starts';
import { RECOVERY_BASELINE_WINDOW_DAYS } from '@/lib/recovery';
import {
  buildClinicalReport,
  isJournalCheckIn,
  reportRange,
  resolveReportToday,
  type ClinicalReport,
  type NoteDay,
  type SymptomDay,
} from '@/lib/clinical-report';
import type { ClinicalReportOptions } from '@/lib/validation/clinical-report-schemas';

/**
 * Loads and decrypts exactly what the user chose to include in the clinical summary,
 * then builds it with lib/clinical-report. Each optional section has its own query
 * with its own column list: a section that was not requested is never read or
 * decrypted. The report is returned to the caller only; it is not stored or logged.
 */

/** The report cannot be made for this account (shown to the user as is). */
export class ClinicalReportUnavailableError extends Error {}

type Range = { start: string; end: string };

function dateFilter(from: string, to: string) {
  return { gte: dateOnlyToUtcDate(from), lte: dateOnlyToUtcDate(to) };
}

async function loadBbtReadings(
  userId: string,
  from: string,
  to: string
): Promise<BbtReading[]> {
  const rows = await prisma.journalEntry.findMany({
    where: { userId, date: dateFilter(from, to), temperature: { not: null } },
    select: { date: true, temperature: true },
    orderBy: { date: 'asc' },
  });
  return rows.flatMap((row) =>
    row.temperature === null
      ? []
      : [{ date: toDateOnlyString(row.date), celsius: row.temperature }]
  );
}

/** Journal check-in days with mood, energy and decrypted symptoms. */
async function loadSymptomDays(
  userId: string,
  range: Range
): Promise<SymptomDay[]> {
  const rows = await prisma.journalEntry.findMany({
    where: { userId, date: dateFilter(range.start, range.end) },
    select: {
      date: true,
      mood: true,
      energy: true,
      sleepHours: true,
      symptomsPhysical: true,
      symptomsMental: true,
      // Read only to tell a journal check-in from a quick-log-only day; never decrypted.
      notes: true,
      gratitudeNotes: true,
      goalsNotes: true,
      symptomsNotes: true,
      tags: true,
      gratitudeEntries: true,
      goalsAchieved: true,
      goalsProgress: true,
    },
    orderBy: { date: 'asc' },
  });
  return rows.filter(isJournalCheckIn).map((row) => ({
    date: toDateOnlyString(row.date),
    mood: row.mood,
    energy: row.energy,
    physical: decryptArray(row.symptomsPhysical),
    mental: decryptArray(row.symptomsMental),
  }));
}

/** Days with a journal note, symptom note or tags, decrypted. */
async function loadNoteDays(userId: string, range: Range): Promise<NoteDay[]> {
  const rows = await prisma.journalEntry.findMany({
    where: {
      userId,
      date: dateFilter(range.start, range.end),
      OR: [
        { notes: { not: null } },
        { symptomsNotes: { not: null } },
        { tags: { isEmpty: false } },
      ],
    },
    select: { date: true, notes: true, symptomsNotes: true, tags: true },
    orderBy: { date: 'asc' },
  });
  return rows.map((row) => ({
    date: toDateOnlyString(row.date),
    note: decrypt(row.notes),
    symptomNote: decrypt(row.symptomsNotes),
    tags: row.tags,
  }));
}

export async function loadClinicalReport(
  userId: string,
  options: ClinicalReportOptions,
  now: Date = new Date()
): Promise<ClinicalReport> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      name: true,
      enableCycleTracking: true,
      cycleLength: true,
      lastPeriodDate: true,
      temperatureUnit: true,
      trackVitals: true,
    },
  });
  if (!user.enableCycleTracking) {
    throw new ClinicalReportUnavailableError(
      'Turn on cycle tracking in your profile to create a clinical summary.'
    );
  }

  const today = resolveReportToday(options.today, todayDateKey(now));
  const range = reportRange(today, options.months);
  const periodStarts = normalizePeriodStarts(
    await listPeriodStartDates(userId),
    // Safety net for a start saved by code that predates the history table.
    user.lastPeriodDate ? toDateOnlyString(user.lastPeriodDate) : null
  );

  // The thermal shift of a cycle that began before the range needs its earlier readings.
  const firstCycle = findCycleForDate(
    buildCycleHistory(periodStarts),
    range.start
  );
  const bbtFrom =
    firstCycle && firstCycle.start < range.start ? firstCycle.start : range.start;
  // Vitals only with the vitals opt-in, which also governs the recovery score.
  const includeVitals = options.includeVitals && user.trackVitals;

  const [bbtReadings, symptomDays, vitalsRows, noteDays] = await Promise.all([
    options.includeBbt
      ? loadBbtReadings(userId, bbtFrom, range.end)
      : undefined,
    options.includeSymptoms ? loadSymptomDays(userId, range) : undefined,
    includeVitals
      ? loadDailyMetricsRows(
          userId,
          addDaysToDateOnly(range.start, -RECOVERY_BASELINE_WINDOW_DAYS),
          range.end
        )
      : undefined,
    options.includeNotes ? loadNoteDays(userId, range) : undefined,
  ]);

  return buildClinicalReport({
    today,
    months: options.months,
    generatedAt: now.toISOString(),
    name: options.includeName ? user.name : null,
    typicalCycleLength: user.cycleLength,
    temperatureUnit: parseTemperatureUnit(user.temperatureUnit),
    periodStarts,
    bbtReadings,
    symptomDays,
    vitalsRows,
    noteDays,
  });
}
