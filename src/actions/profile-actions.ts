'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

const UpdateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  energyLevel: z.enum(['low', 'medium', 'high']).optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  healthGoals: z.array(z.string()).optional(),
  timezone: z.string().optional(),
});

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
      },
    });

    revalidatePath('/profile');
    return { success: true, data: updatedUser };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || 'Validation failed' };
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
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        energyLevel: true,
        dietaryRestrictions: true,
        healthGoals: true,
        timezone: true,
      },
    });

    return { success: true, error: null, data: user };
  } catch (error) {
    console.error('Error fetching profile:', error);
    return { success: false, error: 'Failed to fetch profile', data: null };
  }
}

