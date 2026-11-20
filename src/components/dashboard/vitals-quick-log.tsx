'use client';

/**
 * Dashboard vitals: today's recovery score with the vitals quick log, or the opt-in
 * prompt when vitals tracking is off. Scores compare with the user's own usual levels
 * (Docs/RecoveryScore.md); the copy is guidance, not a medical assessment.
 */

import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, HeartPulse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUIStore } from '@/lib/store';
import {
  getDailyLog,
  logVitals,
  updateVitalsPreferences,
} from '@/actions/vitals-actions';
import type { DailyMetrics, VitalsCardData } from '@/lib/daily-metrics';
import type { RecoverySummary } from '@/lib/cycle-insights';
import {
  RECOVERY_ZONE_LABELS,
  type RecoveryComponentKey,
  type RecoveryZone,
} from '@/lib/recovery';
import {
  HEART_RATE_VARIABILITY_RANGE,
  RESTING_HEART_RATE_RANGE,
  SLEEP_QUALITY_RANGE,
} from '@/lib/validation/vitals-schemas';
import {
  localDateKey,
  numberToInput,
  parseDecimalInput,
  parseWholeNumberInput,
} from '@/lib/quick-log-input';

const ZONE_BADGE_CLASSES: Record<RecoveryZone, string> = {
  green: 'bg-wellness-50 text-wellness-700',
  yellow: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
};

const COMPONENT_LABELS: Record<RecoveryComponentKey, string> = {
  hrv: 'HRV',
  rhr: 'resting heart rate',
  sleep: 'sleep',
};

type VitalsForm = {
  restingHeartRate: string;
  heartRateVariability: string;
  sleepQuality: string;
};

function formFromLog(log: DailyMetrics): VitalsForm {
  return {
    restingHeartRate: numberToInput(log.restingHeartRate),
    heartRateVariability: numberToInput(log.heartRateVariability),
    sleepQuality: numberToInput(log.sleepQuality),
  };
}

function comparisonText(recovery: RecoverySummary): string {
  if (recovery.comparedWith === 'phase' && recovery.phase) {
    return `Compared with your usual in the ${recovery.phase} phase.`;
  }
  if (recovery.comparedWith === 'overall') {
    return 'Compared with your usual overall.';
  }
  return 'Your usual score shows after a few more days of readings.';
}

function basedOnText(recovery: RecoverySummary): string {
  const names = recovery.components.map((c) => COMPONENT_LABELS[c.key]);
  return `Based on ${names.join(', ')}.`;
}

function OptInPrompt() {
  const showToast = useUIStore((state) => state.showToast);
  const [saving, setSaving] = useState(false);

  const turnOn = async () => {
    setSaving(true);
    const result = await updateVitalsPreferences({ trackVitals: true });
    setSaving(false);
    if (result.success) {
      showToast('Vitals tracking is on', 'success');
    } else {
      showToast(result.error, 'error');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        Log your resting heart rate, HRV and sleep to get a daily recovery
        score. It compares each day with your own usual levels, and with your
        cycle phase when cycle tracking is on.
      </p>
      <p className="text-xs text-gray-500">
        Off unless you turn it on. Your vitals are private to you, included in
        your data download, and you can delete them at any time in your profile.
      </p>
      <div>
        <Button type="button" disabled={saving} onClick={() => void turnOn()}>
          {saving ? 'Turning on…' : 'Turn on vitals'}
        </Button>
      </div>
    </div>
  );
}

function RecoveryPanel({ recovery }: { recovery: RecoverySummary | null }) {
  if (!recovery) {
    return (
      <p className="text-sm text-gray-600">
        Log today&apos;s vitals to see your recovery score. Heart rate and HRV
        count once you have 3 days of readings to compare with.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-3">
        <p className="text-4xl font-black text-gray-900">
          {recovery.score}
          <span className="sr-only"> out of 100</span>
          <span
            aria-hidden="true"
            className="text-base font-medium text-gray-500"
          >
            /100
          </span>
        </p>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${ZONE_BADGE_CLASSES[recovery.zone]}`}
        >
          {RECOVERY_ZONE_LABELS[recovery.zone]}
        </span>
      </div>
      <p className="text-xs text-gray-500">
        {basedOnText(recovery)} {comparisonText(recovery)}
      </p>
      {recovery.alert && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          Your recovery is lower than usual
          {recovery.drop !== null ? ` (${recovery.drop} points)` : ''}. An
          easier day and an early night may help. If you feel unwell, listen to
          your body.
        </p>
      )}
    </div>
  );
}

function VitalsLogForm({
  initialDate,
  initialLog,
}: {
  initialDate: string;
  initialLog: DailyMetrics;
}) {
  const showToast = useUIStore((state) => state.showToast);
  const formId = useId();
  const panelId = `${formId}-panel`;
  const errorId = `${formId}-error`;
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(initialDate);
  const [maxDate, setMaxDate] = useState(initialDate);
  const [form, setForm] = useState<VitalsForm>(formFromLog(initialLog));
  const [error, setError] = useState<string | null>(null);
  const [loadingDay, setLoadingDay] = useState(false);
  const [saving, setSaving] = useState(false);
  const dayRequest = useRef(0);

  const loadDay = async (day: string) => {
    const request = ++dayRequest.current;
    setLoadingDay(true);
    setError(null);
    const result = await getDailyLog(day);
    if (request !== dayRequest.current) return;
    setLoadingDay(false);
    if (result.success) {
      setForm(formFromLog(result.data));
    } else {
      showToast(result.error, 'error');
    }
  };

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (!next) return;
    // The viewer's own calendar day: the server's "today" is UTC.
    const today = localDateKey();
    setMaxDate(today);
    if (today !== date) {
      setDate(today);
      void loadDay(today);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const restingHeartRate = parseWholeNumberInput(form.restingHeartRate);
    const heartRateVariability = parseDecimalInput(form.heartRateVariability);
    const sleepQuality = parseWholeNumberInput(form.sleepQuality);
    if (restingHeartRate === undefined) {
      setError('Resting heart rate must be a whole number of beats per minute');
      return;
    }
    if (heartRateVariability === undefined) {
      setError('HRV must be a number in milliseconds');
      return;
    }
    if (sleepQuality === undefined) {
      setError('Sleep quality must be a whole number from 1 to 10');
      return;
    }
    setError(null);
    setSaving(true);
    const result = await logVitals({
      date,
      restingHeartRate,
      heartRateVariability,
      sleepQuality,
    });
    setSaving(false);
    if (result.success) {
      showToast('Vitals saved', 'success');
    } else {
      setError(result.error);
    }
  };

  const fieldProps = {
    disabled: loadingDay,
    autoComplete: 'off',
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined,
  } as const;

  return (
    <div className="flex flex-col gap-4">
      <Button
        type="button"
        variant="outline"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggleOpen}
        className="justify-between gap-2"
      >
        <span>{open ? 'Close vitals log' : 'Log vitals'}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </Button>

      {open && (
        <form
          id={panelId}
          onSubmit={handleSave}
          className="flex flex-col gap-4"
        >
          <div>
            <label
              htmlFor={`${formId}-date`}
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Day
            </label>
            <Input
              id={`${formId}-date`}
              name="vitals-date"
              type="date"
              max={maxDate}
              value={date}
              onChange={(e) => {
                if (!e.target.value) return;
                setDate(e.target.value);
                void loadDay(e.target.value);
              }}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor={`${formId}-rhr`}
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Resting heart rate (bpm)
              </label>
              <Input
                id={`${formId}-rhr`}
                name="vitals-resting-heart-rate"
                inputMode="numeric"
                placeholder={`${RESTING_HEART_RATE_RANGE.min}-${RESTING_HEART_RATE_RANGE.max}`}
                value={form.restingHeartRate}
                onChange={(e) =>
                  setForm({ ...form, restingHeartRate: e.target.value })
                }
                {...fieldProps}
              />
            </div>
            <div>
              <label
                htmlFor={`${formId}-hrv`}
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                HRV (ms)
              </label>
              <Input
                id={`${formId}-hrv`}
                name="vitals-heart-rate-variability"
                inputMode="decimal"
                placeholder={`${HEART_RATE_VARIABILITY_RANGE.min}-${HEART_RATE_VARIABILITY_RANGE.max}`}
                value={form.heartRateVariability}
                onChange={(e) =>
                  setForm({ ...form, heartRateVariability: e.target.value })
                }
                {...fieldProps}
              />
            </div>
            <div>
              <label
                htmlFor={`${formId}-sleep`}
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Sleep quality (1-10)
              </label>
              <Input
                id={`${formId}-sleep`}
                name="vitals-sleep-quality"
                inputMode="numeric"
                placeholder={`${SLEEP_QUALITY_RANGE.min}-${SLEEP_QUALITY_RANGE.max}`}
                value={form.sleepQuality}
                onChange={(e) =>
                  setForm({ ...form, sleepQuality: e.target.value })
                }
                {...fieldProps}
              />
            </div>
          </div>
          {error ? (
            <p id={errorId} className="text-sm text-red-600">
              {error}
            </p>
          ) : (
            <p className="text-xs text-gray-500">
              Measure in the morning, the same way each day (for example from
              your watch or ring). Leave a field empty to remove it for that
              day.
            </p>
          )}
          <div>
            <Button type="submit" disabled={saving || loadingDay}>
              {loadingDay ? 'Loading…' : saving ? 'Saving…' : 'Save vitals'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function VitalsQuickLog({ data }: { data: VitalsCardData }) {
  return (
    <section
      aria-labelledby="vitals-card-title"
      className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-teal-600">
          <HeartPulse className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2
          id="vitals-card-title"
          className="text-lg font-semibold text-gray-900"
        >
          Vitals &amp; recovery
        </h2>
      </div>

      {data.trackVitals ? (
        <>
          <RecoveryPanel recovery={data.recovery} />
          <VitalsLogForm initialDate={data.today} initialLog={data.todayLog} />
          <Link
            href="/profile"
            className="flex min-h-[44px] items-center text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            Manage or delete your vitals in your profile
          </Link>
        </>
      ) : (
        <OptInPrompt />
      )}
    </section>
  );
}
