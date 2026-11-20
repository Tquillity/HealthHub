import { z } from 'zod';
import {
  activeTimeSchema,
  batchEfficiencySchema,
  leanRoleSchema,
  passiveTimeSchema,
  yieldAmountSchema,
  yieldUnitSchema,
} from '@/lib/lean-kitchen';
import { nutrientHighlightsSchema, phaseTagsSchema } from '@/lib/phase-nutrition';

/**
 * Runtime shape of `kitchen-manifest.json` (the system recipe catalog seeded by
 * `pnpm db:seed`), plus the pure helpers the seed uses to sync it into the database.
 *
 * LEAN Kitchen data lives in two optional blocks per recipe:
 *   "leanInfo": { "leanRole", "activeTime", "passiveTime", "batchEfficiency" }
 *   "yield":    { "amount", "unit" }
 * Times are minutes: activeTime is hands-on work, passiveTime is waiting (oven,
 * rising, soaking, chilling, simmering).
 *
 * Biological Fueling (issue #2) adds two optional lists per recipe, set where we are
 * confident about them:
 *   "phaseTags":          ["menstrual" | "follicular" | "ovulation" | "luteal", ...]
 *   "nutrientHighlights": ["iron", "magnesium", ...]  (src/lib/phase-nutrition.ts)
 * Only these explicit lists are stored. Anything left out is worked out from the
 * ingredient names when the recipe is read (resolveRecipeBioProfile), so Treat and
 * Process recipes keep "explicit phases only" and later ingredient edits are followed.
 */

const leanInfoSchema = z
  .object({
    leanRole: leanRoleSchema.optional(),
    activeTime: activeTimeSchema.optional(),
    passiveTime: passiveTimeSchema.optional(),
    batchEfficiency: batchEfficiencySchema.optional(),
  })
  .strict();

const yieldSchema = z
  .object({ amount: yieldAmountSchema, unit: yieldUnitSchema })
  .strict()
  .refine((value) => value.amount !== null && value.unit !== null, {
    message: 'yield needs both an amount and a unit',
  });

const manifestRecipeSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional(),
  prepTime: z.number().int().min(0).optional(),
  cookTime: z.number().int().min(0).optional(),
  servings: z.number().int().min(1).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  cuisine: z.string().optional(),
  dietaryTags: z.array(z.string()).optional(),
  videoUrl: z.string().optional(),
  // Kept for reference; the seed does not set images (uploads live outside the repo).
  imageUrl: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
  /** Only the MAIN admin can see secret recipes. */
  isSecret: z.boolean().optional(),
  leanInfo: leanInfoSchema.optional(),
  yield: yieldSchema.optional(),
  phaseTags: phaseTagsSchema.optional(),
  nutrientHighlights: nutrientHighlightsSchema.optional(),
  ingredients: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        quantity: z.number().positive(),
        unit: z.string().trim().min(1),
        notes: z.string().nullable().optional(),
        melted: z.boolean().optional(),
      })
    )
    .min(1),
  instructions: z
    .array(
      z.object({
        stepNumber: z.number().int().positive(),
        text: z.string().min(1),
      })
    )
    .min(1),
});

const manifestRoutineSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  frequency: z.string().min(1),
});

export const kitchenManifestSchema = z.object({
  recipes: z.array(manifestRecipeSchema).superRefine((recipes, ctx) => {
    // The seed matches system recipes by name, so names must be unique.
    const seen = new Set<string>();
    recipes.forEach((recipe, index) => {
      if (seen.has(recipe.name)) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'name'],
          message: `Duplicate recipe name "${recipe.name}"`,
        });
      }
      seen.add(recipe.name);
    });
  }),
  routines: z.array(manifestRoutineSchema).optional(),
  /** Recipe names that must never be seeded (removed by the owner). */
  deletedRecipes: z.array(z.string()).optional(),
});

export type KitchenManifest = z.infer<typeof kitchenManifestSchema>;
export type KitchenManifestRecipe = KitchenManifest['recipes'][number];

/** Validates parsed JSON and throws a readable error listing every problem. */
export function parseKitchenManifest(json: unknown): KitchenManifest {
  const result = kitchenManifestSchema.safeParse(json);
  if (!result.success) {
    throw new Error(
      `kitchen-manifest.json is invalid:\n${z.prettifyError(result.error)}`
    );
  }
  return result.data;
}

/**
 * Recipe columns the seed owns for a system recipe. Images and the HH Chefs Verified
 * flag are not in the manifest, so an update leaves what an admin set there.
 *
 * Phase tags and nutrient highlights: only explicit manifest values are stored. Empty
 * columns mean "infer when read" (resolveRecipeBioProfile); storing inferred nutrients
 * would make them look explicit and give treats phases they were never tagged with.
 */
export function toSystemRecipeFields(recipe: KitchenManifestRecipe) {
  return {
    name: recipe.name,
    description: recipe.description ?? null,
    videoUrl: recipe.videoUrl ?? null,
    prepTime: recipe.prepTime ?? null,
    cookTime: recipe.cookTime ?? null,
    servings: recipe.servings ?? null,
    category: recipe.category ?? null,
    tags: recipe.tags ?? [],
    difficulty: recipe.difficulty ?? null,
    cuisine: recipe.cuisine ?? null,
    dietaryTags: recipe.dietaryTags ?? [],
    leanRole: recipe.leanInfo?.leanRole ?? null,
    activeTime: recipe.leanInfo?.activeTime ?? null,
    passiveTime: recipe.leanInfo?.passiveTime ?? null,
    batchEfficiency: recipe.leanInfo?.batchEfficiency ?? null,
    yieldAmount: recipe.yield?.amount ?? null,
    yieldUnit: recipe.yield?.unit ?? null,
    phaseTags: recipe.phaseTags ?? [],
    nutrientHighlights: recipe.nutrientHighlights ?? [],
    isSystem: true,
    isSecret: recipe.isSecret ?? false,
    isPrivate: false,
    organizationId: null,
  };
}

export function toIngredientRows(recipe: KitchenManifestRecipe) {
  return recipe.ingredients.map((ingredient) => ({
    name: ingredient.name,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    notes: ingredient.notes ?? null,
  }));
}

export function toInstructionRows(recipe: KitchenManifestRecipe) {
  return recipe.instructions.map((instruction) => ({
    stepNumber: instruction.stepNumber,
    text: instruction.text,
  }));
}

export interface ExistingSystemRecipe {
  id: string;
  name: string;
  createdAt: Date;
  /** Meal plan items + meal plan template items that point at the recipe. */
  usage: number;
}

export interface SystemRecipeSyncPlan {
  create: KitchenManifestRecipe[];
  update: Array<{ id: string; recipe: KitchenManifestRecipe }>;
  /** Stale system recipes that nothing uses: safe to delete. */
  remove: string[];
  /** Stale system recipes still used by meal plans or templates: left in place. */
  keep: Array<{ id: string; name: string; usage: number }>;
  /** Manifest recipes listed in deletedRecipes. */
  skipped: string[];
}

/**
 * Matches system recipes to the manifest by name so that re-running the seed
 * updates rows in place (stable ids, meal plans keep working) instead of
 * deleting and recreating them. With duplicates of one name, the most used
 * (then oldest) row is kept as the match.
 */
export function planSystemRecipeSync(
  manifest: KitchenManifest,
  existing: ExistingSystemRecipe[]
): SystemRecipeSyncPlan {
  const deleted = new Set(manifest.deletedRecipes ?? []);
  const byName = new Map<string, ExistingSystemRecipe[]>();
  for (const row of [...existing].sort(
    (a, b) =>
      b.usage - a.usage ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id)
  )) {
    byName.set(row.name, [...(byName.get(row.name) ?? []), row]);
  }

  const plan: SystemRecipeSyncPlan = {
    create: [],
    update: [],
    remove: [],
    keep: [],
    skipped: [],
  };
  const matched = new Set<string>();

  for (const recipe of manifest.recipes) {
    if (deleted.has(recipe.name)) {
      plan.skipped.push(recipe.name);
      continue;
    }
    const match = byName.get(recipe.name)?.[0];
    if (match) {
      matched.add(match.id);
      plan.update.push({ id: match.id, recipe });
    } else {
      plan.create.push(recipe);
    }
  }

  for (const row of existing) {
    if (matched.has(row.id)) continue;
    if (row.usage > 0) {
      plan.keep.push({ id: row.id, name: row.name, usage: row.usage });
    } else {
      plan.remove.push(row.id);
    }
  }

  return plan;
}
