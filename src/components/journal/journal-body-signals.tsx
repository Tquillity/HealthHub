import {
  CERVICAL_MUCUS_LABELS,
  formatTemperature,
  isCervicalMucus,
} from '@/lib/bbt';

type BodySignals = {
  /** °C */
  temperature: number | null;
  /** Decrypted. */
  cervicalMucus: string | null;
  restingHeartRate: number | null;
  heartRateVariability: number | null;
  sleepQuality: number | null;
};

/**
 * Journal entry detail: the day's BBT, cervical mucus and vitals, read-only. They are
 * logged and edited in the cycle page quick log and the dashboard Vitals card.
 */
export function JournalBodySignals({ entry }: { entry: BodySignals }) {
  const rows: { label: string; value: string }[] = [];
  if (entry.temperature !== null) {
    rows.push({
      label: 'Waking temperature',
      value: `${formatTemperature(entry.temperature, 'C')} / ${formatTemperature(entry.temperature, 'F')}`,
    });
  }
  if (entry.cervicalMucus !== null && isCervicalMucus(entry.cervicalMucus)) {
    rows.push({
      label: 'Cervical mucus',
      value: CERVICAL_MUCUS_LABELS[entry.cervicalMucus],
    });
  }
  if (entry.restingHeartRate !== null) {
    rows.push({
      label: 'Resting heart rate',
      value: `${entry.restingHeartRate} bpm`,
    });
  }
  if (entry.heartRateVariability !== null) {
    rows.push({ label: 'HRV', value: `${entry.heartRateVariability} ms` });
  }
  if (entry.sleepQuality !== null) {
    rows.push({ label: 'Sleep quality', value: `${entry.sleepQuality}/10` });
  }
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-gray-50 p-4">
      <h3 className="text-lg font-semibold text-gray-900">Body signals</h3>
      <dl className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <dt className="text-sm text-gray-600">{row.label}</dt>
            <dd className="text-sm font-semibold text-gray-900">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-gray-500">
        Edit these in the quick log on the Cycle page (temperature) or the
        Vitals card on the dashboard.
      </p>
    </div>
  );
}
