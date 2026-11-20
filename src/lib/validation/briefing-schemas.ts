import { z } from 'zod';
import { DateOnlyStringSchema } from '@/lib/date-only';
import {
  BRIEFING_DETAILS,
  BRIEFING_FREQUENCIES,
  BRIEFING_SOURCES,
  SUGGESTION_KEYS,
  SUGGESTION_RATINGS,
} from '@/lib/briefing/types';

/** The day of the briefing the client shows (rendered in the profile timezone). */
export const BriefingDayInputSchema = z
  .object({ date: DateOnlyStringSchema })
  .strict();
export type BriefingDayInput = z.infer<typeof BriefingDayInputSchema>;

/** Only keys the engine can produce: anything else is rejected before it is encrypted. */
export const SuggestionKeySchema = z.enum(SUGGESTION_KEYS);

export const DismissSuggestionInputSchema = z
  .object({ date: DateOnlyStringSchema, key: SuggestionKeySchema })
  .strict();
export type DismissSuggestionInput = z.infer<
  typeof DismissSuggestionInputSchema
>;

export const RateSuggestionInputSchema = z
  .object({
    date: DateOnlyStringSchema,
    key: SuggestionKeySchema,
    /** null clears today's rating. */
    rating: z.enum(SUGGESTION_RATINGS).nullable(),
  })
  .strict();
export type RateSuggestionInput = z.infer<typeof RateSuggestionInputSchema>;

export const BriefingPreferencesInputSchema = z
  .object({
    frequency: z.enum(BRIEFING_FREQUENCIES).optional(),
    sources: z
      .array(z.enum(BRIEFING_SOURCES))
      .min(1, 'Choose at least one kind of data for your briefing')
      .max(BRIEFING_SOURCES.length * 2)
      .optional(),
    detail: z.enum(BRIEFING_DETAILS).optional(),
  })
  .strict();
export type BriefingPreferencesInput = z.infer<
  typeof BriefingPreferencesInputSchema
>;
