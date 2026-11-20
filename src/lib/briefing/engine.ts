import { analyzeBriefing } from './signals';
import { buildCandidates, urgencyOfScore } from './rules';
import {
  rankCandidates,
  selectVisible,
  summarizeFeedback,
  todaysFeedback,
} from './rank';
import { buildHeadline, buildNotes, phraseSuggestion } from './copy';
import type { BriefingEngineInput, DailyBriefing } from './types';

/**
 * Daily briefing engine: deterministic and rule-based, with no external AI calls.
 *
 *   input ─▶ signals.ts (what changed vs. the user's baselines)
 *         ─▶ rules.ts   (which suggestions apply, how urgent)
 *         ─▶ rank.ts    (focus preference + learned feedback)
 *         ─▶ copy.ts    (wording)
 *
 * Pure: no database, no clock. lib/briefing/data.ts loads the input for the signed-in
 * user. The same input always gives the same briefing.
 */
export function buildDailyBriefing(input: BriefingEngineInput): DailyBriefing {
  const signals = analyzeBriefing(input);
  const ranked = rankCandidates(
    buildCandidates(signals),
    input.focus,
    summarizeFeedback(input.feedback, input.today)
  );
  const today = todaysFeedback(input.feedback, input.today);
  const visible = selectVisible(ranked, input.detail, today.dismissed);

  return {
    date: input.today,
    phase: signals.phase,
    focus: input.focus,
    detail: input.detail,
    headline: buildHeadline(signals),
    suggestions: visible.map((candidate) => ({
      key: candidate.key,
      category: candidate.category,
      urgency: urgencyOfScore(candidate.score),
      ...phraseSuggestion(candidate.key, signals, input.detail),
      rating: today.ratings.get(candidate.key) ?? null,
    })),
    notes: buildNotes(signals),
  };
}
