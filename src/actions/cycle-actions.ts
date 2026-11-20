'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getServerSession, requireSessionUserId } from '@/lib/session';
import { calculateCyclePhase } from '@/lib/cycle-calculator';
import { loadCycleDashboardInsights, todayDateKey } from '@/lib/daily-metrics';
import { recordPeriodStart, removePeriodStart } from '@/lib/period-starts';
import { safeErrorLabel } from '@/lib/safe-error';
import { PeriodStartInputSchema } from '@/lib/validation/vitals-schemas';
import {
  phaseRecommendationWithExpertInclude,
  type FocusPreference,
} from '@/types/cycle';

const FocusPreferenceSchema = z.enum(['hormonal', 'workout', 'both']);
const PhaseSchema = z.enum(['menstrual', 'follicular', 'ovulation', 'luteal']);
const ExpertIdSchema = z.string().min(1);
const UpdateFocusPreferenceSchema = z.object({
  focusPreference: FocusPreferenceSchema,
});
const GetPhaseRecommendationsSchema = z.object({
  phase: PhaseSchema,
  focusPreference: FocusPreferenceSchema,
});

const cycleUserSelect = {
  enableCycleTracking: true,
  cycleLength: true,
  lastPeriodDate: true,
  focusPreference: true,
  temperatureUnit: true,
  trackVitals: true,
} as const;

function categoryFilterForFocus(focusPreference: string | null | undefined): string[] {
  if (focusPreference === 'workout') {
    return ['exercise'];
  }
  if (focusPreference === 'hormonal') {
    return ['nutrition', 'fasting'];
  }
  return ['nutrition', 'fasting', 'exercise'];
}

function parseFocusPreference(value: string | null | undefined): FocusPreference {
  const parsed = FocusPreferenceSchema.safeParse(value);
  return parsed.success ? parsed.data : 'both';
}

/**
 * Server Action: Get Cycle Dashboard Data
 */
export async function getCycleDashboard() {
  try {
    const session = await getServerSession();
    const userId = session?.user.id;
    if (!userId) {
      return { success: false, error: 'Unauthorized', status: 'not_configured' as const };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: cycleUserSelect,
    });

    if (!user) {
      return { success: false, error: 'User not found', status: 'not_configured' as const };
    }

    if (!user.enableCycleTracking || !user.lastPeriodDate) {
      return {
        success: true,
        status: 'not_configured' as const,
        error: null,
      };
    }

    const cycleLength = user.cycleLength ?? 28;
    const phaseData = calculateCyclePhase(user.lastPeriodDate, cycleLength);
    const categoryFilter = categoryFilterForFocus(user.focusPreference);

    const [recommendations, insights] = await Promise.all([
      prisma.phaseRecommendation.findMany({
        where: {
          phase: phaseData.currentPhase,
          category: {
            in: categoryFilter,
          },
        },
        include: phaseRecommendationWithExpertInclude,
        orderBy: {
          createdAt: 'asc',
        },
      }),
      // BBT series and thermal shift of the current cycle, plus the recovery series
      // (only with the vitals opt-in) for the clinical chart and the quick-log card.
      loadCycleDashboardInsights(userId, {
        today: todayDateKey(),
        cycleLength,
        daysIntoCycle: phaseData.daysIntoCycle,
        lastPeriodDate: user.lastPeriodDate,
        temperatureUnit: user.temperatureUnit,
        trackVitals: user.trackVitals,
      }),
    ]);

    return {
      success: true,
      status: 'active' as const,
      phaseData,
      recommendations,
      userPreference: {
        focusPreference: parseFocusPreference(user.focusPreference),
        cycleLength,
      },
      insights,
      error: null,
    };
  } catch (error) {
    console.error('Error fetching cycle dashboard:', error);
    return {
      success: false,
      error: 'Failed to fetch cycle dashboard',
      status: 'error' as const,
    };
  }
}

/**
 * Server Action: Get All Experts
 */
export async function getAllExperts() {
  try {
    const session = await getServerSession();
    if (!session?.user.id) {
      return { success: false, error: 'Unauthorized', data: null };
    }

    const experts = await prisma.expert.findMany({
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
 */
export async function getExpertWithRecommendations(expertId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user.id) {
      return { success: false, error: 'Unauthorized', data: null };
    }

    const validatedId = ExpertIdSchema.parse(expertId);

    const expert = await prisma.expert.findUnique({
      where: { id: validatedId },
    });

    if (!expert) {
      return { success: false, error: 'Expert not found', data: null };
    }

    const recommendations = await prisma.phaseRecommendation.findMany({
      where: { expertId: validatedId },
      orderBy: [{ phase: 'asc' }, { category: 'asc' }],
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
 */
export async function getRecommendationsByExpert(expertId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user.id) {
      return { success: false, error: 'Unauthorized', data: null };
    }

    const validatedId = ExpertIdSchema.parse(expertId);

    const recommendations = await prisma.phaseRecommendation.findMany({
      where: { expertId: validatedId },
      include: phaseRecommendationWithExpertInclude,
      orderBy: [{ phase: 'asc' }, { category: 'asc' }],
    });

    return { success: true, data: recommendations, error: null };
  } catch (error) {
    console.error('Error fetching recommendations by expert:', error);
    return { success: false, error: 'Failed to fetch recommendations', data: null };
  }
}

/**
 * Server Action: Get Recommendations by Phase
 */
export async function getRecommendationsByPhase(phase: string) {
  try {
    const session = await getServerSession();
    const userId = session?.user.id;
    if (!userId) {
      return { success: false, error: 'Unauthorized', data: null };
    }

    const validatedPhase = PhaseSchema.parse(phase);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { focusPreference: true },
    });

    if (!user) {
      return { success: false, error: 'User not found', data: null };
    }

    const categoryFilter = categoryFilterForFocus(user.focusPreference);

    const recommendations = await prisma.phaseRecommendation.findMany({
      where: {
        phase: validatedPhase,
        category: {
          in: categoryFilter,
        },
      },
      include: phaseRecommendationWithExpertInclude,
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
 */
export async function getPhaseRecommendations(
  phase: string,
  focusPreference: FocusPreference
) {
  try {
    const session = await getServerSession();
    if (!session?.user.id) {
      return { success: false, error: 'Unauthorized', recommendations: null };
    }

    const validated = GetPhaseRecommendationsSchema.parse({ phase, focusPreference });
    const categoryFilter = categoryFilterForFocus(validated.focusPreference);

    const recommendations = await prisma.phaseRecommendation.findMany({
      where: {
        phase: validated.phase,
        category: {
          in: categoryFilter,
        },
      },
      include: phaseRecommendationWithExpertInclude,
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
 */
export async function updateFocusPreference(focusPreference: FocusPreference) {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return { success: false, error: authResult.error };
    }

    const validated = UpdateFocusPreferenceSchema.parse({ focusPreference });

    await prisma.user.update({
      where: { id: authResult.userId },
      data: {
        focusPreference: validated.focusPreference,
      },
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('Error updating focus preference:', error);
    return { success: false, error: 'Failed to update focus preference' };
  }
}

/**
 * Server Action: "My period started" on a day (today by default in the UI).
 * Adds the day to the period history and moves lastPeriodDate forward if it is newer.
 */
export async function logPeriodStart(date: string) {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return { success: false, error: authResult.error };
    }
    const parsed = PeriodStartInputSchema.safeParse({ date });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid date',
      };
    }
    const data = await recordPeriodStart(authResult.userId, parsed.data.date);
    revalidatePath('/cycle');
    revalidatePath('/profile');
    revalidatePath('/dashboard');
    return { success: true, data, error: null };
  } catch (error) {
    console.error('Error logging period start:', safeErrorLabel(error));
    return { success: false, error: 'Failed to log your period start' };
  }
}

/**
 * Server Action: Remove a mistaken period start. If it was the latest one, the previous
 * logged start becomes the current one.
 */
export async function deletePeriodStart(date: string) {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return { success: false, error: authResult.error };
    }
    const parsed = PeriodStartInputSchema.safeParse({ date });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid date',
      };
    }
    const data = await removePeriodStart(authResult.userId, parsed.data.date);
    if (!data.removed) {
      return { success: false, error: 'That period start was not found' };
    }
    revalidatePath('/cycle');
    revalidatePath('/profile');
    revalidatePath('/dashboard');
    return { success: true, data, error: null };
  } catch (error) {
    console.error('Error deleting period start:', safeErrorLabel(error));
    return { success: false, error: 'Failed to remove that period start' };
  }
}
