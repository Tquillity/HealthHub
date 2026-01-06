/**
 * Cycle Tracker Dashboard Page
 * 
 * Server Component that displays the user's menstrual cycle tracking dashboard.
 * 
 * Features:
 * - Cycle phase visualization using Recharts
 * - Phase-specific expert recommendations
 * - Current day and phase indicators
 * - Setup flow for users who haven't configured cycle tracking
 * 
 * States:
 * 1. Not Configured: Shows setup prompt linking to profile settings
 * 2. Active: Displays cycle chart, current phase, and filtered recommendations
 * 3. Error: Displays error message if data fetch fails
 * 
 * Data Flow:
 * - Calls getCycleDashboard() server action
 * - Filters recommendations by current phase and user's focus preference
 * - Renders CycleChart with calculated phase data
 * - Displays RecommendationCard components in a responsive grid
 */

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getCycleDashboard } from '@/actions/cycle-actions';
import { CycleChart } from '@/components/cycle/cycle-chart';
import { RecommendationCard } from '@/components/cycle/recommendation-card';
import { Button } from '@/components/ui/button';
import { Moon, Settings } from 'lucide-react';
import Link from 'next/link';

export default async function CyclePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/sign-in');
  }

  const dashboardResult = await getCycleDashboard();

  if (!dashboardResult.success) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
          <p className="font-medium">Error loading cycle dashboard</p>
          <p className="text-sm mt-1">{dashboardResult.error}</p>
        </div>
      </div>
    );
  }

  // Not configured state
  if (dashboardResult.status === 'not_configured') {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600">
            <Moon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Cycle Tracker</h1>
            <p className="text-gray-500">Track your menstrual cycle and get personalized recommendations</p>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 text-center">
            <Moon className="h-16 w-16 mx-auto text-gray-400" />
            <h2 className="text-2xl font-semibold text-gray-900">Setup Your Cycle Tracking</h2>
            <p className="text-gray-600 max-w-md mx-auto">
              To get started with cycle tracking and personalized recommendations, 
              please configure your cycle information in your profile settings.
            </p>
            <div className="mt-4">
              <Link href="/profile">
                <Button className="gap-2">
                  <Settings className="h-4 w-4" />
                  Go to Profile Settings
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active state - TypeScript guard: ensure required data exists
  if (dashboardResult.status !== 'active' || !dashboardResult.phaseData || !dashboardResult.userPreference) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-yellow-800">
          <p className="font-medium">Unable to load cycle data</p>
          <p className="text-sm mt-1">Please try refreshing the page or check your cycle settings.</p>
        </div>
      </div>
    );
  }

  const { phaseData, recommendations, userPreference } = dashboardResult;

  const phaseNames: Record<string, string> = {
    menstrual: 'Menstrual',
    follicular: 'Follicular',
    ovulation: 'Ovulation',
    luteal: 'Luteal',
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600">
          <Moon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cycle Tracker</h1>
          <p className="text-gray-500">
            Day {phaseData.daysIntoCycle} - {phaseNames[phaseData.currentPhase]} Phase
          </p>
        </div>
      </div>

      {/* Cycle Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <CycleChart phaseData={phaseData} cycleLength={userPreference.cycleLength} />
      </div>

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Expert Recommendations for {phaseNames[phaseData.currentPhase]} Phase
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
            Check back later or adjust your focus preference in profile settings.
          </p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <Link href="/profile">
            <Button variant="outline" size="sm" className="gap-2">
              <Settings className="h-3 w-3" />
              Update Cycle Settings
            </Button>
          </Link>
          <Link href="/journal">
            <Button variant="outline" size="sm" className="gap-2">
              Log Today's Entry
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

