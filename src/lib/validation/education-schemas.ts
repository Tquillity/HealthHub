import { z } from 'zod';

export const GetEducationalResourcesSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  featured: z.coerce.boolean().optional(),
  difficulty: z.string().optional(),
});

export const ResourceIdSchema = z.string().min(1);
