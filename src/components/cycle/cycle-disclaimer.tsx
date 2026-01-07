'use client';

/**
 * Cycle Disclaimer Component
 * 
 * Displays important disclaimers about cycle tracking variability, evidence base,
 * and medical advice. Ensures users understand the wellness vs. clinical nature
 * of cycle syncing recommendations.
 */

import { Info } from 'lucide-react';

export function CycleDisclaimer() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 max-w-7xl mx-auto">
      <div className="flex items-start gap-3">
        <Info className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="flex flex-col gap-2 text-sm text-amber-900">
          <p className="font-semibold">Important Information</p>
          <div className="flex flex-col gap-1.5 text-xs leading-relaxed">
            <p>
              <strong>Individual Variability:</strong> Normal cycle length ranges from 21-35 days (average ~29 days). 
              Only ~13% of cycles are exactly 28 days. Luteal phase averages 12.4 days (range 9-16 days).
            </p>
            <p>
              <strong>Wellness vs. Clinical Models:</strong> This app uses a 4-phase wellness model for user-friendly 
              "cycle syncing." Clinically, cycles are typically described as two main phases: Follicular (variable) 
              and Luteal (~12-14 days). Ovulation is a brief 12-48 hour event.
            </p>
            <p>
              <strong>Evidence Base:</strong> While cycle syncing has anecdotal support and biological plausibility, 
              robust RCTs for universal diet/exercise/fasting optimization are limited. Meta-analyses show trivial 
              performance impacts across phases. Personalized approaches based on readiness and symptoms are preferred.
            </p>
            <p>
              <strong>Medical Disclaimer:</strong> This information is for educational purposes only and should not 
              replace personalized medical or nutritional advice. Consult healthcare providers for medical decisions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

