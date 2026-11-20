import { addDaysToDateOnly } from '@/lib/date-only';
import type { FocusPreference } from '@/types/cycle';
import type { SuggestionCandidate } from './rules';
import {
  isSuggestionKey,
  type BriefingDetail,
  type BriefingFeedbackEntry,
  type SuggestionCategory,
  type SuggestionKey,
  type SuggestionRating,
} from './types';

/**
 * Step 3 of the briefing: order the candidates for this user.
 *
 * **Focus preference** (profile: hormonal, workout or both). Suggestions in the focus
 * categories get `FOCUS_BOOST` points: "workout" puts routine and recovery first,
 * "hormonal" puts meal (cycle nutrition) first, "both" changes nothing. The boost is
 * about the width of one urgency band, so a focus suggestion comes before any other
 * one unless that one scores more than `FOCUS_BOOST` points higher (e.g. a high-urgency
 * rest day, or a big energy dip, still leads for a "hormonal" user).
 *
 * **Feedback** from the last `FEEDBACK_LOOKBACK_DAYS` days, before today: each
 * "helpful" adds points, each "not helpful" or dismissal takes points away, so keys the
 * user repeatedly dismisses or rates down sink below the others and drop off the short
 * list, and helpful ones rise. Today's feedback does not reorder today's briefing
 * (it would shuffle the list under the user's finger); it hides dismissed suggestions
 * and shows today's rating.
 *
 * Ties keep a fixed order (focus categories, then score, then key), so the same data
 * always gives the same briefing.
 */

export const FOCUS_BOOST = 25;
export const FEEDBACK_LOOKBACK_DAYS = 60;
export const HELPFUL_POINTS = 10;
export const NOT_HELPFUL_POINTS = -15;
export const DISMISSED_POINTS = -8;
export const MAX_FEEDBACK_BOOST = 20;
export const MAX_FEEDBACK_PENALTY = -45;

/** Suggestions shown per detail level. */
export const SUGGESTION_LIMITS: Record<BriefingDetail, number> = {
  brief: 3,
  detailed: 5,
};
/** At most this many suggestions of one category, so one theme does not crowd the card. */
export const MAX_PER_CATEGORY = 2;

export const FOCUS_CATEGORIES: Record<FocusPreference, SuggestionCategory[]> = {
  workout: ['routine', 'recovery'],
  hormonal: ['meal'],
  both: [],
};

export type FeedbackStats = {
  helpful: number;
  notHelpful: number;
  dismissed: number;
};

/**
 * Counts of feedback per suggestion key from `today − lookback` up to yesterday.
 * Repeated clicks on the same day count once per action.
 */
export function summarizeFeedback(
  entries: readonly BriefingFeedbackEntry[],
  today: string,
  lookbackDays: number = FEEDBACK_LOOKBACK_DAYS
): Map<SuggestionKey, FeedbackStats> {
  const from = addDaysToDateOnly(today, -lookbackDays);
  const seen = new Set<string>();
  const stats = new Map<SuggestionKey, FeedbackStats>();
  for (const entry of entries) {
    if (entry.date < from || entry.date >= today) continue;
    if (!isSuggestionKey(entry.key)) continue;
    const id = `${entry.date}|${entry.key}|${entry.action}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const current = stats.get(entry.key) ?? {
      helpful: 0,
      notHelpful: 0,
      dismissed: 0,
    };
    if (entry.action === 'helpful') current.helpful += 1;
    else if (entry.action === 'not_helpful') current.notHelpful += 1;
    else current.dismissed += 1;
    stats.set(entry.key, current);
  }
  return stats;
}

export function feedbackAdjustment(stats: FeedbackStats | undefined): number {
  if (!stats) return 0;
  const points =
    HELPFUL_POINTS * stats.helpful +
    NOT_HELPFUL_POINTS * stats.notHelpful +
    DISMISSED_POINTS * stats.dismissed;
  return Math.min(MAX_FEEDBACK_BOOST, Math.max(MAX_FEEDBACK_PENALTY, points));
}

export type RankedCandidate = SuggestionCandidate & {
  /** Score used for ordering (base + focus + feedback). */
  rank: number;
  inFocus: boolean;
};

export function rankCandidates(
  candidates: readonly SuggestionCandidate[],
  focus: FocusPreference,
  stats: ReadonlyMap<SuggestionKey, FeedbackStats>
): RankedCandidate[] {
  const focusCategories = FOCUS_CATEGORIES[focus];
  return candidates
    .map((candidate) => {
      const inFocus = focusCategories.includes(candidate.category);
      return {
        ...candidate,
        inFocus,
        rank:
          candidate.score +
          (inFocus ? FOCUS_BOOST : 0) +
          feedbackAdjustment(stats.get(candidate.key)),
      };
    })
    .sort(
      (a, b) =>
        b.rank - a.rank ||
        Number(b.inFocus) - Number(a.inFocus) ||
        b.score - a.score ||
        a.key.localeCompare(b.key)
    );
}

/** Today's per-suggestion state: dismissed keys and the latest rating per key. */
export function todaysFeedback(
  entries: readonly BriefingFeedbackEntry[],
  today: string
): {
  dismissed: Set<SuggestionKey>;
  ratings: Map<SuggestionKey, SuggestionRating>;
} {
  const dismissed = new Set<SuggestionKey>();
  const ratings = new Map<SuggestionKey, SuggestionRating>();
  for (const entry of entries) {
    if (entry.date !== today || !isSuggestionKey(entry.key)) continue;
    if (entry.action === 'dismissed') dismissed.add(entry.key);
    else ratings.set(entry.key, entry.action);
  }
  return { dismissed, ratings };
}

/**
 * The suggestions to show: the top of the ranking for the detail level (at most
 * `MAX_PER_CATEGORY` per category), minus the ones dismissed today. A dismissed
 * suggestion is not replaced by the next one, so dismissing makes the card shorter.
 */
export function selectVisible(
  ranked: readonly RankedCandidate[],
  detail: BriefingDetail,
  dismissedToday: ReadonlySet<SuggestionKey>
): RankedCandidate[] {
  const perCategory = new Map<SuggestionCategory, number>();
  const top: RankedCandidate[] = [];
  for (const candidate of ranked) {
    if (top.length >= SUGGESTION_LIMITS[detail]) break;
    const count = perCategory.get(candidate.category) ?? 0;
    if (count >= MAX_PER_CATEGORY) continue;
    perCategory.set(candidate.category, count + 1);
    top.push(candidate);
  }
  return top.filter((candidate) => !dismissedToday.has(candidate.key));
}
