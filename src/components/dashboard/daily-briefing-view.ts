import type {
  BriefingPhaseInfo,
  BriefingSuggestion,
  DailyBriefing,
  SuggestionKey,
  SuggestionRating,
} from '@/lib/briefing/types';

/**
 * Pure helpers for the dashboard briefing panel (daily-briefing-panel.tsx), kept apart
 * so they can be tested without a DOM.
 */

/** "Luteal phase · day 23", or "Cycle day 35 · longer than usual" without a phase estimate. */
export function phaseLabel(phase: BriefingPhaseInfo): string {
  if (!phase.phase) {
    return `Cycle day ${phase.cycleDay} · longer than usual`;
  }
  const name = phase.phase.charAt(0).toUpperCase() + phase.phase.slice(1);
  return `${name} phase · day ${phase.cycleDay}`;
}

/** A briefing the card's Refresh fetched, and the server prop it replaced. */
export type RefreshedBriefing = {
  from: DailyBriefing;
  briefing: DailyBriefing;
};

/**
 * The briefing to show: the server prop, unless Refresh fetched a newer one since that
 * prop arrived. A new prop (the dashboard was revalidated, for example after a vitals
 * quick log) always wins, so the card never keeps a stale copy of the server's briefing.
 */
export function shownBriefing(
  prop: DailyBriefing,
  refreshed: RefreshedBriefing | null
): DailyBriefing {
  return refreshed && refreshed.from === prop ? refreshed.briefing : prop;
}

/**
 * What the user changed on the card today before the server confirmed it (optimistic
 * ratings and dismissals). Kept apart from the briefing so a refreshed briefing can
 * replace the suggestions without losing them.
 */
export type LocalFeedback = {
  date: string;
  /** null clears a rating. */
  ratings: Partial<Record<SuggestionKey, SuggestionRating | null>>;
  dismissed: readonly SuggestionKey[];
};

export function emptyLocalFeedback(date: string): LocalFeedback {
  return { date, ratings: {}, dismissed: [] };
}

/** The briefing's suggestions with today's local ratings and dismissals applied. */
export function visibleSuggestions(
  briefing: DailyBriefing,
  local: LocalFeedback
): BriefingSuggestion[] {
  if (local.date !== briefing.date) return briefing.suggestions;
  return briefing.suggestions
    .filter((suggestion) => !local.dismissed.includes(suggestion.key))
    .map((suggestion) => {
      const rating = local.ratings[suggestion.key];
      return rating === undefined ? suggestion : { ...suggestion, rating };
    });
}
