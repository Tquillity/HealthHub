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

import { useState, useEffect } from 'react';
import { CyclePhase, CyclePhaseResult, calculateCyclePhase } from '@/lib/cycle-calculator';
import { useQueryState, parseAsString } from 'nuqs';
import { FocusPreferenceSelector } from './focus-preference-selector';
import { CycleChart } from './cycle-chart';
import { InsightCenter } from './insight-center';
import { JournalQuickLook } from './journal-quick-look';
import { RecommendationCard } from './recommendation-card';
import { PhaseDeepDive } from './phase-deep-dive';
import { PhaseDrawer } from './phase-drawer';
import { Card } from '@/components/ui/card';
import { Calendar, Sparkles } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { getPhaseTheme } from '@/lib/phase-theme';
import { getJournalSnippet } from '@/actions/journal-actions';

interface CyclePageClientProps {
  phaseData: CyclePhaseResult;
  recommendations: any[];
  userPreference: {
    focusPreference: 'hormonal' | 'workout' | 'both';
    cycleLength: number;
    lastPeriodDate: Date; // Required for date calculations
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
  // URL state management with nuqs
  const [urlPhase, setUrlPhase] = useQueryState(
    'phase',
    parseAsString.withDefault(phaseData.currentPhase)
  );
  const [view, setView] = useQueryState(
    'view',
    parseAsString.withDefault('summary')
  );
  const [selectedDate, setSelectedDate] = useQueryState(
    'selectedDate',
    parseAsString
  );

  // Track the "active" phase to show in Insight Center
  // Priority: URL phase > hover phase > current phase
  const [hoveredPhase, setHoveredPhase] = useState<CyclePhase | null>(null);
  const [isHovering, setIsHovering] = useState(false);

  // Determine active phase based on URL and hover state
  const activePhase: CyclePhase = (urlPhase as CyclePhase) || hoveredPhase || phaseData.currentPhase;
  const isExploringPhase = urlPhase && urlPhase !== phaseData.currentPhase;

  // Get theme for active phase
  const theme = getPhaseTheme(activePhase);

  // Handle phase hover
  const handleHoverChange = (phase: CyclePhase | null) => {
    if (phase) {
      setHoveredPhase(phase);
      setIsHovering(true);
    } else {
      setHoveredPhase(null);
      setIsHovering(false);
    }
  };

  // Handle phase click - navigate to deep dive
  const handlePhaseClick = (phase: CyclePhase) => {
    setUrlPhase(phase);
    setView('detail');
  };

  // Reset to summary view when clicking away
  const handleResetView = () => {
    setUrlPhase(null);
    setView('summary');
  };

  // Detect mobile viewport
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Determine if deep dive should be shown
  const showDeepDive = view === 'detail' && urlPhase;
  const deepDivePhase = urlPhase as CyclePhase | null;

  // Journal Quick Look state
  const [journalSnippet, setJournalSnippet] = useState<{
    mood: number | null;
    energy: number | null;
    notesSnippet: string | null;
  } | null>(null);
  const [snippetLoading, setSnippetLoading] = useState(false);
  const [selectedDateObj, setSelectedDateObj] = useState<Date | null>(null);
  const [selectedDatePhase, setSelectedDatePhase] = useState<CyclePhase | null>(null);

  // Fetch journal snippet when date is selected
  useEffect(() => {
    const fetchSnippet = async () => {
      if (!selectedDate) {
        setJournalSnippet(null);
        setSelectedDateObj(null);
        setSelectedDatePhase(null);
        return;
      }

      setSnippetLoading(true);
      try {
        // Date object safety: Validate and handle invalid date strings
        const dateObj = new Date(selectedDate);
        if (isNaN(dateObj.getTime())) {
          console.error('Invalid date string:', selectedDate);
          setJournalSnippet(null);
          setSelectedDateObj(null);
          setSelectedDatePhase(null);
          return;
        }
        dateObj.setHours(0, 0, 0, 0);
        setSelectedDateObj(dateObj);

        // Calculate phase for selected date (not current date)
        // We need to manually calculate since calculateCyclePhase uses "today"
        const lastPeriod = new Date(userPreference.lastPeriodDate);
        lastPeriod.setHours(0, 0, 0, 0);
        
        // Handle edge case: selected date is before last period
        if (dateObj < lastPeriod) {
          setSelectedDatePhase('follicular'); // Default fallback
        } else {
          const daysDiff = differenceInDays(dateObj, lastPeriod);
          const daysIntoSelectedCycle = (daysDiff % userPreference.cycleLength) + 1;
          
          // Determine phase based on selected date's position in cycle
          let calculatedPhase: CyclePhase = 'luteal';
          if (daysIntoSelectedCycle <= 5) {
            calculatedPhase = 'menstrual';
          } else if (daysIntoSelectedCycle <= 14) {
            calculatedPhase = 'follicular';
          } else if (daysIntoSelectedCycle <= 18) {
            calculatedPhase = 'ovulation';
          }
          
          setSelectedDatePhase(calculatedPhase);
        }

        const result = await getJournalSnippet(selectedDate);
        if (result.success) {
          setJournalSnippet(result.data);
        }
      } catch (error) {
        console.error('Error fetching journal snippet:', error);
      } finally {
        setSnippetLoading(false);
      }
    };

    fetchSnippet();
  }, [selectedDate, userPreference.lastPeriodDate, userPreference.cycleLength]);

  // Handle day click from chart
  const handleDayClick = (date: Date, day: number) => {
    const dateStr = date.toISOString().split('T')[0];
    setSelectedDate(dateStr);
  };

  // Close quick look
  const handleCloseQuickLook = () => {
    setSelectedDate(null);
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

      {/* 1. Integrated Header & Preference - Thematic Styling */}
      <div
        className={`grid grid-cols-1 md:grid-cols-3 gap-6 transition-opacity duration-300 ${
          isHovering ? 'opacity-50' : 'opacity-100'
        }`}
      >
        <div className="md:col-span-2">
          <h1 className={`text-4xl font-bold tracking-tight mb-2 ${theme.text.primary}`}>
            Cycle Intelligence
          </h1>
          <p className={`text-lg ${theme.text.secondary}`}>
            Optimizing your performance based on Day {phaseData.daysIntoCycle} of{' '}
            {userPreference.cycleLength}
            {isExploringPhase && (
              <span className={`ml-2 ${theme.text.accent}`}>
                • Exploring {PHASE_NAMES[activePhase]} Phase
              </span>
            )}
          </p>
        </div>
        <div className="flex items-start justify-end">
          <FocusPreferenceSelector currentPreference={userPreference.focusPreference} />
        </div>
      </div>

      {/* 2. The Bento Grid (Layout Stability) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Chart Box (Reserved Space - 8 columns) - Thematic Border */}
        <Card className={`lg:col-span-8 p-6 bg-white/50 backdrop-blur-md shadow-xl overflow-hidden transition-colors duration-300 ${theme.border.primary} border-2`}>
          <CycleChart
            phaseData={phaseData}
            cycleLength={userPreference.cycleLength}
            lastPeriodDate={userPreference.lastPeriodDate}
            onPhaseHover={handleHoverChange}
            onPhaseClick={handlePhaseClick}
            onDayClick={handleDayClick}
          />
        </Card>

        {/* The "Insight Center" (Always occupies 4 columns, no shifting) */}
        {/* Switches to Journal Quick Look when a date is selected */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {selectedDateObj && selectedDatePhase ? (
            <JournalQuickLook
              date={selectedDateObj}
              phase={selectedDatePhase}
              snippet={journalSnippet}
              onClose={handleCloseQuickLook}
            />
          ) : (
            <InsightCenter
              activePhase={activePhase}
              currentPhase={phaseData.currentPhase}
              isHovering={isHovering}
            />
          )}

          {/* Secondary Metric Box - Next Period - Thematic Gradient */}
          {phaseData.nextPeriodDate && (
            <Card className={`p-6 text-white shadow-lg ${theme.gradient.classes}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-white/90 text-sm font-medium">Next Period</p>
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
                <Calendar className="h-8 w-8 text-white/70 opacity-50" />
              </div>
              <p className="text-xs text-white/90 mt-4 font-medium uppercase tracking-tighter">
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

      {/* Desktop Deep Dive - Full Width Section */}
      {showDeepDive && !isMobile && deepDivePhase && (
        <div className="mt-8">
          <PhaseDeepDive
            phase={deepDivePhase}
            currentPhase={phaseData.currentPhase}
            focusPreference={userPreference.focusPreference}
            onClose={handleResetView}
          />
        </div>
      )}

      {/* Mobile Drawer */}
      {isMobile && (
        <PhaseDrawer
          isOpen={showDeepDive && !!deepDivePhase}
          phase={deepDivePhase}
          currentPhase={phaseData.currentPhase}
          focusPreference={userPreference.focusPreference}
          onClose={handleResetView}
        />
      )}
    </div>
  );
}
