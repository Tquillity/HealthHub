'use client';

/**
 * Cycle page quick log: waking temperature (BBT), cervical mucus and period starts.
 *
 * The form opens on demand, and only then reads the viewer's local date, so the
 * server-rendered card never depends on the browser's clock. Saves go through
 * `logBbtReading`, which writes only these fields of the day's journal entry.
 * The temperature shift feedback comes from the server (lib/bbt.ts).
 */

import { useId, useRef, useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, ChevronDown, Thermometer, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUIStore } from '@/lib/store';
import {
  getDailyLog,
  logBbtReading,
  updateVitalsPreferences,
} from '@/actions/vitals-actions';
import { deletePeriodStart, logPeriodStart } from '@/actions/cycle-actions';
import {
  BBT_RANGE,
  CERVICAL_MUCUS_LABELS,
  CERVICAL_MUCUS_TYPES,
  TEMPERATURE_UNITS,
  fromStoredCelsius,
  isCervicalMucus,
  type CervicalMucus,
  type TemperatureUnit,
} from '@/lib/bbt';
import { dateOnlyToLocalDate } from '@/lib/date-only';
import type { CycleQuickLogData } from '@/lib/daily-metrics';
import {
  convertTemperatureInput,
  localDateKey,
  numberToInput,
  parseDecimalInput,
} from '@/lib/quick-log-input';
import {
  formatShortDate,
  thermalShiftMessage,
} from '@/lib/cycle-chart-overlays';

const PERIOD_HISTORY_SHOWN = 6;

function temperatureText(
  celsius: number | null,
  unit: TemperatureUnit
): string {
  return celsius === null
    ? ''
    : numberToInput(fromStoredCelsius(celsius, unit));
}

function formatLongDate(date: string): string {
  return format(dateOnlyToLocalDate(date), 'MMM d, yyyy');
}

export function BbtQuickLog({ data }: { data: CycleQuickLogData }) {
  const showToast = useUIStore((state) => state.showToast);
  const formId = useId();
  const panelId = `${formId}-panel`;
  const temperatureErrorId = `${formId}-temperature-error`;

  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState<TemperatureUnit>(data.temperatureUnit);
  const unitRef = useRef(unit);
  const [date, setDate] = useState(data.today);
  const [maxDate, setMaxDate] = useState(data.today);
  const [temperature, setTemperature] = useState(
    temperatureText(data.todayLog.temperature, data.temperatureUnit)
  );
  const [mucus, setMucus] = useState<CervicalMucus | ''>(
    data.todayLog.cervicalMucus ?? ''
  );
  const [temperatureError, setTemperatureError] = useState<string | null>(null);
  const [loadingDay, setLoadingDay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [periodBusy, setPeriodBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  // Only the latest day request may fill the form (the user can change days quickly).
  const dayRequest = useRef(0);

  const { shift } = data;
  const periodLoggedForDate = data.recentPeriodStarts.includes(date);
  const isToday = date === maxDate;

  const loadDay = async (day: string) => {
    const request = ++dayRequest.current;
    setLoadingDay(true);
    setTemperatureError(null);
    const result = await getDailyLog(day);
    if (request !== dayRequest.current) return;
    setLoadingDay(false);
    if (result.success) {
      setTemperature(temperatureText(result.data.temperature, unitRef.current));
      setMucus(result.data.cervicalMucus ?? '');
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

  const changeDate = (value: string) => {
    if (!value) return;
    setDate(value);
    setConfirmRemove(null);
    void loadDay(value);
  };

  const changeUnit = async (next: TemperatureUnit) => {
    if (next === unit) return;
    const previous = unit;
    setUnit(next);
    unitRef.current = next;
    setTemperature((text) => convertTemperatureInput(text, previous, next));
    setTemperatureError(null);
    const result = await updateVitalsPreferences({ temperatureUnit: next });
    if (!result.success) {
      showToast(result.error, 'error');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseDecimalInput(temperature);
    if (value === undefined) {
      setTemperatureError(
        `Enter a number like ${unit === 'C' ? '36.45' : '97.61'}`
      );
      return;
    }
    setTemperatureError(null);
    setSaving(true);
    const result = await logBbtReading({
      date,
      temperature: value,
      unit,
      cervicalMucus: mucus === '' ? null : mucus,
    });
    setSaving(false);
    if (result.success) {
      showToast(isToday ? "Today's reading saved" : 'Reading saved', 'success');
    } else {
      setTemperatureError(result.error);
    }
  };

  const handlePeriodStart = async () => {
    setPeriodBusy(true);
    const result = await logPeriodStart(date);
    setPeriodBusy(false);
    if (result.success) {
      showToast('Period start logged. Your cycle has been updated.', 'success');
    } else {
      showToast(result.error ?? 'Failed to log your period start', 'error');
    }
  };

  const handleRemove = async (start: string) => {
    setPeriodBusy(true);
    const result = await deletePeriodStart(start);
    setPeriodBusy(false);
    setConfirmRemove(null);
    if (result.success) {
      showToast('Period start removed', 'success');
    } else {
      showToast(result.error ?? 'Failed to remove that period start', 'error');
    }
  };

  const range = BBT_RANGE[unit];
  const history = data.recentPeriodStarts.slice(0, PERIOD_HISTORY_SHOWN);

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600">
          <Thermometer className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-gray-900">
            Temperature &amp; period log
          </h2>
          {shift.detected ? (
            <p className="flex items-start gap-1.5 text-sm text-green-700">
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>{thermalShiftMessage(shift, data.temperatureUnit)}</span>
            </p>
          ) : (
            <p className="text-sm text-gray-600">
              {thermalShiftMessage(shift, data.temperatureUnit)}
            </p>
          )}
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggleOpen}
        className="justify-between gap-2"
      >
        <span>{open ? 'Close quick log' : 'Log temperature or period'}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </Button>

      {open && (
        <div id={panelId} className="flex flex-col gap-5">
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor={`${formId}-date`}
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Day
              </label>
              <Input
                id={`${formId}-date`}
                name="bbt-date"
                type="date"
                max={maxDate}
                value={date}
                onChange={(e) => changeDate(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`${formId}-temperature`}
                className="block text-sm font-medium text-gray-700"
              >
                Waking temperature (°{unit})
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id={`${formId}-temperature`}
                  name="bbt-temperature"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={unit === 'C' ? 'e.g. 36.45' : 'e.g. 97.61'}
                  value={temperature}
                  disabled={loadingDay}
                  aria-invalid={temperatureError ? true : undefined}
                  aria-describedby={
                    temperatureError ? temperatureErrorId : undefined
                  }
                  onChange={(e) => {
                    setTemperature(e.target.value);
                    setTemperatureError(null);
                  }}
                />
                <div
                  role="group"
                  aria-label="Temperature unit"
                  className="flex shrink-0 overflow-hidden rounded-md border border-gray-300"
                >
                  {TEMPERATURE_UNITS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={unit === option}
                      onClick={() => void changeUnit(option)}
                      className={`min-h-[44px] min-w-[44px] px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-600 ${
                        unit === option
                          ? 'bg-orange-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      °{option}
                    </button>
                  ))}
                </div>
              </div>
              {temperatureError ? (
                <p id={temperatureErrorId} className="text-xs text-red-600">
                  {temperatureError}
                </p>
              ) : (
                <p className="text-xs text-gray-500">
                  Right after waking, before getting up, at about the same time
                  each day ({range.min}-{range.max} °{unit}). Leave empty to
                  remove a reading.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor={`${formId}-mucus`}
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Cervical mucus (optional)
              </label>
              <select
                id={`${formId}-mucus`}
                name="bbt-cervical-mucus"
                value={mucus}
                disabled={loadingDay}
                onChange={(e) =>
                  setMucus(
                    isCervicalMucus(e.target.value) ? e.target.value : ''
                  )
                }
                className="flex h-10 min-h-[44px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
              >
                <option value="">Not recorded</option>
                {CERVICAL_MUCUS_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {CERVICAL_MUCUS_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            <Button type="submit" disabled={saving || loadingDay}>
              {loadingDay ? 'Loading…' : saving ? 'Saving…' : 'Save reading'}
            </Button>
          </form>

          <div className="flex flex-col gap-3 border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-900">
              Period starts
            </h3>
            {periodLoggedForDate ? (
              <p className="text-sm text-gray-600">
                A period start is logged for{' '}
                {isToday ? 'today' : formatLongDate(date)}.
              </p>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={periodBusy}
                onClick={() => void handlePeriodStart()}
              >
                {isToday
                  ? 'My period started today'
                  : `My period started on ${formatShortDate(date)}`}
              </Button>
            )}

            {history.length > 0 && (
              <ul
                className="flex flex-col gap-2"
                aria-label="Logged period starts"
              >
                {history.map((start) => (
                  <li
                    key={start}
                    className="flex flex-col gap-2 rounded-md bg-gray-50 px-3 py-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-gray-700">
                        {formatLongDate(start)}
                      </span>
                      {confirmRemove !== start && (
                        <button
                          type="button"
                          aria-label={`Remove period start on ${formatLongDate(start)}`}
                          disabled={periodBusy}
                          onClick={() => setConfirmRemove(start)}
                          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 disabled:opacity-50"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    {confirmRemove === start && (
                      <div className="flex flex-col gap-2 pb-2">
                        <p className="text-xs text-gray-600">
                          {data.recentPeriodStarts.length === 1
                            ? 'This is your only logged start. Removing it means your cycle needs a new start date.'
                            : 'Remove this period start? Your cycle will be worked out from the others.'}
                        </p>
                        <div className="flex flex-wrap gap-6">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmRemove(null)}
                          >
                            Keep
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={periodBusy}
                            onClick={() => void handleRemove(start)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Estimates only. Not a contraceptive or fertility tool.
      </p>
    </Card>
  );
}
