'use client';

/**
 * CyclePageClient Component
 * 
 * Client component wrapper for the cycle tracker page that handles:
 * - Focus preference selector
 * - Phase hover state management
 * - Hover preview panel
 * - Next period date display
 * 
 * This component wraps the server-rendered content and adds interactivity.
 */

import { useState } from 'react';
import { CyclePhase, CyclePhaseResult } from '@/lib/cycle-calculator';
import { FocusPreferenceSelector } from './focus-preference-selector';
import { PhaseIndicator } from './phase-indicator';
import { CycleChart } from './cycle-chart';
import { PhaseHoverPreview } from './phase-hover-preview';
import { RecommendationCard } from './recommendation-card';
import { getDietaryRecommendations } from '@/lib/dietary-recommendations';

interface CyclePageClientProps {
  phaseData: CyclePhaseResult;
  recommendations: any[];
  userPreference: {
    focusPreference: 'hormonal' | 'workout' | 'both';
    cycleLength: number;
  };
}

const PHASE_COLORS: Record<CyclePhase, string> = {
  menstrual: '#f43f5e',
  follicular: '#d946ef',
  ovulation: '#f59e0b',
  luteal: '#6366f1',
};

const PHASE_NAMES: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulation: 'Ovulation',
  luteal: 'Luteal',
};

export function CyclePageClient({
  phaseData,
  recommendations,
  userPreference,
}: CyclePageClientProps) {
  const [hoveredPhase, setHoveredPhase] = useState<CyclePhase | null>(null);
  const dietaryRecs = getDietaryRecommendations(phaseData.currentPhase);

  return (
    <div className="flex flex-col gap-6">
      {/* Focus Preference Selector */}
      <FocusPreferenceSelector currentPreference={userPreference.focusPreference} />

      {/* Header with Phase Indicator and Next Period Date */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Cycle Tracker</h1>
            <p className="text-gray-500">
              Day {phaseData.daysIntoCycle} of {userPreference.cycleLength}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-medium text-gray-700">
            Current Phase:
            <PhaseIndicator
              phase={phaseData.currentPhase}
              color={PHASE_COLORS[phaseData.currentPhase]}
            />
          </p>
          {phaseData.nextPeriodDate && (
            <p className="text-sm text-gray-600 mt-1">
              Next period expected: {phaseData.nextPeriodDate.toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {/* Cycle Chart and Hover Preview */}
      <div className="flex gap-6">
        {/* Main Chart */}
        <div className="flex-1 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <CycleChart
            phaseData={phaseData}
            cycleLength={userPreference.cycleLength}
            onPhaseHover={setHoveredPhase}
          />
        </div>

        {/* Hover Preview Panel */}
        <PhaseHoverPreview hoveredPhase={hoveredPhase} currentPhase={phaseData.currentPhase} />
      </div>

      {/* Dietary Recommendations */}
      {dietaryRecs && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            General Dietary Guidance for {PHASE_NAMES[phaseData.currentPhase]} Phase
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Macronutrients</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>Carbs: <span className="font-medium">{dietaryRecs.carbs}</span></li>
                <li>Protein: <span className="font-medium">{dietaryRecs.protein}</span></li>
                <li>Fats: <span className="font-medium">{dietaryRecs.fats}</span></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Focus Foods</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                {dietaryRecs.focus.map((food, idx) => (
                  <li key={idx}>• {food}</li>
                ))}
              </ul>
              <p className="text-sm text-gray-600 mt-2">
                Hydration: <span className="font-medium">{dietaryRecs.hydration}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Expert Recommendations */}
      {recommendations && recommendations.length > 0 ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Expert Recommendations for {PHASE_NAMES[phaseData.currentPhase]} Phase
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {recommendations.map((recommendation: any) => (
              <RecommendationCard key={recommendation.id} recommendation={recommendation} />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-gray-600 text-center">
            No recommendations available for your current phase and focus preference. 
            Check back later or adjust your focus preference above.
          </p>
        </div>
      )}
    </div>
  );
}

