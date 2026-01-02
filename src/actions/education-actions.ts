'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';

const GetResourcesSchema = z.object({
  category: z.string().optional(),
  tag: z.string().optional(),
  featured: z.boolean().optional(),
  search: z.string().optional(),
});

export async function getResources(filter: z.infer<typeof GetResourcesSchema> = {}) {
  try {
    const validated = GetResourcesSchema.parse(filter);

    const where: any = {};

    if (validated.category) {
      where.category = validated.category;
    }

    if (validated.tag) {
      where.tags = { has: validated.tag };
    }

    if (validated.featured !== undefined) {
      where.featured = validated.featured;
    }

    if (validated.search) {
      where.OR = [
        { title: { contains: validated.search, mode: 'insensitive' } },
        { excerpt: { contains: validated.search, mode: 'insensitive' } },
        { content: { contains: validated.search, mode: 'insensitive' } },
      ];
    }

    const resources = await prisma.educationalResource.findMany({
      where,
      orderBy: [
        { featured: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return { success: true, error: null, data: resources };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || 'Validation failed', data: null };
    }
    console.error('Error fetching resources:', error);
    return { success: false, error: 'Failed to fetch resources', data: null };
  }
}

export async function getResource(id: string) {
  try {
    const resource = await prisma.educationalResource.findUnique({
      where: { id },
    });

    if (!resource) {
      return { success: false, error: 'Resource not found', data: null };
    }

    return { success: true, error: null, data: resource };
  } catch (error) {
    console.error('Error fetching resource:', error);
    return { success: false, error: 'Failed to fetch resource', data: null };
  }
}

