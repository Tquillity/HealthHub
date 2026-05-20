import { z } from 'zod';

export const UpdateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  energyLevel: z.enum(['low', 'medium', 'high']).optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  healthGoals: z.array(z.string()).optional(),
  timezone: z.string().optional(),
  mealPlanDuration: z.enum(['1week', '2weeks', '1month']).optional(),
  mealPlanStartDate: z.string().nullable().optional(),
  enableCycleTracking: z.boolean().optional(),
  cycleLength: z.number().int().min(20).max(45).optional(),
  lastPeriodDate: z.string().nullable().optional(),
  focusPreference: z.enum(['hormonal', 'workout', 'both']).optional(),
});
