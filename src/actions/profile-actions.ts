'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { UpdateProfileSchema } from '@/lib/validation/profile-schemas';

export async function updateProfile(data: z.infer<typeof UpdateProfileSchema>) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate input
    const validated = UpdateProfileSchema.parse(data);

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(validated.name && { name: validated.name }),
        ...(validated.energyLevel && { energyLevel: validated.energyLevel }),
        ...(validated.dietaryRestrictions !== undefined && {
          dietaryRestrictions: validated.dietaryRestrictions,
        }),
        ...(validated.healthGoals !== undefined && {
          healthGoals: validated.healthGoals,
        }),
        ...(validated.timezone && { timezone: validated.timezone }),
        ...(validated.mealPlanDuration && { mealPlanDuration: validated.mealPlanDuration }),
        ...(validated.mealPlanStartDate !== undefined && {
          mealPlanStartDate: validated.mealPlanStartDate,
        }),
        ...(validated.enableCycleTracking !== undefined && {
          enableCycleTracking: validated.enableCycleTracking,
        }),
        ...(validated.cycleLength !== undefined && {
          cycleLength: validated.cycleLength,
        }),
        ...(validated.lastPeriodDate !== undefined && {
          lastPeriodDate: validated.lastPeriodDate ? new Date(validated.lastPeriodDate) : null,
        }),
        ...(validated.focusPreference !== undefined && {
          focusPreference: validated.focusPreference,
        }),
      },
    });

    // Return a serializable DTO (do NOT return raw Prisma User with Date fields)
    const userData = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      image: updatedUser.image,
      energyLevel: updatedUser.energyLevel,
      dietaryRestrictions: updatedUser.dietaryRestrictions,
      healthGoals: updatedUser.healthGoals,
      timezone: updatedUser.timezone,
      mealPlanDuration: updatedUser.mealPlanDuration ?? null,
      mealPlanStartDate: updatedUser.mealPlanStartDate
        ? updatedUser.mealPlanStartDate.toISOString()
        : null,
      enableCycleTracking: updatedUser.enableCycleTracking,
      cycleLength: updatedUser.cycleLength,
      lastPeriodDate: updatedUser.lastPeriodDate ? updatedUser.lastPeriodDate.toISOString() : null,
      focusPreference: updatedUser.focusPreference || 'both',
    };

    revalidatePath('/profile');
    return { success: true, data: userData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Zod v4 uses `issues` (Zod v3 used `errors`)
      return { success: false, error: error.issues?.[0]?.message || 'Validation failed' };
    }
    console.error('Error updating profile:', error);
    return { success: false, error: 'Failed to update profile' };
  }
}

export async function getProfile() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized', data: null };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return { success: false, error: 'User not found', data: null };
    }

    // Return user data with type-safe access to new fields
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      energyLevel: user.energyLevel,
      dietaryRestrictions: user.dietaryRestrictions,
      healthGoals: user.healthGoals,
      timezone: user.timezone,
      mealPlanDuration: user.mealPlanDuration ?? null,
      mealPlanStartDate: user.mealPlanStartDate
        ? user.mealPlanStartDate.toISOString()
        : null,
      enableCycleTracking: user.enableCycleTracking,
      cycleLength: user.cycleLength,
      lastPeriodDate: user.lastPeriodDate ? user.lastPeriodDate.toISOString() : null,
      focusPreference: user.focusPreference || 'both',
    };

    return { success: true, error: null, data: userData };
  } catch (error) {
    console.error('Error fetching profile:', error);
    return { success: false, error: 'Failed to fetch profile', data: null };
  }
}

