'use client';

/**
 * Dashboard daily briefing: a few suggestions from the user's last 3 days of logs, their
 * cycle phase, meal plan and recovery score (lib/briefing). Glass card at the top of the
 * dashboard; expandable for the evidence behind each suggestion; dismissible for the day
 * (remembered on the server) with per-suggestion dismiss and helpful/not helpful.
 * Wellness ideas only, not medical advice.
 */

import { useId, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowRight,
  ChevronDown,
  Dumbbell,
  Moon,
  RefreshCw,
  Salad,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { dateOnlyToLocalDate } from '@/lib/date-only';
import { PHASE_THEMES } from '@/lib/phase-theme';
import {
  emptyLocalFeedback,
  phaseLabel,
  shownBriefing,
  visibleSuggestions,
  type LocalFeedback,
  type RefreshedBriefing,
} from './daily-briefing-view';
import {
  dismissBriefingSuggestion,
  dismissDailyBriefing,
  generateDailyBriefing,
  rateBriefingSuggestion,
  restoreDailyBriefing,
} from '@/actions/briefing-actions';
import type {
  BriefingSuggestion,
  DailyBriefing,
  SuggestionCategory,
  SuggestionKey,
  SuggestionRating,
} from '@/lib/briefing/types';

const CATEGORY_META: Record<
  SuggestionCategory,
  { label: string; icon: LucideIcon; iconClass: string }
> = {
  routine: {
    label: 'Movement',
    icon: Dumbbell,
    iconClass: 'bg-primary-100 text-primary-700',
  },
  meal: {
    label: 'Food',
    icon: Salad,
    iconClass: 'bg-wellness-100 text-wellness-700',
  },
  recovery: {
    label: 'Recovery',
    icon: Moon,
    iconClass: 'bg-indigo-100 text-indigo-700',
  },
};

const iconButtonClass =
  'min-h-[44px] min-w-[44px] rounded-full px-0 py-0 text-gray-600 hover:bg-white/80 hover:text-gray-900 focus-visible:ring-primary-500';

function SuggestionItem({
  suggestion,
  index,
  expanded,
  busy,
  onRate,
  onDismiss,
}: {
  suggestion: BriefingSuggestion;
  index: number;
  expanded: boolean;
  busy: boolean;
  onRate: (rating: SuggestionRating) => void;
  onDismiss: () => void;
}) {
  const meta = CATEGORY_META[suggestion.category];
  const Icon = meta.icon;
  const titleId = `briefing-suggestion-title-${index}`;
  const evidenceId = `briefing-suggestion-evidence-${index}`;

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-white/70 bg-white/70 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            meta.iconClass
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {meta.label}
            {suggestion.urgency === 'high' && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 normal-case tracking-normal text-amber-800">
                Worth a look today
              </span>
            )}
          </p>
          <h3 id={titleId} className="text-base font-semibold text-gray-900">
            {suggestion.title}
          </h3>
          <p className="text-sm leading-relaxed text-gray-700">
            {suggestion.body}
          </p>
          {expanded && suggestion.evidence.length > 0 && (
            <div className="mt-1 flex flex-col gap-1">
              <p
                id={evidenceId}
                className="text-xs font-semibold text-gray-600"
              >
                Based on
              </p>
              <ul
                aria-labelledby={evidenceId}
                className="list-disc pl-5 text-xs leading-relaxed text-gray-600"
              >
                {suggestion.evidence.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {suggestion.action ? (
          <Link
            href={suggestion.action.href}
            className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-primary-700 hover:text-primary-800"
          >
            {suggestion.action.label}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              aria-pressed={suggestion.rating === 'helpful'}
              aria-label={`Mark "${suggestion.title}" as helpful`}
              title="Helpful"
              onClick={() => onRate('helpful')}
              className={cn(
                iconButtonClass,
                suggestion.rating === 'helpful' &&
                  'bg-wellness-100 text-wellness-700 hover:bg-wellness-100'
              )}
            >
              <ThumbsUp className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              aria-pressed={suggestion.rating === 'not_helpful'}
              aria-label={`Mark "${suggestion.title}" as not helpful`}
              title="Not helpful"
              onClick={() => onRate('not_helpful')}
              className={cn(
                iconButtonClass,
                suggestion.rating === 'not_helpful' &&
                  'bg-gray-200 text-gray-900 hover:bg-gray-200'
              )}
            >
              <ThumbsDown className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            aria-label={`Dismiss "${suggestion.title}" for today`}
            title="Dismiss for today"
            onClick={onDismiss}
            className={iconButtonClass}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </li>
  );
}

export function DailyBriefingPanel({
  briefing: serverBriefing,
}: {
  briefing: DailyBriefing;
}) {
  const showToast = useUIStore((state) => state.showToast);
  const id = useId();
  const titleId = `${id}-title`;
  const detailsId = `${id}-details`;
  // The server prop is the source of truth: a revalidated dashboard (for example after a
  // vitals quick log) passes a new briefing, which replaces what Refresh fetched. Only
  // today's optimistic ratings and dismissals are kept locally, on top of either.
  const [refreshed, setRefreshed] = useState<RefreshedBriefing | null>(null);
  const briefing = shownBriefing(serverBriefing, refreshed);
  const [local, setLocal] = useState<LocalFeedback>(() =>
    emptyLocalFeedback(serverBriefing.date)
  );
  const suggestions = visibleSuggestions(briefing, local);
  const [expanded, setExpanded] = useState(
    serverBriefing.detail === 'detailed'
  );
  const [hidden, setHidden] = useState(false);
  const [gone, setGone] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  if (gone) return null;

  /** Updates today's local feedback (started afresh when the briefing day changed). */
  const updateLocal = (change: (current: LocalFeedback) => LocalFeedback) =>
    setLocal((current) =>
      change(
        current.date === briefing.date
          ? current
          : emptyLocalFeedback(briefing.date)
      )
    );
  /** Shows `rating` for the suggestion; `undefined` goes back to the briefing's own. */
  const setLocalRating = (
    key: SuggestionKey,
    rating: SuggestionRating | null | undefined
  ) =>
    updateLocal((current) => ({
      ...current,
      ratings: { ...current.ratings, [key]: rating },
    }));
  const setLocalDismissed = (key: SuggestionKey, dismissed: boolean) =>
    updateLocal((current) => ({
      ...current,
      dismissed: dismissed
        ? [...current.dismissed, key]
        : current.dismissed.filter((k) => k !== key),
    }));

  const rate = async (
    suggestion: BriefingSuggestion,
    rating: SuggestionRating
  ) => {
    const previous =
      local.date === briefing.date ? local.ratings[suggestion.key] : undefined;
    // Pressing the selected rating again clears it.
    const next = suggestion.rating === rating ? null : rating;
    setLocalRating(suggestion.key, next);
    setBusyKey(suggestion.key);
    const result = await rateBriefingSuggestion({
      date: briefing.date,
      key: suggestion.key,
      rating: next,
    });
    setBusyKey(null);
    if (result.success) {
      setStatus(
        next === null
          ? 'Feedback removed.'
          : next === 'helpful'
            ? "Thanks! You'll see more suggestions like this."
            : "Thanks. You'll see fewer suggestions like this."
      );
    } else {
      setLocalRating(suggestion.key, previous);
      showToast(result.error, 'error');
    }
  };

  const dismissOne = async (suggestion: BriefingSuggestion) => {
    setLocalDismissed(suggestion.key, true);
    setBusyKey(suggestion.key);
    const result = await dismissBriefingSuggestion({
      date: briefing.date,
      key: suggestion.key,
    });
    setBusyKey(null);
    if (result.success) {
      setStatus(`"${suggestion.title}" hidden for today.`);
    } else {
      setLocalDismissed(suggestion.key, false);
      showToast(result.error, 'error');
    }
  };

  const hideCard = async () => {
    setHidden(true);
    setBusyKey('card');
    const result = await dismissDailyBriefing(briefing.date);
    setBusyKey(null);
    if (result.success) {
      setStatus("Today's briefing is hidden.");
    } else {
      setHidden(false);
      showToast(result.error, 'error');
    }
  };

  const undoHide = async () => {
    setBusyKey('card');
    const result = await restoreDailyBriefing(briefing.date);
    setBusyKey(null);
    if (result.success) {
      setHidden(false);
      setStatus("Today's briefing is back.");
    } else {
      showToast(result.error, 'error');
    }
  };

  const refresh = async () => {
    setBusyKey('refresh');
    // The server picks the day (profile timezone), as it did for the page itself.
    const result = await generateDailyBriefing();
    setBusyKey(null);
    if (!result.success) {
      showToast(result.error, 'error');
      return;
    }
    const state = result.data;
    if (state.status === 'ready') {
      setRefreshed({ from: serverBriefing, briefing: state.briefing });
      setStatus('Briefing updated.');
    } else if (state.status === 'dismissed') {
      setHidden(true);
    } else {
      setGone(true);
    }
  };

  const busy = busyKey !== null;
  const statusRegion = (
    <p role="status" className="sr-only">
      {status}
    </p>
  );

  if (hidden) {
    return (
      <section
        aria-label="Daily briefing"
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/60 px-5 py-3 shadow-sm backdrop-blur-md"
      >
        <p className="text-sm text-gray-600">
          Today&apos;s briefing is hidden. It will be back on your next briefing
          day.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => void undoHide()}
          className="text-primary-700"
        >
          Undo
        </Button>
        {statusRegion}
      </section>
    );
  }

  const phase = briefing.phase;
  const phaseTheme = phase?.phase ? PHASE_THEMES[phase.phase] : null;

  return (
    <section
      aria-labelledby={titleId}
      className="relative isolate overflow-hidden rounded-2xl border border-white/60 bg-linear-to-br from-primary-100/80 via-white/50 to-wellness-100/80 shadow-lg"
    >
      {/* Soft colour fields behind the frosted glass. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 -top-24 -z-10 h-64 w-64 rounded-full bg-primary-300/40 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 right-0 -z-10 h-64 w-64 rounded-full bg-wellness-300/40 blur-3xl"
      />

      <div className="flex flex-col gap-5 bg-white/50 p-5 ring-1 ring-inset ring-white/70 backdrop-blur-xl sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/80 text-primary-600 shadow-sm"
            >
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary-700">
                {format(dateOnlyToLocalDate(briefing.date), 'EEEE, MMM d')}
              </p>
              <h2 id={titleId} className="text-xl font-semibold text-gray-900">
                Your daily briefing
              </h2>
              <p className="text-sm text-gray-700">{briefing.headline}</p>
              {phase && (
                <p className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 font-semibold',
                      phaseTheme
                        ? [phaseTheme.bg.accent, phaseTheme.text.accent]
                        : 'bg-gray-100 text-gray-800'
                    )}
                  >
                    {phaseLabel(phase)}
                  </span>
                  {phase.temperatureConfirmed && (
                    <span>Confirmed by your temperature shift</span>
                  )}
                </p>
              )}
              {briefing.phaseNote && (
                <p className="text-xs leading-relaxed text-gray-700">
                  {briefing.phaseNote}{' '}
                  <Link
                    href="/cycle"
                    className="inline-flex min-h-[44px] items-center font-medium text-primary-700 underline-offset-2 hover:underline"
                  >
                    Go to the cycle page
                  </Link>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6 self-end sm:self-start">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                aria-label="Refresh briefing"
                title="Refresh"
                onClick={() => void refresh()}
                className={iconButtonClass}
              >
                <RefreshCw
                  className={cn(
                    'h-4 w-4',
                    busyKey === 'refresh' && 'animate-spin'
                  )}
                  aria-hidden="true"
                />
              </Button>
              <Button
                type="button"
                variant="ghost"
                aria-expanded={expanded}
                aria-controls={detailsId}
                onClick={() => setExpanded(!expanded)}
                className="min-h-[44px] gap-1.5 rounded-full px-3 text-sm text-gray-700 hover:bg-white/80"
              >
                {expanded ? 'Hide details' : 'Show details'}
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    expanded && 'rotate-180'
                  )}
                  aria-hidden="true"
                />
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              aria-label="Hide today's briefing"
              title="Hide for today"
              onClick={() => void hideCard()}
              className={iconButtonClass}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div id={detailsId} className="flex flex-col gap-4">
          {suggestions.length > 0 ? (
            <ul aria-label="Suggestions" className="flex flex-col gap-3">
              {suggestions.map((suggestion, index) => (
                <SuggestionItem
                  key={suggestion.key}
                  suggestion={suggestion}
                  index={index}
                  expanded={expanded}
                  busy={busyKey === suggestion.key}
                  onRate={(rating) => void rate(suggestion, rating)}
                  onDismiss={() => void dismissOne(suggestion)}
                />
              ))}
            </ul>
          ) : (
            <p className="rounded-xl bg-white/60 p-4 text-sm text-gray-600">
              You&apos;re all caught up for today.
            </p>
          )}

          {expanded && briefing.notes.length > 0 && (
            <ul className="flex flex-col gap-1 text-xs leading-relaxed text-gray-600">
              {briefing.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-xs text-gray-500">
          General wellness ideas based on what you&apos;ve logged, not medical
          advice. Choose what the briefing looks at in your{' '}
          <Link
            href="/profile#daily-briefing-settings"
            className="font-medium text-primary-700 underline-offset-2 hover:underline"
          >
            briefing settings
          </Link>
          .
        </p>
        {statusRegion}
      </div>
    </section>
  );
}
