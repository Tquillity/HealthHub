import { analyzeBriefing } from './signals';
import {
  buildCandidates,
  isTakeItEasyDay,
  recentLogsSayTakeItEasy,
  urgencyOfScore,
} from './rules';
import {
  rankCandidates,
  selectVisible,
  summarizeFeedback,
  todaysFeedback,
} from './rank';
import {
  buildHeadline,
  buildNotes,
  buildPhaseNote,
  phraseSuggestion,
} from './copy';
import type { BriefingEngineInput, DailyBriefing, TakeItEasy } from './types';

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
    phaseNote: buildPhaseNote(signals),
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

/**
 * Whether the briefing for this input calls the day a take-it-easy day (its headline is a
 * gentle one), and why, without building the briefing; null when it does not. lib/easy-day
 * uses it so the circadian card holds back on the same days. Focus, detail, meals and
 * feedback only rank and word the briefing, so they are not needed.
 */
export function takeItEasyOf(
  input: Pick<
    BriefingEngineInput,
    'today' | 'journal' | 'cycle' | 'vitals' | 'lowEnergyToday'
  >
): TakeItEasy | null {
  const signals = analyzeBriefing({
    focus: 'both',
    detail: 'brief',
    meals: null,
    feedback: [],
    ...input,
  });
  if (!isTakeItEasyDay(signals)) return null;
  return { fromLogs: recentLogsSayTakeItEasy(signals) };
}
