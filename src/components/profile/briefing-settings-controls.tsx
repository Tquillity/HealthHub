'use client';

import { useId, useState } from 'react';
import { format } from 'date-fns';
import { useUIStore } from '@/lib/store';
import { dateOnlyToLocalDate } from '@/lib/date-only';
import { updateBriefingPreferences } from '@/actions/briefing-actions';
import type { BriefingSettings } from '@/lib/briefing/data';
import {
  BRIEFING_SOURCES,
  type BriefingDetail,
  type BriefingFrequency,
  type BriefingPreferences,
  type BriefingSource,
} from '@/lib/briefing/types';

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
    hint: 'Resting heart rate, HRV and sleep quality.',
  },
};

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

  const save = async (patch: Partial<BriefingPreferences>) => {
    const previous = preferences;
    setPreferences({ ...previous, ...patch });
    setSaving(true);
    const result = await updateBriefingPreferences(patch);
    setSaving(false);
    if (result.success) {
      setPreferences(result.data.preferences);
      setNextBriefing(result.data.nextBriefing);
      showToast('Briefing settings saved', 'success');
    } else {
      setPreferences(previous);
      showToast(result.error, 'error');
    }
  };

  const toggleSource = (source: BriefingSource, checked: boolean) => {
    const sources = checked
      ? BRIEFING_SOURCES.filter(
          (s) => s === source || preferences.sources.includes(s)
        )
      : preferences.sources.filter((s) => s !== source);
    void save({ sources });
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
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-gray-700">
          How often
        </legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {FREQUENCY_OPTIONS.map((option) => (
            <div
              key={option.value}
              className="flex min-h-[44px] items-center gap-2"
            >
              <input
                type="radio"
                id={`${id}-frequency-${option.value}`}
                name="briefing-frequency"
                value={option.value}
                checked={preferences.frequency === option.value}
                disabled={saving}
                onChange={() => void save({ frequency: option.value })}
                className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-600"
              />
              <label
                htmlFor={`${id}-frequency-${option.value}`}
                className="text-sm text-gray-700"
              >
                {option.label}{' '}
                <span className="text-gray-500">({option.hint})</span>
              </label>
            </div>
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

      <fieldset className="flex flex-col gap-2" disabled={off}>
        <legend className="mb-1 text-sm font-medium text-gray-700">
          What the briefing looks at
        </legend>
        <div className="flex flex-col gap-3">
          {BRIEFING_SOURCES.map((source, index) => {
            const checked = preferences.sources.includes(source);
            const isLast = checked && preferences.sources.length === 1;
            const hintId = `${id}-source-hint-${index}`;
            return (
              <div key={source} className="flex flex-col gap-0.5">
                <div className="flex min-h-[44px] items-center gap-3">
                  <input
                    type="checkbox"
                    id={`${id}-source-${index}`}
                    name={`briefing-source-${source}`}
                    checked={checked}
                    disabled={saving || isLast}
                    aria-describedby={hintId}
                    onChange={(e) => toggleSource(source, e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-600"
                  />
                  <label
                    htmlFor={`${id}-source-${index}`}
                    className="text-sm font-medium text-gray-700"
                  >
                    {SOURCE_TEXT[source].label}
                  </label>
                </div>
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

      <fieldset className="flex flex-col gap-2" disabled={off}>
        <legend className="mb-1 text-sm font-medium text-gray-700">
          Detail
        </legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {DETAIL_OPTIONS.map((option) => (
            <div
              key={option.value}
              className="flex min-h-[44px] items-center gap-2"
            >
              <input
                type="radio"
                id={`${id}-detail-${option.value}`}
                name="briefing-detail"
                value={option.value}
                checked={preferences.detail === option.value}
                disabled={saving}
                onChange={() => void save({ detail: option.value })}
                className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-600"
              />
              <label
                htmlFor={`${id}-detail-${option.value}`}
                className="text-sm text-gray-700"
              >
                {option.label}{' '}
                <span className="text-gray-500">({option.hint})</span>
              </label>
            </div>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
