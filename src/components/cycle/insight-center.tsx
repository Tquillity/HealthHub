'use client';

/**
 * InsightCenter Component
 * 
 * Fixed insight panel that displays phase-specific information and recommendations.
 * Replaced the previous conditional PhaseHoverPreview component to eliminate layout shift.
 * 
 * Features:
 * - Always visible, stable layout position
 * - Shows current phase by default
 * - Updates content smoothly when user hovers over different phases in chart
 * - Displays top recommendation and key metrics
 * 
 * 2026 UX Pattern: Integrated Focus Area that maintains layout stability
 */

import { useState, useEffect } from 'react';
import { CyclePhase } from '@/lib/cycle-calculator';
import { getRecommendationsByPhase } from '@/actions/cycle-actions';
import { getDietaryRecommendations } from '@/lib/dietary-recommendations';
import { Sparkles, Loader2 } from 'lucide-react';

interface InsightCenterProps {
  activePhase: CyclePhase;
  currentPhase: CyclePhase;
  isHovering: boolean;
}

const PHASE_NAMES: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulation: 'Ovulation',
  luteal: 'Luteal',
};

const PHASE_DESCRIPTIONS: Record<CyclePhase, string> = {
  menstrual: 'Rest and recovery phase. Focus on gentle movement and nourishing foods.',
  follicular: 'Energy levels rising. Great time for high-intensity activities and new challenges.',
  ovulation: 'Peak energy window. Optimal time for high-intensity training and complex problem solving.',
  luteal: 'Energy may fluctuate. Listen to your body and adjust intensity accordingly.',
};

export function InsightCenter({ activePhase, currentPhase, isHovering }: InsightCenterProps) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getRecommendationsByPhase(activePhase);
        if (result.success && result.data) {
          setRecommendations(result.data);
        } else {
          setError(result.error || 'Failed to load recommendations');
        }
      } catch (err) {
        console.error('Error fetching phase recommendations:', err);
        setError('Failed to load recommendations');
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [activePhase]);

  const dietaryRecs = getDietaryRecommendations(activePhase);
  const topRecommendation = recommendations.length > 0 ? recommendations[0] : null;

  return (
    <div
      className={`p-6 transition-all duration-300 border-2 rounded-lg ${
        isHovering
          ? 'border-primary-400 bg-primary-50/30 shadow-lg'
          : 'border-transparent bg-white shadow-lg'
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        <Sparkles
          className={`h-5 w-5 transition-colors ${
            isHovering ? 'text-primary-600' : 'text-amber-500'
          }`}
        />
        <h3 className="font-bold text-xl text-gray-900">
          {isHovering ? 'Phase Intelligence' : 'Daily Focus'}
        </h3>
      </div>

      <div className="flex flex-col gap-4">
        {/* Current Phase Display */}
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
            {isHovering ? 'Exploring' : 'Current'} Phase
          </span>
          <p className="text-2xl font-extrabold capitalize text-primary-600 mt-1">
            {PHASE_NAMES[activePhase]}
          </p>
          {activePhase !== currentPhase && (
            <p className="text-xs text-gray-500 mt-1">
              (Currently in {PHASE_NAMES[currentPhase]} phase)
            </p>
          )}
        </div>

        {/* Phase Description */}
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
          <p className="text-sm text-gray-700 leading-relaxed">
            {PHASE_DESCRIPTIONS[activePhase]}
          </p>
        </div>

        {/* Top Recommendation */}
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : topRecommendation ? (
          <div className="p-4 rounded-xl bg-linear-to-br from-primary-50 to-primary-100 border border-primary-200">
            <div className="flex items-start gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary-700">
                Top Tip from {topRecommendation.expert.name}
              </span>
            </div>
            {topRecommendation.content.guidance && (
              <p className="text-sm text-gray-800 leading-relaxed italic">
                "{topRecommendation.content.guidance}"
              </p>
            )}
            {topRecommendation.content.workout_types &&
              topRecommendation.content.workout_types.length > 0 && (
                <p className="text-sm text-gray-800 leading-relaxed mt-2">
                  <span className="font-medium">Recommended:</span>{' '}
                  {topRecommendation.content.workout_types[0]}
                </p>
              )}
            {topRecommendation.content.foods_to_eat &&
              topRecommendation.content.foods_to_eat.length > 0 && (
                <p className="text-sm text-gray-800 leading-relaxed mt-2">
                  <span className="font-medium">Focus on:</span>{' '}
                  {topRecommendation.content.foods_to_eat[0]}
                </p>
              )}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
            <p className="text-sm text-gray-600 text-center">
              No expert recommendations available for this phase
            </p>
          </div>
        )}

        {/* Dietary Summary */}
        {dietaryRecs && (
          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Quick Dietary Guide
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                {dietaryRecs.carbs} carbs
              </span>
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                {dietaryRecs.protein} protein
              </span>
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                {dietaryRecs.fats} fats
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

