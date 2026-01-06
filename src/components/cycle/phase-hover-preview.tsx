'use client';

/**
 * PhaseHoverPreview Component
 * 
 * Side panel that displays recommendations for a hovered phase.
 * Shows when user hovers over a different phase in the cycle chart.
 * Ported from food-heaven project.
 */

import { useState, useEffect } from 'react';
import { CyclePhase } from '@/lib/cycle-calculator';
import { getRecommendationsByPhase } from '@/actions/cycle-actions';
import { RecommendationCard } from './recommendation-card';
import { Loader2 } from 'lucide-react';

interface PhaseHoverPreviewProps {
  hoveredPhase: CyclePhase | null;
  currentPhase: CyclePhase;
}

const PHASE_NAMES: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulation: 'Ovulation',
  luteal: 'Luteal',
};

export function PhaseHoverPreview({ hoveredPhase, currentPhase }: PhaseHoverPreviewProps) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!hoveredPhase || hoveredPhase === currentPhase) {
        setRecommendations([]);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = await getRecommendationsByPhase(hoveredPhase);
        if (result.success && result.data) {
          setRecommendations(result.data);
        } else {
          setError(result.error || 'Failed to load recommendations');
        }
      } catch (err) {
        console.error('Error fetching hovered phase recommendations:', err);
        setError('Failed to load recommendations');
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [hoveredPhase, currentPhase]);

  if (!hoveredPhase || hoveredPhase === currentPhase) {
    return null;
  }

  return (
    <div className="w-80 shrink-0">
      <div className="sticky top-4">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200">
          <div className="p-3 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 capitalize">
              {PHASE_NAMES[hoveredPhase]} Phase Preview
            </h3>
          </div>
          <div className="p-3 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : recommendations.length > 0 ? (
              <div className="flex flex-col gap-3">
                {recommendations.map((recommendation) => (
                  <div key={recommendation.id} className="scale-90 origin-top">
                    <RecommendationCard recommendation={recommendation} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No recommendations available for this phase
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

