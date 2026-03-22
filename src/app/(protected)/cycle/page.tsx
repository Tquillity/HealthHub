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
import { prisma } from '@/lib/db';
import { getCycleDashboard } from '@/actions/cycle-actions';
import { CyclePageClient } from '@/components/cycle/cycle-page-client';
import { CycleDisclaimer } from '@/components/cycle/cycle-disclaimer';
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
            <p className="text-gray-500">
              Track your menstrual cycle and get personalized recommendations
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 text-center">
            <Moon className="h-16 w-16 mx-auto text-gray-400" />
            <h2 className="text-2xl font-semibold text-gray-900">
              Setup Your Cycle Tracking
            </h2>
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
  if (
    dashboardResult.status !== 'active' ||
    !dashboardResult.phaseData ||
    !dashboardResult.userPreference
  ) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-yellow-800">
          <p className="font-medium">Unable to load cycle data</p>
          <p className="text-sm mt-1">
            Please try refreshing the page or check your cycle settings.
          </p>
        </div>
      </div>
    );
  }

  const { phaseData, recommendations, userPreference } = dashboardResult;

  // Get lastPeriodDate from user data for date calculations
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { lastPeriodDate: true },
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Main Cycle Tracker Client Component with Bento Grid Layout */}
      <CyclePageClient
        phaseData={phaseData}
        recommendations={recommendations}
        userPreference={{
          ...userPreference,
          lastPeriodDate: user?.lastPeriodDate || new Date(),
        }}
      />

      {/* Quick Actions Footer */}
      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm max-w-7xl mx-auto w-full">
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

      {/* Cycle Disclaimer */}
      <CycleDisclaimer />
    </div>
  );
}
