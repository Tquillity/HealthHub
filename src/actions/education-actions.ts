'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

interface GetEducationalResourcesParams {
  query?: string;
  category?: string;
  featured?: boolean;
  difficulty?: string;
}

export async function getEducationalResources({
  query,
  category,
  featured,
  difficulty,
}: GetEducationalResourcesParams = {}) {
  try {
    const where: {
      OR?: Array<
        | { title: { contains: string; mode: 'insensitive' } }
        | { content: { contains: string; mode: 'insensitive' } }
        | { excerpt: { contains: string; mode: 'insensitive' } }
        | { tags: { hasSome: string[] } }
      >;
      category?: string;
      featured?: boolean;
      difficulty?: string;
    } = {};

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
    const resource = await prisma.educationalResource.findUnique({
      where: { id },
    });

    if (!resource) {
      return { success: false, error: 'Resource not found', data: null };
    }

    // Increment view count
    await prisma.educationalResource.update({
      where: { id },
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

    const resource = await prisma.educationalResource.findUnique({
      where: { id },
    });

    if (!resource) {
      return { success: false, error: 'Resource not found' };
    }

    // Increment likes (simple implementation - in production you'd track per-user likes)
    const updated = await prisma.educationalResource.update({
      where: { id },
      data: { likes: { increment: 1 } },
    });

    revalidatePath('/learn');
    revalidatePath(`/learn/${id}`);
    return { success: true, data: updated };
  } catch (error) {
    console.error('Error toggling like:', error);
    return { success: false, error: 'Failed to toggle like' };
  }
}
