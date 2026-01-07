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

/**
 * Server Action: Get All Experts
 * 
 * Fetches a list of all experts in the database.
 * 
 * @returns List of all experts with their basic information
 */
export async function getAllExperts() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized', data: null };
    }

    const experts = await (prisma as any).expert.findMany({
      orderBy: { name: 'asc' },
    });

    return { success: true, data: experts, error: null };
  } catch (error) {
    console.error('Error fetching experts:', error);
    return { success: false, error: 'Failed to fetch experts', data: null };
  }
}

/**
 * Server Action: Get Expert with Recommendations
 * 
 * Fetches a specific expert and all their recommendations.
 * 
 * @param expertId - The ID of the expert to fetch
 * @returns Expert details with all their recommendations
 */
export async function getExpertWithRecommendations(expertId: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized', data: null };
    }

    const expert = await (prisma as any).expert.findUnique({
      where: { id: expertId },
    });

    if (!expert) {
      return { success: false, error: 'Expert not found', data: null };
    }

    const recommendations = await (prisma as any).phaseRecommendation.findMany({
      where: { expertId },
      orderBy: [
        { phase: 'asc' },
        { category: 'asc' },
      ],
    });

    return {
      success: true,
      data: {
        expert,
        recommendations,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error fetching expert with recommendations:', error);
    return { success: false, error: 'Failed to fetch expert', data: null };
  }
}

/**
 * Server Action: Get Recommendations by Expert ID
 * 
 * Fetches all recommendations for a specific expert.
 * 
 * @param expertId - The ID of the expert
 * @returns List of all recommendations for the expert
 */
export async function getRecommendationsByExpert(expertId: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized', data: null };
    }

    const recommendations = await (prisma as any).phaseRecommendation.findMany({
      where: { expertId },
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
      orderBy: [
        { phase: 'asc' },
        { category: 'asc' },
      ],
    });

    return { success: true, data: recommendations, error: null };
  } catch (error) {
    console.error('Error fetching recommendations by expert:', error);
    return { success: false, error: 'Failed to fetch recommendations', data: null };
  }
}

/**
 * Server Action: Get Recommendations by Phase
 * 
 * Fetches all recommendations for a specific phase, filtered by user's focus preference.
 * 
 * @param phase - The cycle phase (menstrual, follicular, ovulation, luteal)
 * @returns List of recommendations for the phase
 */
export async function getRecommendationsByPhase(phase: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized', data: null };
    }

    // Get user's focus preference
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    }) as any;

    if (!user) {
      return { success: false, error: 'User not found', data: null };
    }

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

    const recommendations = await (prisma as any).phaseRecommendation.findMany({
      where: {
        phase,
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

    return { success: true, data: recommendations, error: null };
  } catch (error) {
    console.error('Error fetching recommendations by phase:', error);
    return { success: false, error: 'Failed to fetch recommendations', data: null };
  }
}

/**
 * Server Action: Get Phase Recommendations
 * 
 * Fetches recommendations for a specific phase, filtered by focus preference.
 * This is a convenience function that accepts focusPreference as a parameter
 * rather than fetching it from the user profile.
 * 
 * @param phase - The cycle phase (menstrual, follicular, ovulation, luteal)
 * @param focusPreference - The focus preference ('hormonal', 'workout', or 'both')
 * @returns List of recommendations for the phase
 */
export async function getPhaseRecommendations(phase: string, focusPreference: 'hormonal' | 'workout' | 'both') {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized', recommendations: null };
    }

    // Build category filter based on focus preference
    const categoryFilter: string[] = [];
    if (focusPreference === 'workout') {
      categoryFilter.push('exercise');
    } else if (focusPreference === 'hormonal') {
      categoryFilter.push('nutrition', 'fasting');
    } else {
      // 'both' - fetch all categories
      categoryFilter.push('nutrition', 'fasting', 'exercise');
    }

    const recommendations = await (prisma as any).phaseRecommendation.findMany({
      where: {
        phase,
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

    return { success: true, recommendations, error: null };
  } catch (error) {
    console.error('Error fetching phase recommendations:', error);
    return { success: false, error: 'Failed to fetch recommendations', recommendations: null };
  }
}

/**
 * Server Action: Update User Focus Preference
 * 
 * Updates only the focus preference without requiring a full profile update.
 * 
 * @param focusPreference - The new focus preference ('hormonal', 'workout', or 'both')
 * @returns Success status
 */
export async function updateFocusPreference(focusPreference: 'hormonal' | 'workout' | 'both') {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        focusPreference,
      } as any,
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('Error updating focus preference:', error);
    return { success: false, error: 'Failed to update focus preference' };
  }
}

