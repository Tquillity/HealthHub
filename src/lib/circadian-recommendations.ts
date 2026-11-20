import { FALLBACK_TIME_ZONE, isValidTimeZone } from '@/lib/briefing/schedule';
import type { LowEnergyCheckIn, TakeItEasy } from '@/lib/briefing/types';
import { addDaysToDateOnly } from '@/lib/date-only';

/**
 * Circadian insights: time-of-day wellness suggestions from the user's local time
 * (User.timezone) and their own energy check-ins. Pure functions only; the data layer is
 * lib/circadian-data.ts.
 *
 * The suggestions follow well-established daily rhythms and stay cautious ("typically",
 * "many people"): they are wellness ideas, never a diagnosis or a measurement of anyone's
 * hormones. People differ in chronotype (Roenneberg T et al., "Epidemiology of the human
 * circadian clock", Sleep Med Rev 2007;11:429-438), so the user's own pattern wins once
 * there is enough of it.
 *
 * Sources for the daily patterns used below:
 * - Testosterone is highest in the early morning and falls across the day, roughly 10-15%
 *   lower by late afternoon in younger men (Brambilla DJ et al., "The effect of diurnal
 *   variation on clinical measurement of serum testosterone and other sex hormone levels
 *   in men", J Clin Endocrinol Metab 2009;94:907-913). It rises again during sleep
 *   (Luboshitzky R et al., J Clin Endocrinol Metab 2001;86:1134-1139), and one week of
 *   5-hour nights lowered daytime testosterone by 10-15% (Leproult R, Van Cauter E,
 *   JAMA 2011;305:2173-2174).
 * - Cortisol rises by about 50% in the 30-45 minutes after waking, the cortisol awakening
 *   response (Wüst S et al., Noise Health 2000;2:79-88; Clow A et al., "The cortisol
 *   awakening response: more than a measure of HPA axis function", Neurosci Biobehav Rev
 *   2010;35:97-103), then falls through the day to its low around midnight (Debono M et
 *   al., J Clin Endocrinol Metab 2009;94:1548-1554).
 * - Strength, power and core body temperature tend to peak in the late afternoon, and
 *   performance soon after waking is lower; a longer warm-up narrows the gap (Chtourou H,
 *   Souissi N, "The effect of training at a specific time of day: a review", J Strength
 *   Cond Res 2012;26:1984-2005; Drust B et al., Chronobiol Int 2005;22:21-44).
 *   Training at a consistent time matters more than the clock: morning and late-afternoon
 *   training gave similar muscle growth over 10 weeks (Sedliak M et al., J Strength Cond
 *   Res 2009;23:2451-2457).
 * - Alertness dips in the early afternoon (Monk TH, "The post-lunch dip in performance",
 *   Clin Sports Med 2005;24:e15-e23); short walks that break up sitting raise
 *   self-rated energy (Bergouignan A et al., Int J Behav Nutr Phys Act 2016;13:113).
 * - Caffeine 6 hours before bed still reduced sleep (Drake C et al., J Clin Sleep Med
 *   2013;9:1195-1200).
 * - Evening exercise does not harm sleep overall, but vigorous sessions ending within
 *   about an hour of bedtime can delay sleep onset (Stutz J et al., Sports Med
 *   2019;49:269-287).
 * - Morning light advances and evening light delays the body clock (Khalsa SBS et al.,
 *   J Physiol 2003;549:945-952); ordinary room light before bed suppresses melatonin
 *   (Gooley JJ et al., J Clin Endocrinol Metab 2011;96:E463-E472).
 * - Most growth hormone is released in the deep (slow-wave) sleep early in the night
 *   (Takahashi Y et al., J Clin Invest 1968;47:2079-2090; Van Cauter E et al., JAMA
 *   2000;284:861-868). Adults need 7 or more hours of sleep (Watson NF et al., Sleep
 *   2015;38:843-844), in a cool, dark room (Okamoto-Mizuno K, Mizuno K, J Physiol
 *   Anthropol 2012;31:14).
 */

export const CIRCADIAN_WINDOWS = [
  'morning',
  'afternoon',
  'evening',
  'night',
] as const;
export type CircadianWindow = (typeof CIRCADIAN_WINDOWS)[number];

/** The windows with an energy check-in: night has none. */
export const ENERGY_SLOTS = ['morning', 'afternoon', 'evening'] as const;
export type EnergySlot = (typeof ENERGY_SLOTS)[number];

/** JournalEntry column for each energy slot. */
export const ENERGY_SLOT_FIELDS = {
  morning: 'energyMorning',
  afternoon: 'energyAfternoon',
  evening: 'energyEvening',
} as const satisfies Record<EnergySlot, string>;
export type EnergySlotField = (typeof ENERGY_SLOT_FIELDS)[EnergySlot];

/** Local hours of each slot, `[start, end)`. Night is everything else (22:00-06:00). */
export const ENERGY_SLOT_HOURS: Record<
  EnergySlot,
  { start: number; end: number }
> = {
  morning: { start: 6, end: 12 },
  afternoon: { start: 12, end: 18 },
  evening: { start: 18, end: 22 },
};

export const CIRCADIAN_WINDOW_LABELS: Record<CircadianWindow, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night',
};

/** Energy check-ins from this many days (today included) form the personal pattern. */
export const ENERGY_HISTORY_DAYS = 30;

/**
 * A slot is personalised only with at least this many check-ins in the history window.
 * Product rule: about one working week of ratings, so one odd day cannot flip the result.
 */
export const MIN_SLOT_DATA_POINTS = 5;

/**
 * The best window must beat the next one by at least this much on the 1-10 scale.
 * Product rule: smaller gaps are within the day-to-day noise of a self-rating.
 */
export const BEST_WINDOW_MIN_LEAD = 0.5;

/**
 * Protein per serving for a "protein-rich" breakfast. About 20 g of protein per meal
 * maximises muscle protein synthesis in young men (Moore DR et al., Am J Clin Nutr
 * 2009;89:161-168; Schoenfeld BJ, Aragon AA, J Int Soc Sports Nutr 2018;15:10); spreading
 * protein evenly across meals raised 24-hour synthesis (Mamerow MM et al., J Nutr
 * 2014;144:876-880); a higher-protein breakfast improved fullness (Leidy HJ et al., Am J
 * Clin Nutr 2013;97:677-688).
 */
export const PROTEIN_RICH_BREAKFAST_MIN_GRAMS = 20;

/**
 * Calories per serving for a "lighter" dinner. Product heuristic (about a quarter of a
 * 2,400 kcal day), not a clinical threshold. Glucose tolerance is lower in the evening
 * (Van Cauter E, Polonsky KS, Scheen AJ, Endocr Rev 1997;18:716-738), and large meals close
 * to bedtime were linked with poorer sleep (Crispim CA et al., J Clin Sleep Med
 * 2011;7:659-664).
 */
export const LIGHT_DINNER_MAX_KCAL = 600;

export type LocalTime = {
  /** The user's calendar day, `YYYY-MM-DD`. */
  dateKey: string;
  hour: number;
  minute: number;
  /** The zone actually used (UTC when the profile zone is unknown). */
  timeZone: string;
  /** False when the profile zone was not a valid IANA zone and UTC was used instead. */
  timeZoneValid: boolean;
};

/** The wall-clock time of `instant` in `timeZone`; an invalid zone falls back to UTC. */
export function localTimeIn(instant: Date, timeZone: string): LocalTime {
  const timeZoneValid = isValidTimeZone(timeZone);
  const zone = timeZoneValid ? timeZone : FALLBACK_TIME_ZONE;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return {
    dateKey: `${part('year')}-${part('month')}-${part('day')}`,
    // Some engines print midnight as "24" even with h23; normalise it.
    hour: Number(part('hour')) % 24,
    minute: Number(part('minute')),
    timeZone: zone,
    timeZoneValid,
  };
}

export function windowForHour(hour: number): CircadianWindow {
  for (const slot of ENERGY_SLOTS) {
    const { start, end } = ENERGY_SLOT_HOURS[slot];
    if (hour >= start && hour < end) return slot;
  }
  return 'night';
}

/** The energy slot a check-in made now belongs to, or null at night. */
export function slotForWindow(window: CircadianWindow): EnergySlot | null {
  return window === 'night' ? null : window;
}

/**
 * Finer parts of the day for the suggestions, so the afternoon can tell the early
 * dip (12-15) from the late-afternoon performance peak (15-18).
 */
export type DayMoment =
  | 'early-morning'
  | 'late-morning'
  | 'early-afternoon'
  | 'late-afternoon'
  | 'evening'
  | 'night';

export function momentForHour(hour: number): DayMoment {
  switch (windowForHour(hour)) {
    case 'morning':
      return hour < 9 ? 'early-morning' : 'late-morning';
    case 'afternoon':
      return hour < 15 ? 'early-afternoon' : 'late-afternoon';
    case 'evening':
      return 'evening';
    case 'night':
      return 'night';
  }
}

// ---------------------------------------------------------------------------
// Personal energy pattern
// ---------------------------------------------------------------------------

export type TimeOfDayEnergyRow = {
  /** `YYYY-MM-DD` */
  date: string;
  energyMorning: number | null;
  energyAfternoon: number | null;
  energyEvening: number | null;
};

export type SlotEnergy = {
  /** Mean rating, one decimal; null without check-ins. */
  average: number | null;
  count: number;
  /** Enough check-ins (`MIN_SLOT_DATA_POINTS`) to use this slot's average. */
  personalized: boolean;
};

export type SlotEnergySummary = Record<EnergySlot, SlotEnergy>;

function isRating(value: number | null): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 10
  );
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Per-slot averages over the `ENERGY_HISTORY_DAYS` days ending on `today`. */
export function summarizeSlotEnergy(
  rows: readonly TimeOfDayEnergyRow[],
  today: string
): SlotEnergySummary {
  const from = addDaysToDateOnly(today, -(ENERGY_HISTORY_DAYS - 1));
  const inWindow = rows.filter((row) => row.date >= from && row.date <= today);
  const summary = {} as SlotEnergySummary;
  for (const slot of ENERGY_SLOTS) {
    const values = inWindow
      .map((row) => row[ENERGY_SLOT_FIELDS[slot]])
      .filter(isRating);
    const count = values.length;
    summary[slot] = {
      average:
        count > 0
          ? roundToOneDecimal(values.reduce((sum, v) => sum + v, 0) / count)
          : null,
      count,
      personalized: count >= MIN_SLOT_DATA_POINTS,
    };
  }
  return summary;
}

/** An average in tenths: averages are rounded to one decimal, so compare these. */
function averageTenths(slot: SlotEnergy): number {
  return Math.round((slot.average ?? 0) * 10);
}

/**
 * A slot with fewer than `MIN_SLOT_DATA_POINTS` check-ins (an early estimate) whose
 * average is at or above every personalised slot's, or null. The journal shows early
 * estimates next to the personalised averages, so naming another slot as the best while
 * this one looks as high would contradict the chart.
 */
export function leadingEarlyEstimate(
  summary: SlotEnergySummary
): EnergySlot | null {
  const logged = ENERGY_SLOTS.filter((slot) => summary[slot].average !== null);
  const personal = logged.filter((slot) => summary[slot].personalized);
  const early = logged.filter((slot) => !summary[slot].personalized);
  if (personal.length === 0 || early.length === 0) return null;
  const topPersonal = Math.max(
    ...personal.map((s) => averageTenths(summary[s]))
  );
  const topEarly = early.reduce((a, b) =>
    averageTenths(summary[b]) > averageTenths(summary[a]) ? b : a
  );
  return averageTenths(summary[topEarly]) >= topPersonal ? topEarly : null;
}

/**
 * The slot with the clearly highest average energy, once at least two slots have enough
 * check-ins; null when it is too early to tell, the top two are within
 * `BEST_WINDOW_MIN_LEAD` of each other, or a slot with fewer check-ins looks as high
 * (`leadingEarlyEstimate`).
 */
export function detectBestWindow(
  summary: SlotEnergySummary
): EnergySlot | null {
  const ranked = ENERGY_SLOTS.filter(
    (slot) => summary[slot].personalized && summary[slot].average !== null
  ).sort((a, b) => averageTenths(summary[b]) - averageTenths(summary[a]));
  if (ranked.length < 2) return null;
  const [best, next] = ranked;
  const lead = averageTenths(summary[best]) - averageTenths(summary[next]);
  if (lead < BEST_WINDOW_MIN_LEAD * 10) return null;
  return leadingEarlyEstimate(summary) === null ? best : null;
}

// ---------------------------------------------------------------------------
// Routine intensity
// ---------------------------------------------------------------------------

export const ROUTINE_INTENSITIES = ['low', 'medium', 'high'] as const;
export type RoutineIntensity = (typeof ROUTINE_INTENSITIES)[number];

/**
 * Typical good-fit routine intensity for a local hour on a 0 (low) to 2 (high) scale:
 * harder sessions from late morning (testosterone still high, alertness rising) and in
 * the late afternoon (strength and body temperature peak); lighter around the
 * early-afternoon dip; recovery in the evening and at night (sources at the top).
 */
export function typicalIntensityForHour(hour: number): number {
  switch (momentForHour(hour)) {
    case 'early-morning':
      return 1.5;
    case 'late-morning':
      return 2;
    case 'early-afternoon':
      return 0.5;
    case 'late-afternoon':
      return 2;
    case 'evening':
    case 'night':
      return 0;
  }
}

/** A 1-10 energy rating on the 0-2 intensity scale. */
function energyToIntensity(energy: number): number {
  const clamped = Math.min(10, Math.max(1, energy));
  return ((clamped - 1) / 9) * 2;
}

/**
 * Intensity target for now: the typical fit for the hour, pulled halfway towards how the
 * user says they feel (a tired morning lands on medium, not high).
 */
export function routineIntensityTarget(
  hour: number,
  energy: number | null
): number {
  const typical = typicalIntensityForHour(hour);
  if (energy === null) return typical;
  return (typical + energyToIntensity(energy)) / 2;
}

/** Floating-point noise around a halfway target, so 1.5000000000000002 is still halfway. */
const HALFWAY_TOLERANCE = 1e-9;

/**
 * The label for an intensity target. A target halfway between two labels takes the
 * lighter one: the early morning (1.5) is medium and the early-afternoon dip (0.5) is low,
 * as that moment's suggestions say (a longer warm-up first, something light in the dip).
 * Only an exact halfway value counts: just above it (an 8/10 check-in in the early
 * morning gives 1.53) takes the heavier label. The lottery still weights both neighbours
 * of a halfway target equally.
 */
export function intensityLabel(target: number): RoutineIntensity {
  const index = Math.min(
    2,
    Math.max(0, Math.ceil(target - 0.5 - HALFWAY_TOLERANCE))
  );
  return ROUTINE_INTENSITIES[index];
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

export type SuggestionKind =
  'personal' | 'movement' | 'focus' | 'light' | 'rest' | 'food';

export type CircadianSuggestion = {
  key: string;
  kind: SuggestionKind;
  title: string;
  body: string;
};

type BaseSuggestion = CircadianSuggestion & {
  /** Left out while the card holds back on harder work (see `buildCircadianInsights`). */
  demanding?: boolean;
  /** Points to later today; left out next to "now is a good time" (personal.high-now). */
  later?: boolean;
  /** About a dip in energy; left out next to "now is a good time" (personal.high-now). */
  forLowEnergy?: boolean;
};

const SUGGESTIONS = {
  morningLight: {
    key: 'morning.light',
    kind: 'light',
    title: 'Get some daylight',
    body: 'Daylight soon after waking helps set your body clock, which supports alertness now and sleepiness at bedtime. A short walk outside or breakfast by a window both count.',
  },
  morningHormones: {
    key: 'morning.hormones',
    kind: 'focus',
    title: 'Your natural morning high',
    body: 'Cortisol rises sharply in the first half hour after waking, and testosterone is typically at its highest in the early morning. Many people feel sharpest as the morning goes on.',
  },
  morningWarmUp: {
    key: 'morning.warm-up',
    kind: 'movement',
    title: 'Training early? Warm up a little longer',
    body: 'Strength and power are usually a bit lower soon after waking, while your body is still cool. A longer warm-up helps, and harder sessions tend to feel best from late morning.',
    demanding: true,
  },
  lateMorningTraining: {
    key: 'morning.training',
    kind: 'movement',
    title: 'A strong window for focus and training',
    body: 'Alertness usually keeps climbing through the late morning while testosterone is still near its daily high. A good time for demanding work or a strength-focused routine, if you feel ready.',
    demanding: true,
  },
  afternoonDip: {
    key: 'afternoon.dip',
    kind: 'movement',
    title: 'Ride out the early-afternoon dip',
    body: 'Many people feel a natural dip in alertness in the early afternoon. A 10-minute walk, ideally outside, or a low-energy routine from the lottery can lift your energy.',
    forLowEnergy: true,
  },
  afternoonCaffeine: {
    key: 'afternoon.caffeine',
    kind: 'rest',
    title: 'Keep coffee to the earlier part of the day',
    body: 'Caffeine taken even 6 hours before bed can shorten your sleep, so a last coffee around early afternoon is kinder to tonight.',
  },
  laterTraining: {
    key: 'afternoon.training-later',
    kind: 'movement',
    title: 'Later this afternoon suits harder training',
    body: 'Strength, power and body temperature tend to peak in the late afternoon. If you plan a harder session today, that is a good slot.',
    demanding: true,
    later: true,
  },
  afternoonTraining: {
    key: 'afternoon.training',
    kind: 'movement',
    title: 'A good window for harder training',
    body: 'Strength, power and body temperature tend to peak around now. A good time for a harder or skill-based session if your energy allows; training at a time you can keep up matters most.',
    demanding: true,
  },
  eveningRecovery: {
    key: 'evening.recovery',
    kind: 'rest',
    title: 'Shift towards recovery',
    body: 'Cortisol and testosterone are typically lower by the evening as your body starts winding down. Stretching, mobility, an easy walk or a calm routine fit this time well.',
  },
  eveningHardExercise: {
    key: 'evening.hard-exercise',
    kind: 'movement',
    title: 'Finish hard sessions early',
    body: 'Evening exercise is fine for most people, but very hard sessions that end within about an hour of bedtime can make it harder to fall asleep.',
  },
  eveningLight: {
    key: 'evening.light',
    kind: 'light',
    title: 'Dim the lights',
    body: 'Bright light in the evening holds back melatonin, the hormone that makes you sleepy. Dimmer, warmer light in the last hours before bed helps you wind down.',
  },
  nightWindDown: {
    key: 'night.wind-down',
    kind: 'rest',
    title: 'Time to wind down',
    body: 'Most growth hormone is released in deep sleep early in the night, and testosterone builds up while you sleep. Aim for 7 hours or more: a week of 5-hour nights lowered daytime testosterone by 10-15% in young men.',
  },
  nightDarkCool: {
    key: 'night.dark-cool',
    kind: 'rest',
    title: 'Keep it dark and cool',
    body: 'A dark, cool and quiet bedroom supports deeper sleep. Put screens away and keep lights low if you get up.',
  },
} satisfies Record<string, BaseSuggestion>;

const MOMENT_SUGGESTIONS: Record<DayMoment, BaseSuggestion[]> = {
  'early-morning': [
    SUGGESTIONS.morningLight,
    SUGGESTIONS.morningHormones,
    SUGGESTIONS.morningWarmUp,
  ],
  'late-morning': [
    SUGGESTIONS.lateMorningTraining,
    SUGGESTIONS.morningHormones,
    SUGGESTIONS.morningLight,
  ],
  'early-afternoon': [
    SUGGESTIONS.afternoonDip,
    SUGGESTIONS.afternoonCaffeine,
    SUGGESTIONS.laterTraining,
  ],
  'late-afternoon': [
    SUGGESTIONS.afternoonTraining,
    SUGGESTIONS.afternoonCaffeine,
  ],
  evening: [
    SUGGESTIONS.eveningRecovery,
    SUGGESTIONS.eveningHardExercise,
    SUGGESTIONS.eveningLight,
  ],
  night: [SUGGESTIONS.nightWindDown, SUGGESTIONS.nightDarkCool],
};

/** At most this many suggestions are shown at once. */
export const MAX_SUGGESTIONS = 4;

/** Rated energy at or below this counts as low right now. */
export const LOW_ENERGY_RATING = 3;
/** Rated energy at or above this counts as high right now. */
export const HIGH_ENERGY_RATING = 8;

/** A check-in at or below `LOW_ENERGY_RATING`. */
export function isLowEnergy(rating: number | null): boolean {
  return rating !== null && rating <= LOW_ENERGY_RATING;
}

/**
 * The highest intensity target (medium) while the card holds back after a low check-in
 * today. On a day the daily briefing calls a take-it-easy day, its own level applies
 * (`TakeItEasy.maxRoutineEnergy`): medium, as its "swap high intensity for moderate", or
 * low when it suggests a rest day or going gently.
 */
export const EASY_DAY_MAX_INTENSITY = 1;

const SLOT_NAMES: Record<EnergySlot, string> = {
  morning: 'morning',
  afternoon: 'afternoon',
  evening: 'evening',
};

/**
 * What the personal best window suits, for the dashboard card and the journal. The
 * evening gets no push for hard training even when it is the best window: very hard
 * sessions close to bedtime can delay sleep, and the evening suggestions are about
 * recovery (sources at the top).
 */
export function bestWindowAdvice(
  best: EnergySlot,
  when: 'now' | 'later'
): string {
  if (best === 'evening') {
    return when === 'now'
      ? 'A good time for focused tasks or easy movement; keep hard training well before bed.'
      : 'When you can, plan focused tasks or easy movement for then, and keep hard training well before bed.';
  }
  return when === 'now'
    ? 'A good time for your most demanding tasks or training.'
    : 'When you can, plan harder training or demanding tasks for then.';
}

/** An afternoon best window during the early-afternoon dip: its best part is still ahead. */
const AFTER_THE_DIP_ADVICE =
  'Later this afternoon, after the usual early dip, is a good time for your most demanding tasks or training.';

function personalSuggestions(input: {
  moment: DayMoment;
  slot: EnergySlot | null;
  currentEnergy: number | null;
  /** The user just rated their energy as low (`LOW_ENERGY_RATING`). */
  lowNow: boolean;
  /** The daily briefing calls today a take-it-easy day. */
  easyDay: TakeItEasy | null;
  /** No push for harder work (see `buildCircadianInsights`). */
  holdBack: boolean;
  /** A high check-in for now: "now is a good time" (see `buildCircadianInsights`). */
  highNow: boolean;
  slots: SlotEnergySummary;
  bestWindow: EnergySlot | null;
}): CircadianSuggestion[] {
  const { moment, slot, currentEnergy, lowNow, easyDay, holdBack, highNow } =
    input;
  const { slots, bestWindow } = input;
  if (moment === 'night' || slot === null) return [];
  const result: CircadianSuggestion[] = [];

  if (lowNow) {
    result.push({
      key: 'personal.low-now',
      kind: 'personal',
      title: 'Running low right now',
      body: `You rated your energy ${currentEnergy}/10 this ${SLOT_NAMES[slot]}. Something gentle, like a short walk, stretching or a lighter routine, may suit you better than a hard session. Sleep, stress and feeling unwell all affect energy, so listen to your body.`,
    });
  } else if (holdBack) {
    // In the words of the daily briefing's headline on the same dashboard, when the recent
    // logs are why. After a low check-in earlier today there is no note: that rating can
    // be hours old, so it is not "right now".
    if (easyDay?.fromLogs) {
      result.push({
        key: 'personal.easy-day',
        kind: 'personal',
        title: 'A gentler day may suit you',
        body: 'Your recent logs point to an easier day, so harder training is left out for now.',
      });
    }
  } else if (highNow) {
    result.push({
      key: 'personal.high-now',
      kind: 'personal',
      title: 'Plenty of energy right now',
      body: `You rated your energy ${currentEnergy}/10. If a harder session or a demanding task is on your list today, now is a good time for it.`,
    });
  }

  if (bestWindow !== null) {
    const best = slots[bestWindow];
    // While holding back, the pattern only: no push for harder work.
    const advice = (text: string | null) =>
      holdBack || text === null ? '' : ` ${text}`;
    if (bestWindow === slot) {
      // In the dip the best part is still ahead, unless "now is a good time" is shown
      // (personal.high-now): then the pattern only, so the card does not say both.
      const dipAdvice = highNow ? null : AFTER_THE_DIP_ADVICE;
      result.push({
        key: 'personal.best-now',
        kind: 'personal',
        title: 'Usually your best time of day',
        body: `Over the last ${ENERGY_HISTORY_DAYS} days your ${SLOT_NAMES[slot]} energy has averaged ${best.average}/10, your highest of the day.${advice(
          moment === 'early-afternoon'
            ? dipAdvice
            : bestWindowAdvice(bestWindow, 'now')
        )}`,
      });
    } else {
      const current = slots[slot];
      const comparison =
        current.personalized && current.average !== null
          ? `, compared with ${current.average}/10 in the ${SLOT_NAMES[slot]}`
          : '';
      result.push({
        key: 'personal.best-later',
        kind: 'personal',
        title: `Your best window is the ${SLOT_NAMES[bestWindow]}`,
        // Next to "now is a good time" (personal.high-now), the pattern only, so the card
        // does not also say to save harder work for another time of day.
        body: `Over the last ${ENERGY_HISTORY_DAYS} days your energy has averaged ${best.average}/10 in the ${SLOT_NAMES[bestWindow]}${comparison}.${advice(
          highNow ? null : bestWindowAdvice(bestWindow, 'later')
        )}`,
      });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Meals
// ---------------------------------------------------------------------------

export type MealFocus = 'protein-breakfast' | 'light-dinner';

/** Which meal nudge fits now: breakfast in the morning, dinner from late afternoon. */
export function mealFocusForMoment(moment: DayMoment): MealFocus | null {
  switch (moment) {
    case 'early-morning':
    case 'late-morning':
      return 'protein-breakfast';
    case 'late-afternoon':
    case 'evening':
      return 'light-dinner';
    case 'early-afternoon':
    case 'night':
      return null;
  }
}

export const MEAL_NUDGES: Record<
  MealFocus,
  { title: string; body: string; recipeCategory: string; browseLabel: string }
> = {
  'protein-breakfast': {
    title: 'A protein-rich breakfast',
    body: `Around ${PROTEIN_RICH_BREAKFAST_MIN_GRAMS}-30 g of protein at breakfast keeps you full for longer and spreads protein across the day for muscle repair.`,
    recipeCategory: 'Breakfast',
    browseLabel: 'Browse breakfast recipes',
  },
  'light-dinner': {
    title: 'A lighter evening meal',
    body: 'Your body handles carbohydrates less efficiently in the evening. A lighter dinner with vegetables and some protein, eaten a few hours before bed, tends to sit better before sleep.',
    recipeCategory: 'Dinner',
    browseLabel: 'Browse dinner recipes',
  },
};

// ---------------------------------------------------------------------------
// Everything together
// ---------------------------------------------------------------------------

export type CircadianInsights = {
  /** The user's calendar day, `YYYY-MM-DD`. */
  dateKey: string;
  /** `HH:mm` in `timeZone`. */
  localTime: string;
  hour: number;
  timeZone: string;
  /** The profile zone was invalid and UTC was used instead. */
  timeZoneFallback: boolean;
  window: CircadianWindow;
  moment: DayMoment;
  /** The check-in slot for now, or null at night. */
  slot: EnergySlot | null;
  /** Today's check-ins. */
  todayEnergy: Record<EnergySlot, number | null>;
  /** Today's check-in for the current slot (`energyNowFrom`). */
  currentEnergy: number | null;
  /** Today's low check-in the card holds back on (`lowCheckInToday`). */
  lowCheckIn: LowEnergyCheckIn | null;
  /** The daily briefing calls today a take-it-easy day (lib/easy-day). */
  easyDay: boolean;
  slots: SlotEnergySummary;
  bestWindow: EnergySlot | null;
  /** 0 (low) to 2 (high); see `routineIntensityTarget`. */
  intensityTarget: number;
  recommendedIntensity: RoutineIntensity;
  suggestions: CircadianSuggestion[];
  mealFocus: MealFocus | null;
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Today's check-in for each slot; null where there is none. */
function todayEnergyOf(
  rows: readonly TimeOfDayEnergyRow[],
  dateKey: string
): Record<EnergySlot, number | null> {
  const todayRow = rows.find((row) => row.date === dateKey);
  const todayEnergy = {} as Record<EnergySlot, number | null>;
  for (const s of ENERGY_SLOTS) {
    const value = todayRow ? todayRow[ENERGY_SLOT_FIELDS[s]] : null;
    todayEnergy[s] = isRating(value) ? value : null;
  }
  return todayEnergy;
}

/**
 * How the user rated their energy right now: today's check-in for the time-of-day slot
 * `now` falls in, in `timeZone` (UTC when unknown). Null at night and until they check in
 * for this slot. This is the card's `currentEnergy`.
 */
export function energyNowFrom(
  rows: readonly TimeOfDayEnergyRow[],
  now: Date,
  timeZone: string
): number | null {
  const local = localTimeIn(now, timeZone);
  const slot = slotForWindow(windowForHour(local.hour));
  return slot ? todayEnergyOf(rows, local.dateKey)[slot] : null;
}

/**
 * Today's low energy check-in: the one rule the circadian card and, through lib/easy-day,
 * the daily briefing hold back on, in `timeZone` (UTC when unknown).
 * - 'now': today's check-in for the current slot is at or below `LOW_ENERGY_RATING` (the
 *   card's "Running low right now").
 * - 'earlier': the current slot has no check-in yet and today's most recent check-in from
 *   an earlier slot was low. Never called "right now": it can be hours old. Rating the
 *   current slot replaces it.
 * - null otherwise, and at night, which has no slot.
 */
export function lowCheckInToday(
  rows: readonly TimeOfDayEnergyRow[],
  now: Date,
  timeZone: string
): LowEnergyCheckIn | null {
  const local = localTimeIn(now, timeZone);
  const slot = slotForWindow(windowForHour(local.hour));
  if (slot === null) return null;
  const today = todayEnergyOf(rows, local.dateKey);
  if (today[slot] !== null) return isLowEnergy(today[slot]) ? 'now' : null;
  const earlier = ENERGY_SLOTS.slice(0, ENERGY_SLOTS.indexOf(slot))
    .map((s) => today[s])
    .filter((value): value is number => value !== null);
  return isLowEnergy(earlier.at(-1) ?? null) ? 'earlier' : null;
}

export function buildCircadianInsights(input: {
  now: Date;
  timeZone: string;
  /** Check-in rows; only the last `ENERGY_HISTORY_DAYS` days count. */
  rows: readonly TimeOfDayEnergyRow[];
  /** The daily briefing calls today a take-it-easy day (lib/easy-day `loadEasyDay`). */
  easyDay?: TakeItEasy | null;
}): CircadianInsights {
  const local = localTimeIn(input.now, input.timeZone);
  const window = windowForHour(local.hour);
  const moment = momentForHour(local.hour);
  const slot = slotForWindow(window);
  const slots = summarizeSlotEnergy(input.rows, local.dateKey);
  const bestWindow = detectBestWindow(slots);
  const easyDay = input.easyDay ?? null;

  const todayEnergy = todayEnergyOf(input.rows, local.dateKey);
  const currentEnergy = slot ? todayEnergy[slot] : null;

  const lowCheckIn = lowCheckInToday(input.rows, input.now, input.timeZone);
  const lowNow = lowCheckIn === 'now';
  // No push for harder work after a low check-in today (the daily briefing takes it easy
  // after the same one) or on a day the briefing calls a take-it-easy day.
  const holdBack = lowCheckIn !== null || easyDay !== null;
  // "Plenty of energy right now": a high check-in for this slot, except while holding
  // back and in the evening, when the suggestions are about recovery.
  const highNow =
    !holdBack &&
    currentEnergy !== null &&
    currentEnergy >= HIGH_ENERGY_RATING &&
    slot !== 'evening';

  // How the user feels now: today's check-in, else their usual for this slot.
  const slotUsual =
    slot && slots[slot].personalized ? slots[slot].average : null;
  const target = routineIntensityTarget(local.hour, currentEnergy ?? slotUsual);
  // Capped while holding back, so the card's "Good fit right now" and the lottery lean
  // the same way as its suggestions and, on a take-it-easy day, the briefing's routines.
  const maxIntensity = easyDay
    ? ROUTINE_INTENSITIES.indexOf(easyDay.maxRoutineEnergy)
    : EASY_DAY_MAX_INTENSITY;
  const intensityTarget = holdBack ? Math.min(target, maxIntensity) : target;

  const base: CircadianSuggestion[] = MOMENT_SUGGESTIONS[moment]
    .filter((suggestion) => !(holdBack && suggestion.demanding))
    .filter(
      (suggestion) =>
        !(highNow && (suggestion.later || suggestion.forLowEnergy))
    )
    .map(({ key, kind, title, body }) => ({ key, kind, title, body }));
  const suggestions = [
    ...personalSuggestions({
      moment,
      slot,
      currentEnergy,
      lowNow,
      easyDay,
      holdBack,
      highNow,
      slots,
      bestWindow,
    }),
    ...base,
  ].slice(0, MAX_SUGGESTIONS);

  return {
    dateKey: local.dateKey,
    localTime: `${pad(local.hour)}:${pad(local.minute)}`,
    hour: local.hour,
    timeZone: local.timeZone,
    timeZoneFallback: !local.timeZoneValid,
    window,
    moment,
    slot,
    todayEnergy,
    currentEnergy,
    lowCheckIn,
    easyDay: easyDay !== null,
    slots,
    bestWindow,
    intensityTarget,
    recommendedIntensity: intensityLabel(intensityTarget),
    suggestions,
    mealFocus: mealFocusForMoment(moment),
  };
}

/** What the routine lottery needs to weight routines for now. */
export type LotteryCircadianTarget = {
  window: CircadianWindow;
  /** 0 (low) to 2 (high). */
  intensity: number;
};

/** What the lottery dialog tells the user about the weighting. */
export type CircadianLotteryHint = {
  windowLabel: string;
  recommendedIntensity: RoutineIntensity;
};

export function lotteryHintFromInsights(
  insights: CircadianInsights
): CircadianLotteryHint {
  return {
    windowLabel: CIRCADIAN_WINDOW_LABELS[insights.window],
    recommendedIntensity: insights.recommendedIntensity,
  };
}

export function lotteryTargetFromInsights(
  insights: CircadianInsights
): LotteryCircadianTarget {
  return { window: insights.window, intensity: insights.intensityTarget };
}
