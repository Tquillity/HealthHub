import { Droplet, Moon, Sprout, Sun, type LucideIcon } from 'lucide-react';
import type { CyclePhase } from '@/lib/cycle-calculator';
import { cn } from '@/lib/utils';
import { getPhaseTheme } from '@/lib/phase-theme';

/** One icon per phase: bleeding, growth, peak energy, winding down. */
const PHASE_ICONS: Record<CyclePhase, LucideIcon> = {
  menstrual: Droplet,
  follicular: Sprout,
  ovulation: Sun,
  luteal: Moon,
};

/** Decorative phase icon in the phase's accent color (pair it with visible text). */
export function PhaseIcon({
  phase,
  className,
}: {
  phase: CyclePhase;
  className?: string;
}) {
  const Icon = PHASE_ICONS[phase];
  return (
    <Icon
      aria-hidden="true"
      className={cn('h-4 w-4 shrink-0', getPhaseTheme(phase).text.accent, className)}
    />
  );
}
