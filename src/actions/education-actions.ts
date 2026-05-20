'use server';

import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import {
  GetEducationalResourcesSchema,
  ResourceIdSchema,
} from '@/lib/validation/education-schemas';

export async function getEducationalResources(
  params: z.input<typeof GetEducationalResourcesSchema> = {}
) {
  try {
    const { query, category, featured, difficulty } =
      GetEducationalResourcesSchema.parse(params);

    const where: Prisma.EducationalResourceWhereInput = {};

    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } },
        { excerpt: { contains: query, mode: 'insensitive' } },
        { tags: { hasSome: [query] } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (featured !== undefined) {
      where.featured = featured;
    }

    if (difficulty) {
      where.difficulty = difficulty;
    }

    const resources = await prisma.educationalResource.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: resources };
  } catch (error) {
    console.error('Error fetching educational resources:', error);
    return { success: false, error: 'Failed to fetch resources', data: [] };
  }
}

export async function getResourceById(id: string) {
  try {
    const validatedId = ResourceIdSchema.parse(id);

    const resource = await prisma.educationalResource.findUnique({
      where: { id: validatedId },
    });

    if (!resource) {
      return { success: false, error: 'Resource not found', data: null };
    }

    await prisma.educationalResource.update({
      where: { id: validatedId },
      data: { viewCount: { increment: 1 } },
    });

    return { success: true, data: resource };
  } catch (error) {
    console.error('Error fetching resource:', error);
    return { success: false, error: 'Failed to fetch resource', data: null };
  }
}

export async function toggleResourceLike(id: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    const validatedId = ResourceIdSchema.parse(id);

    const resource = await prisma.educationalResource.findUnique({
      where: { id: validatedId },
    });

    if (!resource) {
      return { success: false, error: 'Resource not found' };
    }

    const updated = await prisma.educationalResource.update({
      where: { id: validatedId },
      data: { likes: { increment: 1 } },
    });

    revalidatePath('/learn');
    revalidatePath(`/learn/${validatedId}`);
    return { success: true, data: updated };
  } catch (error) {
    console.error('Error toggling like:', error);
    return { success: false, error: 'Failed to toggle like' };
  }
}
