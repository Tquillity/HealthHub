'use client';

/**
 * Mode Toggle Component
 * 
 * Toggles between "Lifestyle" and "Clinical" modes for the Cycle Tracker.
 * 
 * Lifestyle Mode: Simplified view with only Energy Level
 * Clinical Mode: Full view with all hormone curves and detailed information
 */

import { useQueryState, parseAsString } from 'nuqs';
import { Button } from '@/components/ui/button';
import { Sparkles, Activity } from 'lucide-react';
import { getPhaseTheme } from '@/lib/phase-theme';
import { CyclePhase } from '@/lib/cycle-calculator';

interface ModeToggleProps {
  currentPhase: CyclePhase;
}

export function ModeToggle({ currentPhase }: ModeToggleProps) {
  const [mode, setMode] = useQueryState(
    'mode',
    parseAsString.withDefault('lifestyle')
  );

  const theme = getPhaseTheme(currentPhase);
  const isClinical = mode === 'clinical';

  const handleToggle = () => {
    setMode(isClinical ? 'lifestyle' : 'clinical');
  };

  return (
    <Button
      onClick={handleToggle}
      variant="outline"
      size="sm"
      className={`gap-2 min-h-[44px] border-2 transition-all ${
        isClinical
          ? `${theme.border.accent} ${theme.bg.primary}`
          : 'border-gray-300 bg-white'
      }`}
      aria-label={`Switch to ${isClinical ? 'Lifestyle' : 'Clinical'} mode`}
    >
      {isClinical ? (
        <>
          <Activity className="h-4 w-4" />
          <span className="font-medium">Clinical</span>
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4" />
          <span className="font-medium">Lifestyle</span>
        </>
      )}
    </Button>
  );
}

