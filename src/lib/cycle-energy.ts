import { PHASE_LENGTHS, type CyclePhase } from '@/lib/cycle-calculator';

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
 * Segments use the chart's fixed wellness-model lengths (`PHASE_LENGTHS`): menstrual
 * days 1-5, follicular 6-14, ovulation 15-18, luteal from day 19 to the end of the cycle.
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

const PHASE_SEGMENTS: Record<
  CyclePhase,
  (cycleLength: number) => [number, number]
> = {
  menstrual: () => [1, PHASE_LENGTHS.MENSTRUAL],
  follicular: () => [PHASE_LENGTHS.MENSTRUAL + 1, FOLLICULAR_END],
  ovulation: () => [FOLLICULAR_END + 1, OVULATION_END],
  luteal: (cycleLength) => [
    OVULATION_END + 1,
    Math.max(OVULATION_END + 1, cycleLength),
  ],
};

/** Mean of the typical curve over the phase's chart segment (e.g. luteal ≈ 5.75 for 28 days). */
export function typicalPhaseEnergy(
  phase: CyclePhase,
  cycleLength: number
): number {
  const [first, last] = PHASE_SEGMENTS[phase](cycleLength);
  let total = 0;
  for (let day = first; day <= last; day++) {
    total += typicalEnergyForCycleDay(day, cycleLength);
  }
  return total / (last - first + 1);
}
