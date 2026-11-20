import { prisma } from '@/lib/db';
import { decrypt, encrypt } from '@/lib/encryption';
import {
  addDaysToDateOnly,
  dateOnlyToUtcDate,
  toDateOnlyString,
} from '@/lib/date-only';
import {
  isCervicalMucus,
  parseTemperatureUnit,
  roundTo,
  toStoredCelsius,
  type CervicalMucus,
  type TemperatureUnit,
} from '@/lib/bbt';
import {
  buildCycleHistory,
  normalizePeriodStarts,
  getOpenCycle,
} from '@/lib/cycle-history';
import {
  buildCycleInsights,
  buildTodayRecovery,
  RECOVERY_HISTORY_DAYS,
  type CycleChartOverlays,
  type DailyMetricsRow,
  type RecoverySummary,
  type ThermalShiftSummary,
} from '@/lib/cycle-insights';
import { listPeriodStartDates } from '@/lib/period-starts';
import type {
  BbtReadingInput,
  VitalsInput,
  VitalsPreferencesInput,
} from '@/lib/validation/vitals-schemas';

/**
 * BBT, cervical mucus and vitals on journal days, plus the loaders for the cycle page,
 * the dashboard Vitals card and the profile privacy controls.
 *
 * The quick-log writes here upsert ONLY their own JournalEntry fields. They never go
 * through `logJournalEntry`, which replaces list fields that are left out. Numeric
 * metrics are stored as plain numbers (like mood and energy); cervical mucus is health
 * text, so it is validated against its enum and then encrypted.
 */

/** Vitals were sent while the user's opt-in is off. */
export class VitalsNotEnabledError extends Error {
  constructor() {
    super('Turn on vitals tracking in your profile to log vitals.');
  }
}

/** One day's quick-log values, decrypted. */
export type DailyMetrics = {
  date: string;
  /** °C */
  temperature: number | null;
  cervicalMucus: CervicalMucus | null;
  restingHeartRate: number | null;
  heartRateVariability: number | null;
  sleepQuality: number | null;
};

const dailyMetricsSelect = {
  date: true,
  temperature: true,
  cervicalMucus: true,
  restingHeartRate: true,
  heartRateVariability: true,
  sleepQuality: true,
} as const;

type MetricFields = {
  temperature?: number | null;
  cervicalMucus?: string | null;
  restingHeartRate?: number | null;
  heartRateVariability?: number | null;
  sleepQuality?: number | null;
};

function decryptCervicalMucus(value: string | null): CervicalMucus | null {
  const plain = decrypt(value);
  return isCervicalMucus(plain) ? plain : null;
}

function emptyDailyMetrics(date: string): DailyMetrics {
  return {
    date,
    temperature: null,
    cervicalMucus: null,
    restingHeartRate: null,
    heartRateVariability: null,
    sleepQuality: null,
  };
}

/**
 * Writes only `fields` on the user's journal entry for `dateKey`. An entry is created
 * when needed, except when every field is being cleared (nothing to create then).
 */
async function writeDailyMetrics(
  userId: string,
  dateKey: string,
  fields: MetricFields
): Promise<DailyMetrics> {
  const date = dateOnlyToUtcDate(dateKey);
  const where = { userId_date: { userId, date } };
  const onlyClearing = Object.values(fields).every((value) => value === null);

  if (onlyClearing) {
    await prisma.journalEntry.updateMany({
      where: { userId, date },
      data: fields,
    });
    const row = await prisma.journalEntry.findUnique({
      where,
      select: dailyMetricsSelect,
    });
    return row ? toDailyMetrics(row) : emptyDailyMetrics(dateKey);
  }

  const row = await prisma.journalEntry.upsert({
    where,
    update: fields,
    create: { userId, date, ...fields },
    select: dailyMetricsSelect,
  });
  return toDailyMetrics(row);
}

function toDailyMetrics(row: {
  date: Date;
  temperature: number | null;
  cervicalMucus: string | null;
  restingHeartRate: number | null;
  heartRateVariability: number | null;
  sleepQuality: number | null;
}): DailyMetrics {
  return {
    date: toDateOnlyString(row.date),
    temperature: row.temperature,
    cervicalMucus: decryptCervicalMucus(row.cervicalMucus),
    restingHeartRate: row.restingHeartRate,
    heartRateVariability: row.heartRateVariability,
    sleepQuality: row.sleepQuality,
  };
}

/** Saves a BBT reading (converted to °C) and/or cervical mucus for one day. */
export async function saveBbtReading(
  userId: string,
  input: BbtReadingInput
): Promise<DailyMetrics> {
  const fields: MetricFields = {};
  if (input.temperature !== undefined) {
    fields.temperature =
      input.temperature === null
        ? null
        : toStoredCelsius(input.temperature, input.unit);
  }
  if (input.cervicalMucus !== undefined) {
    // Validated against the enum by the schema before it is encrypted.
    fields.cervicalMucus =
      input.cervicalMucus === null ? null : encrypt(input.cervicalMucus);
  }
  return writeDailyMetrics(userId, input.date, fields);
}

/** Saves resting heart rate, HRV and/or sleep quality for one day (opt-in required). */
export async function saveVitals(
  userId: string,
  input: VitalsInput
): Promise<DailyMetrics> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { trackVitals: true },
  });
  if (!user.trackVitals) {
    throw new VitalsNotEnabledError();
  }
  const fields: MetricFields = {};
  if (input.restingHeartRate !== undefined) {
    fields.restingHeartRate = input.restingHeartRate;
  }
  if (input.heartRateVariability !== undefined) {
    fields.heartRateVariability =
      input.heartRateVariability === null
        ? null
        : roundTo(input.heartRateVariability, 1);
  }
  if (input.sleepQuality !== undefined) {
    fields.sleepQuality = input.sleepQuality;
  }
  return writeDailyMetrics(userId, input.date, fields);
}

/** One day's quick-log values (all null when nothing is logged). */
export async function getDailyMetrics(
  userId: string,
  dateKey: string
): Promise<DailyMetrics> {
  const row = await prisma.journalEntry.findUnique({
    where: { userId_date: { userId, date: dateOnlyToUtcDate(dateKey) } },
    select: dailyMetricsSelect,
  });
  return row ? toDailyMetrics(row) : emptyDailyMetrics(dateKey);
}

const vitalsLogged = {
  OR: [
    { restingHeartRate: { not: null } },
    { heartRateVariability: { not: null } },
    { sleepQuality: { not: null } },
  ],
};

const bbtLogged = {
  OR: [{ temperature: { not: null } }, { cervicalMucus: { not: null } }],
};

/** "Delete all vitals data": clears RHR, HRV and sleep quality on every journal day. */
export async function clearVitalsData(userId: string): Promise<number> {
  const { count } = await prisma.journalEntry.updateMany({
    where: { userId, ...vitalsLogged },
    data: {
      restingHeartRate: null,
      heartRateVariability: null,
      sleepQuality: null,
    },
  });
  return count;
}

/** "Delete all temperature data": clears BBT and cervical mucus on every journal day. */
export async function clearBbtData(userId: string): Promise<number> {
  const { count } = await prisma.journalEntry.updateMany({
    where: { userId, ...bbtLogged },
    data: { temperature: null, cervicalMucus: null },
  });
  return count;
}

export type VitalsPreferences = {
  trackVitals: boolean;
  temperatureUnit: TemperatureUnit;
};

export async function updateVitalsPreferences(
  userId: string,
  input: VitalsPreferencesInput
): Promise<VitalsPreferences> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.trackVitals !== undefined && {
        trackVitals: input.trackVitals,
      }),
      ...(input.temperatureUnit !== undefined && {
        temperatureUnit: input.temperatureUnit,
      }),
    },
    select: { trackVitals: true, temperatureUnit: true },
  });
  return {
    trackVitals: user.trackVitals,
    temperatureUnit: parseTemperatureUnit(user.temperatureUnit),
  };
}

export type VitalsPrivacySummary = VitalsPreferences & {
  /** Journal days with any vitals value. */
  vitalsDays: number;
  /** Journal days with a temperature or cervical mucus value. */
  bbtDays: number;
};

export async function getVitalsPrivacySummary(
  userId: string
): Promise<VitalsPrivacySummary> {
  const [user, vitalsDays, bbtDays] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { trackVitals: true, temperatureUnit: true },
    }),
    prisma.journalEntry.count({ where: { userId, ...vitalsLogged } }),
    prisma.journalEntry.count({ where: { userId, ...bbtLogged } }),
  ]);
  return {
    trackVitals: user.trackVitals,
    temperatureUnit: parseTemperatureUnit(user.temperatureUnit),
    vitalsDays,
    bbtDays,
  };
}

/** Numeric metrics for `from`..`to` (inclusive), oldest first. */
export async function loadDailyMetricsRows(
  userId: string,
  from: string,
  to: string
): Promise<DailyMetricsRow[]> {
  const rows = await prisma.journalEntry.findMany({
    where: {
      userId,
      date: { gte: dateOnlyToUtcDate(from), lte: dateOnlyToUtcDate(to) },
    },
    select: {
      date: true,
      temperature: true,
      restingHeartRate: true,
      heartRateVariability: true,
      sleepQuality: true,
      sleepHours: true,
    },
    orderBy: { date: 'asc' },
  });
  return rows.map((row) => ({ ...row, date: toDateOnlyString(row.date) }));
}

/** Today's calendar day on the server, as stored dates use (UTC). */
export function todayDateKey(now: Date = new Date()): string {
  return toDateOnlyString(now);
}

export type CycleQuickLogData = {
  today: string;
  temperatureUnit: TemperatureUnit;
  todayLog: DailyMetrics;
  shift: ThermalShiftSummary;
  /** Logged period starts, newest first (at most 12). */
  recentPeriodStarts: string[];
};

export type CycleDashboardInsights = {
  quickLog: CycleQuickLogData;
  overlays: CycleChartOverlays;
};

/**
 * Everything the cycle page needs beyond the phase: the quick-log card data and the
 * chart overlays (BBT always, recovery only with the vitals opt-in).
 */
export async function loadCycleDashboardInsights(
  userId: string,
  options: {
    today: string;
    cycleLength: number;
    /** Today's day in the displayed cycle (`calculateCyclePhase().daysIntoCycle`). */
    daysIntoCycle: number;
    lastPeriodDate: Date;
    temperatureUnit: string;
    trackVitals: boolean;
  }
): Promise<CycleDashboardInsights> {
  const { today, cycleLength, daysIntoCycle, trackVitals } = options;
  const temperatureUnit = parseTemperatureUnit(options.temperatureUnit);
  const periodStarts = normalizePeriodStarts(
    await listPeriodStartDates(userId),
    // Safety net for a start saved by code that predates the history table.
    toDateOnlyString(options.lastPeriodDate)
  );
  const openCycle = getOpenCycle(buildCycleHistory(periodStarts));
  const chartStart = addDaysToDateOnly(today, -(daysIntoCycle - 1));

  const starts = [chartStart];
  if (openCycle) starts.push(openCycle.start);
  if (trackVitals)
    starts.push(addDaysToDateOnly(chartStart, -RECOVERY_HISTORY_DAYS));
  const from = starts.sort()[0];

  const [rows, todayLog] = await Promise.all([
    loadDailyMetricsRows(userId, from, today),
    getDailyMetrics(userId, today),
  ]);

  const insights = buildCycleInsights({
    today,
    cycleLength,
    daysIntoCycle,
    periodStarts,
    rows,
    temperatureUnit,
    includeRecovery: trackVitals,
  });

  return {
    quickLog: {
      today,
      temperatureUnit,
      todayLog,
      shift: insights.shift,
      recentPeriodStarts: [...periodStarts].reverse().slice(0, 12),
    },
    overlays: insights.overlays,
  };
}

export type VitalsCardData =
  | { trackVitals: false; today: string }
  | {
      trackVitals: true;
      today: string;
      todayLog: DailyMetrics;
      recovery: RecoverySummary | null;
    };

/** Data for the dashboard Vitals card. Loads no vitals unless the user opted in. */
export async function loadVitalsCardData(
  userId: string,
  today: string = todayDateKey()
): Promise<VitalsCardData> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      trackVitals: true,
      enableCycleTracking: true,
      cycleLength: true,
      lastPeriodDate: true,
    },
  });
  if (!user.trackVitals) {
    return { trackVitals: false, today };
  }

  const useCycle = user.enableCycleTracking && user.lastPeriodDate !== null;
  const [rows, todayLog, periodStarts] = await Promise.all([
    loadDailyMetricsRows(
      userId,
      addDaysToDateOnly(today, -RECOVERY_HISTORY_DAYS),
      today
    ),
    getDailyMetrics(userId, today),
    useCycle ? listPeriodStartDates(userId) : Promise.resolve([]),
  ]);
  const cycles = useCycle
    ? buildCycleHistory(
        normalizePeriodStarts(
          periodStarts,
          user.lastPeriodDate ? toDateOnlyString(user.lastPeriodDate) : null
        )
      )
    : null;

  return {
    trackVitals: true,
    today,
    todayLog,
    recovery: buildTodayRecovery({
      today,
      rows,
      cycles,
      typicalCycleLength: user.cycleLength,
    }),
  };
}
