import { format } from 'date-fns';
import { dateOnlyToLocalDate } from '@/lib/date-only';
import { formatTemperature, roundTo, type TemperatureUnit } from '@/lib/bbt';
import type { RecoveryZone } from '@/lib/recovery';
import type {
  ChartBbtOverlay,
  ThermalShiftSummary,
} from '@/lib/cycle-insights';

/**
 * Colours and copy for the user's own readings on the cycle chart and the quick log.
 *
 * Copy is guidance, not diagnosis: a sustained BBT rise confirms after the fact that
 * ovulation probably happened (Marshall JA, "A field trial of the basal body-temperature
 * method of regulating births", Lancet 1968;2:8-10). It cannot predict or prevent
 * pregnancy.
 */

// Hex values for Recharts/SVG props; they match the Tailwind classes in the legend.
export const BBT_COLOR = '#ea580c'; // orange-600
export const RECOVERY_COLOR = '#0d9488'; // teal-600
export const BIO_VERIFIED_COLOR = '#16a34a'; // green-600
export const RECOVERY_ZONE_COLORS: Record<RecoveryZone, string> = {
  green: '#16a34a', // green-600
  yellow: '#d97706', // amber-600
  red: '#dc2626', // red-600
};

/** `YYYY-MM-DD` → "Mar 5" (local calendar day). */
export function formatShortDate(date: string): string {
  return format(dateOnlyToLocalDate(date), 'MMM d');
}

/** Padded BBT axis range in the user's unit, with headroom for the Bio-Verified marker. */
export function bbtAxisDomain(overlay: ChartBbtOverlay): [number, number] {
  const values = overlay.points.map((p) => p.value);
  if (overlay.coverline !== null) values.push(overlay.coverline);
  const pad = overlay.unit === 'F' ? 0.4 : 0.2;
  // Round first so float noise (36.3 - 0.2 = 36.0999…) does not drop a whole tenth.
  const min = roundTo((Math.min(...values) - pad) * 10, 6);
  const max = roundTo((Math.max(...values) + pad * 2) * 10, 6);
  return [Math.floor(min) / 10, Math.ceil(max) / 10];
}

/** One-line status of the current cycle's temperature shift. */
export function thermalShiftMessage(
  shift: ThermalShiftSummary,
  unit: TemperatureUnit
): string {
  if (shift.detected && shift.ovulationDate) {
    const coverline =
      shift.coverlineCelsius !== null
        ? ` Three readings stayed above your coverline of ${formatTemperature(shift.coverlineCelsius, unit)}.`
        : '';
    return `Ovulation bio-verified around ${formatShortDate(shift.ovulationDate)}.${coverline}`;
  }
  if (!shift.cycleStart) {
    return 'Log when your period starts to follow your temperature by cycle.';
  }
  if (shift.validReadings < shift.readingsNeeded) {
    return `${shift.validReadings} of ${shift.readingsNeeded} readings this cycle. Keep logging to see your temperature shift.`;
  }
  return 'No temperature shift yet this cycle. Keep logging each morning.';
}

/** Where a reading sits relative to this cycle's shift (tooltip copy). */
export function bbtReadingStatus(
  date: string,
  shift: ThermalShiftSummary
): string {
  if (shift.cycleStart && date < shift.cycleStart) return 'Previous cycle';
  if (!shift.detected || !shift.ovulationDate) {
    return 'Not verified yet: no temperature shift this cycle';
  }
  if (date === shift.ovulationDate) return 'Bio-verified ovulation day';
  if (date > shift.ovulationDate) return 'After your temperature shift';
  return 'Before your temperature shift';
}
