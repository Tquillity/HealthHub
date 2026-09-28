'use server';

import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireSessionUserId } from '@/lib/session';
import { revalidatePath } from 'next/cache';
import { buildLotteryWhere, drawRandom } from '@/lib/routine-lottery';
import {
  CreateRoutineSchema,
  LotteryFiltersSchema,
  RoutineIdSchema,
  UpdateRoutineSchema,
} from '@/lib/validation/routine-schemas';

export async function createRoutine(data: z.input<typeof CreateRoutineSchema>) {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return { success: false, error: authResult.error };
    }

    // Get user's organization
    const membership = await prisma.member.findFirst({
      where: { userId: authResult.userId },
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
      return {
        success: false,
        error: error.issues?.[0]?.message || 'Validation failed',
      };
    }
    console.error('Error creating routine:', error);
    return { success: false, error: 'Failed to create routine' };
  }
}

export async function updateRoutine(data: z.input<typeof UpdateRoutineSchema>) {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return { success: false, error: authResult.error };
    }

    // Get user's organization
    const membership = await prisma.member.findFirst({
      where: { userId: authResult.userId },
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
    const dataToUpdate: Prisma.RoutineUpdateInput = {};
    if (updateData.name !== undefined) dataToUpdate.name = updateData.name;
    if (updateData.description !== undefined)
      dataToUpdate.description = updateData.description || null;
    if (updateData.category !== undefined)
      dataToUpdate.category = updateData.category || null;
    if (updateData.frequency !== undefined)
      dataToUpdate.frequency = updateData.frequency || null;
    if (updateData.energyLevel !== undefined)
      dataToUpdate.energyLevel = updateData.energyLevel;
    if (updateData.estimatedTime !== undefined)
      dataToUpdate.estimatedTime = updateData.estimatedTime;
    if (updateData.imageUrl !== undefined)
      dataToUpdate.imageUrl = updateData.imageUrl || null;
    if (updateData.context !== undefined)
      dataToUpdate.context = updateData.context || null;
    if (updateData.duration !== undefined)
      dataToUpdate.duration = updateData.duration || null;
    if (updateData.difficulty !== undefined)
      dataToUpdate.difficulty = updateData.difficulty || null;
    if (updateData.equipment !== undefined)
      dataToUpdate.equipment = updateData.equipment;
    if (updateData.tags !== undefined) dataToUpdate.tags = updateData.tags;
    if (updateData.steps !== undefined) {
      // Prisma `Json?` fields expect `undefined` (omit) instead of `null` for "no value".
      // Store steps as JSON (array/object) rather than a stringified blob.
      dataToUpdate.steps = updateData.steps ?? undefined;
    }
    if (updateData.tips !== undefined) dataToUpdate.tips = updateData.tips;
    if (updateData.contraindications !== undefined)
      dataToUpdate.contraindications = updateData.contraindications;

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
      return {
        success: false,
        error: error.issues?.[0]?.message || 'Validation failed',
      };
    }
    console.error('Error updating routine:', error);
    return { success: false, error: 'Failed to update routine' };
  }
}

export async function getRoutine(id: string) {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return { success: false, error: authResult.error, data: null };
    }

    const parsedId = RoutineIdSchema.safeParse(id);
    if (!parsedId.success) {
      return { success: false, error: 'Routine not found', data: null };
    }

    const membership = await prisma.member.findFirst({
      where: { userId: authResult.userId },
      select: { organizationId: true },
    });

    // Only system routines and routines owned by the caller's household are readable
    const routine = await prisma.routine.findFirst({
      where: {
        id: parsedId.data,
        OR: [
          { isSystem: true },
          ...(membership
            ? [{ organizationId: membership.organizationId }]
            : []),
        ],
      },
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
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return { success: false, error: authResult.error };
    }

    const parsedId = RoutineIdSchema.safeParse(id);
    if (!parsedId.success) {
      return { success: false, error: 'Routine not found or access denied' };
    }

    // Get user's organization
    const membership = await prisma.member.findFirst({
      where: { userId: authResult.userId },
      select: { organizationId: true },
    });

    if (!membership) {
      return { success: false, error: 'No household found' };
    }

    // Verify routine belongs to user's organization
    const routine = await prisma.routine.findFirst({
      where: {
        id: parsedId.data,
        organizationId: membership.organizationId,
      },
    });

    if (!routine) {
      return { success: false, error: 'Routine not found or access denied' };
    }

    // Delete routine
    await prisma.routine.delete({
      where: { id: parsedId.data },
    });

    revalidatePath('/routines');
    return { success: true };
  } catch (error) {
    console.error('Error deleting routine:', error);
    return { success: false, error: 'Failed to delete routine' };
  }
}

// Loose input type on purpose: the client sends select values as strings and
// LotteryFiltersSchema is the single gate that whitelists them.
export async function drawLottery(filters: {
  energy?: string;
  maxTime?: number;
  count?: number;
  context?: string;
  duration?: string;
  difficulty?: string;
}) {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return { success: false, error: authResult.error, data: null };
    }

    const parsed = LotteryFiltersSchema.safeParse(filters);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Invalid filters',
        data: null,
      };
    }

    // Get user's organization
    const membership = await prisma.member.findFirst({
      where: { userId: authResult.userId },
      select: { organizationId: true },
    });

    if (!membership) {
      return { success: false, error: 'No household found', data: null };
    }

    // Fetch candidates matching the validated, whitelisted criteria
    const candidates = await prisma.routine.findMany({
      where: buildLotteryWhere(parsed.data, membership.organizationId),
    });

    if (candidates.length === 0) {
      return { success: true, error: null, data: [] };
    }

    const selected = drawRandom(candidates, parsed.data.count);
    return { success: true, error: null, data: selected };
  } catch (error) {
    console.error('Error drawing lottery:', error);
    return { success: false, error: 'Failed to draw lottery', data: null };
  }
}
