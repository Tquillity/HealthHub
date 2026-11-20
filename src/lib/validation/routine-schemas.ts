import { z } from 'zod';

export const ROUTINE_ENERGY_LEVELS = ['low', 'medium', 'high'] as const;
export const ROUTINE_CONTEXTS = ['morning', 'evening', 'anytime'] as const;
export const ROUTINE_DURATIONS = ['5min', '15min', '30min', '60min'] as const;
export const ROUTINE_DIFFICULTIES = [
  'beginner',
  'intermediate',
  'advanced',
] as const;

/** Upper bound for "max time available" in the lottery (one day). */
export const LOTTERY_MAX_TIME_MINUTES = 24 * 60;
export const LOTTERY_MAX_COUNT = 10;

export const RoutineIdSchema = z.string().min(1).max(100);

const shortText = z.string().max(200);
const longText = z.string().max(5000);
const imageUrl = z.string().url().max(2048).optional().or(z.literal(''));

export const CreateRoutineSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: longText.optional(),
  category: shortText.optional(),
  frequency: shortText.optional(),
  energyLevel: z.enum(ROUTINE_ENERGY_LEVELS).default('medium'),
  estimatedTime: z
    .number()
    .int()
    .positive()
    .max(LOTTERY_MAX_TIME_MINUTES)
    .default(15),
  // Rich metadata
  imageUrl,
  context: z.enum(ROUTINE_CONTEXTS).optional(),
  duration: z.enum(ROUTINE_DURATIONS).optional(),
  difficulty: z.enum(ROUTINE_DIFFICULTIES).optional(),
  equipment: z.array(shortText).max(50).default([]),
  tags: z.array(shortText).max(50).default([]),
  steps: z
    .array(
      z.object({
        step: z.number().int().positive(),
        title: shortText.optional(),
        description: z.string().min(1).max(5000),
        duration: z.number().int().positive().optional(),
        imageUrl,
      })
    )
    .max(100)
    .optional(),
  tips: z.array(z.string().max(1000)).max(50).default([]),
  contraindications: z.array(z.string().max(1000)).max(50).default([]),
});

export const UpdateRoutineSchema = CreateRoutineSchema.partial().extend({
  id: RoutineIdSchema,
});

/**
 * Lottery filters: a closed, whitelisted shape. Unknown keys are stripped and
 * every value is an enum or a bounded integer, so nothing raw reaches Prisma.
 */
export const LotteryFiltersSchema = z.object({
  energy: z.enum(ROUTINE_ENERGY_LEVELS).optional(),
  maxTime: z.number().int().min(1).max(LOTTERY_MAX_TIME_MINUTES).optional(),
  count: z.number().int().min(1).max(LOTTERY_MAX_COUNT).default(1),
  context: z.enum(ROUTINE_CONTEXTS).optional(),
  duration: z.enum(ROUTINE_DURATIONS).optional(),
  difficulty: z.enum(ROUTINE_DIFFICULTIES).optional(),
});

export type LotteryFilters = z.output<typeof LotteryFiltersSchema>;
