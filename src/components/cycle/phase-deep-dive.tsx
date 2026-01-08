'use client';

/**
 * Phase Deep Dive Component
 * 
 * Comprehensive phase information panel for desktop deep-dive exploration.
 * Shows detailed information about a specific phase including:
 * - What's happening in the body
 * - Expert recommendations
 * - Dietary guidance
 * - Exercise recommendations
 * 
 * Used when user clicks a phase area or navigates via URL (?phase=X&view=detail)
 */

import { useState, useEffect } from 'react';
import { CyclePhase } from '@/lib/cycle-calculator';
import { getPhaseTheme } from '@/lib/phase-theme';
import { getPhaseRecommendations } from '@/actions/cycle-actions';
import { getDietaryRecommendations } from '@/lib/dietary-recommendations';
import { RecommendationCard } from './recommendation-card';
import { Card } from '@/components/ui/card';
import { X, Sparkles, Heart, Dumbbell, Utensils, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useQueryState, parseAsString } from 'nuqs';

interface PhaseDeepDiveProps {
  phase: CyclePhase;
  currentPhase: CyclePhase;
  focusPreference: 'hormonal' | 'workout' | 'both';
  onClose: () => void;
}

const PHASE_NAMES: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulation: 'Ovulation',
  luteal: 'Luteal',
};

const PHASE_DESCRIPTIONS: Record<CyclePhase, string> = {
  menstrual: 'Your body is shedding the uterine lining. Energy levels are typically at their lowest. This is a time for rest, recovery, and gentle movement.',
  follicular: 'Estrogen levels are rising, preparing your body for ovulation. Energy and motivation are building. This is an ideal time for new challenges and high-intensity activities.',
  ovulation: 'Peak fertility window. Estrogen and testosterone are at their highest. This is your peak performance phase - ideal for demanding workouts and complex problem-solving.',
  luteal: 'Progesterone rises while estrogen declines. Energy may fluctuate. This phase requires flexibility - listen to your body and adjust intensity accordingly.',
};

const BODY_CHANGES: Record<CyclePhase, string[]> = {
  menstrual: [
    'Uterine lining is being shed',
    'Prostaglandins cause uterine contractions',
    'Iron levels may drop',
    'Energy and motivation are low',
    'Cortisol sensitivity may increase',
  ],
  follicular: [
    'Estrogen levels rise steadily',
    'Follicle-stimulating hormone (FSH) is active',
    'Uterine lining begins to rebuild',
    'Energy and motivation increase',
    'Metabolism may be slightly elevated',
  ],
  ovulation: [
    'Estrogen and testosterone peak',
    'Luteinizing hormone (LH) surge triggers ovulation',
    'Cervical mucus becomes fertile',
    'Energy and strength are at peak',
    'Cognitive function may be enhanced',
  ],
  luteal: [
    'Progesterone rises significantly',
    'Estrogen declines after ovulation',
    'Body temperature may be slightly elevated',
    'Energy may fluctuate day-to-day',
    'Appetite and cravings may increase',
  ],
};

export function PhaseDeepDive({
  phase,
  currentPhase,
  focusPreference,
  onClose,
}: PhaseDeepDiveProps) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const theme = getPhaseTheme(phase);
  const dietaryRecs = getDietaryRecommendations(phase);
  const isCurrentPhase = phase === currentPhase;

  useEffect(() => {
    const fetchRecommendations = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getPhaseRecommendations(phase, focusPreference);
        if (result.success && result.recommendations) {
          setRecommendations(result.recommendations);
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
  }, [phase, focusPreference]);

  const router = useRouter();
  const allPhases: CyclePhase[] = ['menstrual', 'follicular', 'ovulation', 'luteal'];

  // Get current mode from URL to preserve it when switching phases
  const [mode] = useQueryState(
    'mode',
    parseAsString.withDefault('lifestyle')
  );

  // Handle phase tab navigation - preserve mode parameter
  const handlePhaseTabClick = (newPhase: CyclePhase) => {
    router.push(`/cycle?phase=${newPhase}&view=detail&mode=${mode}`);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Back to Dashboard Button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="gap-2 min-h-[44px]"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      {/* Phase Navigation Tabs - Color-Coded with Enhanced Theming */}
      <div
        role="tablist"
        className="flex flex-wrap gap-2 border-b-2 border-gray-200 pb-2"
        aria-label="Cycle phase navigation"
      >
        {allPhases.map((phaseOption) => {
          const isActive = phaseOption === phase;
          const phaseTheme = getPhaseTheme(phaseOption);
          return (
            <button
              key={phaseOption}
              role="tab"
              aria-selected={isActive}
              aria-controls={`phase-${phaseOption}-panel`}
              onClick={() => handlePhaseTabClick(phaseOption)}
              className={`px-4 py-2 rounded-t-lg font-semibold text-sm transition-all duration-200 min-h-[44px] ${
                isActive
                  ? 'text-gray-900 border-b-4'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
              style={
                isActive
                  ? {
                      borderBottomColor: phaseTheme.color.primary,
                      borderBottomWidth: '4px',
                      backgroundColor: `${phaseTheme.color.primary}10`, // 10% opacity background
                    }
                  : {}
              }
            >
              {PHASE_NAMES[phaseOption]}
            </button>
          );
        })}
      </div>

      {/* Header */}
      <div className={`flex items-center justify-between p-6 rounded-lg ${theme.bg.primary} ${theme.border.primary} border-2`}>
        <div className="flex items-center gap-4">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: theme.color.primary }}
          />
          <div>
            <h2 className={`text-2xl font-bold ${theme.text.primary}`}>
              {PHASE_NAMES[phase]} Phase
            </h2>
            {!isCurrentPhase && (
              <p className={`text-sm ${theme.text.secondary} mt-1`}>
                You're currently in {PHASE_NAMES[currentPhase]} phase
              </p>
            )}
          </div>
        </div>
      </div>

      {/* What's Happening in Your Body */}
      <Card className={`p-6 ${theme.bg.secondary} ${theme.border.primary} border`}>
        <div className="flex items-center gap-2 mb-4">
          <Heart className={`h-5 w-5 ${theme.text.accent}`} />
          <h3 className={`text-lg font-semibold ${theme.text.primary}`}>
            What's Happening in Your Body
          </h3>
        </div>
        <p className={`mb-4 ${theme.text.secondary}`}>
          {PHASE_DESCRIPTIONS[phase]}
        </p>
        <ul className="flex flex-col gap-2">
          {BODY_CHANGES[phase].map((change, index) => (
            <li key={index} className={`flex items-start gap-2 ${theme.text.secondary}`}>
              <span className={`mt-1.5 ${theme.text.accent}`}>•</span>
              <span>{change}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Dietary Guidance */}
      {dietaryRecs && (
        <Card className={`p-6 ${theme.bg.secondary} ${theme.border.primary} border`}>
          <div className="flex items-center gap-2 mb-4">
            <Utensils className={`h-5 w-5 ${theme.text.accent}`} />
            <h3 className={`text-lg font-semibold ${theme.text.primary}`}>
              Dietary Guidance
            </h3>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${theme.bg.accent} ${theme.text.accent}`}>
                {dietaryRecs.carbs} carbs
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${theme.bg.accent} ${theme.text.accent}`}>
                {dietaryRecs.protein} protein
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${theme.bg.accent} ${theme.text.accent}`}>
                {dietaryRecs.fats} fats
              </span>
            </div>
            <div>
              <p className={`text-sm font-medium mb-2 ${theme.text.primary}`}>Focus Foods:</p>
              <p className={`text-sm ${theme.text.secondary}`}>
                {dietaryRecs.focus.join(', ')}
              </p>
            </div>
            <div>
              <p className={`text-sm font-medium ${theme.text.primary}`}>
                Hydration: <span className={theme.text.secondary}>{dietaryRecs.hydration}</span>
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Expert Recommendations */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className={`h-5 w-5 ${theme.text.accent}`} />
          <h3 className={`text-lg font-semibold ${theme.text.primary}`}>
            Expert Recommendations
          </h3>
        </div>

        {loading && (
          <Card className="p-8">
            <p className="text-center text-gray-500">Loading recommendations...</p>
          </Card>
        )}

        {error && (
          <Card className={`p-6 ${theme.bg.secondary} border border-red-200`}>
            <p className="text-red-600">{error}</p>
          </Card>
        )}

        {!loading && !error && recommendations.length === 0 && (
          <Card className={`p-6 ${theme.bg.secondary} ${theme.border.primary} border`}>
            <p className={`text-center ${theme.text.secondary}`}>
              No expert recommendations available for this phase and focus preference.
            </p>
          </Card>
        )}

        {!loading && !error && recommendations.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.map((rec) => (
              <RecommendationCard key={rec.id} recommendation={rec} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

