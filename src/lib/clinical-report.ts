/**
 * Clinical summary report: turns logged period starts, BBT readings, journal symptoms,
 * vitals and notes into the figures of the "Download Clinical Summary" PDF.
 *
 * Pure functions only (no database, no clock): `lib/clinical-report-data.ts` loads and
 * decrypts the rows the user asked for and calls `buildClinicalReport`. A section is in
 * the result only when its input is passed, so anything the user left out of the report
 * never leaves the server. The result is serialisable and goes straight to the client,
 * which draws the PDF; nothing is stored.
 *
 * Everything here describes the user's own self-reported data. It does not diagnose and
 * it uses no clinical cut-offs except the documented FIGO regularity bands below.
 *
 * **Report range.** The last 3, 6 or 12 calendar months up to and including "today"
 * (`reportRange`). Cycles are rebuilt from logged period starts with lib/cycle-history.
 *
 * **Cycle length variability.** Completed cycles that *began* inside the range (so every
 * listed cycle is fully known). Average, shortest/longest, the shortest-to-longest
 * difference and the sample standard deviation need at least 2 completed cycles. The
 * trend is the least-squares slope of length over cycle number, shown from 3 cycles; a
 * change of at least 1 day per cycle (after rounding to the 1 decimal shown) is called
 * lengthening/shortening (a descriptive heuristic, not a clinical criterion).
 *
 * **Regularity indicator.** FIGO's own measure, the shortest-to-longest difference in
 * completed cycle length: regular when it is at most 7-9 days and irregular from 8-10
 * days, the limit depending on age (Munro MG, Critchley HOD, Fraser IS; FIGO Menstrual
 * Disorders Committee, "The two FIGO systems for normal and abnormal uterine bleeding
 * symptoms and classification of causes of abnormal uterine bleeding in the reproductive
 * years: 2018 revisions", Int J Gynaecol Obstet 2018;143:393-408). Bands: up to 7 days
 * "consistent" (regular at any age), 8-9 days "somewhat variable" (regular or not
 * depending on age), 10 days or more "variable" (irregular at any age). More cycles can
 * only widen the observed difference, so 10+ days is labelled from 2 completed cycles,
 * while a smaller difference is labelled only from MIN_CYCLES_FOR_REGULARITY (with 2
 * cycles it is a single difference). The SD is reported alongside but not used for the
 * label: the range expected for a given SD grows with the number of cycles (range factor
 * d2 = 1.13 for 2 cycles, 2.53 for 6, 3.26 for 12), so fixed SD bands would contradict
 * FIGO for 3- and 12-month reports.
 *
 * **Phases.** The 4-phase wellness model of lib/cycle-calculator (`getPhaseForDay`):
 * completed cycles use their real length, the open cycle the user's typical length.
 * Phase lengths are therefore estimates (luteal ~14 days), not measurements. Where BBT
 * confirms ovulation, the BBT section reports the measured luteal length instead
 * (luteal phase ~12-14 days and fairly constant: NIH/Endotext "The Normal Menstrual
 * Cycle and the Control of Ovulation"). Days of the open cycle after the typical length
 * (a late period, or one not logged yet) get no phase: the model would call every one
 * of them luteal, although ovulation was later than modelled or did not happen. They
 * are counted separately (`beyondTypicalDays`) and left out of every by-phase figure.
 *
 * **BBT.** lib/bbt's 3-over-6 rule per cycle (Marshall 1968), run on every reading of
 * each cycle that overlaps the range, including readings before the range start. The
 * "rise" is the mean of the readings from the shift onwards minus the mean of the
 * cycle's readings before it. The measured luteal length counts the days after the
 * estimated ovulation day up to the day before the next period.
 *
 * **Symptoms.** Journal symptoms are free text, so they are grouped case-insensitively
 * after trimming. There is no severity field: figures are frequencies (days a symptom
 * was logged) against "check-in days" (journal days with anything entered in the journal
 * form, not just a quick-log temperature or vitals). Mood and energy (self-rated 1-10)
 * per phase are given as context only and labelled as such, not as symptom severity.
 *
 * **Notes.** Opt-in. Journal notes and tags in the range, newest kept when there are
 * many, each note cut to a readable length. Symptom notes are free-text symptom details,
 * so they are included only when both notes and symptoms are (`resolveReportInclusion`).
 */

import { getPhaseForDay, type CyclePhase } from '@/lib/cycle-calculator';
import type { ClinicalReportOptions } from '@/lib/validation/clinical-report-schemas';
import {
  buildCycleHistory,
  getCycleDayInfo,
  normalizePeriodStarts,
  type CycleDayInfo,
  type CycleSpan,
} from '@/lib/cycle-history';
import {
  analyzeBbtByCycle,
  cleanBbtReadings,
  roundTo,
  type BbtReading,
  type TemperatureUnit,
} from '@/lib/bbt';
import { EMOJI_PART } from '@/lib/pdf-text';
import { computeRecoverySeries, mean, sampleSd } from '@/lib/recovery';
import { buildRecoveryInputs, type DailyMetricsRow } from '@/lib/cycle-insights';
import {
  addDaysToDateOnly,
  addMonthsToDateOnly,
  daysBetweenDateOnly,
} from '@/lib/date-only';

export const REPORT_MONTH_OPTIONS = [3, 6, 12] as const;
export type ReportMonths = (typeof REPORT_MONTH_OPTIONS)[number];

export const REPORT_PHASES = [
  'menstrual',
  'follicular',
  'ovulation',
  'luteal',
] as const satisfies readonly CyclePhase[];

export const PHASE_LABELS: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulation: 'Ovulation',
  luteal: 'Luteal',
};

/** Completed cycles needed for average, range and standard deviation. */
export const MIN_CYCLES_FOR_VARIABILITY = 2;
/** Completed cycles needed before a trend is described. */
export const MIN_CYCLES_FOR_TREND = 3;
/** Least-squares change (days per cycle) at which a trend counts as a change. */
export const TREND_MIN_SLOPE_DAYS = 1;
/**
 * Regularity bands on the shortest-to-longest cycle length difference (days): FIGO
 * 2018's 7-9 day limit for regular cycles (see the module notes).
 */
export const REGULARITY_DIFFERENCE_BANDS = { consistent: 7, somewhatVariable: 9 } as const;
/**
 * Completed cycles needed before a difference within the FIGO limit gets a label. A
 * difference above it is labelled "variable" from MIN_CYCLES_FOR_VARIABILITY cycles.
 */
export const MIN_CYCLES_FOR_REGULARITY = 3;

export const MAX_SYMPTOMS_PER_KIND = 15;
export const MAX_SYMPTOM_PAIRS = 10;
/** A pair of symptoms is listed only when it was logged together on at least this many days. */
export const MIN_PAIR_DAYS = 2;
export const MAX_LABEL_CHARS = 60;
export const MAX_NOTE_ENTRIES = 60;
export const MAX_NOTE_CHARS = 400;
export const MAX_TAGS = 20;
export const MAX_TAG_CHARS = 40;
export const MAX_NAME_CHARS = 80;

export type ReportRange = {
  /** First day, inclusive (`YYYY-MM-DD`). */
  start: string;
  /** Last day ("today"), inclusive. */
  end: string;
  /** Number of calendar days in the range. */
  days: number;
};

export type PhaseCounts = Record<CyclePhase, number>;

export type ReportSections = {
  name: boolean;
  bbt: boolean;
  symptoms: boolean;
  vitals: boolean;
  notes: boolean;
  /** Free-text symptom notes, shown with the notes: only with both notes and symptoms. */
  symptomNotes: boolean;
};

/** The include toggles of the export dialog. */
export type ReportToggles = Omit<ClinicalReportOptions, 'months' | 'today'>;

/**
 * What a report contains for the user's toggles. The server loads data by this and the
 * export dialog's preview describes it, so what the user is shown is what they get.
 * Vitals also need the profile's vitals opt-in (it governs the recovery score), and
 * symptom notes need both the notes and the symptoms toggle: unticking symptoms keeps
 * every symptom detail out, free text included.
 */
export function resolveReportInclusion(
  toggles: ReportToggles,
  { vitalsAvailable }: { vitalsAvailable: boolean }
): ReportSections {
  return {
    name: toggles.includeName,
    bbt: toggles.includeBbt,
    symptoms: toggles.includeSymptoms,
    vitals: toggles.includeVitals && vitalsAvailable,
    notes: toggles.includeNotes,
    symptomNotes: toggles.includeNotes && toggles.includeSymptoms,
  };
}

export type ReportMeta = {
  name: string | null;
  months: ReportMonths;
  rangeStart: string;
  rangeEnd: string;
  rangeDays: number;
  /** ISO timestamp (server clock); formatted in the viewer's time zone. */
  generatedAt: string;
  typicalCycleLength: number;
  temperatureUnit: TemperatureUnit;
  sections: ReportSections;
};

export type CycleRow = { start: string; end: string; length: number };

export type CycleTrend = {
  direction: 'lengthening' | 'shortening' | 'stable';
  /** Least-squares change in days per cycle (1 decimal). */
  slopePerCycle: number;
};

export type CycleVariability = {
  /** Completed cycles that began in the range, oldest first. */
  completed: CycleRow[];
  /** The cycle in progress on the last day of the range. */
  current: { start: string; day: number } | null;
  /** Logged period starts inside the range, oldest first. */
  periodStartsInRange: string[];
  count: number;
  /** False when fewer than MIN_CYCLES_FOR_VARIABILITY completed cycles exist. */
  enoughForVariability: boolean;
  averageLength: number | null;
  minLength: number | null;
  maxLength: number | null;
  /** Longest minus shortest completed cycle (days). */
  variationDays: number | null;
  /** Sample standard deviation (days, 1 decimal). */
  sdLength: number | null;
  trend: CycleTrend | null;
};

export type RegularityLevel = 'consistent' | 'somewhat-variable' | 'variable';

export const REGULARITY_LABELS: Record<RegularityLevel, string> = {
  consistent: 'Consistent',
  'somewhat-variable': 'Somewhat variable',
  variable: 'Variable',
};

export type PhaseShare = {
  phase: CyclePhase;
  days: number;
  /** Share of the days in the range that have a phase (1 decimal). */
  percent: number;
  /** Average estimated length in completed cycles (1 decimal), or null. */
  averageLength: number | null;
};

export type PhaseDistribution = {
  /** Days in the range with an estimated phase (the base of `percent`). */
  trackedDays: number;
  /** Days in the range before the first logged period start (no phase). */
  untrackedDays: number;
  /**
   * Days of the open cycle after the typical cycle length (period late or not logged
   * yet). No phase is estimated for them. tracked + untracked + beyond = range days.
   */
  beyondTypicalDays: number;
  phases: PhaseShare[];
  /** Completed cycles the average phase lengths come from. */
  cyclesForLengths: number;
  /** Null below MIN_CYCLES_FOR_VARIABILITY completed cycles. */
  regularity: {
    /** Null when there are too few cycles to call the difference regular. */
    level: RegularityLevel | null;
    /** Longest minus shortest completed cycle (days), the basis of `level`. */
    differenceDays: number;
    /** Sample standard deviation (days, 1 decimal), for information. */
    sd: number;
    cycles: number;
  } | null;
};

export type BbtCycleStatus = 'confirmed' | 'no-shift' | 'not-enough-readings';

export type BbtCycleSummary = {
  start: string;
  end: string | null;
  isOpen: boolean;
  /** Valid readings in the whole cycle (the rule uses all of them). */
  readings: number;
  status: BbtCycleStatus;
  ovulationDate: string | null;
  shiftDate: string | null;
  confirmedDate: string | null;
  coverlineCelsius: number | null;
  preShiftAverageCelsius: number | null;
  postShiftAverageCelsius: number | null;
  /** Post-shift mean minus pre-shift mean, °C (2 decimals). */
  riseCelsius: number | null;
  /** Days after the estimated ovulation up to the day before the next period. */
  lutealLength: number | null;
};

export type BbtTrends = {
  unit: TemperatureUnit;
  /** Valid readings inside the range, oldest first (°C). */
  readings: BbtReading[];
  daysWithReading: number;
  phaseAverages: {
    phase: CyclePhase;
    averageCelsius: number | null;
    readings: number;
  }[];
  /** Cycles overlapping the range that have at least one reading, oldest first. */
  cycles: BbtCycleSummary[];
  /** Bio-verified (BBT-confirmed) estimated ovulation days inside the range. */
  ovulationDates: string[];
};

export type SymptomStat = {
  label: string;
  kind: 'physical' | 'mental';
  /** Check-in days the symptom was logged on. */
  days: number;
  byPhase: PhaseCounts;
};

export type SymptomPair = { a: string; b: string; days: number };

export type SymptomClusters = {
  checkInDays: number;
  checkInDaysByPhase: PhaseCounts;
  /**
   * Check-in days with no estimated phase: before the first logged period start, or
   * after the typical length in the open cycle.
   */
  checkInDaysWithoutPhase: number;
  daysWithSymptoms: number;
  physical: SymptomStat[];
  mental: SymptomStat[];
  /** Distinct symptoms left out because of the per-kind cap. */
  omittedSymptoms: number;
  pairs: SymptomPair[];
  moodEnergyByPhase: {
    phase: CyclePhase;
    mood: number | null;
    energy: number | null;
    days: number;
  }[];
};

export type VitalsAverages = {
  days: number;
  restingHeartRate: number | null;
  heartRateVariability: number | null;
  sleepQuality: number | null;
  sleepHours: number | null;
  recoveryScore: number | null;
};

export type VitalsSummary = {
  overall: VitalsAverages;
  byPhase: ({ phase: CyclePhase } & VitalsAverages)[];
  scoredDays: number;
  /** Days flagged as a bigger-than-usual recovery dip. */
  dipDays: number;
};

export type NoteEntry = {
  date: string;
  phase: CyclePhase | null;
  note: string | null;
  symptomNote: string | null;
  tags: string[];
};

export type NotesSection = {
  entries: NoteEntry[];
  /** Older entries left out because of MAX_NOTE_ENTRIES. */
  omittedEntries: number;
  tagCounts: { tag: string; days: number }[];
};

export type ClinicalReport = {
  meta: ReportMeta;
  cycles: CycleVariability;
  phases: PhaseDistribution;
  /** Present only when requested. */
  bbt?: BbtTrends;
  symptoms?: SymptomClusters;
  vitals?: VitalsSummary;
  notes?: NotesSection;
};

/** One journal check-in day's mood, energy and symptoms (decrypted). */
export type SymptomDay = {
  date: string;
  mood: number | null;
  energy: number | null;
  physical: readonly string[];
  mental: readonly string[];
};

/** One journal day's notes and tags (decrypted). */
export type NoteDay = {
  date: string;
  note: string | null;
  symptomNote: string | null;
  tags: readonly string[];
};

export type ClinicalReportInput = {
  /** Last day of the report (`YYYY-MM-DD`), see `resolveReportToday`. */
  today: string;
  months: ReportMonths;
  generatedAt: string;
  /** Account name, or null when the user left it out. */
  name: string | null;
  typicalCycleLength: number;
  temperatureUnit: TemperatureUnit;
  periodStarts: readonly string[];
  /** Each of these is optional: a missing input leaves its section out of the report. */
  bbtReadings?: readonly BbtReading[];
  symptomDays?: readonly SymptomDay[];
  vitalsRows?: readonly DailyMetricsRow[];
  noteDays?: readonly NoteDay[];
};

/**
 * The viewer's calendar day when it is within one day of the server's UTC day (any
 * real time zone is), otherwise the server's day. Keeps the report range on the
 * viewer's calendar without trusting an arbitrary date from the client.
 */
export function resolveReportToday(
  clientToday: string | undefined,
  serverToday: string
): string {
  if (!clientToday) return serverToday;
  return Math.abs(daysBetweenDateOnly(serverToday, clientToday)) <= 1
    ? clientToday
    : serverToday;
}

/** The last `months` calendar months up to and including `today`. */
export function reportRange(today: string, months: ReportMonths): ReportRange {
  const start = addDaysToDateOnly(addMonthsToDateOnly(today, -months), 1);
  return { start, end: today, days: daysBetweenDateOnly(start, today) + 1 };
}

function inRange(date: string, range: ReportRange): boolean {
  return date >= range.start && date <= range.end;
}

function round1(value: number): number {
  return roundTo(value, 1);
}

function meanOrNull(values: readonly number[], decimals = 1): number | null {
  return values.length > 0 ? roundTo(mean(values), decimals) : null;
}

function emptyPhaseCounts(): PhaseCounts {
  return { menstrual: 0, follicular: 0, ovulation: 0, luteal: 0 };
}

/** Least-squares slope of `values` over their index (0, 1, 2, …). 0 for < 2 values. */
export function linearSlope(values: readonly number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = mean(values);
  let numerator = 0;
  let denominator = 0;
  values.forEach((y, x) => {
    numerator += (x - xMean) * (y - yMean);
    denominator += (x - xMean) ** 2;
  });
  return numerator / denominator;
}

/**
 * Regularity label for a shortest-to-longest difference over `cycles` completed cycles,
 * or null when there are too few cycles to give one (see the module notes).
 */
export function classifyRegularity(
  differenceDays: number,
  cycles: number
): RegularityLevel | null {
  if (cycles < MIN_CYCLES_FOR_VARIABILITY) return null;
  if (differenceDays > REGULARITY_DIFFERENCE_BANDS.somewhatVariable) return 'variable';
  // More cycles can only widen the difference, so a small one needs enough of them.
  if (cycles < MIN_CYCLES_FOR_REGULARITY) return null;
  return differenceDays <= REGULARITY_DIFFERENCE_BANDS.consistent
    ? 'consistent'
    : 'somewhat-variable';
}

/** Cuts `text` to at most `max` characters (whole code points), ending with "…". */
export function truncateText(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return `${chars.slice(0, Math.max(0, max - 1)).join('').trimEnd()}…`;
}

/** A day of the open cycle after the typical length: the next period is late or unlogged. */
function isBeyondTypicalLength(info: CycleDayInfo): boolean {
  return info.cycle.isOpen && info.cycleDay > info.phaseCycleLength;
}

/**
 * Estimated phase of a day, or null before the first logged period start and in the
 * open cycle after the typical length (see the module notes on phases).
 */
function phaseOf(
  cycles: readonly CycleSpan[],
  date: string,
  typicalCycleLength: number
): CyclePhase | null {
  const info = getCycleDayInfo(cycles, date, typicalCycleLength);
  return info && !isBeyondTypicalLength(info) ? info.phase : null;
}

function completedCyclesInRange(
  cycles: readonly CycleSpan[],
  range: ReportRange
): CycleRow[] {
  return cycles.flatMap((cycle) =>
    cycle.length !== null && cycle.end !== null && inRange(cycle.start, range)
      ? [{ start: cycle.start, end: cycle.end, length: cycle.length }]
      : []
  );
}

export function summarizeCycleVariability(
  cycles: readonly CycleSpan[],
  range: ReportRange
): CycleVariability {
  const completed = completedCyclesInRange(cycles, range);
  const lengths = completed.map((cycle) => cycle.length);
  const enough = lengths.length >= MIN_CYCLES_FOR_VARIABILITY;
  const open = cycles.find(
    (cycle) => cycle.isOpen && cycle.start <= range.end
  );

  let trend: CycleTrend | null = null;
  if (lengths.length >= MIN_CYCLES_FOR_TREND) {
    // Classified on the rounded slope the PDF prints, so "+1.0" is never "stable".
    const slope = round1(linearSlope(lengths));
    trend = {
      direction:
        slope >= TREND_MIN_SLOPE_DAYS
          ? 'lengthening'
          : slope <= -TREND_MIN_SLOPE_DAYS
            ? 'shortening'
            : 'stable',
      slopePerCycle: slope,
    };
  }

  return {
    completed,
    current: open
      ? { start: open.start, day: daysBetweenDateOnly(open.start, range.end) + 1 }
      : null,
    periodStartsInRange: cycles
      .map((cycle) => cycle.start)
      .filter((start) => inRange(start, range)),
    count: completed.length,
    enoughForVariability: enough,
    averageLength: enough ? round1(mean(lengths)) : null,
    minLength: enough ? Math.min(...lengths) : null,
    maxLength: enough ? Math.max(...lengths) : null,
    variationDays: enough ? Math.max(...lengths) - Math.min(...lengths) : null,
    sdLength: enough ? round1(sampleSd(lengths)) : null,
    trend,
  };
}

export function summarizePhaseDistribution(
  cycles: readonly CycleSpan[],
  range: ReportRange,
  typicalCycleLength: number
): PhaseDistribution {
  const counts = emptyPhaseCounts();
  let untrackedDays = 0;
  let beyondTypicalDays = 0;
  for (let i = 0; i < range.days; i++) {
    const info = getCycleDayInfo(
      cycles,
      addDaysToDateOnly(range.start, i),
      typicalCycleLength
    );
    if (!info) untrackedDays++;
    else if (isBeyondTypicalLength(info)) beyondTypicalDays++;
    else counts[info.phase]++;
  }
  const trackedDays = range.days - untrackedDays - beyondTypicalDays;

  const completed = completedCyclesInRange(cycles, range);
  const lengthsByPhase: Record<CyclePhase, number[]> = {
    menstrual: [],
    follicular: [],
    ovulation: [],
    luteal: [],
  };
  for (const cycle of completed) {
    const perCycle = emptyPhaseCounts();
    for (let day = 1; day <= cycle.length; day++) {
      perCycle[getPhaseForDay(day, cycle.length)]++;
    }
    for (const phase of REPORT_PHASES) {
      lengthsByPhase[phase].push(perCycle[phase]);
    }
  }

  const lengths = completed.map((cycle) => cycle.length);
  const differenceDays =
    lengths.length >= MIN_CYCLES_FOR_VARIABILITY
      ? Math.max(...lengths) - Math.min(...lengths)
      : null;

  return {
    trackedDays,
    untrackedDays,
    beyondTypicalDays,
    phases: REPORT_PHASES.map((phase) => ({
      phase,
      days: counts[phase],
      percent: trackedDays > 0 ? round1((counts[phase] / trackedDays) * 100) : 0,
      averageLength: meanOrNull(lengthsByPhase[phase]),
    })),
    cyclesForLengths: completed.length,
    regularity:
      differenceDays === null
        ? null
        : {
            level: classifyRegularity(differenceDays, lengths.length),
            differenceDays,
            sd: round1(sampleSd(lengths)),
            cycles: lengths.length,
          },
  };
}

export function summarizeBbt(
  cycles: readonly CycleSpan[],
  readings: readonly BbtReading[],
  range: ReportRange,
  typicalCycleLength: number,
  unit: TemperatureUnit
): BbtTrends {
  const valid = cleanBbtReadings(readings).filter((r) => r.date <= range.end);
  const inRangeReadings = valid.filter((r) => inRange(r.date, range));

  const byPhase: Record<CyclePhase, number[]> = {
    menstrual: [],
    follicular: [],
    ovulation: [],
    luteal: [],
  };
  for (const reading of inRangeReadings) {
    const phase = phaseOf(cycles, reading.date, typicalCycleLength);
    if (phase) byPhase[phase].push(reading.celsius);
  }

  const overlapping = cycles.filter(
    (cycle) =>
      cycle.start <= range.end &&
      (cycle.end === null || cycle.end >= range.start)
  );
  const summaries: BbtCycleSummary[] = analyzeBbtByCycle(overlapping, valid)
    .filter((analysis) =>
      analysis.readings.some((reading) => inRange(reading.date, range))
    )
    .map(({ cycle, readings: cycleReadings, shift }) => {
      const base = {
        start: cycle.start,
        end: cycle.end,
        isOpen: cycle.isOpen,
        readings: cycleReadings.length,
      };
      if (!shift.detected) {
        return {
          ...base,
          status:
            shift.reason === 'insufficient-readings'
              ? ('not-enough-readings' as const)
              : ('no-shift' as const),
          ovulationDate: null,
          shiftDate: null,
          confirmedDate: null,
          coverlineCelsius: null,
          preShiftAverageCelsius: null,
          postShiftAverageCelsius: null,
          riseCelsius: null,
          lutealLength: null,
        };
      }
      const pre = cycleReadings
        .filter((r) => r.date < shift.shiftDate)
        .map((r) => r.celsius);
      const post = cycleReadings
        .filter((r) => r.date >= shift.shiftDate)
        .map((r) => r.celsius);
      const preAverage = meanOrNull(pre, 2);
      const postAverage = meanOrNull(post, 2);
      return {
        ...base,
        status: 'confirmed' as const,
        ovulationDate: shift.ovulationDate,
        shiftDate: shift.shiftDate,
        confirmedDate: shift.confirmedDate,
        coverlineCelsius: shift.coverlineCelsius,
        preShiftAverageCelsius: preAverage,
        postShiftAverageCelsius: postAverage,
        riseCelsius:
          preAverage !== null && postAverage !== null
            ? roundTo(mean(post) - mean(pre), 2)
            : null,
        lutealLength:
          cycle.end !== null
            ? daysBetweenDateOnly(shift.ovulationDate, cycle.end)
            : null,
      };
    });

  return {
    unit,
    readings: inRangeReadings,
    daysWithReading: inRangeReadings.length,
    phaseAverages: REPORT_PHASES.map((phase) => ({
      phase,
      averageCelsius: meanOrNull(byPhase[phase], 2),
      readings: byPhase[phase].length,
    })),
    cycles: summaries,
    ovulationDates: summaries.flatMap((summary) =>
      summary.ovulationDate !== null && inRange(summary.ovulationDate, range)
        ? [summary.ovulationDate]
        : []
    ),
  };
}

/**
 * Emoji and their parts, flags included (the same set the PDF drops): "Tired 😴" is
 * grouped with "Tired" and "Trip 🇸🇪" with "Trip".
 */
const EMOJI = new RegExp(EMOJI_PART.source, 'gu');

/**
 * Grouping key and display label for a free-text symptom or tag: emoji removed,
 * whitespace collapsed, trailing punctuation dropped, compared case-insensitively.
 * Null for blank (or emoji-only) text, which the PDF fonts could not print anyway.
 */
export function normalizeLabel(
  raw: string,
  maxChars: number = MAX_LABEL_CHARS
): { key: string; label: string } | null {
  const text = raw
    .normalize('NFC')
    .replace(EMOJI, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,;:!]+$/, '')
    .trim();
  if (!text) return null;
  const label = truncateText(
    text.charAt(0).toLocaleUpperCase() + text.slice(1),
    maxChars
  );
  return { key: text.toLocaleLowerCase(), label };
}

/**
 * A "check-in" is a journal day with anything entered in the journal form. Days that
 * only hold quick-log values (temperature, cervical mucus, vitals) are not check-ins,
 * so they do not dilute symptom frequencies. Presence checks only: nothing is decrypted.
 */
export function isJournalCheckIn(entry: {
  mood: number | null;
  energy: number | null;
  sleepHours: number | null;
  notes: string | null;
  gratitudeNotes: string | null;
  goalsNotes: string | null;
  symptomsNotes: string | null;
  tags: readonly string[];
  gratitudeEntries: readonly string[];
  goalsAchieved: readonly string[];
  goalsProgress: readonly string[];
  symptomsPhysical: readonly string[];
  symptomsMental: readonly string[];
}): boolean {
  return (
    entry.mood !== null ||
    entry.energy !== null ||
    entry.sleepHours !== null ||
    Boolean(entry.notes) ||
    Boolean(entry.gratitudeNotes) ||
    Boolean(entry.goalsNotes) ||
    Boolean(entry.symptomsNotes) ||
    entry.tags.length > 0 ||
    entry.gratitudeEntries.length > 0 ||
    entry.goalsAchieved.length > 0 ||
    entry.goalsProgress.length > 0 ||
    entry.symptomsPhysical.length > 0 ||
    entry.symptomsMental.length > 0
  );
}

function rankStats(stats: Iterable<SymptomStat>): SymptomStat[] {
  return [...stats].sort(
    (a, b) => b.days - a.days || a.label.localeCompare(b.label)
  );
}

export function summarizeSymptoms(
  cycles: readonly CycleSpan[],
  days: readonly SymptomDay[],
  range: ReportRange,
  typicalCycleLength: number
): SymptomClusters {
  const checkInDaysByPhase = emptyPhaseCounts();
  let checkInDays = 0;
  let checkInDaysWithoutPhase = 0;
  let daysWithSymptoms = 0;
  const stats = { physical: new Map<string, SymptomStat>(), mental: new Map<string, SymptomStat>() };
  const labels = new Map<string, string>();
  const pairCounts = new Map<string, { a: string; b: string; days: number }>();
  const moodByPhase: Record<CyclePhase, number[]> = {
    menstrual: [],
    follicular: [],
    ovulation: [],
    luteal: [],
  };
  const energyByPhase: Record<CyclePhase, number[]> = {
    menstrual: [],
    follicular: [],
    ovulation: [],
    luteal: [],
  };
  const moodEnergyDays = emptyPhaseCounts();

  // One entry per day (the database has one; keep the last if a caller repeats a day).
  const byDate = new Map<string, SymptomDay>();
  for (const day of days) {
    if (inRange(day.date, range)) byDate.set(day.date, day);
  }

  for (const day of [...byDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  )) {
    const phase = phaseOf(cycles, day.date, typicalCycleLength);
    checkInDays++;
    if (phase) checkInDaysByPhase[phase]++;
    else checkInDaysWithoutPhase++;

    if (phase && (day.mood !== null || day.energy !== null)) {
      moodEnergyDays[phase]++;
      if (day.mood !== null) moodByPhase[phase].push(day.mood);
      if (day.energy !== null) energyByPhase[phase].push(day.energy);
    }

    const dayKeys = new Set<string>();
    for (const kind of ['physical', 'mental'] as const) {
      const seen = new Set<string>();
      for (const raw of day[kind]) {
        const normalized = normalizeLabel(raw);
        if (!normalized || seen.has(normalized.key)) continue;
        seen.add(normalized.key);
        dayKeys.add(normalized.key);
        if (!labels.has(normalized.key)) {
          labels.set(normalized.key, normalized.label);
        }
        const stat = stats[kind].get(normalized.key) ?? {
          label: normalized.label,
          kind,
          days: 0,
          byPhase: emptyPhaseCounts(),
        };
        stat.days++;
        if (phase) stat.byPhase[phase]++;
        stats[kind].set(normalized.key, stat);
      }
    }
    if (dayKeys.size > 0) daysWithSymptoms++;

    const sortedKeys = [...dayKeys].sort();
    for (let i = 0; i < sortedKeys.length; i++) {
      for (let j = i + 1; j < sortedKeys.length; j++) {
        const id = `${sortedKeys[i]}\u0000${sortedKeys[j]}`;
        const pair = pairCounts.get(id) ?? {
          a: sortedKeys[i],
          b: sortedKeys[j],
          days: 0,
        };
        pair.days++;
        pairCounts.set(id, pair);
      }
    }
  }

  const physical = rankStats(stats.physical.values());
  const mental = rankStats(stats.mental.values());
  const labelOf = (key: string) => labels.get(key) ?? key;

  return {
    checkInDays,
    checkInDaysByPhase,
    checkInDaysWithoutPhase,
    daysWithSymptoms,
    physical: physical.slice(0, MAX_SYMPTOMS_PER_KIND),
    mental: mental.slice(0, MAX_SYMPTOMS_PER_KIND),
    omittedSymptoms:
      Math.max(0, physical.length - MAX_SYMPTOMS_PER_KIND) +
      Math.max(0, mental.length - MAX_SYMPTOMS_PER_KIND),
    pairs: [...pairCounts.values()]
      .filter((pair) => pair.days >= MIN_PAIR_DAYS)
      .map((pair) => ({ a: labelOf(pair.a), b: labelOf(pair.b), days: pair.days }))
      .sort(
        (x, y) =>
          y.days - x.days || x.a.localeCompare(y.a) || x.b.localeCompare(y.b)
      )
      .slice(0, MAX_SYMPTOM_PAIRS),
    moodEnergyByPhase: REPORT_PHASES.map((phase) => ({
      phase,
      mood: meanOrNull(moodByPhase[phase]),
      energy: meanOrNull(energyByPhase[phase]),
      days: moodEnergyDays[phase],
    })),
  };
}

function averageVitals(
  rows: readonly DailyMetricsRow[],
  scores: readonly number[]
): VitalsAverages {
  const values = (pick: (row: DailyMetricsRow) => number | null) =>
    rows.flatMap((row) => {
      const value = pick(row);
      return value === null ? [] : [value];
    });
  return {
    days: rows.length,
    restingHeartRate: meanOrNull(values((r) => r.restingHeartRate)),
    heartRateVariability: meanOrNull(values((r) => r.heartRateVariability)),
    sleepQuality: meanOrNull(values((r) => r.sleepQuality)),
    sleepHours: meanOrNull(values((r) => r.sleepHours)),
    recoveryScore: meanOrNull(scores, 0),
  };
}

/**
 * Vitals and recovery by phase. `rows` should start 90 days before the range so the
 * recovery score of the first days has its baseline (see lib/recovery).
 */
export function summarizeVitals(
  cycles: readonly CycleSpan[],
  rows: readonly DailyMetricsRow[],
  range: ReportRange,
  typicalCycleLength: number
): VitalsSummary {
  const series = computeRecoverySeries(
    buildRecoveryInputs(
      rows.filter((row) => row.date <= range.end),
      cycles.length > 0 ? cycles : null,
      typicalCycleLength
    )
  ).filter((result) => inRange(result.date, range));
  const scoreByDate = new Map(
    series.flatMap((result) =>
      result.score === null ? [] : [[result.date, result.score] as const]
    )
  );

  const withData = rows.filter(
    (row) =>
      inRange(row.date, range) &&
      (row.restingHeartRate !== null ||
        row.heartRateVariability !== null ||
        row.sleepQuality !== null ||
        row.sleepHours !== null)
  );
  const scoresFor = (subset: readonly DailyMetricsRow[]) =>
    subset.flatMap((row) => {
      const score = scoreByDate.get(row.date);
      return score === undefined ? [] : [score];
    });

  return {
    overall: averageVitals(withData, scoresFor(withData)),
    byPhase: REPORT_PHASES.map((phase) => {
      const subset = withData.filter(
        (row) => phaseOf(cycles, row.date, typicalCycleLength) === phase
      );
      return { phase, ...averageVitals(subset, scoresFor(subset)) };
    }),
    scoredDays: scoreByDate.size,
    dipDays: series.filter((result) => result.alert).length,
  };
}

function cleanNote(text: string | null): string | null {
  const trimmed = text?.trim();
  return trimmed ? truncateText(trimmed, MAX_NOTE_CHARS) : null;
}

export function summarizeNotes(
  cycles: readonly CycleSpan[],
  days: readonly NoteDay[],
  range: ReportRange,
  typicalCycleLength: number
): NotesSection {
  const entries: NoteEntry[] = [];
  const tagCounts = new Map<string, { tag: string; days: number }>();
  const sorted = [...days]
    .filter((day) => inRange(day.date, range))
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const day of sorted) {
    const tags: string[] = [];
    const seen = new Set<string>();
    for (const raw of day.tags) {
      const normalized = normalizeLabel(raw, MAX_TAG_CHARS);
      if (!normalized || seen.has(normalized.key)) continue;
      seen.add(normalized.key);
      tags.push(normalized.label);
      const count = tagCounts.get(normalized.key) ?? {
        tag: normalized.label,
        days: 0,
      };
      count.days++;
      tagCounts.set(normalized.key, count);
    }
    const note = cleanNote(day.note);
    const symptomNote = cleanNote(day.symptomNote);
    if (note === null && symptomNote === null && tags.length === 0) continue;
    entries.push({
      date: day.date,
      phase: phaseOf(cycles, day.date, typicalCycleLength),
      note,
      symptomNote,
      tags,
    });
  }

  const omittedEntries = Math.max(0, entries.length - MAX_NOTE_ENTRIES);
  return {
    entries: entries.slice(omittedEntries),
    omittedEntries,
    tagCounts: [...tagCounts.values()]
      .sort((a, b) => b.days - a.days || a.tag.localeCompare(b.tag))
      .slice(0, MAX_TAGS),
  };
}

/**
 * The report. Sections whose input is missing are left out entirely (not empty), so
 * data the user did not choose to include is never part of the result.
 */
export function buildClinicalReport(input: ClinicalReportInput): ClinicalReport {
  const range = reportRange(input.today, input.months);
  // A start logged after "today" cannot be part of the report yet.
  const cycles = buildCycleHistory(
    normalizePeriodStarts(input.periodStarts).filter((d) => d <= range.end)
  );
  const typical = input.typicalCycleLength;
  const name = input.name?.trim()
    ? truncateText(input.name.trim(), MAX_NAME_CHARS)
    : null;
  // Symptom notes are symptom details: never without the symptoms section, even if a
  // caller passes them (the loader does not read them then; see resolveReportInclusion).
  const symptomNotes =
    input.noteDays !== undefined && input.symptomDays !== undefined;

  const report: ClinicalReport = {
    meta: {
      name,
      months: input.months,
      rangeStart: range.start,
      rangeEnd: range.end,
      rangeDays: range.days,
      generatedAt: input.generatedAt,
      typicalCycleLength: typical,
      temperatureUnit: input.temperatureUnit,
      sections: {
        name: name !== null,
        bbt: input.bbtReadings !== undefined,
        symptoms: input.symptomDays !== undefined,
        vitals: input.vitalsRows !== undefined,
        notes: input.noteDays !== undefined,
        symptomNotes,
      },
    },
    cycles: summarizeCycleVariability(cycles, range),
    phases: summarizePhaseDistribution(cycles, range, typical),
  };
  if (input.bbtReadings) {
    report.bbt = summarizeBbt(
      cycles,
      input.bbtReadings,
      range,
      typical,
      input.temperatureUnit
    );
  }
  if (input.symptomDays) {
    report.symptoms = summarizeSymptoms(cycles, input.symptomDays, range, typical);
  }
  if (input.vitalsRows) {
    report.vitals = summarizeVitals(cycles, input.vitalsRows, range, typical);
  }
  if (input.noteDays) {
    const noteDays = symptomNotes
      ? input.noteDays
      : input.noteDays.map((day) => ({ ...day, symptomNote: null }));
    report.notes = summarizeNotes(cycles, noteDays, range, typical);
  }
  return report;
}
