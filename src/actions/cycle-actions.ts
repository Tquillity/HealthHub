'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { calculateCyclePhase } from '@/lib/cycle-calculator';

/**
 * Server Action: Get Cycle Dashboard Data
 * 
 * Aggregates cycle tracking data for the authenticated user's dashboard.
 * 
 * Flow:
 * 1. Authenticates user session
 * 2. Fetches user's cycle tracking preferences (enableCycleTracking, cycleLength, lastPeriodDate, focusPreference)
 * 3. If not configured, returns 'not_configured' status
 * 4. Calculates current menstrual cycle phase using cycle-calculator utility
 * 5. Filters recommendations by:
 *    - Current phase (menstrual/follicular/ovulation/luteal)
 *    - User's focus preference:
 *      * 'workout' → only exercise recommendations
 *      * 'hormonal' → nutrition and fasting recommendations
 *      * 'both' → all categories (nutrition, fasting, exercise)
 * 6. Returns phase data, filtered recommendations, and user preferences
 * 
 * @returns Dashboard data with status: 'active' | 'not_configured' | 'error'
 */
export async function getCycleDashboard() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized', status: 'not_configured' };
    }

    // Fetch user profile with cycle tracking fields
    // Note: Using type assertion for cycle tracking fields until TypeScript server picks up regenerated Prisma types
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    }) as any;

    if (!user) {
      return { success: false, error: 'User not found', status: 'not_configured' };
    }

    // Check if cycle tracking is enabled and lastPeriodDate exists
    if (!user.enableCycleTracking || !user.lastPeriodDate) {
      return { 
        success: true, 
        status: 'not_configured',
        error: null,
      };
    }

    // Calculate current phase
    const cycleLength = user.cycleLength ?? 28;
    const phaseData = calculateCyclePhase(user.lastPeriodDate, cycleLength);

    // Build category filter based on focus preference
    const categoryFilter: string[] = [];
    if (user.focusPreference === 'workout') {
      categoryFilter.push('exercise');
    } else if (user.focusPreference === 'hormonal') {
      categoryFilter.push('nutrition', 'fasting');
    } else {
      // 'both' - fetch all categories
      categoryFilter.push('nutrition', 'fasting', 'exercise');
    }

    // Fetch recommendations for current phase
    // Note: Using type assertion until TypeScript server picks up regenerated Prisma types
    const recommendations = await (prisma as any).phaseRecommendation.findMany({
      where: {
        phase: phaseData.currentPhase,
        category: {
          in: categoryFilter,
        },
      },
      include: {
        expert: {
          select: {
            id: true,
            name: true,
            credentials: true,
            website: true,
            focusAreas: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return {
      success: true,
      status: 'active',
      phaseData,
      recommendations,
      userPreference: {
        focusPreference: user.focusPreference ?? 'both',
        cycleLength,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error fetching cycle dashboard:', error);
    return { 
      success: false, 
      error: 'Failed to fetch cycle dashboard', 
      status: 'error' 
    };
  }
}

