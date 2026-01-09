'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

// Zod schemas
const CreateRoutineSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  frequency: z.string().optional(),
  energyLevel: z.enum(['low', 'medium', 'high']).default('medium'),
  estimatedTime: z.number().int().positive().default(15),
  // Rich metadata
  imageUrl: z.string().url().optional().or(z.literal('')),
  context: z.enum(['morning', 'evening', 'anytime']).optional(),
  duration: z.enum(['5min', '15min', '30min', '60min']).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  equipment: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  steps: z.array(
    z.object({
      step: z.number().int().positive(),
      title: z.string().optional(),
      description: z.string().min(1),
      duration: z.number().int().positive().optional(),
      imageUrl: z.string().url().optional().or(z.literal('')),
    })
  ).optional(),
  tips: z.array(z.string()).default([]),
  contraindications: z.array(z.string()).default([]),
});

const UpdateRoutineSchema = CreateRoutineSchema.partial().extend({
  id: z.string().min(1),
});

export async function createRoutine(data: z.input<typeof CreateRoutineSchema>) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get user's organization
    const membership = await prisma.member.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return { success: false, error: 'No household found' };
    }

    // Validate input
    const validated = CreateRoutineSchema.parse(data);

    // Create routine
    const routine = await prisma.routine.create({
      data: {
        name: validated.name,
        description: validated.description || null,
        category: validated.category || null,
        frequency: validated.frequency || null,
        energyLevel: validated.energyLevel,
        estimatedTime: validated.estimatedTime,
        imageUrl: validated.imageUrl || null,
        context: validated.context || null,
        duration: validated.duration || null,
        difficulty: validated.difficulty || null,
        equipment: validated.equipment,
        tags: validated.tags,
        // Prisma `Json?` fields expect `undefined` (omit) instead of `null` for "no value".
        // Store steps as JSON (array/object) rather than a stringified blob.
        steps: validated.steps ?? undefined,
        tips: validated.tips,
        contraindications: validated.contraindications,
        organizationId: membership.organizationId,
      },
    });

    revalidatePath('/routines');
    return { success: true, data: routine };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Zod v4 uses `issues` (Zod v3 used `errors`)
      return { success: false, error: error.issues?.[0]?.message || 'Validation failed' };
    }
    console.error('Error creating routine:', error);
    return { success: false, error: 'Failed to create routine' };
  }
}

export async function updateRoutine(data: z.input<typeof UpdateRoutineSchema>) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get user's organization
    const membership = await prisma.member.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return { success: false, error: 'No household found' };
    }

    // Validate input
    const validated = UpdateRoutineSchema.parse(data);
    const { id, ...updateData } = validated;

    // Check if routine exists and belongs to user's organization
    const existingRoutine = await prisma.routine.findFirst({
      where: {
        id,
        organizationId: membership.organizationId,
      },
    });

    if (!existingRoutine) {
      return { success: false, error: 'Routine not found or access denied' };
    }

    // Prepare update data
    const dataToUpdate: any = {};
    if (updateData.name !== undefined) dataToUpdate.name = updateData.name;
    if (updateData.description !== undefined) dataToUpdate.description = updateData.description || null;
    if (updateData.category !== undefined) dataToUpdate.category = updateData.category || null;
    if (updateData.frequency !== undefined) dataToUpdate.frequency = updateData.frequency || null;
    if (updateData.energyLevel !== undefined) dataToUpdate.energyLevel = updateData.energyLevel;
    if (updateData.estimatedTime !== undefined) dataToUpdate.estimatedTime = updateData.estimatedTime;
    if (updateData.imageUrl !== undefined) dataToUpdate.imageUrl = updateData.imageUrl || null;
    if (updateData.context !== undefined) dataToUpdate.context = updateData.context || null;
    if (updateData.duration !== undefined) dataToUpdate.duration = updateData.duration || null;
    if (updateData.difficulty !== undefined) dataToUpdate.difficulty = updateData.difficulty || null;
    if (updateData.equipment !== undefined) dataToUpdate.equipment = updateData.equipment;
    if (updateData.tags !== undefined) dataToUpdate.tags = updateData.tags;
    if (updateData.steps !== undefined) {
      // Prisma `Json?` fields expect `undefined` (omit) instead of `null` for "no value".
      // Store steps as JSON (array/object) rather than a stringified blob.
      dataToUpdate.steps = updateData.steps ?? undefined;
    }
    if (updateData.tips !== undefined) dataToUpdate.tips = updateData.tips;
    if (updateData.contraindications !== undefined) dataToUpdate.contraindications = updateData.contraindications;

    // Update routine
    const routine = await prisma.routine.update({
      where: { id },
      data: dataToUpdate,
    });

    revalidatePath('/routines');
    return { success: true, data: routine };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Zod v4 uses `issues` (Zod v3 used `errors`)
      return { success: false, error: error.issues?.[0]?.message || 'Validation failed' };
    }
    console.error('Error updating routine:', error);
    return { success: false, error: 'Failed to update routine' };
  }
}

export async function getRoutine(id: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized', data: null };
    }

    const routine = await prisma.routine.findUnique({
      where: { id },
    });

    if (!routine) {
      return { success: false, error: 'Routine not found', data: null };
    }

    return { success: true, data: routine };
  } catch (error) {
    console.error('Error fetching routine:', error);
    return { success: false, error: 'Failed to fetch routine', data: null };
  }
}

export async function deleteRoutine(id: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get user's organization
    const membership = await prisma.member.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return { success: false, error: 'No household found' };
    }

    // Verify routine belongs to user's organization
    const routine = await prisma.routine.findFirst({
      where: {
        id,
        organizationId: membership.organizationId,
      },
    });

    if (!routine) {
      return { success: false, error: 'Routine not found or access denied' };
    }

    // Delete routine
    await prisma.routine.delete({
      where: { id },
    });

    revalidatePath('/routines');
    return { success: true };
  } catch (error) {
    console.error('Error deleting routine:', error);
    return { success: false, error: 'Failed to delete routine' };
  }
}

export async function drawLottery(filters: {
  energy?: string;
  maxTime?: number;
  count?: number;
  context?: string;
  duration?: string;
  difficulty?: string;
}) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized', data: null };
    }

    // Get user's organization
    const membership = await prisma.member.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return { success: false, error: 'No household found', data: null };
    }

    // Build where clause
    const where: any = {
      OR: [
        { organizationId: membership.organizationId },
        { isSystem: true },
      ],
    };

    if (filters.energy) {
      where.energyLevel = filters.energy;
    }

    if (filters.maxTime) {
      where.estimatedTime = { lte: filters.maxTime };
    }

    if (filters.context) {
      where.context = filters.context;
    }

    if (filters.duration) {
      where.duration = filters.duration;
    }

    if (filters.difficulty) {
      where.difficulty = filters.difficulty;
    }

    // Fetch candidates matching criteria
    const candidates = await prisma.routine.findMany({
      where,
    });

    if (candidates.length === 0) {
      return { success: true, error: null, data: [] };
    }

    // Randomize selection
    const count = filters.count || 1;
    const selected: typeof candidates = [];
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
      selected.push(shuffled[i]);
    }

    return { success: true, error: null, data: selected };
  } catch (error) {
    console.error('Error drawing lottery:', error);
    return { success: false, error: 'Failed to draw lottery', data: null };
  }
}
