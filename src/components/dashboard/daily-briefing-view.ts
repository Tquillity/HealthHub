import type { BriefingPhaseInfo } from '@/lib/briefing/types';

/**
 * Pure helpers for the dashboard briefing panel (daily-briefing-panel.tsx), kept apart
 * so they can be tested without a DOM.
 */

/** "Luteal phase · day 23", or "Cycle day 35 · longer than usual" without a phase estimate. */
export function phaseLabel(phase: BriefingPhaseInfo): string {
  if (!phase.phase) {
    return `Cycle day ${phase.cycleDay} · longer than usual`;
  }
  const name = phase.phase.charAt(0).toUpperCase() + phase.phase.slice(1);
  return `${name} phase · day ${phase.cycleDay}`;
}
