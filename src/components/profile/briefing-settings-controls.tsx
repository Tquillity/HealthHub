'use client';

import { useId, useRef, useState } from 'react';
import { format } from 'date-fns';
import { useUIStore } from '@/lib/store';
import { dateOnlyToLocalDate } from '@/lib/date-only';
import { cn } from '@/lib/utils';
import { updateBriefingPreferences } from '@/actions/briefing-actions';
import type { BriefingSettings } from '@/lib/briefing/data';
import {
  BRIEFING_SOURCES,
  type BriefingDetail,
  type BriefingFrequency,
  type BriefingPreferences,
  type BriefingSource,
} from '@/lib/briefing/types';
import { createPreferenceSaver } from './briefing-preference-saver';

const FREQUENCY_OPTIONS: {
  value: BriefingFrequency;
  label: string;
  hint: string;
}[] = [
  { value: 'daily', label: 'Daily', hint: 'Every morning' },
  { value: 'weekly', label: 'Weekly', hint: 'On Mondays' },
  { value: 'never', label: 'Never', hint: 'Turn the briefing off' },
];

const DETAIL_OPTIONS: { value: BriefingDetail; label: string; hint: string }[] =
  [
    { value: 'brief', label: 'Brief', hint: 'Top 3 suggestions, kept short' },
    {
      value: 'detailed',
      label: 'Detailed',
      hint: 'Up to 5 suggestions with tips and the reasons behind them',
    },
  ];

const SOURCE_TEXT: Record<BriefingSource, { label: string; hint: string }> = {
  journal: {
    label: 'Journal check-ins',
    hint: 'Mood, energy, sleep and symptoms, compared with your own usual.',
  },
  cycle: {
    label: 'Cycle phase and temperature',
    hint: 'Your phase and cycle day, refined by your temperature shift.',
  },
  meals: {
    label: 'Meal plan',
    hint: "Meals planned in your household's meal planner.",
  },
  vitals: {
    label: 'Vitals and recovery score',
    hint: 'Your recovery score as on the Vitals card, from resting heart rate, HRV and sleep.',
  },
};

// The whole 44px row is the label, so a tap anywhere on it changes the choice.
const optionRowClass =
  'flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-gray-700';
const inputClass =
  'h-4 w-4 shrink-0 border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-600 aria-disabled:opacity-50';

export function BriefingSettingsControls({
  settings,
}: {
  settings: BriefingSettings;
}) {
  const showToast = useUIStore((state) => state.showToast);
  const id = useId();
  const [preferences, setPreferences] = useState<BriefingPreferences>(
    settings.preferences
  );
  const [nextBriefing, setNextBriefing] = useState(settings.nextBriefing);
  const [saving, setSaving] = useState(false);
  // Toasts are not announced, so results are also read out from this status region.
  const [status, setStatus] = useState('');
  // The preferences the server last confirmed, to fall back to when a save fails.
  const confirmed = useRef(settings.preferences);
  // Controls are never disabled while saving: arrow keys in a radio group move focus
  // and select together, so a disabled radio would drop focus. Changes made while a
  // save runs are merged into the next request instead.
  const [saver] = useState(() =>
    createPreferenceSaver({
      send: updateBriefingPreferences,
      onSaving: setSaving,
      onSaved: (saved, more) => {
        confirmed.current = saved.preferences;
        setNextBriefing(saved.nextBriefing);
        if (more) return;
        setPreferences(saved.preferences);
        setStatus('Briefing settings saved.');
        showToast('Briefing settings saved', 'success');
      },
      onFailed: (error) => {
        setPreferences(confirmed.current);
        setStatus(error);
        showToast(error, 'error');
      },
    })
  );

  const save = (patch: Partial<BriefingPreferences>) => {
    setPreferences((current) => ({ ...current, ...patch }));
    saver.save(patch);
  };

  const toggleSource = (source: BriefingSource, checked: boolean) => {
    const sources = checked
      ? BRIEFING_SOURCES.filter(
          (s) => s === source || preferences.sources.includes(s)
        )
      : preferences.sources.filter((s) => s !== source);
    // At least one source stays on (the last one is aria-disabled, not disabled, so it
    // keeps focus and its hint can be read).
    if (sources.length === 0) return;
    save({ sources });
  };

  const unavailable: Partial<Record<BriefingSource, string>> = {
    ...(!settings.cycleTracking && {
      cycle: 'Cycle tracking is off in your profile, so this is skipped.',
    }),
    ...(!settings.trackVitals && {
      vitals: 'Vitals tracking is off, so this is skipped.',
    }),
  };
  const off = preferences.frequency === 'never';

  return (
    <div className="flex flex-col gap-6">
      <fieldset
        className="flex flex-col gap-2"
        aria-busy={saving || undefined}
      >
        <legend className="mb-1 text-sm font-medium text-gray-700">
          How often
        </legend>
        <div className="flex flex-wrap gap-x-6">
          {FREQUENCY_OPTIONS.map((option) => (
            <label key={option.value} className={optionRowClass}>
              <input
                type="radio"
                id={`${id}-frequency-${option.value}`}
                name="briefing-frequency"
                value={option.value}
                checked={preferences.frequency === option.value}
                onChange={() => save({ frequency: option.value })}
                className={inputClass}
              />
              <span>
                {option.label}{' '}
                <span className="text-gray-500">({option.hint})</span>
              </span>
            </label>
          ))}
        </div>
        {nextBriefing && preferences.frequency === 'weekly' && (
          <p className="text-xs text-gray-500">
            Next briefing:{' '}
            {format(dateOnlyToLocalDate(nextBriefing), 'EEEE, MMM d')} (
            {settings.timezone} time).
          </p>
        )}
      </fieldset>

      <fieldset
        className="flex flex-col gap-2"
        disabled={off}
        aria-busy={saving || undefined}
      >
        <legend className="mb-1 text-sm font-medium text-gray-700">
          What the briefing looks at
        </legend>
        <div className="flex flex-col gap-1">
          {BRIEFING_SOURCES.map((source, index) => {
            const checked = preferences.sources.includes(source);
            const isLast = checked && preferences.sources.length === 1;
            const hintId = `${id}-source-hint-${index}`;
            return (
              <div key={source} className="flex flex-col">
                <label className={cn(optionRowClass, 'gap-3 font-medium')}>
                  <input
                    type="checkbox"
                    id={`${id}-source-${index}`}
                    name={`briefing-source-${source}`}
                    checked={checked}
                    aria-disabled={isLast || undefined}
                    aria-describedby={hintId}
                    onChange={(e) => toggleSource(source, e.target.checked)}
                    className={cn(inputClass, 'rounded')}
                  />
                  <span>{SOURCE_TEXT[source].label}</span>
                </label>
                <p id={hintId} className="pl-7 text-xs text-gray-500">
                  {SOURCE_TEXT[source].hint}
                  {unavailable[source] ? ` ${unavailable[source]}` : ''}
                  {isLast
                    ? ' Keep at least one on, or set the briefing to Never.'
                    : ''}
                </p>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-500">
          Routine completions are not tracked in HealthHub yet, so they are not
          part of the briefing.
        </p>
      </fieldset>

      <fieldset
        className="flex flex-col gap-2"
        disabled={off}
        aria-busy={saving || undefined}
      >
        <legend className="mb-1 text-sm font-medium text-gray-700">
          Detail
        </legend>
        <div className="flex flex-wrap gap-x-6">
          {DETAIL_OPTIONS.map((option) => (
            <label key={option.value} className={optionRowClass}>
              <input
                type="radio"
                id={`${id}-detail-${option.value}`}
                name="briefing-detail"
                value={option.value}
                checked={preferences.detail === option.value}
                onChange={() => save({ detail: option.value })}
                className={inputClass}
              />
              <span>
                {option.label}{' '}
                <span className="text-gray-500">({option.hint})</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <p role="status" className="sr-only">
        {status}
      </p>
    </div>
  );
}
