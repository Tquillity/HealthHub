import {
  getOvulationDay,
  getPhaseForDay,
  PHASE_LENGTHS,
  type CyclePhase,
} from '@/lib/cycle-calculator';

/**
 * Typical energy pattern across the cycle, on a 1-10 scale: the "Energy Level" curve of
 * the cycle chart, shared here so the chart and the daily briefing use one model.
 *
 * It is an illustrative typical pattern, not a measurement or a prediction for one
 * person: low during menstruation, rising through the follicular phase, highest around
 * ovulation, then declining through the luteal phase (the phase descriptions in
 * components/cycle/phase-deep-dive.tsx; Dr. Natalie Crawford on Huberman Lab, 2023;
 * NIH/Endotext "The Normal Menstrual Cycle and the Control of Ovulation"). Studies of
 * performance find only small average differences between phases (McNulty KL et al.,
 * "The effects of menstrual cycle phase on exercise performance in eumenorrheic women:
 * a systematic review and meta-analysis", Sports Med 2020;50:1813-1827), so anything
 * that compares a person with this curve must treat it as a loose reference and prefer
 * their own history.
 *
 * The curve's shape uses the chart's fixed wellness-model lengths (`PHASE_LENGTHS`):
 * low on days 1-5, rising on days 6-14, peaking on days 15-18, declining from day 19 to
 * the end of the cycle. Per-phase means (`typicalPhaseEnergy`) instead average the curve
 * over the days the phase model (`getPhaseForDay`, ovulation ~14 days before the end of
 * the cycle) gives that phase: the same days the cycle chart shades as the phase and the
 * daily briefing calls it.
 */

const FOLLICULAR_END = PHASE_LENGTHS.MENSTRUAL + PHASE_LENGTHS.FOLLICULAR;
const OVULATION_END = FOLLICULAR_END + PHASE_LENGTHS.OVULATION;

/** Typical energy (about 3-10) on a 1-based cycle day. Not rounded. */
export function typicalEnergyForCycleDay(
  day: number,
  cycleLength: number
): number {
  if (day <= PHASE_LENGTHS.MENSTRUAL) {
    // Menstrual phase: low energy (3-4)
    return 3 + (day / PHASE_LENGTHS.MENSTRUAL) * 1;
  }
  if (day <= FOLLICULAR_END) {
    // Follicular phase: rising energy (4-7)
    const follicularDay = day - PHASE_LENGTHS.MENSTRUAL;
    return 4 + (follicularDay / PHASE_LENGTHS.FOLLICULAR) * 3;
  }
  if (day <= OVULATION_END) {
    // Ovulation phase: peak energy (8-10)
    return 8 + (day - FOLLICULAR_END) * 0.5;
  }
  // Luteal phase: declining energy (8.5 down to 3.5)
  const lutealDay = day - OVULATION_END;
  const lutealLength = Math.max(1, cycleLength - OVULATION_END);
  return 8.5 - (lutealDay / lutealLength) * 5;
}

/**
 * Mean of the typical curve over the days `getPhaseForDay` gives `phase` in a cycle of
 * `cycleLength` days (for 28 days: ovulation days 11-14 ≈ 6.5, luteal days 15-28 ≈ 6.75).
 * When the model gives the phase no day at this length (the follicular phase of the
 * shortest cycles), the curve on the estimated ovulation day is used.
 */
export function typicalPhaseEnergy(
  phase: CyclePhase,
  cycleLength: number
): number {
  let total = 0;
  let count = 0;
  for (let day = 1; day <= cycleLength; day++) {
    if (getPhaseForDay(day, cycleLength) !== phase) continue;
    total += typicalEnergyForCycleDay(day, cycleLength);
    count += 1;
  }
  return count > 0
    ? total / count
    : typicalEnergyForCycleDay(getOvulationDay(cycleLength), cycleLength);
}
