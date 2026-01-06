'use client';

/**
 * CyclePageClient Component
 * 
 * 2026 Bento-Style Grid Layout for Cycle Tracker
 * 
 * Features:
 * - Stable grid layout that eliminates layout shift on hover
 * - Integrated Insight Center (always visible, updates content dynamically)
 * - Glassmorphic design elements for modern iOS/VisionOS feel
 * - Glanceable metrics (Next Period, Current Phase, Top Tip)
 * - Responsive Bento grid that collapses to single column on mobile
 * 
 * UX Improvements:
 * - No layout shift: Insight Center always occupies reserved space
 * - Visual feedback: Border color changes on hover to indicate dynamic content
 * - Above-the-fold information: Key metrics visible immediately
 * - Integrated recommendations: Top expert tip shown in Insight Center
 */

import { useState } from 'react';
import { CyclePhase, CyclePhaseResult } from '@/lib/cycle-calculator';
import { FocusPreferenceSelector } from './focus-preference-selector';
import { CycleChart } from './cycle-chart';
import { InsightCenter } from './insight-center';
import { RecommendationCard } from './recommendation-card';
import { Card } from '@/components/ui/card';
import { Calendar, Sparkles } from 'lucide-react';
import { differenceInDays } from 'date-fns';

interface CyclePageClientProps {
  phaseData: CyclePhaseResult;
  recommendations: any[];
  userPreference: {
    focusPreference: 'hormonal' | 'workout' | 'both';
    cycleLength: number;
  };
}

const PHASE_NAMES: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulation: 'Ovulation',
  luteal: 'Luteal',
};

const PHASE_COLORS: Record<CyclePhase, string> = {
  menstrual: '#f43f5e', // rose-500
  follicular: '#d946ef', // fuchsia-500
  ovulation: '#f59e0b', // amber-500
  luteal: '#6366f1', // indigo-500
};

export function CyclePageClient({
  phaseData,
  recommendations,
  userPreference,
}: CyclePageClientProps) {
  // Track the "active" phase to show in Insight Center
  // Defaults to current phase, updates on hover
  const [activePhase, setActivePhase] = useState<CyclePhase>(phaseData.currentPhase);
  const [isHovering, setIsHovering] = useState(false);

  const handleHoverChange = (phase: CyclePhase | null) => {
    if (phase) {
      setActivePhase(phase);
      setIsHovering(true);
    } else {
      setActivePhase(phaseData.currentPhase);
      setIsHovering(false);
    }
  };

  // Calculate days until next period
  const daysUntilNextPeriod = phaseData.nextPeriodDate
    ? differenceInDays(phaseData.nextPeriodDate, new Date())
    : null;

  return (
    <div className="relative flex flex-col gap-8 max-w-7xl mx-auto">
      {/* Phase Transition Overlay - Dims content when exploring phases */}
      {isHovering && (
        <div className="absolute inset-0 bg-black/5 pointer-events-none rounded-lg transition-opacity duration-300 -z-10" />
      )}

      {/* 1. Integrated Header & Preference */}
      <div
        className={`grid grid-cols-1 md:grid-cols-3 gap-6 transition-opacity duration-300 ${
          isHovering ? 'opacity-50' : 'opacity-100'
        }`}
      >
        <div className="md:col-span-2">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-2">
            Cycle Intelligence
          </h1>
          <p className="text-gray-500 text-lg">
            Optimizing your performance based on Day {phaseData.daysIntoCycle} of{' '}
            {userPreference.cycleLength}
          </p>
        </div>
        <div className="flex items-start justify-end">
          <FocusPreferenceSelector currentPreference={userPreference.focusPreference} />
        </div>
      </div>

      {/* 2. The Bento Grid (Layout Stability) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Chart Box (Reserved Space - 8 columns) */}
        <Card className="lg:col-span-8 p-6 bg-white/50 backdrop-blur-md border-gray-100 shadow-xl overflow-hidden">
          <CycleChart
            phaseData={phaseData}
            cycleLength={userPreference.cycleLength}
            onPhaseHover={handleHoverChange}
          />
        </Card>

        {/* The "Insight Center" (Always occupies 4 columns, no shifting) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <InsightCenter
            activePhase={activePhase}
            currentPhase={phaseData.currentPhase}
            isHovering={isHovering}
          />

          {/* Secondary Metric Box - Next Period */}
          {phaseData.nextPeriodDate && (
            <Card className="p-6 bg-linear-to-br from-indigo-500 to-purple-600 text-white shadow-lg">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-indigo-100 text-sm font-medium">Next Period</p>
                  {daysUntilNextPeriod !== null && (
                    <p className="text-3xl font-black mt-1">
                      {daysUntilNextPeriod === 0
                        ? 'Today'
                        : daysUntilNextPeriod === 1
                          ? '1 Day'
                          : `${daysUntilNextPeriod} Days`}
                    </p>
                  )}
                </div>
                <Calendar className="h-8 w-8 text-indigo-200 opacity-50" />
              </div>
              <p className="text-xs text-indigo-100 mt-4 font-medium uppercase tracking-tighter">
                Expected:{' '}
                {phaseData.nextPeriodDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* 3. Personalized Recommendation Feed (Modern Grid) */}
      {recommendations && recommendations.length > 0 && (
        <div
          className={`flex flex-col gap-6 transition-opacity duration-300 ${
            isHovering ? 'opacity-50' : 'opacity-100'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">Expert Insights</h2>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full border-2" style={{ 
                borderColor: PHASE_COLORS[phaseData.currentPhase],
                backgroundColor: `${PHASE_COLORS[phaseData.currentPhase]}15`
              }}>
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: PHASE_COLORS[phaseData.currentPhase] }}
                />
                <span className="text-sm font-semibold text-gray-700">
                  for {PHASE_NAMES[phaseData.currentPhase]} Phase
                </span>
              </div>
            </div>
            <div className="h-px flex-1 bg-gray-100" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {recommendations.map((recommendation: any) => (
              <RecommendationCard key={recommendation.id} recommendation={recommendation} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!recommendations || recommendations.length === 0) && (
        <Card
          className={`p-8 transition-opacity duration-300 ${
            isHovering ? 'opacity-50' : 'opacity-100'
          }`}
        >
          <div className="flex flex-col items-center justify-center text-center">
            <Sparkles className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No recommendations available
            </h3>
            <p className="text-gray-600 max-w-md">
              No expert recommendations available for your current phase and focus preference.
              Check back later or adjust your focus preference above.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
