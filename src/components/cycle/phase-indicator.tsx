'use client';

/**
 * PhaseIndicator Component
 * 
 * Visual indicator showing the current cycle phase with color coding.
 * Ported from food-heaven project.
 */

import { CyclePhase } from '@/lib/cycle-calculator';

interface PhaseIndicatorProps {
  phase: CyclePhase;
  color: string;
}

const PHASE_NAMES: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulation: 'Ovulation',
  luteal: 'Luteal',
};

export function PhaseIndicator({ phase, color }: PhaseIndicatorProps) {
  return (
    <span
      className="font-bold capitalize ml-2"
      style={{ color }}
    >
      {PHASE_NAMES[phase]}
    </span>
  );
}

