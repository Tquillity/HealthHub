'use client';

/**
 * Dashboard circadian insights: suggestions for the current time of day, a one-tap
 * "How is your energy right now?" check-in and a meal nudge (lib/circadian-
 * recommendations). The server picks the time-of-day slot from the profile timezone.
 * Wellness ideas based on typical daily rhythms, not medical advice.
 */

import { useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Brain,
  Dumbbell,
  Moon,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { logEnergyNow } from '@/actions/circadian-actions';
import type {
  CircadianCardData,
  CircadianMealIdea,
} from '@/lib/circadian-data';
import {
  CIRCADIAN_WINDOW_LABELS,
  ENERGY_SLOTS,
  MEAL_NUDGES,
  MIN_SLOT_DATA_POINTS,
  type CircadianInsights,
  type CircadianWindow,
  type EnergySlot,
  type MealFocus,
  type SuggestionKind,
} from '@/lib/circadian-recommendations';

const WINDOW_ICONS: Record<CircadianWindow, LucideIcon> = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Sunset,
  night: Moon,
};

const KIND_META: Record<
  SuggestionKind,
  { icon: LucideIcon; iconClass: string }
> = {
  personal: { icon: Sparkles, iconClass: 'bg-primary-100 text-primary-700' },
  movement: { icon: Dumbbell, iconClass: 'bg-wellness-100 text-wellness-700' },
  focus: { icon: Brain, iconClass: 'bg-amber-100 text-amber-700' },
  light: { icon: Sun, iconClass: 'bg-amber-100 text-amber-700' },
  rest: { icon: Moon, iconClass: 'bg-indigo-100 text-indigo-700' },
  food: { icon: Utensils, iconClass: 'bg-wellness-100 text-wellness-700' },
};

const SLOT_LABELS: Record<EnergySlot, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

function TimeZoneNote({ insights }: { insights: CircadianInsights }) {
  if (!insights.timeZoneFallback && insights.timeZone !== 'UTC') return null;
  return (
    <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
      {insights.timeZoneFallback
        ? "Your profile time zone isn't recognised, so these times use UTC."
        : 'These times use UTC, your current profile time zone.'}{' '}
      <Link
        href="/profile"
        className="font-medium underline underline-offset-2 hover:text-amber-900"
      >
        Set your time zone
      </Link>{' '}
      so morning and evening match your day.
    </p>
  );
}

/**
 * The 1-10 rating buttons. While a rating saves they stay focusable (aria-disabled, not
 * disabled), so keyboard focus stays on the button just pressed; `onRate` ignores taps
 * in the meantime.
 */
export function EnergyRatingButtons({
  selected,
  saving,
  onRate,
  labelledBy,
  describedBy,
}: {
  selected: number | null;
  /** The rating being saved, or null. */
  saving: number | null;
  onRate: (rating: number) => void;
  labelledBy: string;
  describedBy: string;
}) {
  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      // Ten 44px buttons in a row need 512px. The card is narrower than that up to xl
      // (beside the sidebar and the dashboard's left column), so two rows of five until
      // then; gap-1 keeps five in a row on a 320px phone.
      className="grid grid-cols-5 gap-1 sm:gap-2 xl:grid-cols-10"
    >
      {RATINGS.map((rating) => (
        <button
          key={rating}
          type="button"
          aria-pressed={selected === rating}
          aria-label={`${rating} out of 10`}
          aria-disabled={saving !== null || undefined}
          onClick={() => onRate(rating)}
          className={cn(
            'min-h-[44px] min-w-[44px] rounded-md border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 aria-disabled:cursor-not-allowed aria-disabled:opacity-60',
            selected === rating
              ? 'border-primary-600 bg-primary-600 text-white'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          )}
        >
          {saving === rating ? '…' : rating}
        </button>
      ))}
    </div>
  );
}

function EnergyCheckIn({ insights }: { insights: CircadianInsights }) {
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const id = useId();
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<{
    date: string;
    slot: EnergySlot;
    energy: number;
  } | null>(null);
  // Toasts are not announced, so the result is also read out from this status region.
  const [status, setStatus] = useState('');
  const slot = insights.slot;

  if (!slot) {
    return (
      <p className="text-sm text-gray-600">
        Energy check-ins open again at 06:00. Rest well.
      </p>
    );
  }

  const selected =
    saved && saved.slot === slot && saved.date === insights.dateKey
      ? saved.energy
      : insights.currentEnergy;

  const save = async (energy: number) => {
    if (saving !== null) return;
    setSaving(energy);
    // Cleared first, so the same result twice in a row is announced again.
    setStatus('');
    let result: Awaited<ReturnType<typeof logEnergyNow>>;
    try {
      result = await logEnergyNow({ energy });
    } catch {
      result = { success: false, error: 'Failed to save your energy' };
    }
    setSaving(null);
    if (!result.success) {
      setStatus(result.error);
      showToast(result.error, 'error');
      return;
    }
    setSaved(result.data);
    const message = `Energy saved for this ${result.data.slot}: ${result.data.energy}/10`;
    setStatus(message);
    showToast(message, 'success');
    // The card may have been open since an earlier part of the day.
    if (result.data.slot !== slot || result.data.date !== insights.dateKey) {
      router.refresh();
    }
  };

  const legendId = `${id}-energy-legend`;
  const hintId = `${id}-energy-hint`;

  return (
    <div className="flex flex-col gap-2">
      <p id={legendId} className="text-sm font-medium text-gray-900">
        How is your energy right now?
      </p>
      <EnergyRatingButtons
        selected={selected}
        saving={saving}
        onRate={(rating) => void save(rating)}
        labelledBy={legendId}
        describedBy={hintId}
      />
      <p id={hintId} className="text-xs text-gray-500">
        1 is drained, 10 is full of energy. Saved for this{' '}
        {SLOT_LABELS[slot].toLowerCase()}; tap again to change it.
      </p>
      <p role="status" className="sr-only">
        {status}
      </p>
    </div>
  );
}

function PatternSummary({ insights }: { insights: CircadianInsights }) {
  const anyPersonal = ENERGY_SLOTS.some((s) => insights.slots[s].personalized);
  const items = ENERGY_SLOTS.map((s) => {
    const slot = insights.slots[s];
    const today = insights.todayEnergy[s];
    return {
      slot: s,
      today: today === null ? '—' : `${today}/10`,
      usual:
        slot.personalized && slot.average !== null
          ? `${slot.average}/10`
          : `${slot.count}/${MIN_SLOT_DATA_POINTS} check-ins`,
    };
  });

  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-3 gap-2 text-center">
        {items.map((item) => (
          <div
            key={item.slot}
            className={cn(
              'flex flex-col gap-0.5 rounded-md bg-gray-50 p-2',
              insights.bestWindow === item.slot && 'ring-2 ring-wellness-500'
            )}
          >
            <dt className="text-xs font-medium text-gray-500">
              {SLOT_LABELS[item.slot]}
              {insights.bestWindow === item.slot && (
                <span className="sr-only"> (your best window)</span>
              )}
            </dt>
            <dd className="text-sm font-semibold text-gray-900">
              <span className="sr-only">Today: </span>
              {item.today}
            </dd>
            <dd className="text-xs text-gray-500">
              <span className="sr-only">Usual: </span>
              {item.usual}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-gray-500">
        {anyPersonal
          ? 'Top: today. Bottom: your usual over the last 30 days.'
          : `Top: today. Check in at different times of day: after ${MIN_SLOT_DATA_POINTS} check-ins for a time of day you will see your usual energy for it.`}
      </p>
    </div>
  );
}

function MealIdeaLabel({
  idea,
  focus,
}: {
  idea: CircadianMealIdea;
  focus: MealFocus;
}) {
  const detail =
    focus === 'protein-breakfast'
      ? idea.protein !== null
        ? `${Math.round(idea.protein)} g protein`
        : null
      : idea.calories !== null
        ? `${Math.round(idea.calories)} kcal`
        : null;
  return (
    <>
      <span className="font-medium">{idea.name}</span>
      {detail && <span className="text-gray-500"> · {detail} per serving</span>}
    </>
  );
}

function MealNudge({
  focus,
  ideas,
}: {
  focus: MealFocus;
  ideas: CircadianMealIdea[];
}) {
  const nudge = MEAL_NUDGES[focus];
  const browseHref = `/recipes?category=${encodeURIComponent(nudge.recipeCategory)}`;
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-wellness-50 p-4">
      <div className="flex items-center gap-2">
        <Utensils className="h-4 w-4 text-wellness-700" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-gray-900">{nudge.title}</h3>
      </div>
      <p className="text-sm text-gray-700">{nudge.body}</p>
      {ideas.length > 0 ? (
        <ul className="flex flex-col">
          {ideas.map((idea) => (
            <li key={idea.id}>
              <Link
                href={`/recipes/${idea.id}`}
                className="flex min-h-[44px] items-center text-sm text-wellness-800 hover:text-wellness-900"
              >
                <span>
                  <MealIdeaLabel idea={idea} focus={focus} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-500">
          {focus === 'protein-breakfast'
            ? 'Breakfast recipes with protein per serving filled in show up here.'
            : 'Dinner recipes with calories per serving filled in show up here.'}
        </p>
      )}
      <Link
        href={browseHref}
        className="flex min-h-[44px] items-center text-sm font-medium text-wellness-700 hover:text-wellness-800"
      >
        {nudge.browseLabel}
      </Link>
    </div>
  );
}

export function CircadianPanel({ data }: { data: CircadianCardData }) {
  const { insights, mealIdeas } = data;
  const WindowIcon = WINDOW_ICONS[insights.window];
  const windowLabel = CIRCADIAN_WINDOW_LABELS[insights.window];

  return (
    <section
      aria-labelledby="circadian-card-title"
      className="flex flex-col gap-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <WindowIcon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-col">
          <h2
            id="circadian-card-title"
            className="text-lg font-semibold text-gray-900"
          >
            Circadian insights
          </h2>
          <p className="text-sm text-gray-500">
            {windowLabel} · {insights.localTime} ({insights.timeZone} time)
          </p>
        </div>
      </div>

      <TimeZoneNote insights={insights} />

      <ul className="flex flex-col gap-3">
        {insights.suggestions.map((suggestion) => {
          const meta = KIND_META[suggestion.kind];
          const Icon = meta.icon;
          return (
            <li key={suggestion.key} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  meta.iconClass
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <h3 className="text-sm font-semibold text-gray-900">
                  {suggestion.title}
                </h3>
                <p className="text-sm text-gray-600">{suggestion.body}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-4 border-t border-gray-100 pt-4">
        <EnergyCheckIn insights={insights} />
        <PatternSummary insights={insights} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-gray-50 px-4 py-2">
        <p className="text-sm text-gray-700">
          Good fit right now:{' '}
          <span className="font-semibold">
            {insights.recommendedIntensity}-energy routines
          </span>
        </p>
        <Link
          href="/routines"
          className="flex min-h-[44px] items-center text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          Spin the routine lottery
        </Link>
      </div>

      {insights.mealFocus && (
        <MealNudge focus={insights.mealFocus} ideas={mealIdeas} />
      )}

      <div className="flex flex-col gap-1">
        <p className="text-xs text-gray-500">
          General wellness ideas based on typical daily rhythms and your own
          check-ins, not medical advice. Everyone&apos;s rhythm differs, so go
          by how you feel.
        </p>
        <div className="flex flex-wrap gap-x-6">
          <Link
            href="/learn?category=circadian"
            className="flex min-h-[44px] items-center text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            Learn about your daily rhythm
          </Link>
          <Link
            href="/profile#circadian-insights-settings"
            className="flex min-h-[44px] items-center text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            Circadian settings
          </Link>
        </div>
      </div>
    </section>
  );
}
