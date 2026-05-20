'use server';

import { prisma } from '@/lib/db';
import { requireSessionUserId } from '@/lib/session';
import { addDays } from 'date-fns';

export async function getWeeklyPlan(date?: Date) {
  const authResult = await requireSessionUserId();
  if (!authResult.ok) throw new Error('Unauthorized');

  // Get user preferences (with fallback for fields that might not exist yet)
  const user = await prisma.user.findUnique({
    where: { id: authResult.userId },
    select: {
      mealPlanDuration: true,
      mealPlanStartDate: true,
    },
  });

  const mealPlanDuration = user?.mealPlanDuration ?? null;
  const mealPlanStartDate = user?.mealPlanStartDate ?? null;

  const membership = await prisma.member.findFirst({
    where: { userId: authResult.userId },
    select: { organizationId: true },
  });

  if (!membership) throw new Error('No household found');

  // Determine start date: use provided date, or user preference, or today
  let startDate: Date;
  if (date) {
    startDate = date;
  } else if (mealPlanStartDate) {
    startDate = new Date(mealPlanStartDate);
  } else {
    startDate = new Date();
    // If using default (today), start from today, not start of week
    startDate.setHours(0, 0, 0, 0);
  }

  // Determine duration: use user preference or default to 1 week
  const duration = mealPlanDuration || '1week';
  
  // Calculate end date based on duration
  let endDate: Date;
  let daysToShow: number;
  
  switch (duration) {
    case '2weeks':
      daysToShow = 14;
      endDate = addDays(startDate, 13);
      break;
    case '1month':
      daysToShow = 30;
      endDate = addDays(startDate, 29);
      break;
    case '1week':
    default:
      daysToShow = 7;
      endDate = addDays(startDate, 6);
      break;
  }

  // If using default (today) and not a custom start date, adjust to show from today forward
  const useDefaultStart = !mealPlanStartDate && !date;
  if (useDefaultStart) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Only adjust if startDate is in the past
    if (startDate < today) {
      startDate = today;
      endDate = addDays(startDate, daysToShow - 1);
    }
  }

  // Find or create meal plan
  let plan = await prisma.mealPlan.findFirst({
    where: {
      organizationId: membership.organizationId,
      startDate: startDate,
    },
    include: {
      items: {
        include: { recipe: true },
      },
    },
  });

  if (!plan) {
    plan = await prisma.mealPlan.create({
      data: {
        organizationId: membership.organizationId,
        startDate: startDate,
        endDate: endDate,
      },
      include: {
        items: { include: { recipe: true } },
      },
    });
  }

  return { 
    plan, 
    recipes: await getAvailableRecipes(membership.organizationId),
    duration,
    startDate,
    endDate,
    useDefaultStart,
  };
}

export async function getMealPlanTemplates() {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return { success: false, error: authResult.error };
    }

    const membership = await prisma.member.findFirst({
      where: { userId: authResult.userId },
      select: { organizationId: true },
    });

    if (!membership) {
      return { success: false, error: 'No household found' };
    }

    const templates = await prisma.mealPlanTemplate.findMany({
      where: {
        organizationId: membership.organizationId,
      },
      include: {
        items: {
          include: {
            recipe: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                category: true,
              },
            },
          },
          orderBy: [
            { dayOffset: 'asc' },
            { mealType: 'asc' },
          ],
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return { success: true, data: templates };
  } catch (error) {
    console.error('Error fetching templates:', error);
    return {
      success: false,
      error: 'Failed to fetch templates',
    };
  }
}

/**
 * Delete a meal plan template
 * 
 * Permanently removes a meal plan template from the database. Performs security checks
 * to ensure the template belongs to the user's organization before deletion.
 * This is a destructive operation that cannot be undone.
 * 
 * @param templateId - The ID of the template to delete
 * @returns Success status with error message if operation fails
 */
async function getAvailableRecipes(orgId: string) {
  return await prisma.recipe.findMany({
    where: {
      OR: [{ isSystem: true }, { organizationId: orgId }],
    },
    select: { id: true, name: true, category: true, imageUrl: true },
  });
}

