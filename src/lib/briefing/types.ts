import type { CyclePhase } from '@/lib/cycle-calculator';
import type { BbtReading } from '@/lib/bbt';
import type { DailyMetricsRow } from '@/lib/cycle-insights';
import type { FocusPreference } from '@/types/cycle';

/**
 * Daily briefing: shared constants and types. Safe to import from client components
 * (no database, no Node APIs).
 */

export const BRIEFING_FREQUENCIES = ['daily', 'weekly', 'never'] as const;
export type BriefingFrequency = (typeof BRIEFING_FREQUENCIES)[number];

/** Data the briefing may read. Each one can be switched off in the profile. */
export const BRIEFING_SOURCES = [
  'journal',
  'cycle',
  'meals',
  'vitals',
] as const;
export type BriefingSource = (typeof BRIEFING_SOURCES)[number];

export const BRIEFING_DETAILS = ['brief', 'detailed'] as const;
export type BriefingDetail = (typeof BRIEFING_DETAILS)[number];

export const SUGGESTION_CATEGORIES = ['routine', 'meal', 'recovery'] as const;
export type SuggestionCategory = (typeof SUGGESTION_CATEGORIES)[number];

export const SUGGESTION_URGENCIES = ['high', 'medium', 'low'] as const;
export type SuggestionUrgency = (typeof SUGGESTION_URGENCIES)[number];

export const BRIEFING_FEEDBACK_ACTIONS = [
  'dismissed',
  'helpful',
  'not_helpful',
] as const;
export type BriefingFeedbackAction = (typeof BRIEFING_FEEDBACK_ACTIONS)[number];

export const SUGGESTION_RATINGS = ['helpful', 'not_helpful'] as const;
export type SuggestionRating = (typeof SUGGESTION_RATINGS)[number];

/** Feedback key for the whole card ("hide today's briefing"). */
export const BRIEFING_CARD_KEY = 'briefing';

/**
 * Every suggestion the engine can make. Keys are stable: feedback is stored per key,
 * so renaming one resets what the briefing has learned about it.
 */
export const SUGGESTION_KEYS = [
  'routine.ease-intensity',
  'routine.go-for-it',
  'recovery.rest-day',
  'recovery.well-recovered',
  'recovery.sleep',
  'recovery.gentle-symptoms',
  'meal.iron',
  'meal.magnesium',
  'meal.follicular-foods',
  'meal.ovulation-foods',
  'meal.plan-ahead',
  'meal.adherence-slipping',
  'meal.adherence-good',
] as const;
export type SuggestionKey = (typeof SUGGESTION_KEYS)[number];

export function isSuggestionKey(value: string): value is SuggestionKey {
  return (SUGGESTION_KEYS as readonly string[]).includes(value);
}

export function categoryOfKey(key: SuggestionKey): SuggestionCategory {
  return key.slice(0, key.indexOf('.')) as SuggestionCategory;
}

export type BriefingPreferences = {
  frequency: BriefingFrequency;
  sources: BriefingSource[];
  detail: BriefingDetail;
};

export const DEFAULT_BRIEFING_PREFERENCES: BriefingPreferences = {
  frequency: 'daily',
  sources: [...BRIEFING_SOURCES],
  detail: 'brief',
};

/** Stored preference columns → preferences; unknown values fall back to the defaults. */
export function parseBriefingPreferences(stored: {
  briefingFrequency: string;
  briefingSources: readonly string[];
  briefingDetail: string;
}): BriefingPreferences {
  const frequency = (BRIEFING_FREQUENCIES as readonly string[]).includes(
    stored.briefingFrequency
  )
    ? (stored.briefingFrequency as BriefingFrequency)
    : DEFAULT_BRIEFING_PREFERENCES.frequency;
  const detail = (BRIEFING_DETAILS as readonly string[]).includes(
    stored.briefingDetail
  )
    ? (stored.briefingDetail as BriefingDetail)
    : DEFAULT_BRIEFING_PREFERENCES.detail;
  // Kept in the canonical order, so the UI and the loader never depend on stored order.
  const sources = BRIEFING_SOURCES.filter((source) =>
    stored.briefingSources.includes(source)
  );
  return { frequency, sources, detail };
}

// ---------------------------------------------------------------------------
// Engine input
// ---------------------------------------------------------------------------

/** One journal day as the briefing sees it (symptoms already decrypted). */
export type BriefingJournalDay = {
  /** `YYYY-MM-DD` */
  date: string;
  /** Self-rated 1-10. */
  mood: number | null;
  /**
   * Self-rated 1-10. Without a daily rating, the mean of the day's time-of-day energy
   * check-ins (same scale) while circadian insights are on.
   */
  energy: number | null;
  sleepHours: number | null;
  /** Physical and mental symptoms, decrypted. */
  symptoms: string[];
  /** Anything entered in the journal form (not just a quick-log temperature or vitals). */
  checkIn: boolean;
  /**
   * A time-of-day energy check-in (circadian insights) on this day. Only read while
   * circadian insights are on; such a day alone is not a journal `checkIn`.
   */
  energyCheckIn?: boolean;
};

export type BriefingCycleData = {
  /** The user's typical cycle length (profile setting). */
  typicalCycleLength: number;
  /** Logged period starts with User.lastPeriodDate merged in (`normalizePeriodStarts`). */
  periodStarts: string[];
  /** Basal body temperature readings in °C. */
  bbtReadings: BbtReading[];
};

/**
 * Inputs of the recovery score, loaded as the dashboard Vitals card loads them, so the
 * briefing's score for a day is the card's score (lib/cycle-insights `buildRecoverySeries`).
 */
export type BriefingVitalsData = {
  /** Daily metrics rows, sleep hours included. */
  rows: DailyMetricsRow[];
  /** Logged period starts for the score's phase baselines; null without cycle tracking. */
  periodStarts: string[] | null;
  typicalCycleLength: number;
};

export type BriefingMealDay = {
  /** `YYYY-MM-DD` in the user's timezone. */
  date: string;
  planned: number;
  cooked: number;
};

export type BriefingMealData = {
  days: BriefingMealDay[];
  /**
   * True when the household has marked any meal as cooked recently. Without that, a
   * cooked count of 0 means "not tracked", not "not cooked".
   */
  cookedTracking: boolean;
};

export type BriefingFeedbackEntry = {
  /** `YYYY-MM-DD` */
  date: string;
  /** A suggestion key or `BRIEFING_CARD_KEY`. */
  key: string;
  action: BriefingFeedbackAction;
};

export type BriefingEngineInput = {
  /** The briefing day (`YYYY-MM-DD`, the user's calendar day). */
  today: string;
  focus: FocusPreference;
  detail: BriefingDetail;
  /** null when the journal source is off. Days from about 3 months back up to today. */
  journal: BriefingJournalDay[] | null;
  /** null when the cycle source is off or cycle tracking is not set up. */
  cycle: BriefingCycleData | null;
  /** null when the meals source is off or the user has no household. */
  meals: BriefingMealData | null;
  /** Recovery score inputs; null when the source or the vitals opt-in is off. */
  vitals: BriefingVitalsData | null;
  /**
   * Today's time-of-day energy check-in for right now is at or below LOW_ENERGY_RATING,
   * as the circadian card's "Running low right now" (lib/easy-day). False unless the
   * journal source and circadian insights are on.
   */
  lowEnergyNow?: boolean;
  /** Feedback from the last weeks, including today. */
  feedback: BriefingFeedbackEntry[];
};

// ---------------------------------------------------------------------------
// Engine output (serialisable: goes straight to the dashboard card)
// ---------------------------------------------------------------------------

export type BriefingPhaseInfo = {
  /**
   * null when the current cycle has run past its expected length (period late or not
   * logged): no phase is estimated and phase-based ideas are skipped (see phase.ts).
   */
  phase: CyclePhase | null;
  /** 1-based day of the current cycle. */
  cycleDay: number;
  /** The phase follows a BBT thermal shift (ovulation confirmed) rather than the calendar. */
  temperatureConfirmed: boolean;
  typicalCycleLength: number;
  /** The current cycle is longer than the user's typical length (period not logged yet). */
  pastTypicalLength: boolean;
};

export type BriefingSuggestion = {
  key: SuggestionKey;
  category: SuggestionCategory;
  urgency: SuggestionUrgency;
  title: string;
  body: string;
  /** Plain-language facts the suggestion is based on. */
  evidence: string[];
  action: { href: string; label: string } | null;
  /** The rating the user already gave this suggestion today. */
  rating: SuggestionRating | null;
};

export type DailyBriefing = {
  date: string;
  phase: BriefingPhaseInfo | null;
  focus: FocusPreference;
  detail: BriefingDetail;
  headline: string;
  /**
   * A caveat about the cycle phase (the cycle is longer than usual), shown next to the
   * phase at every detail level; null when there is none.
   */
  phaseNote: string | null;
  /** Ranked, most relevant first. Suggestions dismissed today are left out. */
  suggestions: BriefingSuggestion[];
  /** Notes about missing or limited data. */
  notes: string[];
};
