import { z } from 'zod';
import { DateOnlyStringSchema } from '@/lib/date-only';

/**
 * Options for "Download Clinical Summary". Strict: unknown keys (such as a userId) are
 * rejected, the report is always for the signed-in user.
 */
export const ClinicalReportOptionsSchema = z
  .object({
    months: z.union([z.literal(3), z.literal(6), z.literal(12)]),
    includeName: z.boolean(),
    includeNotes: z.boolean(),
    includeBbt: z.boolean(),
    includeSymptoms: z.boolean(),
    /** Ignored unless vitals tracking is on in the profile. */
    includeVitals: z.boolean(),
    /** The viewer's calendar day; used only when within a day of the server's day. */
    today: DateOnlyStringSchema.optional(),
  })
  .strict();

export type ClinicalReportOptions = z.infer<typeof ClinicalReportOptionsSchema>;
