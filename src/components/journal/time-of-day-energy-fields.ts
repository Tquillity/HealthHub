import type { TimeOfDayEnergyFields } from '@/lib/validation/circadian-schemas';

/** The journal form's morning, afternoon and evening energy (circadian insights opt-in). */
export const TIME_OF_DAY_ENERGY_FIELDS = [
  { key: 'energyMorning', label: 'Morning', hours: '06-12' },
  { key: 'energyAfternoon', label: 'Afternoon', hours: '12-18' },
  { key: 'energyEvening', label: 'Evening', hours: '18-22' },
] as const;

export type TimeOfDayEnergyKey =
  (typeof TIME_OF_DAY_ENERGY_FIELDS)[number]['key'];

/** The form's text for each field ('' = blank). */
export type TimeOfDayEnergyForm = Record<TimeOfDayEnergyKey, string>;

/** Rating text to the value to send: empty clears it (`null`). */
function ratingOrNull(value: string): number | null {
  return value ? parseInt(value, 10) : null;
}

/**
 * The time-of-day ratings a journal save sends: only the ones the user changed since the
 * form loaded. The dashboard check-in writes the same fields on the same day, so a field
 * left as it loaded is omitted (`undefined` keeps the stored value). Otherwise saving a
 * form that was open while the user checked in elsewhere would clear that check-in.
 */
export function changedTimeOfDayEnergy(
  loaded: TimeOfDayEnergyForm,
  current: TimeOfDayEnergyForm
): TimeOfDayEnergyFields {
  const changed: TimeOfDayEnergyFields = {};
  for (const { key } of TIME_OF_DAY_ENERGY_FIELDS) {
    const value = ratingOrNull(current[key]);
    if (value !== ratingOrNull(loaded[key])) changed[key] = value;
  }
  return changed;
}
