'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { parseIngredientAlternatives, normalizePatternKey } from '@/lib/ingredient-alternatives';

/**
 * Get user's ingredient preferences
 */
export async function getUserIngredientPreferences() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized', data: null };
    }

    const preferences = await prisma.userIngredientPreference.findMany({
      where: { userId: session.user.id },
      select: {
        pattern: true,
        preferred: true,
      },
    });

    // Convert to a map for easy lookup
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
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    // Upsert the preference
    await prisma.userIngredientPreference.upsert({
      where: {
        userId_pattern: {
          userId: session.user.id,
          pattern: pattern,
        },
      },
      create: {
        userId: session.user.id,
        pattern: pattern,
        preferred: preferred,
      },
      update: {
        preferred: preferred,
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
 * Returns the preferred choice or the default (first option)
 * 
 * This is a helper function that can be called from within server actions
 * It requires the userId to be passed in (not a server action itself)
 */
export async function resolveIngredientChoice(
  userId: string,
  ingredientName: string,
  alternatives: string[]
): Promise<string> {
  try {
    if (!userId || alternatives.length === 0) {
      // No alternatives or no userId, return default (first option)
      return ingredientName;
    }

    // Generate pattern key for lookup
    const patternKey = normalizePatternKey(ingredientName, alternatives);

    // Check user preference
    const preference = await prisma.userIngredientPreference.findUnique({
      where: {
        userId_pattern: {
          userId: userId,
          pattern: patternKey,
        },
      },
    });

    if (preference) {
      // Validate that the preferred option is in the alternatives list
      const allOptions = [ingredientName, ...alternatives];
      if (allOptions.includes(preference.preferred)) {
        return preference.preferred;
      }
    }

    // No preference or invalid preference, return default (first option)
    return ingredientName;
  } catch (error) {
    console.error('Error resolving ingredient choice:', error);
    // On error, return default
    return ingredientName;
  }
}

/**
 * Get all available alternatives for an ingredient pattern
 * Used for displaying options in UI
 */
export async function getIngredientAlternatives(pattern: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized', data: null };
    }

    // Find all ingredients with this pattern
    // This is a simplified version - in practice, you might want to cache this
    const ingredients = await prisma.ingredient.findMany({
      where: {
        OR: [
          { name: { contains: pattern, mode: 'insensitive' } },
          {
            alternatives: {
              some: {
                name: { contains: pattern, mode: 'insensitive' },
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
      take: 10, // Limit results
    });

    // Extract unique alternatives
    const allAlternatives = new Set<string>();
    for (const ing of ingredients) {
      const parsed = parseIngredientAlternatives(ing.name);
      if (parsed.alternatives.length > 0) {
        allAlternatives.add(parsed.name);
        parsed.alternatives.forEach(alt => allAlternatives.add(alt));
      }
      // Also check stored alternatives
      ing.alternatives.forEach(alt => allAlternatives.add(alt.name));
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

