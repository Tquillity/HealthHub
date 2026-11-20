import { z } from 'zod';
import { DateOnlyStringSchema, dateOnlyToUtcDate } from '@/lib/date-only';

// UTC+14 is the furthest-ahead timezone, so a calendar day has started somewhere
// on Earth once its UTC midnight is at most 14 hours from now.
const MAX_TIMEZONE_AHEAD_MS = 14 * 60 * 60 * 1000;

/** `YYYY-MM-DD` that is not after the user's local today (whatever their timezone). */
export const PastDateOnlyStringSchema = DateOnlyStringSchema.refine(
  (value) =>
    dateOnlyToUtcDate(value).getTime() <= Date.now() + MAX_TIMEZONE_AHEAD_MS,
  { message: 'Date cannot be in the future' }
);

export const UpdateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  energyLevel: z.enum(['low', 'medium', 'high']).optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  healthGoals: z.array(z.string()).optional(),
  timezone: z.string().optional(),
  mealPlanDuration: z.enum(['1week', '2weeks', '1month']).optional(),
  // Date-only `YYYY-MM-DD`; the action stores it as UTC midnight.
  mealPlanStartDate: DateOnlyStringSchema.nullable().optional(),
  enableCycleTracking: z.boolean().optional(),
  cycleLength: z.number().int().min(20).max(45).optional(),
  lastPeriodDate: PastDateOnlyStringSchema.nullable().optional(),
  focusPreference: z.enum(['hormonal', 'workout', 'both']).optional(),
});
