'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireSessionUserId } from '@/lib/session';
import { parseIngredientAlternatives, normalizePatternKey } from '@/lib/ingredient-alternatives';

const SetPreferenceSchema = z.object({
  pattern: z.string().min(1),
  preferred: z.string().min(1),
});

const ResolveIngredientSchema = z.object({
  userId: z.string().min(1),
  ingredientName: z.string().min(1),
  alternatives: z.array(z.string()),
});

const PatternSchema = z.string().min(1);

/**
 * Get user's ingredient preferences
 */
export async function getUserIngredientPreferences() {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return { success: false, error: authResult.error, data: null };
    }

    const preferences = await prisma.userIngredientPreference.findMany({
      where: { userId: authResult.userId },
      select: {
        pattern: true,
        preferred: true,
      },
    });

    const preferenceMap = new Map<string, string>();
    for (const pref of preferences) {
      preferenceMap.set(pref.pattern, pref.preferred);
    }

    return { success: true, data: preferenceMap, error: null };
  } catch (error) {
    console.error('Error fetching ingredient preferences:', error);
    return { success: false, error: 'Failed to fetch preferences', data: null };
  }
}

/**
 * Set user's preference for an ingredient alternative
 */
export async function setIngredientPreference(
  pattern: string,
  preferred: string
) {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return { success: false, error: authResult.error };
    }

    const validated = SetPreferenceSchema.parse({ pattern, preferred });

    await prisma.userIngredientPreference.upsert({
      where: {
        userId_pattern: {
          userId: authResult.userId,
          pattern: validated.pattern,
        },
      },
      create: {
        userId: authResult.userId,
        pattern: validated.pattern,
        preferred: validated.preferred,
      },
      update: {
        preferred: validated.preferred,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error setting ingredient preference:', error);
    return { success: false, error: 'Failed to set preference' };
  }
}

/**
 * Resolve which ingredient to use from alternatives based on user preference
 */
export async function resolveIngredientChoice(
  userId: string,
  ingredientName: string,
  alternatives: string[]
): Promise<string> {
  try {
    const validated = ResolveIngredientSchema.parse({
      userId,
      ingredientName,
      alternatives,
    });

    if (validated.alternatives.length === 0) {
      return validated.ingredientName;
    }

    const patternKey = normalizePatternKey(
      validated.ingredientName,
      validated.alternatives
    );

    const preference = await prisma.userIngredientPreference.findUnique({
      where: {
        userId_pattern: {
          userId: validated.userId,
          pattern: patternKey,
        },
      },
    });

    if (preference) {
      const allOptions = [validated.ingredientName, ...validated.alternatives];
      if (allOptions.includes(preference.preferred)) {
        return preference.preferred;
      }
    }

    return validated.ingredientName;
  } catch (error) {
    console.error('Error resolving ingredient choice:', error);
    return ingredientName;
  }
}

/**
 * Get all available alternatives for an ingredient pattern
 */
export async function getIngredientAlternatives(pattern: string) {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return { success: false, error: authResult.error, data: null };
    }

    const validatedPattern = PatternSchema.parse(pattern);

    const ingredients = await prisma.ingredient.findMany({
      where: {
        OR: [
          { name: { contains: validatedPattern, mode: 'insensitive' } },
          {
            alternatives: {
              some: {
                name: { contains: validatedPattern, mode: 'insensitive' },
              },
            },
          },
        ],
      },
      include: {
        alternatives: {
          orderBy: { order: 'asc' },
        },
      },
      take: 10,
    });

    const allAlternatives = new Set<string>();
    for (const ing of ingredients) {
      const parsed = parseIngredientAlternatives(ing.name);
      if (parsed.alternatives.length > 0) {
        allAlternatives.add(parsed.name);
        parsed.alternatives.forEach((alt) => allAlternatives.add(alt));
      }
      ing.alternatives.forEach((alt) => allAlternatives.add(alt.name));
    }

    return {
      success: true,
      data: Array.from(allAlternatives),
      error: null,
    };
  } catch (error) {
    console.error('Error fetching ingredient alternatives:', error);
    return { success: false, error: 'Failed to fetch alternatives', data: null };
  }
}
