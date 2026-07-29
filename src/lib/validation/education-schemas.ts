import { z } from 'zod';

export const GetEducationalResourcesSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  featured: z.coerce.boolean().optional(),
  difficulty: z.string().optional(),
});

export const ResourceIdSchema = z.string().min(1);

/**
 * Structured "TLDR" quick-facts for an educational resource.
 * Shown on /learn/[id]/tldr — short practical guidance only.
 */
export const LearnTldrSchema = z.object({
  /** One or two sentence bottom line */
  summary: z.string().optional(),
  /** When in the day / week / cycle to take or do it */
  whenToTake: z.string().optional(),
  /** Route and form (e.g. oral capsules, with food) */
  howToTake: z.string().optional(),
  /** Dose / serving / portion guidance */
  portioning: z.string().optional(),
  /** Things that pair well (foods, habits, co-supplements) */
  takeWith: z.array(z.string()).default([]),
  /** Interactions, combinations, or contexts to avoid */
  avoidWith: z.array(z.string()).default([]),
  /** Bullet takeaways */
  keyPoints: z.array(z.string()).default([]),
  /** Safety / who should pause or ask a clinician */
  cautions: z.array(z.string()).default([]),
  /** How long protocols typically run, or washout notes */
  duration: z.string().optional(),
  /** Free-form short notes that do not fit other fields */
  extraNotes: z.string().optional(),
});

export type LearnTldr = z.infer<typeof LearnTldrSchema>;

/** Parse unknown JSON (DB `tldr`) into a LearnTldr or null if empty/invalid. */
export function parseLearnTldr(value: unknown): LearnTldr | null {
  if (value == null) return null;
  const result = LearnTldrSchema.safeParse(value);
  if (!result.success) return null;
  const data = result.data;
  const hasContent =
    Boolean(data.summary?.trim()) ||
    Boolean(data.whenToTake?.trim()) ||
    Boolean(data.howToTake?.trim()) ||
    Boolean(data.portioning?.trim()) ||
    Boolean(data.duration?.trim()) ||
    Boolean(data.extraNotes?.trim()) ||
    data.takeWith.length > 0 ||
    data.avoidWith.length > 0 ||
    data.keyPoints.length > 0 ||
    data.cautions.length > 0;
  return hasContent ? data : null;
}
